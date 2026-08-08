-- Cost cuts: slow high-frequency edge crons (AI support removed).

-- ── Cost cuts: slow high-frequency edge crons ──────────────────────────────
-- Push drain: 5s → 15s (still fast enough; ~3× fewer edge invocations).
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron')
     AND EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_net') THEN
    BEGIN
      PERFORM cron.unschedule('send-push-5s');
    EXCEPTION WHEN OTHERS THEN NULL;
    END;
    BEGIN
      PERFORM cron.unschedule('send-push-15s');
    EXCEPTION WHEN OTHERS THEN NULL;
    END;
    PERFORM cron.schedule(
      'send-push-15s',
      '15 seconds',
      $cron$
      SELECT net.http_post(
        url := 'https://ojkesspghyqmjmupybva.supabase.co/functions/v1/send-push',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'X-Cron-Secret', coalesce(current_setting('app.settings.cron_secret', true), '')
        ),
        body := '{"limit":20,"source":"cron"}'::jsonb
      );
      $cron$
    );
  END IF;
END $$;

-- Email queue: stretch to 30s when the job exists (body kept as-is).
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'process-email-queue') THEN
    UPDATE cron.job SET schedule = '30 seconds' WHERE jobname = 'process-email-queue';
  END IF;
EXCEPTION WHEN undefined_table THEN
  NULL;
END $$;
