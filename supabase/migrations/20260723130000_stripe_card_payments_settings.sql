-- Stripe card payments: admin-configurable enable + publishable key (pk_ only).
-- Secret keys stay in Edge Function secrets — never stored in DB.

ALTER TABLE public.platform_settings
  ADD COLUMN IF NOT EXISTS card_payments_enabled boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS stripe_publishable_key text;

COMMENT ON COLUMN public.platform_settings.card_payments_enabled IS
  'When false, checkout hides/disables card and forces cash.';
COMMENT ON COLUMN public.platform_settings.stripe_publishable_key IS
  'Optional Stripe publishable key (pk_test_… / pk_live_…). Falls back to VITE_PAYMENTS_CLIENT_TOKEN.';

-- Reject secret keys if somehow written
CREATE OR REPLACE FUNCTION public.enforce_stripe_publishable_key()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.stripe_publishable_key IS NOT NULL THEN
    NEW.stripe_publishable_key := trim(NEW.stripe_publishable_key);
    IF NEW.stripe_publishable_key = '' THEN
      NEW.stripe_publishable_key := NULL;
    ELSIF NEW.stripe_publishable_key !~ '^pk_(test|live)_' THEN
      RAISE EXCEPTION 'stripe_publishable_key must start with pk_test_ or pk_live_';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_stripe_publishable_key ON public.platform_settings;
CREATE TRIGGER trg_enforce_stripe_publishable_key
  BEFORE INSERT OR UPDATE OF stripe_publishable_key ON public.platform_settings
  FOR EACH ROW EXECUTE FUNCTION public.enforce_stripe_publishable_key();

DROP FUNCTION IF EXISTS public.get_platform_settings_public();
CREATE OR REPLACE FUNCTION public.get_platform_settings_public()
RETURNS TABLE(
  platform_service_fee numeric,
  max_cash_cap numeric,
  show_stores_on_driver_map boolean,
  assignment_mode text,
  maintenance_mode boolean,
  maintenance_message text,
  customer_base_fee numeric,
  customer_per_km_fee numeric,
  max_stacked_orders integer,
  stacking_enabled boolean,
  dist_offer_timeout_seconds integer,
  wait_bonus_rate_per_min numeric,
  wait_bonus_grace_minutes integer,
  wait_bonus_cap numeric,
  card_payments_enabled boolean,
  stripe_publishable_key text
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT
    platform_service_fee,
    max_cash_cap,
    show_stores_on_driver_map,
    assignment_mode,
    maintenance_mode,
    maintenance_message,
    customer_base_fee,
    customer_per_km_fee,
    max_stacked_orders,
    stacking_enabled,
    dist_offer_timeout_seconds,
    wait_bonus_rate_per_min,
    wait_bonus_grace_minutes,
    wait_bonus_cap,
    card_payments_enabled,
    -- Only expose when card payments are enabled
    CASE WHEN card_payments_enabled THEN stripe_publishable_key ELSE NULL END AS stripe_publishable_key
  FROM public.platform_settings
  WHERE id = 1
  LIMIT 1;
$function$;

GRANT EXECUTE ON FUNCTION public.get_platform_settings_public() TO anon, authenticated, service_role;
