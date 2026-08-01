-- ════════════════════════════════════════════════════════════════════
-- REFERRAL & LOYALTY PROGRAM
-- ════════════════════════════════════════════════════════════════════
-- Incentivize customer referrals and driver recruitment with rewards

CREATE TABLE IF NOT EXISTS public.referral_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_id uuid NOT NULL REFERENCES public.profiles(user_id) ON DELETE CASCADE,
  code varchar(20) UNIQUE NOT NULL,
  referral_type text NOT NULL CHECK (referral_type IN ('customer', 'driver')),
  customer_reward numeric(5, 2) DEFAULT 5.00,  -- €5 credit for customer referral
  referrer_reward numeric(5, 2) DEFAULT 5.00,  -- €5 credit to referrer
  driver_reward numeric(4, 2) DEFAULT 20.00,   -- €20 when driver completes 10 rides
  max_uses int,  -- NULL = unlimited
  current_uses int DEFAULT 0,
  expires_at timestamptz,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_referral_codes_referrer ON public.referral_codes(referrer_id);
CREATE INDEX IF NOT EXISTS idx_referral_codes_active ON public.referral_codes(is_active, expires_at);
CREATE INDEX IF NOT EXISTS idx_referral_codes_code ON public.referral_codes(code);

ALTER TABLE public.referral_codes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users view own referral codes" ON public.referral_codes;
CREATE POLICY "Users view own referral codes"
  ON public.referral_codes FOR SELECT
  USING (referrer_id = auth.uid() OR public.has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Users create own referral codes" ON public.referral_codes;
CREATE POLICY "Users create own referral codes"
  ON public.referral_codes FOR INSERT
  WITH CHECK (referrer_id = auth.uid());

-- ────────────────────────────────────────────────────────────────────
-- Track referral usage
-- ────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.referral_tracking (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  referral_code_id uuid NOT NULL REFERENCES public.referral_codes(id) ON DELETE CASCADE,
  referrer_id uuid NOT NULL REFERENCES public.profiles(user_id) ON DELETE CASCADE,
  referee_id uuid NOT NULL REFERENCES public.profiles(user_id) ON DELETE CASCADE,
  first_order_id uuid REFERENCES public.orders(id) ON DELETE SET NULL,
  referral_status text NOT NULL DEFAULT 'pending' CHECK (referral_status IN ('pending', 'completed', 'expired')),
  referrer_credited boolean DEFAULT false,
  referee_credited boolean DEFAULT false,
  referee_rides_completed int DEFAULT 0,  -- For driver referrals
  credited_at timestamptz,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_referral_tracking_code ON public.referral_tracking(referral_code_id);
CREATE INDEX IF NOT EXISTS idx_referral_tracking_referrer ON public.referral_tracking(referrer_id);
CREATE INDEX IF NOT EXISTS idx_referral_tracking_referee ON public.referral_tracking(referee_id);
CREATE INDEX IF NOT EXISTS idx_referral_tracking_status ON public.referral_tracking(referral_status);

ALTER TABLE public.referral_tracking ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users view own referrals" ON public.referral_tracking;
CREATE POLICY "Users view own referrals"
  ON public.referral_tracking FOR SELECT
  USING (referrer_id = auth.uid() OR referee_id = auth.uid() OR public.has_role(auth.uid(), 'admin'::app_role));

-- ────────────────────────────────────────────────────────────────────
-- Loyalty points system
-- ────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.loyalty_points (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(user_id) ON DELETE CASCADE UNIQUE,
  points_balance numeric(10, 2) DEFAULT 0,
  lifetime_points numeric(10, 2) DEFAULT 0,
  tier text DEFAULT 'bronze' CHECK (tier IN ('bronze', 'silver', 'gold', 'platinum')),
  orders_count int DEFAULT 0,
  last_order_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_loyalty_points_user ON public.loyalty_points(user_id);
CREATE INDEX IF NOT EXISTS idx_loyalty_points_tier ON public.loyalty_points(tier);

ALTER TABLE public.loyalty_points ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users view own loyalty" ON public.loyalty_points;
CREATE POLICY "Users view own loyalty"
  ON public.loyalty_points FOR SELECT
  USING (user_id = auth.uid());

-- ────────────────────────────────────────────────────────────────────
-- Loyalty point transactions ledger
-- ────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.loyalty_ledger (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(user_id) ON DELETE CASCADE,
  order_id uuid REFERENCES public.orders(id) ON DELETE SET NULL,
  points_amount numeric(10, 2) NOT NULL,
  transaction_type text NOT NULL CHECK (transaction_type IN ('order', 'referral', 'redemption', 'bonus', 'admin')),
  description text,
  balance_after numeric(10, 2),
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_loyalty_ledger_user ON public.loyalty_ledger(user_id);
CREATE INDEX IF NOT EXISTS idx_loyalty_ledger_order ON public.loyalty_ledger(order_id);
CREATE INDEX IF NOT EXISTS idx_loyalty_ledger_created ON public.loyalty_ledger(created_at DESC);

ALTER TABLE public.loyalty_ledger ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users view own ledger" ON public.loyalty_ledger;
CREATE POLICY "Users view own ledger"
  ON public.loyalty_ledger FOR SELECT
  USING (user_id = auth.uid());

-- ════════════════════════════════════════════════════════════════════
-- FUNCTIONS
-- ════════════════════════════════════════════════════════════════════

-- Generate unique referral code
CREATE OR REPLACE FUNCTION public.generate_referral_code()
RETURNS varchar(20)
LANGUAGE plpgsql
AS $$
DECLARE
  v_code varchar(20);
BEGIN
  LOOP
    v_code := 'REF' || UPPER(SUBSTRING(MD5(RANDOM()::text), 1, 17));
    EXIT WHEN NOT EXISTS (SELECT 1 FROM public.referral_codes WHERE code = v_code);
  END LOOP;
  RETURN v_code;
END;
$$;

-- Create referral code for authenticated user
CREATE OR REPLACE FUNCTION public.create_referral_code(
  p_referral_type text DEFAULT 'customer',
  p_expires_at timestamptz DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_code varchar(20);
  v_row public.referral_codes%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF p_referral_type NOT IN ('customer', 'driver') THEN
    RAISE EXCEPTION 'Invalid referral_type: must be customer or driver';
  END IF;

  v_code := public.generate_referral_code();

  INSERT INTO public.referral_codes (
    referrer_id,
    code,
    referral_type,
    expires_at
  ) VALUES (
    auth.uid(),
    v_code,
    p_referral_type,
    COALESCE(p_expires_at, now() + INTERVAL '1 year')
  ) RETURNING * INTO v_row;

  RETURN jsonb_build_object(
    'code', v_row.code,
    'type', v_row.referral_type,
    'reward', CASE WHEN v_row.referral_type = 'customer' THEN v_row.customer_reward ELSE v_row.driver_reward END,
    'expires_at', v_row.expires_at
  );
END;
$$;

REVOKE ALL ON FUNCTION public.create_referral_code(text, timestamptz) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_referral_code(text, timestamptz) TO authenticated;

-- Apply referral code on first order
CREATE OR REPLACE FUNCTION public.apply_referral_code(
  p_referral_code varchar(20)
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_code_row public.referral_codes%ROWTYPE;
  v_existing RECORD;
  v_tracking_row public.referral_tracking%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Find the referral code
  SELECT * INTO v_code_row
  FROM public.referral_codes
  WHERE code = UPPER(p_referral_code)
    AND is_active = true
    AND (expires_at IS NULL OR expires_at > now());

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invalid or expired referral code';
  END IF;

  -- Check if referee already has a referral
  SELECT * INTO v_existing
  FROM public.referral_tracking
  WHERE referee_id = auth.uid()
    AND referral_code_id = v_code_row.id;

  IF FOUND THEN
    RAISE EXCEPTION 'You have already used this referral code';
  END IF;

  -- Check if referee is the referrer (can't refer yourself)
  IF v_code_row.referrer_id = auth.uid() THEN
    RAISE EXCEPTION 'You cannot use your own referral code';
  END IF;

  -- Create tracking record
  INSERT INTO public.referral_tracking (
    referral_code_id,
    referrer_id,
    referee_id,
    referral_status
  ) VALUES (
    v_code_row.id,
    v_code_row.referrer_id,
    auth.uid(),
    'pending'
  ) RETURNING * INTO v_tracking_row;

  -- Increment code usage
  UPDATE public.referral_codes
  SET current_uses = current_uses + 1
  WHERE id = v_code_row.id;

  RETURN jsonb_build_object(
    'success', true,
    'message', 'Referral code applied! You''ll receive €' || v_code_row.customer_reward || ' credit on your first order.',
    'referee_reward', v_code_row.customer_reward,
    'referrer_reward', v_code_row.referrer_reward
  );
END;
$$;

REVOKE ALL ON FUNCTION public.apply_referral_code(varchar) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.apply_referral_code(varchar) TO authenticated;

-- Award loyalty points on order completion
CREATE OR REPLACE FUNCTION public.award_loyalty_points()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_points numeric;
  v_tier text;
  v_loyalty RECORD;
BEGIN
  IF NEW.status <> 'delivered' OR OLD.status = 'delivered' THEN
    RETURN NEW;
  END IF;

  -- 1 point per €1 spent (food only, not delivery/tip)
  v_points := COALESCE(NEW.total_amount, 0);

  -- Bonus multiplier by tier
  SELECT * INTO v_loyalty FROM public.loyalty_points WHERE user_id = NEW.customer_id;
  
  IF FOUND THEN
    CASE v_loyalty.tier
      WHEN 'silver' THEN v_points := v_points * 1.1;
      WHEN 'gold' THEN v_points := v_points * 1.25;
      WHEN 'platinum' THEN v_points := v_points * 1.5;
    END CASE;

    -- Update points
    UPDATE public.loyalty_points
    SET 
      points_balance = points_balance + v_points,
      lifetime_points = lifetime_points + v_points,
      orders_count = orders_count + 1,
      last_order_at = now(),
      tier = CASE
        WHEN lifetime_points + v_points >= 500 THEN 'platinum'
        WHEN lifetime_points + v_points >= 200 THEN 'gold'
        WHEN lifetime_points + v_points >= 50 THEN 'silver'
        ELSE 'bronze'
      END,
      updated_at = now()
    WHERE user_id = NEW.customer_id;
  ELSE
    -- Create initial loyalty account
    INSERT INTO public.loyalty_points (
      user_id,
      points_balance,
      lifetime_points,
      orders_count,
      last_order_at
    ) VALUES (
      NEW.customer_id,
      v_points,
      v_points,
      1,
      now()
    );
  END IF;

  -- Log transaction
  INSERT INTO public.loyalty_ledger (
    user_id,
    order_id,
    points_amount,
    transaction_type,
    description,
    balance_after
  ) VALUES (
    NEW.customer_id,
    NEW.id,
    v_points,
    'order',
    'Points earned from order ' || NEW.id,
    (SELECT points_balance FROM public.loyalty_points WHERE user_id = NEW.customer_id)
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS award_loyalty_on_delivery ON public.orders;
CREATE TRIGGER award_loyalty_on_delivery
AFTER UPDATE ON public.orders
FOR EACH ROW
EXECUTE FUNCTION public.award_loyalty_points();

-- Award referral bonus when referee completes first order
CREATE OR REPLACE FUNCTION public.complete_referral_reward()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tracking RECORD;
  v_code RECORD;
  v_referee_wallet RECORD;
  v_referrer_wallet RECORD;
BEGIN
  IF NEW.status <> 'delivered' OR OLD.status = 'delivered' THEN
    RETURN NEW;
  END IF;

  -- Find pending referral for this customer
  SELECT rt.*, rc.customer_reward, rc.referrer_reward
  INTO v_tracking
  FROM public.referral_tracking rt
  JOIN public.referral_codes rc ON rt.referral_code_id = rc.id
  WHERE rt.referee_id = NEW.customer_id
    AND rt.referral_status = 'pending'
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN NEW;
  END IF;

  -- Credit referee (customer)
  INSERT INTO public.customer_wallets (user_id, balance)
  VALUES (NEW.customer_id, v_tracking.customer_reward)
  ON CONFLICT (user_id) DO UPDATE
  SET balance = customer_wallets.balance + v_tracking.customer_reward;

  INSERT INTO public.customer_wallet_ledger (user_id, type, amount, description)
  VALUES (
    NEW.customer_id,
    'referral_bonus',
    v_tracking.customer_reward,
    'Bonus for using referral code ' || (SELECT code FROM public.referral_codes WHERE id = v_tracking.referral_code_id)
  );

  -- Credit referrer
  INSERT INTO public.customer_wallets (user_id, balance)
  VALUES (v_tracking.referrer_id, v_tracking.referrer_reward)
  ON CONFLICT (user_id) DO UPDATE
  SET balance = customer_wallets.balance + v_tracking.referrer_reward;

  INSERT INTO public.customer_wallet_ledger (user_id, type, amount, description)
  VALUES (
    v_tracking.referrer_id,
    'referral_bonus',
    v_tracking.referrer_reward,
    'Bonus for referring customer'
  );

  -- Mark as completed
  UPDATE public.referral_tracking
  SET 
    referral_status = 'completed',
    referee_credited = true,
    referrer_credited = true,
    first_order_id = NEW.id,
    credited_at = now()
  WHERE id = v_tracking.id;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS complete_referral_on_delivery ON public.orders;
CREATE TRIGGER complete_referral_on_delivery
AFTER UPDATE ON public.orders
FOR EACH ROW
EXECUTE FUNCTION public.complete_referral_reward();

-- Redeem loyalty points for credit
CREATE OR REPLACE FUNCTION public.redeem_loyalty_points(
  p_points numeric
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_loyalty RECORD;
  v_credit numeric;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT * INTO v_loyalty
  FROM public.loyalty_points
  WHERE user_id = auth.uid()
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'No loyalty account found';
  END IF;

  IF v_loyalty.points_balance < p_points THEN
    RAISE EXCEPTION 'Insufficient loyalty points';
  END IF;

  -- 1 point = €0.01 credit (100 points = €1)
  v_credit := p_points / 100.0;

  -- Deduct points
  UPDATE public.loyalty_points
  SET points_balance = points_balance - p_points
  WHERE user_id = auth.uid();

  -- Add wallet credit
  INSERT INTO public.customer_wallets (user_id, balance)
  VALUES (auth.uid(), v_credit)
  ON CONFLICT (user_id) DO UPDATE
  SET balance = customer_wallets.balance + v_credit;

  -- Log redemption
  INSERT INTO public.loyalty_ledger (
    user_id,
    points_amount,
    transaction_type,
    description,
    balance_after
  ) VALUES (
    auth.uid(),
    -p_points,
    'redemption',
    'Redeemed ' || p_points || ' points for €' || ROUND(v_credit, 2),
    v_loyalty.points_balance - p_points
  );

  RETURN jsonb_build_object(
    'success', true,
    'points_redeemed', p_points,
    'credit_awarded', ROUND(v_credit, 2),
    'remaining_points', v_loyalty.points_balance - p_points
  );
END;
$$;

REVOKE ALL ON FUNCTION public.redeem_loyalty_points(numeric) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.redeem_loyalty_points(numeric) TO authenticated;
