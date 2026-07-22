-- Delete (operationally remove) any store or driver outside Ioannina.
-- Coverage: 18 km around city center — same as service_zones / geo-defaults.
-- Stores with order history cannot be hard-deleted (orders.store_id NO ACTION),
-- so they are permanently deactivated + suspended. Out-of-area GPS is wiped.

DO $$
DECLARE
  base_lat double precision := 39.6650;
  base_lng double precision := 20.8537;
  radius_km double precision := 18;
  trg_name text;
  store_ids uuid[];
  driver_ids uuid[];
BEGIN
  -- Bypass protect_store_active_status while we force-deactivate
  SELECT t.tgname INTO trg_name
  FROM pg_trigger t
  JOIN pg_class c ON c.oid = t.tgrelid
  JOIN pg_proc p ON p.oid = t.tgfoid
  WHERE c.relname = 'stores'
    AND c.relnamespace = 'public'::regnamespace
    AND p.proname = 'protect_store_active_status'
    AND NOT t.tgisinternal
  LIMIT 1;

  IF trg_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.stores DISABLE TRIGGER %I', trg_name);
  END IF;

  -- 1) Stores outside Ioannina (coords) OR known Athens test store
  SELECT coalesce(array_agg(id), '{}') INTO store_ids
  FROM public.stores
  WHERE
    name = 'Test Souvlaki Spot'
    OR (
      latitude IS NOT NULL AND longitude IS NOT NULL
      AND (
        2 * 6371 * asin(sqrt(
          power(sin(radians((latitude - base_lat) / 2)), 2)
          + cos(radians(base_lat)) * cos(radians(latitude))
            * power(sin(radians((longitude - base_lng) / 2)), 2)
        ))
      ) > radius_km
    )
    OR address ILIKE '%αθήν%'
    OR address ILIKE '%athens%'
    OR address ILIKE '%athen%';

  UPDATE public.stores
  SET
    is_active = false,
    suspension_reason = coalesce(nullif(suspension_reason, ''), 'Deleted: outside Ioannina service area'),
    suspended_at = coalesce(suspended_at, now()),
    updated_at = now()
  WHERE id = ANY (store_ids);

  IF trg_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.stores ENABLE TRIGGER %I', trg_name);
  END IF;

  -- 2) Drivers whose latest GPS is outside Ioannina, or named Test Driver with Athens coords
  SELECT coalesce(array_agg(DISTINCT d.driver_id), '{}') INTO driver_ids
  FROM (
    SELECT DISTINCT ON (dl.driver_id)
      dl.driver_id,
      dl.latitude,
      dl.longitude
    FROM public.driver_locations dl
    ORDER BY dl.driver_id, dl.updated_at DESC
  ) d
  WHERE (
    2 * 6371 * asin(sqrt(
      power(sin(radians((d.latitude - base_lat) / 2)), 2)
      + cos(radians(base_lat)) * cos(radians(d.latitude))
        * power(sin(radians((d.longitude - base_lng) / 2)), 2)
    ))
  ) > radius_km;

  -- Also include known Athens test driver by profile name
  SELECT coalesce(array_agg(p.user_id), driver_ids) INTO driver_ids
  FROM (
    SELECT unnest(driver_ids) AS user_id
    UNION
    SELECT user_id FROM public.profiles
    WHERE role = 'driver' AND full_name ILIKE 'Test Driver'
  ) p;

  -- Deactivate + suspend driver profiles
  UPDATE public.driver_profiles
  SET
    is_active = false,
    suspension_reason = coalesce(nullif(suspension_reason, ''), 'Deleted: outside Ioannina service area'),
    suspended_at = coalesce(suspended_at, now()),
    updated_at = now()
  WHERE user_id = ANY (driver_ids);

  -- End any open shift so they cannot stay “on duty”
  UPDATE public.driver_state
  SET
    shift_started_at = NULL,
    on_break = false,
    break_until = NULL,
    updated_at = now()
  WHERE driver_id = ANY (driver_ids);

  -- Wipe out-of-area GPS (and all locs for removed drivers)
  DELETE FROM public.driver_locations
  WHERE driver_id = ANY (driver_ids)
     OR (
       latitude IS NOT NULL AND longitude IS NOT NULL
       AND (
         2 * 6371 * asin(sqrt(
           power(sin(radians((latitude - base_lat) / 2)), 2)
           + cos(radians(base_lat)) * cos(radians(latitude))
             * power(sin(radians((longitude - base_lng) / 2)), 2)
         ))
       ) > radius_km
     );

  -- Drop push tokens so they stop getting offer spam
  DELETE FROM public.push_tokens
  WHERE user_id = ANY (driver_ids)
    AND app = 'driver';

  RAISE NOTICE 'ioannina cleanup stores=% drivers=%',
    coalesce(array_length(store_ids, 1), 0),
    coalesce(array_length(driver_ids, 1), 0);
END $$;
