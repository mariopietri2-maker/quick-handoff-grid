-- Surge was ON by default (DEFAULT true) with no admin toggle.
-- Turn it off until ops explicitly enable it.

UPDATE public.platform_settings
SET surge_enabled = false
WHERE id = 1;

ALTER TABLE public.platform_settings
  ALTER COLUMN surge_enabled SET DEFAULT false;
