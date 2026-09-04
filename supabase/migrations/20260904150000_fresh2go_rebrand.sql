-- Fresh2go rebrand of the published/draft customer app config.
-- The web app now defaults to "fresh2go" in code; this updates live DB
-- rows regardless of which prior brand value they carry (EpirusEats,
-- "Epirus Go", "Fresh Meal", or legacy "Fresh Delivery") so the customer
-- main page header / splash show fresh2go instead of an old name.
UPDATE public.customer_app_config
SET
  draft_config = jsonb_set(
    jsonb_set(
      jsonb_set(
        COALESCE(draft_config, '{}'::jsonb),
        '{branding,app_name}',
        '"fresh2go"'::jsonb,
        true
      ),
      '{branding,tagline}',
      '"Fresh Food. Fast Delivery."'::jsonb,
      true
    ),
    '{branding,city_label}',
    '"Ιωάννινα"'::jsonb,
    true
  ),
  published_config = jsonb_set(
    jsonb_set(
      jsonb_set(
        COALESCE(published_config, '{}'::jsonb),
        '{branding,app_name}',
        '"fresh2go"'::jsonb,
        true
      ),
      '{branding,tagline}',
      '"Fresh Food. Fast Delivery."'::jsonb,
      true
    ),
    '{branding,city_label}',
    '"Ιωάννινα"'::jsonb,
    true
  ),
  updated_at = now()
WHERE id = true;
