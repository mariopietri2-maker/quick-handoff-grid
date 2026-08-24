-- =============================================================================
-- One-at-a-time driver flow («μία-μία»)
-- -----------------------------------------------------------------------------
-- Driver UX contract being enforced here:
--   · A driver NEVER receives a new offer while any of his orders is still
--     before pickup (accepted/preparing/ready/arrived).
--   · Once ALL his remaining work is picked up, he may receive exactly ONE
--     second order — only from the SAME store, and only while demand
--     outstrips supply (driver_demand_pressure).
--   · The second order always pays HALF of its own priced driver_payout.
--     The first order keeps its priced payout untouched.
--   · Every claimed order gets a 4-digit pickup_code shown at the counter.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1) Pickup code on orders (shown to the driver at the store counter)
-- ---------------------------------------------------------------------------
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS pickup_code text;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'orders_pickup_code_format'
  ) THEN
    ALTER TABLE public.orders
      ADD CONSTRAINT orders_pickup_code_format
      CHECK (pickup_code IS NULL OR pickup_code ~ '^[0-9]{4}$');
  END IF;
END $$;

COMMENT ON COLUMN public.orders.pickup_code IS
  '4-digit code the driver shows at the counter to confirm physical pickup';

CREATE INDEX IF NOT EXISTS idx_orders_pickup_code ON public.orders (pickup_code)
  WHERE pickup_code IS NOT NULL;

-- ---------------------------------------------------------------------------
-- 2) Settings: re-enable stacking with a hard cap of 2 (first + second)
-- ---------------------------------------------------------------------------
UPDATE public.platform_settings
   SET stacking_enabled = true,
       max_stacked_orders = 2
 WHERE id = 1;

-- ---------------------------------------------------------------------------
-- 3) Demand pressure: unassigned open orders exceed idle on-shift drivers.
--    "Open" excludes orders that already have a live pending offer (supply is
--    already en route to them). "Idle" = on-shift, not on break, no active work.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.driver_demand_pressure()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $fn$
  SELECT (
    SELECT COUNT(*)
    FROM public.orders o
    WHERE o.driver_id IS NULL
      AND o.status IN ('placed','accepted','preparing','ready')
      AND NOT EXISTS (
        SELECT 1 FROM public.pending_offers po
        WHERE po.order_id = o.id
          AND po.status = 'pending'
          AND po.expires_at > now()
      )
  ) > (
    SELECT COUNT(*)
    FROM public.driver_profiles dp
    JOIN public.driver_state ds ON ds.driver_id = dp.user_id
    WHERE dp.is_active = true
      AND dp.suspended_at IS NULL
      AND COALESCE(dp.call_role, 'standard') <> 'K'
      AND ds.shift_started_at IS NOT NULL
      AND COALESCE(ds.on_break, false) = false
      AND COALESCE(ds.shift_cash_balance, 0) < GREATEST(0::numeric, COALESCE(
            (SELECT ps.max_cash_cap FROM public.platform_settings ps WHERE ps.id = 1), 200))
      AND NOT EXISTS (
        SELECT 1 FROM public.orders o
        WHERE o.driver_id = dp.user_id
          AND o.status IN ('accepted','preparing','ready','arrived','picked_up')
      )
  );
$fn$;

REVOKE ALL ON FUNCTION public.driver_demand_pressure() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.driver_demand_pressure() TO service_role, authenticated;

-- ---------------------------------------------------------------------------
-- 4) nearby_active_drivers — one-at-a-time candidate rules.
--    Based on 20260822140000, with:
--      a) drivers holding ANY pre-pickup order are removed from the pool
--         entirely (never interrupt a pickup run with new offers);
--      b) stacking candidates must match the SAME STORE (same_dropoff no
--         longer qualifies on its own);
--      c) stacking additionally requires driver_demand_pressure().
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.nearby_active_drivers(
  _store_lat double precision,
  _store_lng double precision,
  _order_value numeric DEFAULT 0,
  _exclude_drivers uuid[] DEFAULT ARRAY[]::uuid[],
  _limit integer DEFAULT 10,
  _store_id uuid DEFAULT NULL::uuid,
  _dropoff_lat double precision DEFAULT NULL::double precision,
  _dropoff_lng double precision DEFAULT NULL::double precision
)
RETURNS TABLE(driver_id uuid, distance_km numeric, vehicle_type text, score numeric, active_orders integer, is_stack boolean)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $fn$
DECLARE
  s RECORD;
  max_stack INT;
  near_km NUMERIC := 0.6;
  gps_fresh INTERVAL := INTERVAL '10 minutes';
  cash_cap NUMERIC;
  target_h NUMERIC;
  w_dist NUMERIC;
  w_fair NUMERIC;
