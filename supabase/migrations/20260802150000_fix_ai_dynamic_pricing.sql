-- Fix AI Dynamic Pricing: saneable model, safer defaults, scheduled cron.

UPDATE public.ai_pricing_config
SET model = 'google/gemini-2.5-flash'
WHERE model IS NULL
   OR model = ''
   OR model = 'google/gemini-3.6-flash';

ALTER TABLE public.ai_pricing_config
  ALTER COLUMN model SET DEFAULT 'google/gemini-2.5-flash';

-- Safer default: proposals need explicit apply unless admin opts into auto_apply.
ALTER TABLE public.ai_pricing_config
  ALTER COLUMN auto_apply SET DEFAULT false;

UPDATE public.ai_pricing_config
SET auto_apply = false
WHERE auto_apply IS TRUE
  AND enabled IS FALSE;

INSERT INTO public.ai_pricing_config (id, enabled, auto_apply, model)
VALUES (true, false, false, 'google/gemini-2.5-flash')
ON CONFLICT (id) DO NOTHING;

-- Cron every 5 minutes; edge function self-throttles via run_interval_minutes.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron')
     AND EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_net') THEN
    BEGIN
      PERFORM cron.unschedule('ai-dynamic-pricing');
    EXCEPTION WHEN OTHERS THEN NULL;
    END;
    PERFORM cron.schedule(
      'ai-dynamic-pricing',
      '*/5 * * * *',
      $cron$
      SELECT net.http_post(
        url := 'https://ojkesspghyqmjmupybva.supabase.co/functions/v1/ai-dynamic-pricing',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'X-Cron-Secret', coalesce(current_setting('app.settings.cron_secret', true), '')
        ),
        body := '{"action":"tick"}'::jsonb
      );
      $cron$
    );
  END IF;
END $$;
