/*
  Secure post-delivery tip: customers must not write wallet_transactions
  or call admin_adjust_wallet directly. This RPC validates ownership and
  credits the driver atomically.
*/

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
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  v_amount := ROUND(COALESCE(p_amount, 0)::numeric, 2);
  IF v_amount <= 0 THEN
    RAISE EXCEPTION 'Tip amount must be positive';
  END IF;
  IF v_amount > 100 THEN
    RAISE EXCEPTION 'Tip amount too large';
  END IF;

  SELECT id, customer_id, driver_id, status
    INTO v_order
    FROM public.orders
   WHERE id = p_order_id
   FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Order not found';
  END IF;

  IF v_order.customer_id <> auth.uid() THEN
    RAISE EXCEPTION 'Not allowed';
  END IF;

  IF v_order.status::text <> 'delivered' THEN
    RAISE EXCEPTION 'Order is not delivered';
  END IF;

  IF v_order.driver_id IS NULL THEN
    RAISE EXCEPTION 'Order has no driver';
  END IF;

  -- Idempotent per tip attempt: allow multiple tips, but record each credit.
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

  UPDATE public.orders
     SET tip_amount = COALESCE(tip_amount, 0) + v_amount
   WHERE id = p_order_id;
END;
$$;

REVOKE ALL ON FUNCTION public.add_post_delivery_tip(uuid, numeric) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.add_post_delivery_tip(uuid, numeric) TO authenticated;
