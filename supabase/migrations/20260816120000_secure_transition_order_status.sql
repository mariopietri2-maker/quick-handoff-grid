-- Hardening: transition_order_status previously checked only
-- `auth.uid() IS NOT NULL` and GRANT EXECUTE TO authenticated, relying
-- entirely on the trg_enforce_order_lifecycle BEFORE UPDATE trigger for
-- authorization. That trigger is the source of truth for WHICH transitions
-- are legal, but it early-returns when auth.uid() is NULL and can be dropped
-- or altered independently of this RPC. Add real role/ownership checks inside
-- the function (defense in depth): only admin/support, the store owner, or the
-- assigned driver may attempt a status change. The trigger still decides
-- whether the specific transition is legal for that caller.

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
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

  SELECT * INTO v_order FROM public.orders WHERE id = p_order_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Order not found'; END IF;

  IF NOT (
       public.has_role(v_uid, 'admin'::app_role)
    OR public.has_role(v_uid, 'support'::app_role)
    OR EXISTS (
         SELECT 1 FROM public.stores s
          WHERE s.id = v_order.store_id AND s.owner_id = v_uid
       )
    OR v_order.driver_id = v_uid
  ) THEN
    RAISE EXCEPTION 'Not authorized to update this order';
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
