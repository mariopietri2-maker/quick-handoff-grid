-- Store appearance fields for premium customer-app cards + public catalog.

ALTER TABLE public.stores
  ADD COLUMN IF NOT EXISTS tagline text,
  ADD COLUMN IF NOT EXISTS promo_badge text,
  ADD COLUMN IF NOT EXISTS cover_image_url text,
  ADD COLUMN IF NOT EXISTS highlight_color text;

COMMENT ON COLUMN public.stores.tagline IS 'Short marketing line under store name on customer cards';
COMMENT ON COLUMN public.stores.promo_badge IS 'Ribbon/badge text on store cover (e.g. -20%, Νέο)';
COMMENT ON COLUMN public.stores.cover_image_url IS 'Optional wide cover; falls back to image_url';
COMMENT ON COLUMN public.stores.highlight_color IS 'Optional accent for store card (HSL without hsl(), e.g. 152 100% 39%)';

DROP VIEW IF EXISTS public.stores_public CASCADE;

CREATE VIEW public.stores_public
WITH (security_invoker = false) AS
SELECT
  id,
  owner_id,
  name,
  address,
  latitude,
  longitude,
  image_url,
  cover_image_url,
  tagline,
  promo_badge,
  highlight_color,
  is_active,
  busy_mode,
  prep_buffer_minutes,
  opening_hours,
  holiday_dates,
  promotion_status,
  promotion_starts_at,
  promotion_ends_at,
  covers_delivery_fee,
  created_at,
  updated_at
FROM public.stores
WHERE is_active = true
  AND suspended_at IS NULL;

GRANT SELECT ON public.stores_public TO anon, authenticated, service_role;