BEGIN
  SELECT * INTO s FROM platform_settings WHERE id = 1;
  max_stack := GREATEST(1, COALESCE(s.max_stacked_orders, 2));
  cash_cap := GREATEST(0::numeric, COALESCE(s.max_cash_cap, 200));
  target_h := GREATEST(1::numeric, COALESCE(s.target_hourly_eur, 10));
  w_dist := COALESCE(s.dist_distance_weight, 0.55);
  w_fair := COALESCE(s.dist_fairness_weight, 0.35);

  RETURN QUERY
  WITH driver_pool AS (
    SELECT
      dp.user_id AS drv_id,
      COALESCE(dp.vehicle_type, 'motorcycle') AS v_type,
      dl.latitude AS lat,
      dl.longitude AS lng,
      dl.updated_at AS loc_at,
      (6371 * acos(
        LEAST(1.0, GREATEST(-1.0,
          cos(radians(_store_lat)) * cos(radians(dl.latitude)) *
          cos(radians(dl.longitude) - radians(_store_lng)) +
          sin(radians(_store_lat)) * sin(radians(dl.latitude))
        ))
      ))::NUMERIC AS dist_km,
      COALESCE(ds.on_break, false) AS on_brk,
      ds.shift_started_at AS shift_at,
      COALESCE(ds.shift_cash_balance, 0)::NUMERIC AS cash_bal,
      (
        SELECT COUNT(*)::INT FROM orders o
        WHERE o.driver_id = dp.user_id
          AND o.status IN ('accepted','preparing','ready','arrived','picked_up')
      ) AS active_cnt,
      (
        -- One-at-a-time: a driver mid-pickup-run is never a candidate.
        NOT EXISTS (
          SELECT 1 FROM orders op
          WHERE op.driver_id = dp.user_id
            AND op.status IN ('accepted','preparing','ready','arrived')
        )
      ) AS pickup_done,
      (
        SELECT COALESCE(SUM(o.driver_payout), 0)::NUMERIC
        FROM orders o
        WHERE o.driver_id = dp.user_id
          AND o.status = 'delivered'
          AND o.updated_at >= date_trunc('day', now())
      ) AS earned_today,
      (
        _store_id IS NOT NULL AND EXISTS (
          SELECT 1 FROM orders o
          WHERE o.driver_id = dp.user_id
            AND o.status IN ('picked_up')
            AND o.store_id = _store_id
        )
      ) AS same_store
    FROM driver_profiles dp
    JOIN driver_locations dl ON dl.driver_id = dp.user_id
    LEFT JOIN driver_state ds ON ds.driver_id = dp.user_id
    WHERE dp.is_active = true
      AND dp.suspended_at IS NULL
      AND COALESCE(dp.call_role, 'standard') <> 'K'
      AND ds.shift_started_at IS NOT NULL
      AND dl.updated_at > now() - gps_fresh
      AND COALESCE(ds.shift_cash_balance, 0) < cash_cap
      AND NOT (dp.user_id = ANY(_exclude_drivers))
      AND NOT EXISTS (
        SELECT 1 FROM pending_offers po
        WHERE po.driver_id = dp.user_id AND po.status = 'pending'
      )
  ),
  scored AS (
    SELECT
      dp.*,
      GREATEST(
        0.25::numeric,
        LEAST(
          12::numeric,
          EXTRACT(EPOCH FROM (now() - COALESCE(dp.shift_at, dp.loc_at))) / 3600.0
        )
      ) AS hours_worked
    FROM driver_pool dp
  )
  SELECT
    sc.drv_id,
    ROUND(sc.dist_km, 2),
    sc.v_type,
    ROUND(
      (sc.dist_km * w_dist * 10)
      + (
          CASE
            WHEN (sc.earned_today / sc.hours_worked) < target_h
              THEN -w_fair * LEAST(1::numeric, (target_h - (sc.earned_today / sc.hours_worked)) / target_h) * 10
            ELSE w_fair * LEAST(1::numeric, ((sc.earned_today / sc.hours_worked) - target_h) / target_h) * 3
          END
        )
      + (sc.active_cnt * 1.5)
      - (CASE WHEN sc.same_store THEN 5.0 ELSE 0 END)
    , 3) AS score,
    sc.active_cnt,
    (sc.active_cnt > 0) AS is_stack
  FROM scored sc
  WHERE sc.on_brk = false
    AND sc.dist_km <= COALESCE(s.dist_search_radius_km, 15)
    AND sc.active_cnt < CASE WHEN COALESCE(s.stacking_enabled, true) THEN max_stack ELSE 1 END
    AND sc.pickup_done
    AND (
      sc.active_cnt = 0
      OR (
        COALESCE(s.stacking_enabled, true)
        AND sc.same_store
        AND public.driver_demand_pressure()
      )
    )
    AND (
      NOT COALESCE(s.dist_vehicle_rules_enabled, false)
      OR (
        (sc.v_type = 'bike' AND sc.dist_km <= COALESCE(s.dist_bike_max_km, 3))
        OR (sc.v_type = 'motorcycle' AND sc.dist_km <= COALESCE(s.dist_motorcycle_max_km, 8))
        OR (sc.v_type = 'car' AND _order_value >= COALESCE(s.dist_car_min_value, 25))
        OR sc.v_type NOT IN ('bike','motorcycle','car')
      )
    )
  ORDER BY score ASC, sc.dist_km ASC
  LIMIT _limit;
