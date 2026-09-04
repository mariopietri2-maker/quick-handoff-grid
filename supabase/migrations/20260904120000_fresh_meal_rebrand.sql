-- Rebrand: EpirusEats -> Fresh Meal in the published/draft customer app config.
-- Old seed migrations only affect fresh installs; this updates live rows.
UPDATE public.customer_app_config
SET draft_config = jsonb_set(draft_config, '{branding,app_name}', '"Fresh Meal"', true)
WHERE draft_config #>> '{branding,app_name}' = 'EpirusEats';

UPDATE public.customer_app_config
SET published_config = jsonb_set(published_config, '{branding,app_name}', '"Fresh Meal"', true)
WHERE published_config #>> '{branding,app_name}' = 'EpirusEats';
