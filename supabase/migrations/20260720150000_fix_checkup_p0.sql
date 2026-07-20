/*
  Checkup P0 fixes:
  1) customer_wallets uses `balance` (not available_balance) — fix tip + admin refund
  2) refund_order must credit customer wallet for wallet_credit refunds
  3) transition_order_status must enforce ownership (store / driver / admin / support)
  4) Restrict stores INSERT to admins (was: any auth user with owner_id = self)
*/

-- ---------------------------------------------------------------------------
-- 1) Post-delivery tip: debit customer_wallets.balance
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.add_post_delivery_tip(
  p_order_id uuid,
  p_amount numeric
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order RECORD;
  v_amount numeric;
  v_balance numeric := 0;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  v_amount := ROUND(COALESCE(p_amount, 0)::numeric, 2);
  IF v_amount <= 0 THEN RAISE EXCEPTION 'Tip amount must be positive'; END IF;
  IF v_amount > 100 THEN RAISE EXCEPTION 'Tip amount too large'; END IF;

  SELECT id, customer_id, driver_id, status
    INTO v_order
    FROM public.orders
   WHERE id = p_order_id
   FOR UPDATE;

  IF NOT FOUND THEN RAISE EXCEPTION 'Order not found'; END IF;
  IF v_order.customer_id <> auth.uid() THEN RAISE EXCEPTION 'Not allowed'; END IF;
  IF v_order.status::text <> 'delivered' THEN RAISE EXCEPTION 'Order is not delivered'; END IF;
  IF v_order.driver_id IS NULL THEN RAISE EXCEPTION 'Order has no driver'; END IF;

  SELECT COALESCE(balance, 0) INTO v_balance
  FROM public.customer_wallets
  WHERE user_id = auth.uid()
  FOR UPDATE;

  IF COALESCE(v_balance, 0) < v_amount THEN
    RAISE EXCEPTION 'Insufficient wallet balance for tip. Add funds or tip at checkout.';
  END IF;

  UPDATE public.customer_wallets
     SET balance = balance - v_amount,
         updated_at = now()
   WHERE user_id = auth.uid();

  INSERT INTO public.customer_wallet_ledger (user_id, order_id, type, amount, description)
  VALUES (auth.uid(), p_order_id, 'order_redemption', -v_amount, 'Επιπλέον φιλοδώρημα οδηγού');

  INSERT INTO public.wallet_transactions (driver_id, type, amount, status, description, order_id)
  VALUES (
    v_order.driver_id,
    'extra_tip',
    v_amount,
    'completed',
    'Επιπλέον φιλοδώρημα από πελάτη',
    p_order_id
  );

  INSERT INTO public.driver_wallets (driver_id, available_balance, pending_balance, total_withdrawn)
  VALUES (v_order.driver_id, v_amount, 0, 0)
  ON CONFLICT (driver_id) DO UPDATE
    SET available_balance = public.driver_wallets.available_balance + v_amount,
        updated_at = now();

  PERFORM set_config('app.allow_tip_update', '1', true);
  UPDATE public.orders
     SET tip_amount = COALESCE(tip_amount, 0) + v_amount
   WHERE id = p_order_id;
END;
$$;

-- ---------------------------------------------------------------------------
-- 2) Admin refund: credit customer_wallets.balance + lifetime_credit
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_refund_order(
  p_order_id uuid,
  p_amount numeric,
  p_reason text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order RECORD;
  v_amount numeric;
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'Admin only';
  END IF;

  v_amount := ROUND(COALESCE(p_amount, 0)::numeric, 2);
  IF v_amount <= 0 THEN RAISE EXCEPTION 'Refund amount must be positive'; END IF;

  SELECT id, customer_id, total_amount, delivery_fee, tip_amount, status
    INTO v_order FROM public.orders WHERE id = p_order_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Order not found'; END IF;

  IF v_amount > (COALESCE(v_order.total_amount,0) + COALESCE(v_order.delivery_fee,0) + COALESCE(v_order.tip_amount,0)) THEN
    RAISE EXCEPTION 'Refund exceeds order total';
  END IF;

  INSERT INTO public.customer_wallets (user_id, balance, lifetime_credit)
  VALUES (v_order.customer_id, v_amount, v_amount)
  ON CONFLICT (user_id) DO UPDATE
    SET balance = public.customer_wallets.balance + v_amount,
        lifetime_credit = public.customer_wallets.lifetime_credit + v_amount,
        updated_at = now();

  INSERT INTO public.customer_wallet_ledger (user_id, order_id, type, amount, description)
  VALUES (
    v_order.customer_id,
    p_order_id,
    'refund_credit',
    v_amount,
    COALESCE(NULLIF(p_reason, ''), 'Admin refund')
  );

  UPDATE public.orders
     SET refund_reason = COALESCE(NULLIF(p_reason, ''), refund_reason),
         refunded_amount = COALESCE(refunded_amount, 0) + v_amount,
         updated_at = now()
   WHERE id = p_order_id;

  PERFORM public.log_admin_action(
    'admin_refund_order',
    'order',
    p_order_id::text,
    'Refunded ' || v_amount || ' (' || COALESCE(NULLIF(p_reason, ''), 'no reason') || ')',
    jsonb_build_object('amount', v_amount)
  );
END;
$$;

-- ---------------------------------------------------------------------------
-- 3) Support/admin refund_order: actually credit wallet for wallet_credit
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.refund_order(
  p_order_id uuid,
  p_amount numeric,
  p_reason text,
  p_refund_type text DEFAULT 'wallet_credit',
  p_notes text DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order orders%ROWTYPE;
  v_refund_id uuid;
  v_amount numeric;
BEGIN
  IF NOT is_support_or_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Only support or admin can issue refunds';
  END IF;

  v_amount := ROUND(COALESCE(p_amount, 0)::numeric, 2);
  IF v_amount <= 0 THEN
    RAISE EXCEPTION 'Refund amount must be positive';
  END IF;

  SELECT * INTO v_order FROM orders WHERE id = p_order_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Order not found'; END IF;

  IF (COALESCE(v_order.refunded_amount, 0) + v_amount) > COALESCE(v_order.total_amount, 0) THEN
    RAISE EXCEPTION 'Refund exceeds order total';
  END IF;

  INSERT INTO refunds (order_id, customer_id, amount, reason, refund_type, notes, issued_by)
  VALUES (p_order_id, v_order.customer_id, v_amount, p_reason, p_refund_type, p_notes, auth.uid())
  RETURNING id INTO v_refund_id;

  UPDATE orders
  SET refunded_amount = COALESCE(refunded_amount, 0) + v_amount,
      refund_reason = COALESCE(p_reason, refund_reason),
      updated_at = now()
  WHERE id = p_order_id;

  -- Credit customer wallet when refund is issued as wallet credit
  IF COALESCE(p_refund_type, 'wallet_credit') = 'wallet_credit' THEN
    INSERT INTO customer_wallets (user_id, balance, lifetime_credit)
    VALUES (v_order.customer_id, v_amount, v_amount)
    ON CONFLICT (user_id) DO UPDATE
      SET balance = customer_wallets.balance + v_amount,
          lifetime_credit = customer_wallets.lifetime_credit + v_amount,
          updated_at = now();

    INSERT INTO customer_wallet_ledger (user_id, order_id, type, amount, description)
    VALUES (
      v_order.customer_id,
      p_order_id,
      'refund_credit',
      v_amount,
      COALESCE(NULLIF(p_reason, ''), 'Order refund')
    );
  END IF;

  IF has_role(auth.uid(), 'admin') THEN
    PERFORM log_admin_action(
      'refund_order',
      'order',
      p_order_id::text,
      'Refunded ' || v_amount || ' (' || COALESCE(p_reason, 'no reason') || ')',
      jsonb_build_object('amount', v_amount, 'type', p_refund_type, 'refund_id', v_refund_id)
    );
  END IF;

  RETURN v_refund_id;
END;
$$;

-- ---------------------------------------------------------------------------
-- 4) transition_order_status: ownership / role gate
--    Valid transitions still enforced by trg_enforce_order_lifecycle.
-- ---------------------------------------------------------------------------
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
  v_allowed boolean := false;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

  SELECT * INTO v_order FROM public.orders WHERE id = p_order_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Order not found'; END IF;

  IF public.has_role(v_uid, 'admin'::app_role)
     OR public.is_support_or_admin(v_uid) THEN
    v_allowed := true;
  ELSIF v_order.driver_id IS NOT NULL AND v_order.driver_id = v_uid
        AND public.has_role(v_uid, 'driver'::app_role) THEN
    v_allowed := true;
  ELSIF EXISTS (
    SELECT 1 FROM public.stores s
     WHERE s.id = v_order.store_id AND s.owner_id = v_uid
  ) THEN
    v_allowed := true;
  END IF;

  IF NOT v_allowed THEN
    RAISE EXCEPTION 'Not allowed to transition this order';
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

-- ---------------------------------------------------------------------------
-- 5) Stores INSERT: admin only (prevents anyone creating a store as owner)
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Owners can insert their store" ON public.stores;
DROP POLICY IF EXISTS "Admins can insert stores" ON public.stores;
CREATE POLICY "Admins can insert stores"
  ON public.stores
  FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));
