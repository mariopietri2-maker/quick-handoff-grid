-- Per-store customer-facing delivery controls (admin editable, native + web read).
-- Adds optional per-store fee override + free-delivery threshold, exposes everything in stores_public.

ALTER TABLE public.stores
  ADD COLUMN IF NOT EXISTS delivery_fee NUMERIC NULL CHECK (delivery_fee IS NULL OR delivery_fee >= 0),
  ADD COLUMN IF NOT EXISTS delivery_free_min NUMERIC NULL CHECK (delivery_free_min IS NULL OR delivery_free_min >= 0);

COMMENT ON COLUMN public.stores.delivery_fee IS 'Per-store delivery fee override (€). NULL = use platform default (platform_settings.customer_base_fee).';
COMMENT ON COLUMN public.stores.delivery_free_min IS 'Min cart subtotal (€) for free delivery messaging. NULL = no threshold.';

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
  delivery_fee,
  delivery_free_min,
  fulfilment_mode,
  created_at,
  updated_at
FROM public.stores
WHERE is_active = true
  AND suspended_at IS NULL;

GRANT SELECT ON public.stores_public TO anon, authenticated, service_role;
