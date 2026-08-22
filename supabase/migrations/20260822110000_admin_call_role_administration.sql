-- Admin management for side-project call roles (N=store, K=driver).
-- Roles stay dormant ('standard') until an admin changes them in
-- Admin → Settings → "Call roles (N/K)".
-- All functions are SECURITY DEFINER but guarded to admins via user_roles,
-- so regular users can never self-assign N/K.

CREATE OR REPLACE FUNCTION public.admin_list_call_roles()
RETURNS TABLE(kind TEXT, id UUID, label TEXT, sublabel TEXT, call_role TEXT)
LANGUAGE sql SECURITY DEFINER SET search_path = public STABLE AS $fn$
  SELECT 'store'::text, s.id, s.name,
         COALESCE((SELECT p.full_name FROM public.profiles p WHERE p.user_id = s.owner_id LIMIT 1), ''),
         COALESCE(s.store_role, 'standard')
  FROM public.stores s
  UNION ALL
  SELECT 'driver', dp.user_id,
         COALESCE(p.full_name, '(χωρίς όνομα)'),
         COALESCE((SELECT u.email FROM auth.users u WHERE u.id = dp.user_id), ''),
         COALESCE(dp.call_role, 'standard')
  FROM public.driver_profiles dp
  LEFT JOIN public.profiles p ON p.user_id = dp.user_id;
$fn$;

CREATE OR REPLACE FUNCTION public.admin_set_store_call_role(p_store_id UUID, p_role TEXT)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $fn$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.user_roles r WHERE r.user_id = auth.uid() AND r.role = 'admin'
  ) THEN
    RAISE EXCEPTION 'Admins only';
  END IF;
  IF p_role NOT IN ('standard', 'N') THEN
    RAISE EXCEPTION 'Invalid store call role';
  END IF;
  UPDATE public.stores SET store_role = p_role WHERE stores.id = p_store_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Store not found';
  END IF;
END $fn$;

CREATE OR REPLACE FUNCTION public.admin_set_driver_call_role(p_user_id UUID, p_role TEXT)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $fn$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.user_roles r WHERE r.user_id = auth.uid() AND r.role = 'admin'
  ) THEN
    RAISE EXCEPTION 'Admins only';
  END IF;
  IF p_role NOT IN ('standard', 'K') THEN
    RAISE EXCEPTION 'Invalid driver call role';
  END IF;
  UPDATE public.driver_profiles SET call_role = p_role WHERE driver_profiles.user_id = p_user_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Driver not found';
  END IF;
END $fn$;

REVOKE EXECUTE ON FUNCTION public.admin_list_call_roles() FROM anon;
REVOKE EXECUTE ON FUNCTION public.admin_set_store_call_role(UUID, TEXT) FROM anon;
REVOKE EXECUTE ON FUNCTION public.admin_set_driver_call_role(UUID, TEXT) FROM anon;
