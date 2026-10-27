-- Store can move paid/unblocked orders; clearer auth for store owners.
-- Safe to re-run.

CREATE OR REPLACE FUNCTION public.transition_order_status(
  p_order_id uuid,
  p_new_status text,
  p_estimated_prep_time integer DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_order public.orders%ROWTYPE;
  v_is_store_owner boolean := false;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

  SELECT * INTO v_order FROM public.orders WHERE id = p_order_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Order not found'; END IF;

  v_is_store_owner := EXISTS (
    SELECT 1 FROM public.stores s
     WHERE s.id = v_order.store_id AND s.owner_id = v_uid
  );

  IF NOT (
       public.has_role(v_uid, 'admin'::app_role)
    OR public.has_role(v_uid, 'support'::app_role)
    OR v_is_store_owner
    OR v_order.driver_id = v_uid
  ) THEN
    RAISE EXCEPTION 'Not authorized to update this order';
  END IF;

  -- Card orders stay pending until paid — store cannot cook unpaid orders
  IF v_order.status::text = 'pending'
     AND COALESCE(v_order.payment_method, '') = 'card'
     AND p_new_status IN ('accepted', 'preparing', 'ready') THEN
    RAISE EXCEPTION 'waiting for card payment';
  END IF;

  UPDATE public.orders
     SET status = p_new_status::order_status,
         estimated_prep_time = COALESCE(p_estimated_prep_time, estimated_prep_time),
         updated_at = now()
   WHERE id = p_order_id;
END;
$$;

REVOKE ALL ON FUNCTION public.transition_order_status(uuid, text, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.transition_order_status(uuid, text, integer) TO authenticated;
