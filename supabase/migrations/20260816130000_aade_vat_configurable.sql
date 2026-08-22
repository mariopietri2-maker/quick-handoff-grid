-- Make the myDATA VAT rates configurable instead of the hardcoded 0.24 in
-- aade-submit-delivery. Food is 13% (standard Greek rate for restaurants) and
-- the delivery service the platform provides is 24%. The edge function now
-- reports the full platform gross (food + delivery fee; tip excluded) split
-- across these two rates.

ALTER TABLE public.aade_platform_config
  ADD COLUMN IF NOT EXISTS vat_rate_food numeric(5,4) NOT NULL DEFAULT 0.13,
  ADD COLUMN IF NOT EXISTS vat_rate_delivery numeric(5,4) NOT NULL DEFAULT 0.24;
