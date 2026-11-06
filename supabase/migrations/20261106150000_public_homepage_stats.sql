-- Public homepage counters. Aggregates only — no customer or driver details.
CREATE OR REPLACE FUNCTION public.get_homepage_stats()
RETURNS TABLE (
  stores bigint,
  drivers bigint,
  orders bigint,
  rating numeric
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    (SELECT count(*) FROM public.stores WHERE COALESCE(is_active, false) AND suspended_at IS NULL),
    (SELECT count(*) FROM public.driver_profiles),
    (SELECT count(*) FROM public.orders),
    COALESCE((SELECT round(avg(rating)::numeric, 1) FROM public.reviews), 0);
$$;

REVOKE ALL ON FUNCTION public.get_homepage_stats() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_homepage_stats() TO anon, authenticated, service_role;
