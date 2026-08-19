-- ROUTE DISTANCE CACHE for Mapbox cost optimization
-- Skips repeated Directions API calls for the same store -> delivery pair.
-- Mirrors the cached_addresses pattern (service-role RLS, SECURITY DEFINER RPCs,
-- weekly cleanup). Distances are a client-side preview hint only: place_order
-- still resolves/sanitizes distances server-side (resolve_delivery_distance_km),
-- so a tampered/rounded cache value cannot change the charged delivery fee.

CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

CREATE TABLE IF NOT EXISTS public.route_cache (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  route_key text UNIQUE NOT NULL,
  from_lat numeric(9, 6) NOT NULL,
  from_lng numeric(9, 6) NOT NULL,
  to_lat numeric(9, 6) NOT NULL,
  to_lng numeric(9, 6) NOT NULL,
  distance_km numeric(8, 2) NOT NULL,
  last_used_at timestamptz DEFAULT now(),
  usage_count int DEFAULT 1,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_route_cache_key ON public.route_cache(route_key);
CREATE INDEX IF NOT EXISTS idx_route_cache_last_used ON public.route_cache(last_used_at DESC);

ALTER TABLE public.route_cache ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role manages route cache" ON public.route_cache;
CREATE POLICY "Service role manages route cache"
  ON public.route_cache
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

DROP POLICY IF EXISTS "Public cannot access route cache" ON public.route_cache;
CREATE POLICY "Public cannot access route cache"
  ON public.route_cache
  FOR ALL
  USING (false)
  WITH CHECK (false);

-- Stable key from coordinates rounded to ~110m cells.
CREATE OR REPLACE FUNCTION public.route_cache_key(
  p_from_lat double precision, p_from_lng double precision,
  p_to_lat double precision, p_to_lng double precision
)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT format('%s,%s->%s,%s',
    round(p_from_lat::numeric, 3),
    round(p_from_lng::numeric, 3),
    round(p_to_lat::numeric, 3),
    round(p_to_lng::numeric, 3));
$$;

CREATE OR REPLACE FUNCTION public.lookup_route_distance(
  p_from_lat double precision, p_from_lng double precision,
  p_to_lat double precision, p_to_lng double precision
)
RETURNS TABLE (distance_km numeric)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_key text := public.route_cache_key(p_from_lat, p_from_lng, p_to_lat, p_to_lng);
  v_row public.route_cache%ROWTYPE;
BEGIN
  IF p_from_lat IS NULL OR p_from_lng IS NULL
     OR p_to_lat IS NULL OR p_to_lng IS NULL THEN
    RETURN;
  END IF;

  SELECT * INTO v_row
  FROM public.route_cache
  WHERE route_key = v_key;
  IF NOT FOUND THEN
    RETURN;
  END IF;

  UPDATE public.route_cache
     SET usage_count = coalesce(usage_count, 0) + 1,
         last_used_at = now()
   WHERE route_key = v_key;

  distance_km := v_row.distance_km;
  RETURN NEXT;
END;
$$;

CREATE OR REPLACE FUNCTION public.remember_route_distance(
  p_from_lat double precision, p_from_lng double precision,
  p_to_lat double precision, p_to_lng double precision,
  p_distance_km numeric
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_key text := public.route_cache_key(p_from_lat, p_from_lng, p_to_lat, p_to_lng);
  v_sane numeric := round(coalesce(p_distance_km, 0), 2);
  v_id uuid;
BEGIN
  IF v_sane < 0.05 OR v_sane > 500 THEN
    RETURN NULL;
  END IF;

  INSERT INTO public.route_cache AS c (
    route_key, from_lat, from_lng, to_lat, to_lng, distance_km, usage_count, last_used_at
  ) VALUES (
    v_key,
    round(p_from_lat::numeric, 3), round(p_from_lng::numeric, 3),
    round(p_to_lat::numeric, 3), round(p_to_lng::numeric, 3),
    v_sane, 1, now()
  )
  ON CONFLICT (route_key) DO UPDATE
    SET distance_km = EXCLUDED.distance_km,
        usage_count = coalesce(c.usage_count, 0) + 1,
        last_used_at = now()
  RETURNING c.id INTO v_id;

  RETURN v_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.route_cache_key(double precision, double precision, double precision, double precision)
  TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.lookup_route_distance(double precision, double precision, double precision, double precision)
  TO anon, authenticated, service_role;
-- Anon may write resolved distances so guests still grow the shared cache
-- (SECURITY DEFINER + sanity bounds; value is a preview hint only).
GRANT EXECUTE ON FUNCTION public.remember_route_distance(double precision, double precision, double precision, double precision, numeric)
  TO anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.cleanup_stale_route_cache()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.route_cache
  WHERE last_used_at < now() - INTERVAL '180 days';
END;
$$;

REVOKE ALL ON FUNCTION public.cleanup_stale_route_cache() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.cleanup_stale_route_cache() TO service_role;

SELECT cron.schedule(
  'cleanup_stale_route_cache',
  '0 2 * * 0',
  'SELECT public.cleanup_stale_route_cache();'
);