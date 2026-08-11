-- =============================================================================
-- Customer self-cancel now auto-enqueues a card refund for paid card orders.
-- -----------------------------------------------------------------------------
-- A customer who cancels a paid card order (placed, no driver assigned,
-- <15 min old) gets the original card charge refunded automatically via the
-- process-refunds cron, instead of being left charged until support acts.
-- Cash orders and still-pending card orders have nothing to refund.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.customer_cancel_order(p_order_id uuid, p_reason text DEFAULT NULL)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = public
AS $function$
DECLARE
  v_order orders%ROWTYPE;
  v_amount numeric;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

  SELECT * INTO v_order FROM orders WHERE id = p_order_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Order not found'; END IF;

  IF v_order.customer_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'Not allowed to cancel this order';
  END IF;
  IF v_order.status NOT IN ('placed', 'pending') THEN
    RAISE EXCEPTION 'Η παραγγελία δεν μπορεί να ακυρωθεί πλέον';
  END IF;
  IF v_order.driver_id IS NOT NULL THEN
    RAISE EXCEPTION 'Η παραγγελία έχει ήδη ανατεθεί σε διανομέα';
  END IF;
  IF v_order.created_at < now() - interval '15 minutes' THEN
    RAISE EXCEPTION 'Η παραγγελία είναι μεγαλύτερη από 15 λεπτά και δεν ακυρώνεται αυτόματα';
  END IF;

  UPDATE orders
    SET status = 'cancelled',
        notes = CASE
          WHEN p_reason IS NOT NULL AND p_reason <> ''
            THEN COALESCE(notes || E'\n', '') || 'Ακυρώθηκε από τον πελάτη: ' || p_reason
          ELSE COALESCE(notes || E'\n', '') || 'Ακυρώθηκε από τον πελάτη'
        END,
        updated_at = now()
    WHERE id = p_order_id;

  -- Paid card order → enqueue an automated refund to the original card.
  -- Pending card orders were never charged; cash orders have nothing to refund.
  IF v_order.payment_method = 'card' AND v_order.stripe_payment_intent_id IS NOT NULL THEN
    v_amount := GREATEST(0, COALESCE(v_order.total_amount, 0) - COALESCE(v_order.refunded_amount, 0));
    IF v_amount > 0 THEN
      INSERT INTO public.refunds (
        order_id, customer_id, amount, reason, refund_type, notes, issued_by,
        status, stripe_payment_intent_id, stripe_env
      ) VALUES (
        p_order_id, v_order.customer_id, v_amount,
        COALESCE(p_reason, 'Customer self-cancel'), 'original_payment',
        'Auto-refund on customer cancel', auth.uid(),
        'pending', v_order.stripe_payment_intent_id,
        COALESCE(v_order.stripe_environment, 'live')
      );
      UPDATE orders
        SET refunded_amount = COALESCE(refunded_amount, 0) + v_amount,
            updated_at = now()
        WHERE id = p_order_id;
    END IF;
  END IF;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.customer_cancel_order(uuid, text) TO authenticated;