-- =============================================================================
-- Automated Stripe card refunds
-- -----------------------------------------------------------------------------
-- Today a "refund" only credits the customer wallet (refund_type='wallet_credit').
-- This adds the ability to refund the ORIGINAL card charge:
--   1. orders gains stripe_payment_intent_id + stripe_environment
--      (create-checkout records the env; payments-webhook records the PI id).
--   2. refunds gains a lifecycle (status/attempts/processed_at/failure_message)
--      plus the Stripe identifiers needed to run the refund.
--   3. refund_order supports refund_type='original_payment' → enqueues a
--      'pending' card refund instead of crediting the wallet.
--   4. claim_pending_card_refunds / complete_card_refund let the
--      process-refunds edge function (driven by pg_cron) execute the Stripe
--      refund idempotently and record the result.
--   5. admin_refund_order (old broken variant) is rewritten to delegate.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Orders: payment intent + environment
-- -----------------------------------------------------------------------------
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS stripe_payment_intent_id text,
  ADD COLUMN IF NOT EXISTS stripe_environment text;

-- Existing paid card orders predate this column; treat them as live payments.
UPDATE public.orders
   SET stripe_environment = 'live'
 WHERE stripe_environment IS NULL
   AND stripe_session_id IS NOT NULL;

-- -----------------------------------------------------------------------------
-- Refunds: lifecycle + Stripe identifiers
-- -----------------------------------------------------------------------------
ALTER TABLE public.refunds
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'completed',
  ADD COLUMN IF NOT EXISTS stripe_payment_intent_id text,
  ADD COLUMN IF NOT EXISTS stripe_env text,
  ADD COLUMN IF NOT EXISTS stripe_refund_id text,
  ADD COLUMN IF NOT EXISTS attempts integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS processed_by uuid,
  ADD COLUMN IF NOT EXISTS processed_at timestamptz,
  ADD COLUMN IF NOT EXISTS failure_message text;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'refunds_status_check' AND conrelid = 'public.refunds'::regclass
  ) THEN
    ALTER TABLE public.refunds ADD CONSTRAINT refunds_status_check
      CHECK (status IN ('completed', 'pending', 'processing', 'succeeded', 'failed'));
  END IF;
END $$;

-- -----------------------------------------------------------------------------
-- refund_order: support refunding the original card payment
-- -----------------------------------------------------------------------------
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

  IF COALESCE(p_refund_type, 'wallet_credit') = 'original_payment' THEN
    -- Refund straight back to the card that paid for the order.
    IF COALESCE(v_order.payment_method, 'cash') != 'card' THEN
      RAISE EXCEPTION 'This order was not paid by card';
    END IF;
    IF v_order.status = 'pending' THEN
      RAISE EXCEPTION 'Order was never paid';
    END IF;
    IF v_order.stripe_payment_intent_id IS NULL THEN
      RAISE EXCEPTION 'No Stripe payment found for this order - use wallet credit instead';
    END IF;

    INSERT INTO refunds (
      order_id, customer_id, amount, reason, refund_type, notes, issued_by,
      status, stripe_payment_intent_id, stripe_env
    )
    VALUES (
      p_order_id, v_order.customer_id, v_amount, p_reason, 'original_payment', p_notes, auth.uid(),
      'pending', v_order.stripe_payment_intent_id,
      COALESCE(v_order.stripe_environment, 'live')
    )
    RETURNING id INTO v_refund_id;

    UPDATE orders
    SET refunded_amount = COALESCE(refunded_amount, 0) + v_amount,
        refund_reason = COALESCE(p_reason, refund_reason),
        updated_at = now()
    WHERE id = p_order_id;

    IF has_role(auth.uid(), 'admin') THEN
      PERFORM log_admin_action(
        'refund_order',
        'order',
        p_order_id::text,
        'Card refund queued ' || v_amount || ' (' || COALESCE(p_reason, 'no reason') || ')',
        jsonb_build_object('amount', v_amount, 'type', 'original_payment', 'refund_id', v_refund_id)
      );
    END IF;

    RETURN v_refund_id;
  END IF;

  -- Wallet credit (existing behavior) — instant, no Stripe call.
  INSERT INTO refunds (order_id, customer_id, amount, reason, refund_type, notes, issued_by)
  VALUES (p_order_id, v_order.customer_id, v_amount, p_reason, p_refund_type, p_notes, auth.uid())
  RETURNING id INTO v_refund_id;

  UPDATE orders
  SET refunded_amount = COALESCE(refunded_amount, 0) + v_amount,
      refund_reason = COALESCE(p_reason, refund_reason),
      updated_at = now()
  WHERE id = p_order_id;

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

  UPDATE refunds SET status = 'completed', processed_at = now() WHERE id = v_refund_id;

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

