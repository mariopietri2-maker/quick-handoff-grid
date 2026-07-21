/*
  admin_cancel_all_open_orders — emergency kill for every non-terminal order.
  Leaves delivered / already-cancelled alone. Clears pending offers. Audits.
*/

CREATE OR REPLACE FUNCTION public.admin_cancel_all_open_orders(
  p_reason text DEFAULT 'Admin: cancel all open orders'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count int := 0;
  v_reason text := COALESCE(NULLIF(trim(p_reason), ''), 'Admin: cancel all open orders');
  v_ids uuid[];
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  SELECT array_agg(id) INTO v_ids
  FROM public.orders
  WHERE status IN (
    'pending'::order_status,
    'placed'::order_status,
    'accepted'::order_status,
    'preparing'::order_status,
    'ready'::order_status,
    'arrived'::order_status,
    'picked_up'::order_status
  );

  IF v_ids IS NULL OR array_length(v_ids, 1) IS NULL THEN
    RETURN jsonb_build_object('cancelled', 0);
  END IF;

  UPDATE public.orders
     SET status = 'cancelled'::order_status,
         notes = COALESCE(notes || E'\n', '') || '❌ Cancelled (bulk): ' || v_reason,
         updated_at = now()
   WHERE id = ANY (v_ids);

  GET DIAGNOSTICS v_count = ROW_COUNT;

  -- Drop live offers so drivers stop seeing cancelled jobs.
  DELETE FROM public.pending_offers
   WHERE order_id = ANY (v_ids);

  INSERT INTO public.admin_audit_log (actor_id, action, target_type, target_id, description, metadata)
  VALUES (
    auth.uid(),
    'cancel_all_open_orders',
    'orders',
    'bulk',
    format('Cancelled %s open orders', v_count),
    jsonb_build_object('count', v_count, 'reason', v_reason)
  );

  RETURN jsonb_build_object('cancelled', v_count);
END;
$$;

REVOKE ALL ON FUNCTION public.admin_cancel_all_open_orders(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_cancel_all_open_orders(text) TO authenticated;
