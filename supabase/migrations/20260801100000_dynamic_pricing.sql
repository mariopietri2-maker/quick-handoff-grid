-- ════════════════════════════════════════════════════════════════════
-- DYNAMIC PRICING ENGINE for intelligent delivery fee optimization
-- ════════════════════════════════════════════════════════════════════
-- Real-time demand-based pricing multipliers based on:
-- - Active driver scarcity
-- - Order volume
-- - Time of day
-- - Weather conditions (placeholder)

CREATE TABLE IF NOT EXISTS public.demand_pricing_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  zone_id uuid REFERENCES public.demand_zones(id) ON DELETE CASCADE,
  pricing_multiplier numeric(3, 2) NOT NULL DEFAULT 1.0,  -- 0.90 to 1.50
  reason text NOT NULL CHECK (reason IN ('low_drivers', 'high_demand', 'peak_hour', 'weather', 'manual')),
  active boolean DEFAULT true,
  started_at timestamptz NOT NULL DEFAULT now(),
  ends_at timestamptz,
  created_by uuid,
  metadata jsonb DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_demand_pricing_zone_active ON public.demand_pricing_events(zone_id, active, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_demand_pricing_created ON public.demand_pricing_events(created_at DESC);

ALTER TABLE public.demand_pricing_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins manage dynamic pricing" ON public.demand_pricing_events;
CREATE POLICY "Admins manage dynamic pricing" 
  ON public.demand_pricing_events 
  FOR ALL 
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Customers view active pricing" ON public.demand_pricing_events;
CREATE POLICY "Customers view active pricing" 
  ON public.demand_pricing_events 
  FOR SELECT 
  USING (active AND (ends_at IS NULL OR ends_at > now()));

-- ────────────────────────────────────────────────────────────────────
-- Get active pricing multiplier for a zone
-- ────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.get_active_pricing_multiplier(
  p_zone_id uuid
)
RETURNS numeric
LANGUAGE plpgsql
STABLE
SET search_path = public
AS $$
DECLARE
  v_multiplier numeric := 1.0;
BEGIN
  SELECT COALESCE(pricing_multiplier, 1.0) INTO v_multiplier
  FROM public.demand_pricing_events
  WHERE zone_id = p_zone_id
    AND active = true
    AND (ends_at IS NULL OR ends_at > now())
  ORDER BY created_at DESC
  LIMIT 1;
  
  RETURN GREATEST(0.80, LEAST(1.50, COALESCE(v_multiplier, 1.0)));
END;
$$;

REVOKE ALL ON FUNCTION public.get_active_pricing_multiplier(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_active_pricing_multiplier(uuid) TO anon, authenticated;

-- ────────────────────────────────────────────────────────────────────
-- Automatically adjust pricing based on available drivers
-- Runs hourly via pg_cron
-- ────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.auto_adjust_pricing_by_driver_scarcity()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_zone RECORD;
  v_active_drivers int;
  v_pending_orders int;
  v_ratio numeric;
  v_multiplier numeric;
  v_existing_event RECORD;
BEGIN
  -- Loop through all zones
  FOR v_zone IN SELECT id FROM public.demand_zones WHERE is_active = true
  LOOP
    -- Count active drivers
    SELECT COUNT(*) INTO v_active_drivers
    FROM public.driver_profiles
    WHERE is_active = true
      AND zone_id = v_zone.id
      AND last_seen_online_at > now() - INTERVAL '15 minutes';

    -- Count pending/accepted orders (not yet in transit)
    SELECT COUNT(*) INTO v_pending_orders
    FROM public.orders
    WHERE status IN ('pending', 'accepted')
      AND store_id IN (
        SELECT id FROM public.stores 
        WHERE demand_zone_id = v_zone.id
      );

    -- Calculate ratio (orders per active driver)
    IF v_active_drivers > 0 THEN
      v_ratio := ROUND((v_pending_orders::numeric / v_active_drivers), 2);
    ELSE
      v_ratio := 999;  -- Critical shortage
    END IF;

    -- Determine pricing multiplier based on ratio
    IF v_ratio > 5 THEN
      v_multiplier := 1.50;  -- Critical shortage
    ELSIF v_ratio > 3 THEN
      v_multiplier := 1.35;  -- High demand
    ELSIF v_ratio > 1.5 THEN
      v_multiplier := 1.15;  -- Moderate demand
    ELSIF v_ratio < 0.5 THEN
      v_multiplier := 0.90;  -- Abundant supply
    ELSE
      v_multiplier := 1.0;   -- Balanced
    END IF;

    -- Check if we already have an active low_drivers event
    SELECT * INTO v_existing_event
    FROM public.demand_pricing_events
    WHERE zone_id = v_zone.id
      AND reason = 'low_drivers'
      AND active = true
      AND (ends_at IS NULL OR ends_at > now())
    LIMIT 1;

    -- Update or create pricing event
    IF v_existing_event IS NOT NULL THEN
      -- Deactivate old event
      UPDATE public.demand_pricing_events
      SET active = false, ends_at = now()
      WHERE id = v_existing_event.id;
    END IF;

    -- Create new event if multiplier != 1.0
    IF v_multiplier != 1.0 THEN
      INSERT INTO public.demand_pricing_events (
        zone_id,
        pricing_multiplier,
        reason,
        active,
        metadata
      ) VALUES (
        v_zone.id,
        v_multiplier,
        'low_drivers',
        true,
        jsonb_build_object(
          'active_drivers', v_active_drivers,
          'pending_orders', v_pending_orders,
          'ratio', v_ratio
        )
      );
    END IF;
  END LOOP;
END;
$$;

REVOKE ALL ON FUNCTION public.auto_adjust_pricing_by_driver_scarcity() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.auto_adjust_pricing_by_driver_scarcity() TO service_role;

-- Schedule hourly pricing adjustment
SELECT cron.schedule(
  'auto_adjust_pricing_by_driver_scarcity',
  '0 * * * *',  -- Every hour
  'SELECT public.auto_adjust_pricing_by_driver_scarcity();'
);

-- ────────────────────────────────────────────────────────────────────
-- Peak hour detection and surging
-- ────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.detect_and_surge_peak_hours()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_zone RECORD;
  v_hour int;
  v_orders_last_hour int;
  v_avg_orders int;
  v_multiplier numeric;
BEGIN
  v_hour := EXTRACT(HOUR FROM now() AT TIME ZONE 'Europe/Athens');
  
  -- Peak hours: 12-13 (lunch), 19-21 (dinner)
  IF v_hour NOT IN (12, 13, 19, 20) THEN
    RETURN;
  END IF;

  FOR v_zone IN SELECT id FROM public.demand_zones WHERE is_active = true
  LOOP
    -- Orders in last hour
    SELECT COUNT(*) INTO v_orders_last_hour
    FROM public.orders
    WHERE store_id IN (
      SELECT id FROM public.stores WHERE demand_zone_id = v_zone.id
    )
    AND created_at > now() - INTERVAL '1 hour';

    -- Average orders in this hour (historical: last 7 days)
    SELECT COUNT(*) / 7 INTO v_avg_orders
    FROM public.orders
    WHERE store_id IN (
      SELECT id FROM public.stores WHERE demand_zone_id = v_zone.id
    )
    AND EXTRACT(HOUR FROM created_at AT TIME ZONE 'Europe/Athens') = v_hour
    AND created_at > now() - INTERVAL '7 days';

    -- If current hour is 30%+ above average, surge
    IF v_orders_last_hour > COALESCE(v_avg_orders, 0) * 1.3 THEN
      v_multiplier := LEAST(1.50, 1.0 + (v_orders_last_hour::numeric / NULLIF(v_avg_orders, 0) - 1) * 0.3);
      
      INSERT INTO public.demand_pricing_events (
        zone_id,
        pricing_multiplier,
        reason,
        active,
        ends_at,
        metadata
      ) VALUES (
        v_zone.id,
        v_multiplier,
        'peak_hour',
        true,
        now() + INTERVAL '2 hours',
        jsonb_build_object(
          'hour', v_hour,
          'current_orders', v_orders_last_hour,
          'avg_orders', v_avg_orders
        )
      )
      ON CONFLICT DO NOTHING;
    END IF;
  END LOOP;
END;
$$;

REVOKE ALL ON FUNCTION public.detect_and_surge_peak_hours() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.detect_and_surge_peak_hours() TO service_role;

-- Run peak hour detection every 15 minutes during active hours
SELECT cron.schedule(
  'detect_and_surge_peak_hours',
  '*/15 11-22 * * *',  -- Every 15 min, 11am-10pm
  'SELECT public.detect_and_surge_peak_hours();'
);
