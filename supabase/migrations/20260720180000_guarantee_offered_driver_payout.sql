/*
  Guarantee drivers receive the locked offer payout (driver_payout + tip).
  When the driver pool is short, subsidize from admin treasury instead of
  silently cutting what was shown on the offer card.
*/
UPDATE public.platform_settings
SET subsidize_min_pay = true
WHERE id = 1;
