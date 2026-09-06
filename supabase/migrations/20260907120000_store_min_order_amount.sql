-- Per-store minimum order amount (€) for customers.
ALTER TABLE public.stores
  ADD COLUMN IF NOT EXISTS min_order_amount NUMERIC NOT NULL DEFAULT 0
  CHECK (min_order_amount >= 0);

COMMENT ON COLUMN public.stores.min_order_amount IS 'Minimum cart subtotal (€) required to place an order. 0 = no minimum.';

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
  min_order_amount,
  fulfilment_mode,
  created_at,
  updated_at,
  status_override
FROM public.stores
WHERE is_active = true AND suspended_at IS NULL;

GRANT SELECT ON public.stores_public TO anon, authenticated, service_role;