END;
$fn$;

-- Restore grants matching the previous state (20260720110000 hardening).
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT p.oid::regprocedure::text AS sig
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'nearby_active_drivers'
  LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon', r.sig);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated, service_role', r.sig);
  END LOOP;
END $$;

-- ---------------------------------------------------------------------------
-- 5) driver_claim_order — manual-mode parity with accept-offer:
--      same one-at-a-time gates, second order pays half of its own payout,
--      every claim stamps a pickup code. Admins keep bypass rights.
--    Return type changes void → text (the pickup code) for caller feedback.
-- ---------------------------------------------------------------------------
-- Return type changes are not allowed by CREATE OR REPLACE — drop first.
DROP FUNCTION IF EXISTS public.driver_claim_order(uuid);

CREATE OR REPLACE FUNCTION public.driver_claim_order(p_order_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_max int;
  v_pre int;
  v_post int;
  v_store uuid;
  v_existing_payout numeric;
  v_admin boolean;
  v_second boolean;
  v_claimed uuid;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF NOT public.is_driver_like(v_uid) THEN
    RAISE EXCEPTION 'Driver only';
  END IF;

  v_admin := public.has_role(v_uid, 'admin'::app_role);

  SELECT store_id, driver_payout INTO v_store, v_existing_payout
  FROM public.orders WHERE id = p_order_id FOR UPDATE;
  IF v_store IS NULL THEN RAISE EXCEPTION 'Order not found'; END IF;

  SELECT GREATEST(1, COALESCE(max_stacked_orders, 2)) INTO v_max
  FROM public.platform_settings WHERE id = 1;

  SELECT
    COUNT(*) FILTER (WHERE status IN ('accepted','preparing','ready','arrived')),
    COUNT(*) FILTER (WHERE status = 'picked_up')
  INTO v_pre, v_post
  FROM public.orders
  WHERE driver_id = v_uid
    AND status IN ('accepted','preparing','ready','arrived','picked_up');

  IF v_pre > 0 AND NOT v_admin THEN
    RAISE EXCEPTION 'Complete your current pickup first';
  END IF;

  IF v_pre + v_post >= v_max AND NOT v_admin THEN
    RAISE EXCEPTION 'Driver at capacity';
  END IF;

  v_second := v_post > 0;
  IF v_second AND NOT v_admin THEN
    IF NOT public.driver_demand_pressure() THEN
      RAISE EXCEPTION 'Second order requires increased demand';
    END IF;
    IF EXISTS (
      SELECT 1 FROM public.orders
      WHERE driver_id = v_uid
        AND status = 'picked_up'
        AND store_id <> v_store
    ) THEN
      RAISE EXCEPTION 'Second order must be from the same store';
    END IF;
  END IF;

  UPDATE public.orders
     SET driver_id = v_uid,
         status = CASE WHEN status = 'placed' THEN 'accepted'::order_status ELSE status END,
         driver_payout = CASE
           WHEN v_second AND COALESCE(v_existing_payout, 0) > 0
             THEN ROUND(v_existing_payout * 0.5, 2)
           ELSE driver_payout
         END,
         pickup_code = LPAD((floor(random() * 10000))::int::text, 4, '0'),
         updated_at = now()
   WHERE id = p_order_id
     AND (driver_id IS NULL OR v_admin)
   RETURNING id INTO v_claimed;

  IF v_claimed IS NULL THEN
    RAISE EXCEPTION 'Order already taken';
  END IF;

  RETURN (SELECT pickup_code FROM public.orders WHERE id = v_claimed);
END;
$$;

REVOKE ALL ON FUNCTION public.driver_claim_order(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.driver_claim_order(uuid) TO authenticated;
