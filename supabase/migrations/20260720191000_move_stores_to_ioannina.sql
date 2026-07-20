-- Move every store outside Ioannina city into the city basin.
-- Active Ioannina stores are left as-is; outliers (e.g. Athens test store)
-- get relocated to distinct spots around the city center.

DO $$
DECLARE
  trg_name text;
  r record;
  i int := 0;
  -- Ioannina city center
  base_lat double precision := 39.6650;
  base_lng double precision := 20.8537;
  -- ring offsets (~150–350 m) so relocated stores don't stack
  new_lat double precision;
  new_lng double precision;
  angle double precision;
  radius_deg double precision;
BEGIN
  -- Bypass protect_store_active_status when re-enabling relocated stores
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

  FOR r IN
    SELECT id, name, address, latitude, longitude, is_active
    FROM public.stores
    WHERE latitude IS NOT NULL
      AND longitude IS NOT NULL
      AND (
        2 * 6371 * asin(sqrt(
          power(sin(radians((latitude - base_lat) / 2)), 2)
          + cos(radians(base_lat)) * cos(radians(latitude))
            * power(sin(radians((longitude - base_lng) / 2)), 2)
        ))
      ) > 5  -- outside Ioannina city (~5 km)
  LOOP
    angle := radians((i * 137.5)::double precision);
    radius_deg := 0.0018 + (i % 4) * 0.0006; -- ~200–500 m
    new_lat := base_lat + sin(angle) * radius_deg;
    new_lng := base_lng + cos(angle) * radius_deg;

    UPDATE public.stores
    SET
      latitude = new_lat,
      longitude = new_lng,
      address = CASE
        WHEN address ILIKE '%αθήν%' OR address ILIKE '%athen%' OR address ILIKE '%athens%'
          OR name = 'Test Souvlaki Spot'
          THEN 'Πλατεία Πύρρου ' || (3 + i)::text || ', Ιωάννινα'
        WHEN address ILIKE '%ιωάννιν%' OR address ILIKE '%ιωαννιν%' OR address ILIKE '%ioannina%'
          THEN address
        ELSE coalesce(nullif(trim(address), ''), name) || ', Ιωάννινα'
      END,
      is_active = true,
      updated_at = now()
    WHERE id = r.id;

    i := i + 1;
  END LOOP;

  -- Also pin any stores missing coordinates into the city
  FOR r IN
    SELECT id FROM public.stores
    WHERE latitude IS NULL OR longitude IS NULL
  LOOP
    angle := radians((i * 137.5)::double precision);
    radius_deg := 0.0018 + (i % 4) * 0.0006;
    UPDATE public.stores
    SET
      latitude = base_lat + sin(angle) * radius_deg,
      longitude = base_lng + cos(angle) * radius_deg,
      address = CASE
        WHEN address IS NULL OR trim(address) = '' THEN 'Ιωάννινα'
        WHEN address ILIKE '%ιωάννιν%' OR address ILIKE '%ioannina%' THEN address
        ELSE address || ', Ιωάννινα'
      END,
      updated_at = now()
    WHERE id = r.id;
    i := i + 1;
  END LOOP;

  IF trg_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.stores ENABLE TRIGGER %I', trg_name);
  END IF;
END $$;
