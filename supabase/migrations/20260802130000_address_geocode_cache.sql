-- Enhance cached_addresses for customer reuse + nearby reverse-geocode hits.
-- Goal: skip Mapbox autocomplete / reverse when another customer already
-- resolved the same (or ~40m nearby) address.

CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

CREATE INDEX IF NOT EXISTS idx_cached_addresses_geo
  ON public.cached_addresses (latitude, longitude);

CREATE INDEX IF NOT EXISTS idx_cached_addresses_address_lower
  ON public.cached_addresses (lower(address));


CREATE OR REPLACE FUNCTION public.normalize_address_query(p_q text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT lower(trim(regexp_replace(coalesce(p_q, ''), '\s+', ' ', 'g')));
$$;


CREATE OR REPLACE FUNCTION public.lookup_address_geocode(p_q text)
RETURNS TABLE (
  display_address text,
  latitude double precision,
  longitude double precision,
  usage_count integer
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_norm text := public.normalize_address_query(p_q);
BEGIN
  IF v_norm IS NULL OR length(v_norm) < 3 THEN
    RETURN;
  END IF;

  RETURN QUERY
  UPDATE public.cached_addresses c
     SET usage_count = coalesce(c.usage_count, 0) + 1,
         last_used_at = now()
   WHERE lower(trim(c.address)) = v_norm
      OR c.address_hash = encode(extensions.digest(v_norm, 'sha256'), 'hex')
  RETURNING c.address, c.latitude::double precision, c.longitude::double precision, c.usage_count;
END;
$$;


CREATE OR REPLACE FUNCTION public.lookup_address_geocode_nearby(
  p_lat double precision,
  p_lng double precision,
  p_radius_m double precision DEFAULT 40
)
RETURNS TABLE (
  display_address text,
  latitude double precision,
  longitude double precision,
  distance_m double precision
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_radius double precision := GREATEST(5, LEAST(coalesce(p_radius_m, 40), 120));
  v_dlat double precision := v_radius / 111320.0;
  v_dlng double precision := v_radius / (111320.0 * GREATEST(0.2, cos(radians(p_lat))));
  v_id uuid;
  v_addr text;
  v_lat double precision;
  v_lng double precision;
  v_dist double precision;
BEGIN
  IF p_lat IS NULL OR p_lng IS NULL THEN
    RETURN;
  END IF;

  SELECT c.id, c.address, c.latitude::double precision, c.longitude::double precision,
    (
      6371000 * acos(LEAST(1::float8, GREATEST(-1::float8,
        cos(radians(p_lat)) * cos(radians(c.latitude::float8))
        * cos(radians(c.longitude::float8) - radians(p_lng))
        + sin(radians(p_lat)) * sin(radians(c.latitude::float8))
      )))
    )::double precision
  INTO v_id, v_addr, v_lat, v_lng, v_dist
  FROM public.cached_addresses c
  WHERE c.latitude BETWEEN (p_lat - v_dlat) AND (p_lat + v_dlat)
    AND c.longitude BETWEEN (p_lng - v_dlng) AND (p_lng + v_dlng)
  ORDER BY 5 ASC
  LIMIT 1;

  IF v_id IS NULL OR v_dist IS NULL OR v_dist > v_radius THEN
    RETURN;
  END IF;

  UPDATE public.cached_addresses
     SET usage_count = coalesce(usage_count, 0) + 1,
         last_used_at = now()
   WHERE id = v_id;

  display_address := v_addr;
  latitude := v_lat;
  longitude := v_lng;
  distance_m := v_dist;
  RETURN NEXT;
END;
$$;


CREATE OR REPLACE FUNCTION public.suggest_cached_addresses(
  p_q text,
  p_limit integer DEFAULT 8
)
RETURNS TABLE (
  display_address text,
  latitude double precision,
  longitude double precision
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_norm text := public.normalize_address_query(p_q);
  v_limit integer := GREATEST(1, LEAST(coalesce(p_limit, 8), 12));
BEGIN
  IF v_norm IS NULL OR length(v_norm) < 3 THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT c.address, c.latitude::double precision, c.longitude::double precision
  FROM public.cached_addresses c
  WHERE lower(c.address) LIKE v_norm || '%'
     OR lower(c.address) LIKE '%' || v_norm || '%'
  ORDER BY
    CASE WHEN lower(trim(c.address)) = v_norm THEN 0
         WHEN lower(c.address) LIKE v_norm || '%' THEN 1
         ELSE 2 END,
    coalesce(c.usage_count, 0) DESC,
    c.last_used_at DESC NULLS LAST
  LIMIT v_limit;
END;
$$;


CREATE OR REPLACE FUNCTION public.remember_address_geocode(
  p_q text,
  p_display text,
  p_lat double precision,
  p_lng double precision,
  p_source text DEFAULT 'client'
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_norm text := public.normalize_address_query(p_q);
  v_display text := nullif(trim(coalesce(p_display, p_q)), '');
  v_hash text;
  v_id uuid;
BEGIN
  IF v_norm IS NULL OR length(v_norm) < 3 THEN
    RETURN NULL;
  END IF;
  IF p_lat IS NULL OR p_lng IS NULL THEN
    RETURN NULL;
  END IF;
  IF v_display IS NULL THEN
    v_display := trim(p_q);
  END IF;

  v_hash := encode(extensions.digest(v_norm, 'sha256'), 'hex');

  INSERT INTO public.cached_addresses AS c (
    address_hash, address, latitude, longitude, last_used_at, usage_count
  ) VALUES (
    v_hash, v_display, p_lat, p_lng, now(), 1
  )
  ON CONFLICT (address_hash) DO UPDATE
    SET address = EXCLUDED.address,
        latitude = EXCLUDED.latitude,
        longitude = EXCLUDED.longitude,
        usage_count = coalesce(c.usage_count, 0) + 1,
        last_used_at = now()
  RETURNING c.id INTO v_id;

  -- Also index formatted display when it differs from typed query.
  IF public.normalize_address_query(v_display) IS DISTINCT FROM v_norm THEN
    INSERT INTO public.cached_addresses AS c2 (
      address_hash, address, latitude, longitude, last_used_at, usage_count
    ) VALUES (
      encode(extensions.digest(public.normalize_address_query(v_display), 'sha256'), 'hex'),
      v_display, p_lat, p_lng, now(), 1
    )
    ON CONFLICT (address_hash) DO UPDATE
      SET latitude = EXCLUDED.latitude,
          longitude = EXCLUDED.longitude,
          usage_count = coalesce(c2.usage_count, 0) + 1,
          last_used_at = now();
  END IF;

  RETURN v_id;
END;
$$;


CREATE OR REPLACE FUNCTION public.remember_my_delivery_address(
  p_address text,
  p_lat double precision DEFAULT NULL,
  p_lng double precision DEFAULT NULL,
  p_label text DEFAULT 'Σπίτι'
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_id uuid;
  v_addr text := nullif(trim(coalesce(p_address, '')), '');
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  IF v_addr IS NULL OR length(v_addr) < 5 THEN
    RETURN NULL;
  END IF;

  SELECT id INTO v_id
  FROM public.saved_addresses
  WHERE user_id = v_user
    AND lower(trim(address)) = lower(v_addr)
  LIMIT 1;

  IF v_id IS NULL THEN
    UPDATE public.saved_addresses SET is_default = false WHERE user_id = v_user;
    INSERT INTO public.saved_addresses (user_id, label, address, latitude, longitude, is_default)
    VALUES (
      v_user,
      coalesce(nullif(trim(p_label), ''), 'Σπίτι'),
      v_addr, p_lat, p_lng, true
    )
    RETURNING id INTO v_id;
  ELSE
    UPDATE public.saved_addresses
       SET latitude = coalesce(p_lat, latitude),
           longitude = coalesce(p_lng, longitude),
           is_default = true,
           updated_at = now()
     WHERE id = v_id;
    UPDATE public.saved_addresses
       SET is_default = false
     WHERE user_id = v_user AND id <> v_id;
  END IF;

  IF p_lat IS NOT NULL AND p_lng IS NOT NULL THEN
    PERFORM public.remember_address_geocode(v_addr, v_addr, p_lat, p_lng, 'saved_address');
  END IF;

  RETURN v_id;
END;
$$;


GRANT EXECUTE ON FUNCTION public.normalize_address_query(text) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.lookup_address_geocode(text) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.lookup_address_geocode_nearby(double precision, double precision, double precision)
  TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.suggest_cached_addresses(text, integer) TO anon, authenticated, service_role;
-- Anon may write resolved pins so guests still grow the shared cache
-- (SECURITY DEFINER + length/coord checks; no PII beyond the typed address).
GRANT EXECUTE ON FUNCTION public.remember_address_geocode(text, text, double precision, double precision, text)
  TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.remember_my_delivery_address(text, double precision, double precision, text)
  TO authenticated;

-- Seed from personal saved addresses that already have coords.
INSERT INTO public.cached_addresses (address_hash, address, latitude, longitude, usage_count, last_used_at)
SELECT DISTINCT ON (encode(extensions.digest(public.normalize_address_query(sa.address), 'sha256'), 'hex'))
  encode(extensions.digest(public.normalize_address_query(sa.address), 'sha256'), 'hex'),
  sa.address,
  sa.latitude,
  sa.longitude,
  1,
  now()
FROM public.saved_addresses sa
WHERE sa.latitude IS NOT NULL
  AND sa.longitude IS NOT NULL
  AND length(trim(sa.address)) >= 5
ON CONFLICT (address_hash) DO NOTHING;
