-- =============================================================================
-- Saved cards / 1-tap reorder
-- -----------------------------------------------------------------------------
-- 1. profiles.stripe_customer_id — one Stripe Customer per user so Embedded
--    Checkout can show "saved payment methods" natively.
-- 2. customer_payment_methods — local mirror of saved cards (brand / last4 /
--    expiry) used for the profile UI and delete-card edge function.
--
-- create-checkout links the session to the customer and asks Stripe to save
-- cards (payment_method_collection='always'); payments-webhook mirrors cards
-- that Stripe actually attached to the customer.
-- =============================================================================

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS stripe_customer_id text;

CREATE UNIQUE INDEX IF NOT EXISTS profiles_stripe_customer_unique
  ON public.profiles (stripe_customer_id)
  WHERE stripe_customer_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.customer_payment_methods (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(user_id) ON DELETE CASCADE,
  stripe_customer_id text NOT NULL,
  stripe_payment_method_id text NOT NULL UNIQUE,
  stripe_env text NOT NULL DEFAULT 'live',      -- sandbox | live
  brand text,
  last4 text,
  exp_month integer,
  exp_year integer,
  is_default boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.customer_payment_methods ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users view own payment methods" ON public.customer_payment_methods;
CREATE POLICY "Users view own payment methods" ON public.customer_payment_methods
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users update own payment methods" ON public.customer_payment_methods;
CREATE POLICY "Users update own payment methods" ON public.customer_payment_methods
  FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users delete own payment methods" ON public.customer_payment_methods;
CREATE POLICY "Users delete own payment methods" ON public.customer_payment_methods
  FOR DELETE USING (auth.uid() = user_id);

-- Only one default per user
CREATE UNIQUE INDEX IF NOT EXISTS one_default_payment_method_per_user
  ON public.customer_payment_methods (user_id)
  WHERE is_default;

-- -----------------------------------------------------------------------------
-- Set default card (user-owned)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.set_default_payment_method(p_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN false;
  END IF;

  SELECT user_id INTO v_user
  FROM public.customer_payment_methods
  WHERE id = p_id;
  IF v_user IS NULL OR v_user <> auth.uid() THEN
    RETURN false;
  END IF;

  UPDATE public.customer_payment_methods
  SET is_default = false,
      updated_at = now()
  WHERE user_id = v_user AND id <> p_id;

  UPDATE public.customer_payment_methods
  SET is_default = true,
      updated_at = now()
  WHERE id = p_id;

  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.set_default_payment_method(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.set_default_payment_method(uuid) TO authenticated, service_role;
