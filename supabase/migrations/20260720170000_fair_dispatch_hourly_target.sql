/*
  Fair dispatch: prefer drivers closest to the store, while boosting
  drivers below a target hourly earn rate (default €10/h) so everyone
  has a path to that target.

  score (lower = better) =
      dist_km * dist_distance_weight * 10
    + active_orders * 2
    - same_store bonus
    - same_dropoff bonus
    - hourly_deficit * dist_fairness_weight * 1.2

  hourly_deficit = max(0, dist_target_hourly_eur - eur_per_hr)
  eur_per_hr uses rolling earnings since shift start (capped at 1h window).
*/

ALTER TABLE public.platform_settings
  ADD COLUMN IF NOT EXISTS dist_target_hourly_eur numeric NOT NULL DEFAULT 10;

UPDATE public.platform_settings
SET
  distribution_mode = 'fair_earnings',
  dist_distance_weight = 0.55,
  dist_fairness_weight = 0.35,
  dist_rating_weight = 0.10,
  dist_target_hourly_eur = 10
WHERE id = 1;

-- Keep older overloads from diverging: drop 5-arg and 6-arg, keep the 8-arg.
DROP FUNCTION IF EXISTS public.nearby_active_drivers(double precision, double precision, numeric, uuid[], integer);
DROP FUNCTION IF EXISTS public.nearby_active_drivers(double precision, double precision, numeric, uuid[], integer, uuid);

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
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  s RECORD;
  max_stack INT;
  near_km NUMERIC := 0.6;
  target_hourly NUMERIC;
  w_dist NUMERIC;
  w_fair NUMERIC;
