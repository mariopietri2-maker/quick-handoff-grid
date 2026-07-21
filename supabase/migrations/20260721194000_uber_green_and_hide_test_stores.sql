-- Launch cleanup: Uber green branding + hide test stores
ALTER TABLE public.stores DISABLE TRIGGER protect_store_active;

UPDATE public.stores
SET is_active = false
WHERE name IN ('aaaa', 'Test Souvlaki Spot');

ALTER TABLE public.stores ENABLE TRIGGER protect_store_active;

-- Force customer branding accents to Uber Eats green
UPDATE public.customer_app_config
SET
  published_config = jsonb_set(
    jsonb_set(
      COALESCE(published_config, '{}'::jsonb),
      '{branding,accent_hsl}',
      '"152 100% 39%"'::jsonb,
      true
    ),
    '{branding,accent_dark_hsl}',
    '"152 100% 28%"'::jsonb,
    true
  ),
  draft_config = jsonb_set(
    jsonb_set(
      COALESCE(draft_config, '{}'::jsonb),
      '{branding,accent_hsl}',
      '"152 100% 39%"'::jsonb,
      true
    ),
    '{branding,accent_dark_hsl}',
    '"152 100% 28%"'::jsonb,
    true
  ),
  updated_at = now();
