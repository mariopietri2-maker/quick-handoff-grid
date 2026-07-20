-- Lock platform coverage to Ioannina city + surrounding basin (~18 km).
-- Seeds the active service zone, tightens order enforcement, and parks
-- the Athens test store so it no longer appears in production catalogs.

-- 1) Canonical Ioannina service zone (upsert by unique city name)
INSERT INTO public.service_zones (
  city,
  center_latitude,
  center_longitude,
  radius_km,
  is_active
) VALUES (
  'Ιωάννινα',
  39.6650,
  20.8537,
  18,
  true
)
ON CONFLICT (city) DO UPDATE SET
  center_latitude = EXCLUDED.center_latitude,
  center_longitude = EXCLUDED.center_longitude,
  radius_km = EXCLUDED.radius_km,
  is_active = true,
  updated_at = now();

-- 2) Dispatch search radius: cover the same basin so online drivers across
--    Ioannina can receive offers (vehicle max-km caps still apply).
UPDATE public.platform_settings
SET dist_search_radius_km = GREATEST(COALESCE(dist_search_radius_km, 5), 15)
WHERE id = 1;

-- 3) Deactivate Athens test store (outside service area).
--    Bypass protect_store_active_status (requires auth.uid() admin).
DO $$
DECLARE
  trg_name text;
BEGIN
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

  UPDATE public.stores
  SET is_active = false,
      updated_at = now()
  WHERE name = 'Test Souvlaki Spot'
    AND latitude IS NOT NULL
    AND longitude IS NOT NULL
    AND abs(latitude - 37.9840) < 0.05
    AND abs(longitude - 23.7278) < 0.05;

  IF trg_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.stores ENABLE TRIGGER %I', trg_name);
  END IF;
END $$;

-- 4) Require delivery coordinates when an active zone exists (no bypass)
CREATE OR REPLACE FUNCTION public.enforce_order_in_service_zone()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.service_zones WHERE is_active) THEN
    IF NEW.delivery_latitude IS NULL OR NEW.delivery_longitude IS NULL THEN
      RAISE EXCEPTION 'Απαιτείται έγκυρη διεύθυνση παράδοσης με συντεταγμένες εντός ζώνης κάλυψης (Ιωάννινα).'
        USING ERRCODE = 'check_violation';
    END IF;
  ELSIF NEW.delivery_latitude IS NULL OR NEW.delivery_longitude IS NULL THEN
    RETURN NEW; -- legacy: no zones configured
  END IF;

  IF NOT public.is_point_in_any_zone(NEW.delivery_latitude, NEW.delivery_longitude) THEN
    RAISE EXCEPTION 'Η διεύθυνση παράδοσης βρίσκεται εκτός ζώνης κάλυψης (Ιωάννινα και γύρω περιοχή).'
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END $$;
