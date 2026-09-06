-- Complete the store owner manual open/closed override.
--
-- Replaces the never-applied 20260906140000_manual_store_open_close.sql on the
-- live project. That migration's stores_public rebuild dropped delivery_fee and
-- delivery_free_min, and the later 20260907000000_store_delivery_controls.sql
-- recreated the view without status_override. This one adds the column and
-- exposes it in stores_public while preserving every column the native apps
-- currently read (delivery_fee, delivery_free_min, ...). Without it, the
-- customer/driver apps cannot list stores: their fetch requests status_override
-- and PostgREST returns HTTP 400 "column stores_public.status_override does not exist".

ALTER TABLE public.stores
  ADD COLUMN IF NOT EXISTS status_override text
  CHECK (status_override IS NULL OR status_override IN ('open', 'closed'));

COMMENT ON COLUMN public.stores.status_override IS 'Owner manual open/closed override. NULL = follow weekly schedule, ''open'' = force open, ''closed'' = force closed.';

CREATE OR REPLACE VIEW public.stores_public
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
  updated_at,
  status_override
FROM public.stores
WHERE is_active = true AND suspended_at IS NULL;

GRANT SELECT ON public.stores_public TO anon, authenticated, service_role;