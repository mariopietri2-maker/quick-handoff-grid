-- Admin can remove an order only if it is assigned to a Ghost Rider (call_role = K).
CREATE OR REPLACE FUNCTION public.admin_delete_ghost_order(p_order_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_driver uuid;
  v_role text;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'not admin';
  END IF;

  SELECT driver_id INTO v_driver FROM public.orders WHERE id = p_order_id;
  IF v_driver IS NULL THEN
    RAISE EXCEPTION 'order not found or has no driver';
  END IF;

  SELECT call_role INTO v_role FROM public.driver_profiles WHERE user_id = v_driver;
  IF v_role IS DISTINCT FROM 'K' THEN
    RAISE EXCEPTION 'only ghost rider orders can be removed';
  END IF;

  DELETE FROM public.order_items WHERE order_id = p_order_id;
  DELETE FROM public.orders WHERE id = p_order_id;
  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_delete_ghost_order(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_delete_ghost_order(uuid) TO authenticated;
