-- ════════════════════════════════════════════════════════════════════
-- LOYALTY POINTS REDEMPTION
-- ════════════════════════════════════════════════════════════════════
-- Points are earned automatically on delivery (award_loyalty_points) but
-- there was no way for a customer to spend them. This adds a self-service
-- "points → wallet credit" redemption so the loyalty program pays out.
--
--   rate: 5 points = €1.00 of wallet credit
--   min:  5 points (≤ €1). Partial / under-rate redemptions are rejected.
--
-- The customer only ever touches their OWN reward balance and their OWN
-- wallet, so a SECURITY DEFINER on the caller's uid is safe (no privilege
-- escalation to other users, no arbitrary amounts).
-- -------------------------------------------------------------------

-- 1) The wallet ledger 'type' is constrained to a fixed CHECK set; allow a
--    new value for self-served points redemptions.
ALTER TABLE public.customer_wallet_ledger
  DROP CONSTRAINT IF EXISTS customer_wallet_ledger_type_check;

ALTER TABLE public.customer_wallet_ledger
  ADD CONSTRAINT customer_wallet_ledger_type_check
  CHECK (type IN (
    'refund_credit','referral_bonus','order_redemption','admin_adjust',
    'signup_bonus','points_redeemed'
  ));

-- 2) Self-service redemption RPC. Returns the euro amount credited.
CREATE OR REPLACE FUNCTION public.redeem_loyalty_points(p_points integer)
RETURNS numeric
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid;
  v_current integer;
  v_per_euro numeric := 5;   -- 5 points = €1
  v_amount numeric;
  v_balance numeric;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Guard rails on the request.
  IF p_points IS NULL OR p_points <= 0 THEN
    RAISE EXCEPTION 'Redeem a positive number of points';
  END IF;
  IF p_points % v_per_euro <> 0 THEN
    RAISE EXCEPTION 'Points must be a multiple of % (minimum €1)', v_per_euro;
  END IF;

  v_amount := p_points / v_per_euro;

  -- Lock the customer's reward row so concurrent redemptions serialize.
  SELECT points INTO v_current
    FROM public.customer_rewards
   WHERE user_id = v_uid
   FOR UPDATE;

  IF v_current IS NULL OR v_current < p_points THEN
    RAISE EXCEPTION 'Insufficient points';
  END IF;

  -- 2a. Spend the points (reward_history is a negative-change audit trail).
  UPDATE public.customer_rewards
     SET points = points - p_points,
         updated_at = now()
   WHERE user_id = v_uid;

  INSERT INTO public.reward_history (user_id, points_change, reason)
  VALUES (v_uid, -p_points, 'redeemed_points');

  -- 2b. Credit the customer wallet (balance only; lifetime_credit is reserved
  --     for admin-issued bonuses so it keeps its intended meaning).
  INSERT INTO public.customer_wallets (user_id, balance)
  VALUES (v_uid, v_amount)
  ON CONFLICT (user_id) DO UPDATE
    SET balance = customer_wallets.balance + v_amount,
        updated_at = now();

  INSERT INTO public.customer_wallet_ledger (user_id, amount, type, description)
  VALUES (v_uid, v_amount, 'points_redeemed',
          'Redeemed ' || p_points || ' loyalty points for €' || v_amount::text);

  RETURN v_amount;
END;
$$;

REVOKE ALL ON FUNCTION public.redeem_loyalty_points(integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.redeem_loyalty_points(integer) TO authenticated;