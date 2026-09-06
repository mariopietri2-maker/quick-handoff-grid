-- Manual open/closed control for store owners.
--
-- Store availability today comes only from opening_hours + holiday_dates,
-- which admins decide. Add an owner-controlled, instantly visible override:
--   status_override = NULL    → follow the weekly schedule
--   status_override = 'open'  → force open right now (manual override)
--   status_override = 'closed'→ force closed right now (manual override)
--
-- The existing stores RLS policy ("Owners can update their store") already
-- scopes UPDATEs to auth.uid() = owner_id, so no new policy is required.

ALTER TABLE public.stores
  ADD COLUMN IF NOT EXISTS status_override text
  CHECK (status_override IS NULL OR status_override IN ('open', 'closed'));

-- Expose the flag on the customer-facing view so browsing + checkout see the
-- override instantly (no extra fetch, same realtime feed as before).
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
  fulfilment_mode,
  created_at,
  updated_at,
  status_override
FROM public.stores
WHERE is_active = true
  AND suspended_at IS NULL;

GRANT SELECT ON public.stores_public TO anon, authenticated, service_role;