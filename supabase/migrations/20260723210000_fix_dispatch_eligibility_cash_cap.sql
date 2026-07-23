/*
  Align auto-dispatch eligibility with driver "online" + capacity rules:
  - Keep presence gate: on-shift + GPS fresher than 3 minutes
  - Exclude cash-capped drivers (UI already hid their offers; SQL did not,
    so they could hold a pending offer they never see and block new waves)
*/

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
  gps_fresh INTERVAL := INTERVAL '3 minutes';
  cash_cap NUMERIC;
  target_h NUMERIC;
  w_dist NUMERIC;
  w_fair NUMERIC;
BEGIN
  SELECT * INTO s FROM platform_settings WHERE id = 1;
  max_stack := GREATEST(1, COALESCE(s.max_stacked_orders, 1));
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
      - (CASE WHEN sc.same_dropoff THEN 4.0 ELSE 0 END)
    , 3) AS score,
    sc.active_cnt,
    (sc.active_cnt > 0) AS is_stack
  FROM scored sc
  WHERE sc.on_brk = false
    AND sc.dist_km <= COALESCE(s.dist_search_radius_km, 15)
    AND sc.active_cnt < CASE WHEN COALESCE(s.stacking_enabled, true) THEN max_stack ELSE 1 END
    AND (
      sc.active_cnt = 0
      OR (
        COALESCE(s.stacking_enabled, true)
        AND (sc.same_store OR sc.same_dropoff)
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
$function$;

REVOKE EXECUTE ON FUNCTION public.nearby_active_drivers(
  double precision, double precision, numeric, uuid[], integer, uuid, double precision, double precision
) FROM anon, authenticated, PUBLIC;
GRANT EXECUTE ON FUNCTION public.nearby_active_drivers(
  double precision, double precision, numeric, uuid[], integer, uuid, double precision, double precision
) TO service_role;
