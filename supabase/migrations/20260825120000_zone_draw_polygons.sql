-- Drawn (polygon) delivery zones.
-- service_zones.area stores a GeoJSON Polygon: {"type":"Polygon","coordinates":[[[lng,lat],...]]}
-- Zones with a drawn area use point-in-polygon matching; legacy zones keep the circle check.

ALTER TABLE public.service_zones
  ADD COLUMN IF NOT EXISTS area jsonb;

CREATE OR REPLACE FUNCTION public.geojson_point_in_polygon(
  p_lat double precision,
  p_lng double precision,
  p_polygon jsonb
)
RETURNS boolean
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  ring jsonb;
  n int;
  i int;
  j int;
  vix double precision;
  viy double precision;
  vjx double precision;
  vjy double precision;
  tilt double precision;
  crossings int := 0;
BEGIN
  IF p_lat IS NULL OR p_lng IS NULL OR p_polygon IS NULL THEN
    RETURN false;
  END IF;
  ring := p_polygon->'coordinates'->0;
  IF ring IS NULL OR jsonb_typeof(ring) <> 'array' THEN
    RETURN false;
  END IF;
  n := jsonb_array_length(ring);
  IF n < 3 THEN
    RETURN false;
  END IF;
  -- Ray casting due east from the point; coordinates are [lng, lat].
  FOR i IN 0 .. n - 1 LOOP
    j := (i + 1) % n;
    vix := (ring -> i ->> 0)::double precision;
    viy := (ring -> i ->> 1)::double precision;
    vjx := (ring -> j ->> 0)::double precision;
    vjy := (ring -> j ->> 1)::double precision;
    IF (viy > p_lat) <> (vjy > p_lat) THEN
      tilt := (vjx - vix) * (p_lat - viy) / (vjy - viy) + vix;
      IF p_lng < tilt THEN
        crossings := crossings + 1;
      END IF;
    END IF;
  END LOOP;
  RETURN (crossings % 2) = 1;
END $$;

CREATE OR REPLACE FUNCTION public.is_point_in_any_zone(p_lat double precision, p_lng double precision)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  hit boolean;
BEGIN
  IF p_lat IS NULL OR p_lng IS NULL THEN RETURN true; END IF;
  -- if no zones defined yet, allow everything (avoid bricking the platform)
  IF NOT EXISTS (SELECT 1 FROM public.service_zones WHERE is_active) THEN
    RETURN true;
  END IF;
  SELECT EXISTS (
    SELECT 1 FROM public.service_zones z
    WHERE z.is_active
      AND (
        (z.area IS NOT NULL AND public.geojson_point_in_polygon(p_lat, p_lng, z.area))
        OR (
          z.area IS NULL
          AND 2 * 6371 * asin(sqrt(
            power(sin(radians((p_lat - z.center_latitude) / 2)), 2)
            + cos(radians(z.center_latitude)) * cos(radians(p_lat))
              * power(sin(radians((p_lng - z.center_longitude) / 2)), 2)
          )) <= z.radius_km
        )
      )
  ) INTO hit;
  RETURN hit;
END $$;
