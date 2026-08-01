ALTER TABLE public.platform_settings
  ADD COLUMN IF NOT EXISTS target_hourly_eur numeric NOT NULL DEFAULT 10;