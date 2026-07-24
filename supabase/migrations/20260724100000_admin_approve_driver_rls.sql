-- Allow admins to approve / activate drivers.
-- Previously RLS only allowed SELECT for admins; upsert/update failed with
-- "new row violates row-level security policy for table driver_profiles".

DROP POLICY IF EXISTS "Admins can insert driver profiles" ON public.driver_profiles;
CREATE POLICY "Admins can insert driver profiles"
ON public.driver_profiles
FOR INSERT
TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Admins can update driver profiles" ON public.driver_profiles;
CREATE POLICY "Admins can update driver profiles"
ON public.driver_profiles
FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE OR REPLACE FUNCTION public.admin_set_driver_active(
  p_user_id uuid,
  p_active boolean DEFAULT true
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row public.driver_profiles%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'Μόνο οι διαχειριστές μπορούν να εγκρίνουν οδηγούς';
  END IF;

  IF p_user_id IS NULL THEN
    RAISE EXCEPTION 'Λείπει user_id';
  END IF;

  INSERT INTO public.driver_profiles (user_id, is_active)
  VALUES (p_user_id, COALESCE(p_active, true))
  ON CONFLICT (user_id) DO UPDATE
    SET is_active = EXCLUDED.is_active,
        updated_at = now()
  RETURNING * INTO v_row;

  RETURN jsonb_build_object(
    'ok', true,
    'user_id', v_row.user_id,
    'is_active', v_row.is_active,
    'driver_code', v_row.driver_code
  );
END;
$$;

REVOKE ALL ON FUNCTION public.admin_set_driver_active(uuid, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_set_driver_active(uuid, boolean) TO authenticated;
