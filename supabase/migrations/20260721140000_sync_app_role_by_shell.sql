/*
  sync_app_role(p_app):
    - 'customer' → profiles.role = customer (keeps driver_profiles row if any)
    - 'driver'   → profiles.role = driver + user_roles + driver_profiles(is_active=false)

  Called automatically from the Fresh Meal / Fresh Meal Driver shells on signup & login.
  Does not touch admin / support / store accounts.
*/

CREATE OR REPLACE FUNCTION public.protect_profile_role()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF OLD.role IS DISTINCT FROM NEW.role THEN
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

CREATE OR REPLACE FUNCTION public.sync_app_role(p_app text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
  cur_role text;
  app text := lower(trim(p_app));
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF app NOT IN ('customer', 'driver') THEN
    RAISE EXCEPTION 'Invalid app flavor: %', p_app;
  END IF;

  SELECT role INTO cur_role FROM public.profiles WHERE user_id = uid;
  IF cur_role IS NULL THEN
    RAISE EXCEPTION 'Profile not found';
  END IF;

  -- Never rewrite privileged roles from a mobile shell.
  IF cur_role IN ('admin', 'support', 'store') THEN
    RETURN jsonb_build_object('ok', true, 'role', cur_role, 'skipped', true);
  END IF;

  IF app = 'customer' THEN
    IF cur_role = 'customer' THEN
      INSERT INTO public.user_roles (user_id, role)
      VALUES (uid, 'customer')
      ON CONFLICT (user_id, role) DO NOTHING;
      RETURN jsonb_build_object('ok', true, 'role', 'customer', 'created', false);
    END IF;

    -- driver / m → customer when using the customer app
    PERFORM set_config('app.bypass_role_protect', '1', true);
    UPDATE public.profiles SET role = 'customer' WHERE user_id = uid;
    INSERT INTO public.user_roles (user_id, role)
    VALUES (uid, 'customer')
    ON CONFLICT (user_id, role) DO NOTHING;
    -- Keep driver_profiles + user_roles.driver so returning to driver app restores cleanly.
    RETURN jsonb_build_object('ok', true, 'role', 'customer', 'created', true);
  END IF;

  -- app = 'driver'
  IF cur_role IN ('driver', 'm') THEN
    INSERT INTO public.driver_profiles (user_id, is_active)
    VALUES (uid, false)
    ON CONFLICT (user_id) DO NOTHING;
    INSERT INTO public.user_roles (user_id, role)
    VALUES (uid, 'driver')
    ON CONFLICT (user_id, role) DO NOTHING;
    RETURN jsonb_build_object('ok', true, 'role', cur_role, 'created', false);
  END IF;

  PERFORM set_config('app.bypass_role_protect', '1', true);
  UPDATE public.profiles SET role = 'driver' WHERE user_id = uid;
  INSERT INTO public.user_roles (user_id, role)
  VALUES (uid, 'driver')
  ON CONFLICT (user_id, role) DO NOTHING;
  INSERT INTO public.driver_profiles (user_id, is_active)
  VALUES (uid, false)
  ON CONFLICT (user_id) DO NOTHING;

  RETURN jsonb_build_object('ok', true, 'role', 'driver', 'created', true);
END;
$$;

-- Back-compat wrapper used by older clients / RoleAccessGate
CREATE OR REPLACE FUNCTION public.request_driver_access()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN public.sync_app_role('driver');
END;
$$;

REVOKE ALL ON FUNCTION public.sync_app_role(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.sync_app_role(text) TO authenticated;
REVOKE ALL ON FUNCTION public.request_driver_access() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.request_driver_access() TO authenticated;