-- -----------------------------------------------------------------------------
-- Claim pending card refunds (concurrent-drain safe)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.claim_pending_card_refunds(p_limit integer DEFAULT 10)
RETURNS SETOF public.refunds
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  WITH picked AS (
    SELECT id
    FROM public.refunds
    WHERE status = 'pending'
       OR (status = 'processing' AND processed_at < now() - interval '10 minutes')
    ORDER BY created_at ASC
    LIMIT GREATEST(1, LEAST(COALESCE(p_limit, 10), 50))
    FOR UPDATE SKIP LOCKED
  )
  UPDATE public.refunds r
  SET status = 'processing',
      attempts = r.attempts + 1,
      processed_at = now(),
      failure_message = NULL
  FROM picked
  WHERE r.id = picked.id
  RETURNING r.*;
END;
$$;

REVOKE ALL ON FUNCTION public.claim_pending_card_refunds(integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.claim_pending_card_refunds(integer) TO service_role;

-- -----------------------------------------------------------------------------
-- Complete a card refund (called by process-refunds edge function).
-- Idempotent: re-delivery of the drain after a crash does not double-notify.
-- Notifies the customer (push) about the outcome.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.complete_card_refund(
  p_refund_id uuid,
  p_stripe_refund_id text,
  p_succeeded boolean,
  p_error text DEFAULT NULL
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_customer uuid;
  v_amount numeric;
BEGIN
  IF p_succeeded THEN
    IF EXISTS (SELECT 1 FROM public.refunds WHERE id = p_refund_id AND status = 'succeeded') THEN
      RETURN;
    END IF;
    UPDATE public.refunds
    SET status = 'succeeded',
        stripe_refund_id = p_stripe_refund_id,
        failure_message = NULL,
        processed_at = now()
    WHERE id = p_refund_id;
  ELSE
    IF EXISTS (SELECT 1 FROM public.refunds WHERE id = p_refund_id AND status = 'failed') THEN
      RETURN;
    END IF;
    UPDATE public.refunds
    SET status = 'failed',
        failure_message = LEFT(COALESCE(p_error, 'Unknown error'), 500),
        processed_at = now()
    WHERE id = p_refund_id;
  END IF;

  SELECT o.customer_id, r.amount
    INTO v_customer, v_amount
    FROM public.refunds r
    JOIN public.orders o ON o.id = r.order_id
   WHERE r.id = p_refund_id;

  IF v_customer IS NOT NULL THEN
    IF p_succeeded THEN
      INSERT INTO public.push_outbox (user_id, app, title, body, data)
      VALUES (
        v_customer,
        'customer',
        'Επιστροφή χρημάτων',
        'Επιστράφηκαν ' || to_char(v_amount, 'FM9990.00') || ' € στην κάρτα σου. Μπορεί να χρειαστούν 2-5 εργάσιμες ημέρες.',
        jsonb_build_object('type', 'refund', 'refund_id', p_refund_id, 'amount', v_amount, 'status', 'succeeded')
      );
    ELSE
      INSERT INTO public.push_outbox (user_id, app, title, body, data)
      VALUES (
        v_customer,
        'customer',
        'Η επιστροφή χρημάτων απέτυχε',
        'Η επιστροφή για την παραγγελία σου δεν ολοκληρώθηκε. Επικοινώνησε μαζί μας για να το διορθώσουμε.',
        jsonb_build_object('type', 'refund', 'refund_id', p_refund_id, 'amount', v_amount, 'status', 'failed')
      );
    END IF;
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.complete_card_refund(uuid, text, boolean, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.complete_card_refund(uuid, text, boolean, text) TO service_role;

-- -----------------------------------------------------------------------------
-- Ops: requeue a permanently-failed card refund for another drain attempt
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.retry_failed_card_refund(p_refund_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT is_support_or_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Only support or admin can retry refunds';
  END IF;
  UPDATE public.refunds
     SET status = 'pending',
         attempts = 0,
         failure_message = NULL,
         processed_at = NULL
   WHERE id = p_refund_id AND status = 'failed';
  RETURN FOUND;
END;
$$;

REVOKE ALL ON FUNCTION public.retry_failed_card_refund(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.retry_failed_card_refund(uuid) TO authenticated, service_role;

-- -----------------------------------------------------------------------------
-- Fix the old admin_refund_order variant (batch_14) which referenced columns
-- that do not exist (customer_wallets.customer_id, refunds.status/processed_by
-- at that time) and would fail at runtime. Rewrite to delegate to refund_order.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_refund_order(p_order_id uuid, p_amount numeric, p_reason text DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;
  PERFORM public.refund_order(p_order_id, p_amount, p_reason, 'wallet_credit');
END;
$$;

-- -----------------------------------------------------------------------------
-- Cron: drain pending card refunds every 20 seconds
-- -----------------------------------------------------------------------------
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron')
     AND EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_net') THEN
    BEGIN
      PERFORM cron.unschedule('process-refunds-20s');
    EXCEPTION WHEN OTHERS THEN NULL;
    END;
    PERFORM cron.schedule(
      'process-refunds-20s',
      '20 seconds',
      $cron$
      SELECT net.http_post(
        url := 'https://ojkesspghyqmjmupybva.supabase.co/functions/v1/process-refunds',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'X-Cron-Secret', coalesce(current_setting('app.settings.cron_secret', true), '')
        ),
        body := '{"limit":10,"source":"cron"}'::jsonb
      );
      $cron$
    );
  END IF;
END $$;
