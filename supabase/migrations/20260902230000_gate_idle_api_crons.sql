-- Cost fix: api-push-15s + api-poll-30s were missing from the 20260819
-- cost budget and burn ~8,640 edge invocations/day (~259K/month) even when
-- completely idle. Observed usage is 585K/month vs the 500K plan limit;
-- cron-driven edge calls account for ~565K of it.
--
-- Fix: keep the same 15s/30s cadence, but only fire the HTTP call when
-- there is work to do (conditional SELECT -> zero rows -> no invocation).
-- Same latency when busy, ~zero cost when idle. Expected total back to
-- ~300-400K/month depending on external-order volume.
--
-- api-push gate matches api_claim_outbox exactly:
--   state IN ('pending','failed') AND attempts < 10, on an enabled connection
--   with outgoing_enabled.
-- api-poll gate matches the function's connection filter:
--   enabled AND polling_enabled AND incoming_enabled.

-- 1) api-push-15s: only invoke when unsent outbox rows exist.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron')
     AND EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_net') THEN
    BEGIN
      PERFORM cron.unschedule('api-push-15s');
    EXCEPTION WHEN OTHERS THEN NULL;
    END;
    PERFORM cron.schedule(
      'api-push-15s',
      '15 seconds',
      $cron$
      SELECT net.http_post(
        url := 'https://ojkesspghyqmjmupybva.supabase.co/functions/v1/api-push',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'X-Cron-Secret', coalesce(current_setting('app.settings.cron_secret', true), '')
        ),
        body := '{"limit":20,"source":"cron"}'::jsonb
      )
      WHERE EXISTS (
        SELECT 1
        FROM public.api_outbox o
        JOIN public.api_connections c ON c.id = o.connection_id
        WHERE o.state IN ('pending', 'failed')
          AND o.attempts < 10
          AND c.enabled
          AND c.outgoing_enabled
      );
      $cron$
    );
  END IF;
END $$;

-- 2) api-poll-30s: only invoke when a pull-polling connection exists.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron')
     AND EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_net') THEN
    BEGIN
      PERFORM cron.unschedule('api-poll-30s');
    EXCEPTION WHEN OTHERS THEN NULL;
    END;
    PERFORM cron.schedule(
      'api-poll-30s',
      '30 seconds',
      $cron$
      SELECT net.http_post(
        url := 'https://ojkesspghyqmjmupybva.supabase.co/functions/v1/api-poll',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'X-Cron-Secret', coalesce(current_setting('app.settings.cron_secret', true), '')
        ),
        body := '{"source":"cron"}'::jsonb
      )
      WHERE EXISTS (
        SELECT 1
        FROM public.api_connections
        WHERE enabled
          AND polling_enabled
          AND incoming_enabled
      );
      $cron$
    );
  END IF;
END $$;
