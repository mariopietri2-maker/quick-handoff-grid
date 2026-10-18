-- Loyalty coupon cards: redeem points for fixed € coupons
--   10 points → €1 coupon
--   30 points → €3 coupon
--   50 points → €5 coupon
-- Personal promo codes (max_uses = 1) applied at checkout like any promo.

ALTER TABLE public.promo_codes
  ADD COLUMN IF NOT EXISTS owner_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_promo_codes_owner ON public.promo_codes(owner_user_id)
  WHERE owner_user_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.redeem_loyalty_coupon(p_tier text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_points_cost integer;
  v_euro numeric;
  v_current integer;
  v_code text;
  v_promo_id uuid;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  CASE lower(trim(p_tier))
    WHEN '1', 'eur1', '€1' THEN
      v_points_cost := 10;
      v_euro := 1;
    WHEN '3', 'eur3', '€3' THEN
      v_points_cost := 30;
      v_euro := 3;
    WHEN '5', 'eur5', '€5' THEN
      v_points_cost := 50;
      v_euro := 5;
    ELSE
      RAISE EXCEPTION 'Invalid coupon tier. Use 1, 3, or 5';
  END CASE;

  SELECT points INTO v_current
    FROM public.customer_rewards
   WHERE user_id = v_uid
   FOR UPDATE;

  IF v_current IS NULL THEN
    INSERT INTO public.customer_rewards (user_id, points, lifetime_points)
    VALUES (v_uid, 0, 0)
    ON CONFLICT (user_id) DO NOTHING;
    SELECT points INTO v_current
      FROM public.customer_rewards
     WHERE user_id = v_uid
     FOR UPDATE;
  END IF;

  IF COALESCE(v_current, 0) < v_points_cost THEN
    RAISE EXCEPTION 'Insufficient points (need %, have %)', v_points_cost, COALESCE(v_current, 0);
  END IF;

  -- Unique personal code
  v_code := 'F2G' || v_euro::int || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8));

  INSERT INTO public.promo_codes (
    code, discount_type, discount_value, min_order_amount,
    max_uses, current_uses, is_active, owner_user_id, expires_at
  ) VALUES (
    v_code,
    'fixed',
    v_euro,
    0,
    1,
    0,
    true,
    v_uid,
    now() + interval '90 days'
  )
  RETURNING id INTO v_promo_id;

  UPDATE public.customer_rewards
     SET points = points - v_points_cost,
         updated_at = now()
   WHERE user_id = v_uid;

  INSERT INTO public.reward_history (user_id, points_change, reason)
  VALUES (
    v_uid,
    -v_points_cost,
    format('coupon_€%s code=%s', v_euro::int, v_code)
  );

  RETURN jsonb_build_object(
    'ok', true,
    'code', v_code,
    'euro', v_euro,
    'points_spent', v_points_cost,
    'points_left', v_current - v_points_cost,
    'promo_id', v_promo_id,
    'expires_at', (now() + interval '90 days')
  );
END;
$$;

REVOKE ALL ON FUNCTION public.redeem_loyalty_coupon(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.redeem_loyalty_coupon(text) TO authenticated;

-- List my unused loyalty coupons
CREATE OR REPLACE FUNCTION public.my_loyalty_coupons()
RETURNS TABLE (
  id uuid,
  code text,
  discount_value numeric,
  current_uses integer,
  max_uses integer,
  expires_at timestamptz,
  is_active boolean
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.id, p.code, p.discount_value, p.current_uses, p.max_uses, p.expires_at, p.is_active
  FROM public.promo_codes p
  WHERE p.owner_user_id = auth.uid()
    AND p.is_active = true
    AND (p.max_uses IS NULL OR p.current_uses < p.max_uses)
    AND (p.expires_at IS NULL OR p.expires_at > now())
  ORDER BY p.created_at DESC;
$$;

REVOKE ALL ON FUNCTION public.my_loyalty_coupons() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.my_loyalty_coupons() TO authenticated;
