-- Blend recent completed-delivery durations into dynamic ETA.
CREATE OR REPLACE FUNCTION public.get_dynamic_delivery_eta(p_prep_buffer integer DEFAULT 0)
RETURNS TABLE (eta_min integer, eta_max integer)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_base_min   integer;
  v_base_max   integer;
  v_hard_cap   integer;
  v_supply     integer;
  v_demand     integer;
  v_deficit    integer;
  v_extra      integer;
  v_buffer     integer;
  v_hist_avg   numeric;
  v_hist_count integer;
BEGIN
  SELECT ps.eta_min_minutes,
         ps.eta_max_minutes,
         ps.eta_max_cap_minutes
    INTO v_base_min, v_base_max, v_hard_cap
    FROM public.platform_settings ps
   WHERE ps.id = 1;

  v_base_min := COALESCE(v_base_min, 25);
  v_base_max := GREATEST(COALESCE(v_base_max, 35), v_base_min);
  v_hard_cap := GREATEST(COALESCE(v_hard_cap, 50), v_base_max);

  -- Supply: drivers on shift, not on break, location ping fresh (< 5 min)
  SELECT count(*)::integer INTO v_supply
    FROM public.driver_state ds
    JOIN public.driver_locations dl ON dl.driver_id = ds.driver_id
   WHERE ds.on_break = false
     AND ds.shift_started_at IS NOT NULL
     AND dl.updated_at > now() - interval '5 minutes';

  -- Demand: live orders right now
  SELECT count(*)::integer INTO v_demand
    FROM public.orders o
   WHERE o.status NOT IN ('delivered', 'cancelled');

  v_extra := 0;
  IF v_demand > 0 THEN
    v_deficit := v_demand - (v_supply * 2);
    IF v_deficit > 0 THEN
      v_extra := LEAST(v_hard_cap - v_base_max, CEIL(v_deficit * 2.5)::integer);
      v_extra := GREATEST(v_extra, 0);
    END IF;
  END IF;

  -- Historical median-ish avg of placed→delivered over last 7 days (sample)
  SELECT AVG(EXTRACT(EPOCH FROM (o.updated_at - o.created_at)) / 60.0)::numeric,
         COUNT(*)::integer
    INTO v_hist_avg, v_hist_count
    FROM public.orders o
   WHERE o.status = 'delivered'
     AND o.created_at > now() - interval '7 days'
     AND o.updated_at > o.created_at
     AND EXTRACT(EPOCH FROM (o.updated_at - o.created_at)) / 60.0 BETWEEN 10 AND 120;

  IF v_hist_count IS NOT NULL AND v_hist_count >= 8 AND v_hist_avg IS NOT NULL THEN
    -- Pull base toward observed average (60% history / 40% settings)
    v_base_min := GREATEST(10, ROUND(v_hist_avg * 0.85 * 0.6 + v_base_min * 0.4)::integer);
    v_base_max := GREATEST(v_base_min + 5, ROUND(v_hist_avg * 1.15 * 0.6 + v_base_max * 0.4)::integer);
  END IF;

  v_buffer := COALESCE(p_prep_buffer, 0);

  eta_min := LEAST(v_base_min + v_extra + v_buffer, v_hard_cap);
  eta_max := LEAST(GREATEST(v_base_max + v_extra + v_buffer, eta_min + 5), v_hard_cap);
  RETURN NEXT;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.get_dynamic_delivery_eta(integer) TO anon, authenticated, service_role;