BEGIN
  SELECT * INTO s FROM platform_settings WHERE id = 1;
  max_stack := GREATEST(1, COALESCE(s.max_stacked_orders, 1));
  target_hourly := GREATEST(0, COALESCE(s.dist_target_hourly_eur, 10));
  w_dist := COALESCE(s.dist_distance_weight, 0.55);
  w_fair := COALESCE(s.dist_fairness_weight, 0.35);

  RETURN QUERY
  WITH driver_pool AS (
    SELECT
      dp.user_id AS drv_id,
      COALESCE(dp.vehicle_type, 'motorcycle') AS v_type,
      dl.latitude AS lat,
      dl.longitude AS lng,
      (6371 * acos(
        LEAST(1.0, GREATEST(-1.0,
          cos(radians(_store_lat)) * cos(radians(dl.latitude)) *
          cos(radians(dl.longitude) - radians(_store_lng)) +
          sin(radians(_store_lat)) * sin(radians(dl.latitude))
        ))
      ))::NUMERIC AS dist_km,
      COALESCE(ds.on_break, false) AS on_brk,
      COALESCE(ds.shift_started_at, now() - INTERVAL '1 hour') AS shift_start,
      (
        SELECT COUNT(*)::INT FROM orders o
        WHERE o.driver_id = dp.user_id
          AND o.status IN ('accepted','preparing','ready','arrived','picked_up')
      ) AS active_cnt,
      (
        _store_id IS NOT NULL AND EXISTS (
          SELECT 1 FROM orders o
          WHERE o.driver_id = dp.user_id
            AND o.status IN ('accepted','preparing','ready','arrived')
            AND o.store_id = _store_id
        )
      ) AS same_store,
      (
        _dropoff_lat IS NOT NULL AND _dropoff_lng IS NOT NULL AND EXISTS (
          SELECT 1 FROM orders o
          WHERE o.driver_id = dp.user_id
            AND o.status IN ('accepted','preparing','ready','arrived','picked_up')
            AND o.delivery_latitude IS NOT NULL
            AND o.delivery_longitude IS NOT NULL
            AND (6371 * acos(
              LEAST(1.0, GREATEST(-1.0,
                cos(radians(_dropoff_lat)) * cos(radians(o.delivery_latitude)) *
                cos(radians(o.delivery_longitude) - radians(_dropoff_lng)) +
                sin(radians(_dropoff_lat)) * sin(radians(o.delivery_latitude))
              ))
            )) <= near_km
        )
      ) AS same_dropoff
    FROM driver_profiles dp
    JOIN driver_locations dl ON dl.driver_id = dp.user_id
    LEFT JOIN driver_state ds ON ds.driver_id = dp.user_id
    WHERE dp.is_active = true
      AND dp.suspended_at IS NULL
      AND dl.updated_at > now() - INTERVAL '15 minutes'
      AND NOT (dp.user_id = ANY(_exclude_drivers))
      AND NOT EXISTS (
        SELECT 1 FROM pending_offers po
        WHERE po.driver_id = dp.user_id AND po.status = 'pending'
      )
  ),
  with_earn AS (
    SELECT
      p.*,
      -- Hours on shift (min 9 min so brand-new drivers aren't treated as 0),
      -- capped at 1h for a rolling pace window.
      GREATEST(
        0.15::NUMERIC,
        LEAST(
          1.0::NUMERIC,
          (EXTRACT(EPOCH FROM (now() - p.shift_start)) / 3600.0)::NUMERIC
        )
      ) AS hours_worked,
      COALESCE((
        SELECT SUM(e.total)::NUMERIC
        FROM earnings e
        WHERE e.driver_id = p.drv_id
          AND e.created_at >= GREATEST(p.shift_start, now() - INTERVAL '1 hour')
      ), 0)::NUMERIC AS earn_window
    FROM driver_pool p
  ),
  scored AS (
    SELECT
      w.*,
      (w.earn_window / NULLIF(w.hours_worked, 0))::NUMERIC AS eur_per_hr,
      -- € short of the €/h pace for time worked (not inflated rate).
      -- Example: 0.5h online at €10/h target → need €5; if earned €2, deficit=3.
      GREATEST(
        0::NUMERIC,
        (target_hourly * w.hours_worked) - w.earn_window
      )::NUMERIC AS hourly_deficit
    FROM with_earn w
  )
  SELECT
    sc.drv_id,
    ROUND(sc.dist_km, 2),
    sc.v_type,
    ROUND(
      sc.dist_km * w_dist * 10
      + (sc.active_cnt * 2.0)
      - (CASE WHEN sc.same_store THEN 5.0 ELSE 0 END)
      - (CASE WHEN sc.same_dropoff THEN 4.0 ELSE 0 END)
      - (LEAST(sc.hourly_deficit, target_hourly) * w_fair * 1.2)
    , 3) AS score,
    sc.active_cnt,
    (sc.active_cnt > 0) AS is_stack
  FROM scored sc
  WHERE sc.on_brk = false
    AND sc.dist_km <= COALESCE(s.dist_search_radius_km, 5)
    AND sc.active_cnt < max_stack
    AND (sc.active_cnt = 0 OR sc.same_store OR sc.same_dropoff)
    AND (
      NOT COALESCE(s.dist_vehicle_rules_enabled, false)
      OR (
        (sc.v_type = 'bike' AND sc.dist_km <= COALESCE(s.dist_bike_max_km, 3))
        OR (sc.v_type = 'motorcycle' AND sc.dist_km <= COALESCE(s.dist_motorcycle_max_km, 8))
        OR (sc.v_type = 'car' AND _order_value >= COALESCE(s.dist_car_min_value, 25))
        OR sc.v_type NOT IN ('bike','motorcycle','car')
      )
    )
  ORDER BY score ASC, sc.dist_km ASC, sc.hourly_deficit DESC
  LIMIT _limit;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.nearby_active_drivers(
  double precision, double precision, numeric, uuid[], integer, uuid, double precision, double precision
) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.nearby_active_drivers(
  double precision, double precision, numeric, uuid[], integer, uuid, double precision, double precision
) FROM PUBLIC, anon;

-- Seed an active €10/h guarantee row for admin visibility (idempotent).
INSERT INTO public.driver_guarantees (label, min_per_hour, start_time, end_time, min_acceptance_pct, is_active)
SELECT 'Target €10/hour', 10, '00:00', '23:59', 0, true
WHERE NOT EXISTS (
  SELECT 1 FROM public.driver_guarantees
  WHERE label = 'Target €10/hour' AND is_active = true
);
