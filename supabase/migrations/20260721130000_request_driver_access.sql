/*
  Allow self-serve driver signup from the Fresh Driver app.

  New accounts always start as profiles.role = customer (handle_new_user).
  The driver APK then called /order → MobileAppGate → /driver → ProtectedRoute
  → / → /driver forever (blank WebView).

  request_driver_access():
    - customer → driver (profiles + user_roles)
    - ensures driver_profiles with is_active = false (admin must activate)
*/

CREATE OR REPLACE FUNCTION public.protect_profile_role()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF OLD.role IS DISTINCT FROM NEW.role THEN
    -- Local bypass for request_driver_access() only (transaction-scoped).
    IF current_setting('app.bypass_role_protect', true) = '1' THEN
      RETURN NEW;
    END IF;
    IF NOT public.has_role(auth.uid(), 'admin') THEN
      RAISE EXCEPTION 'Only admins can change profile role';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.request_driver_access()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
  cur_role text;
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT role INTO cur_role FROM public.profiles WHERE user_id = uid;
  IF cur_role IS NULL THEN
    RAISE EXCEPTION 'Profile not found';
  END IF;

  -- Already a driver / monitor — ensure profile row exists, stay pending if inactive.
  IF cur_role IN ('driver', 'm') THEN
    INSERT INTO public.driver_profiles (user_id, is_active)
    VALUES (uid, false)
    ON CONFLICT (user_id) DO NOTHING;
    INSERT INTO public.user_roles (user_id, role)
    VALUES (uid, 'driver')
    ON CONFLICT (user_id, role) DO NOTHING;
    RETURN jsonb_build_object('ok', true, 'role', cur_role, 'created', false);
  END IF;

  -- Do not silently demote store / support / admin.
  IF cur_role IS DISTINCT FROM 'customer' THEN
    RAISE EXCEPTION 'Only customer accounts can request driver access (current: %)', cur_role;
  END IF;

  PERFORM set_config('app.bypass_role_protect', '1', true);

  UPDATE public.profiles
  SET role = 'driver'
  WHERE user_id = uid;

  INSERT INTO public.user_roles (user_id, role)
  VALUES (uid, 'driver')
  ON CONFLICT (user_id, role) DO NOTHING;

  INSERT INTO public.driver_profiles (user_id, is_active)
  VALUES (uid, false)
  ON CONFLICT (user_id) DO NOTHING;

  RETURN jsonb_build_object('ok', true, 'role', 'driver', 'created', true);
END;
$$;

REVOKE ALL ON FUNCTION public.request_driver_access() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.request_driver_access() TO authenticated;
