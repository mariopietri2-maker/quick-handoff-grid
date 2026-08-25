-- =============================================================================
-- FIX: customer self-cancel broken by enforce_order_lifecycle trigger.
-- -----------------------------------------------------------------------------
-- Since 20260720110000 the BEFORE UPDATE lifecycle guard allows only
-- admin/store/driver transitions. customer_cancel_order (SECURITY DEFINER)
-- still carries the caller's JWT, so auth.uid() = the customer → its direct
-- `UPDATE orders SET status='cancelled'` raises
--   "Illegal order status transition: placed → cancelled"
-- Result: customers could NOT cancel a pending order on web or native, and
-- E2E cleanup left live 'placed' orders behind.
--
-- Fix = repo-canonical GUC bypass (same pattern as app.allow_tip_update):
--   * customer_cancel_order sets app.customer_cancel_active='1' (tx-local)
--     around its UPDATE.
--   * enforce_order_lifecycle returns NEW when that flag is set and the
--     transition is exactly placed|pending -> cancelled on the caller's own
--     order row.
-- Direct REST PATCHes by customers stay blocked (RLS + flag never set).
--
-- Deploy: Supabase Dashboard → SQL Editor → paste & run (idempotent).
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1) Trigger: add the customer-self-cancel allowance
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.enforce_order_lifecycle()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_is_admin boolean := false;
  v_is_store boolean := false;
  v_is_driver boolean := false;
  v_old text;
  v_new text;
  v_allow_tip boolean := false;
  v_customer_cancel boolean := false;
BEGIN
  IF TG_OP <> 'UPDATE' THEN RETURN NEW; END IF;

  IF v_uid IS NULL THEN
    RETURN NEW;
  END IF;

  BEGIN
    v_allow_tip := current_setting('app.allow_tip_update', true) = '1';
  EXCEPTION WHEN OTHERS THEN
    v_allow_tip := false;
  END;

  v_customer_cancel := COALESCE(current_setting('app.customer_cancel_active', true), '') = '1';

  v_is_admin := public.has_role(v_uid, 'admin'::app_role);
  v_is_store := EXISTS (
    SELECT 1 FROM public.stores s WHERE s.id = COALESCE(NEW.store_id, OLD.store_id) AND s.owner_id = v_uid
  );
  v_is_driver := (NEW.driver_id = v_uid OR OLD.driver_id = v_uid);

  IF NEW.total_amount IS DISTINCT FROM OLD.total_amount
     OR NEW.delivery_fee IS DISTINCT FROM OLD.delivery_fee
     OR NEW.customer_id IS DISTINCT FROM OLD.customer_id
     OR NEW.store_id IS DISTINCT FROM OLD.store_id THEN
    IF NOT v_is_admin THEN
      RAISE EXCEPTION 'Cannot modify protected order financial fields';
    END IF;
  END IF;

  IF NEW.tip_amount IS DISTINCT FROM OLD.tip_amount AND NOT v_is_admin AND NOT v_allow_tip THEN
    RAISE EXCEPTION 'Cannot modify tip_amount directly';
  END IF;

  v_old := OLD.status::text;
  v_new := NEW.status::text;

  IF v_old = v_new THEN
    IF NEW.driver_id IS DISTINCT FROM OLD.driver_id THEN
      IF v_is_admin THEN RETURN NEW; END IF;
      IF OLD.driver_id IS NULL AND NEW.driver_id = v_uid THEN RETURN NEW; END IF;
      RAISE EXCEPTION 'Not allowed to change driver assignment';
    END IF;
    RETURN NEW;
  END IF;

  -- Customer self-cancel path (customer_cancel_order RPC): the RPC already
  -- enforced ownership, status window, no-driver and 15-min age. Allow exactly
  -- placed|pending -> cancelled, only on the caller's own row.
  IF v_customer_cancel
     AND v_old IN ('placed', 'pending')
     AND v_new = 'cancelled'
     AND NEW.customer_id = v_uid
     AND OLD.customer_id = v_uid THEN
    RETURN NEW;
  END IF;

  IF v_is_admin THEN RETURN NEW; END IF;

  IF v_is_store THEN
    IF (v_old = 'placed' AND v_new IN ('accepted', 'preparing', 'cancelled'))
       OR (v_old = 'accepted' AND v_new IN ('preparing', 'cancelled'))
       OR (v_old = 'preparing' AND v_new IN ('ready', 'cancelled'))
       OR (v_old = 'ready' AND v_new = 'cancelled') THEN
      IF NEW.driver_id IS DISTINCT FROM OLD.driver_id THEN
        RAISE EXCEPTION 'Store cannot change driver assignment';
      END IF;
      RETURN NEW;
    END IF;
  END IF;

  IF OLD.driver_id = v_uid AND NEW.driver_id = v_uid THEN
    IF (v_old IN ('accepted', 'preparing', 'ready') AND v_new = 'arrived')
       OR (v_old IN ('ready', 'arrived') AND v_new = 'picked_up')
       OR (v_old = 'picked_up' AND v_new = 'delivered') THEN
      RETURN NEW;
    END IF;
  END IF;

  RAISE EXCEPTION 'Illegal order status transition: % → %', v_old, v_new;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_order_lifecycle ON public.orders;
CREATE TRIGGER trg_enforce_order_lifecycle
BEFORE UPDATE ON public.orders
FOR EACH ROW
EXECUTE FUNCTION public.enforce_order_lifecycle();

-- ---------------------------------------------------------------------------
-- 2) customer_cancel_order: latest version (auto card-refund) + GUC flag
-- ---------------------------------------------------------------------------
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

  PERFORM set_config('app.customer_cancel_active', '1', true);

  UPDATE orders
    SET status = 'cancelled',
        notes = CASE
          WHEN p_reason IS NOT NULL AND p_reason <> ''
            THEN COALESCE(notes || E'\n', '') || 'Ακυρώθηκε από τον πελάτη: ' || p_reason
          ELSE COALESCE(notes || E'\n', '') || 'Ακυρώθηκε από τον πελάτη'
        END,
        updated_at = now()
    WHERE id = p_order_id;

  PERFORM set_config('app.customer_cancel_active', '', true);

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
