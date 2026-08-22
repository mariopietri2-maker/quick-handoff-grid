-- Cost optimization: bring cron-driven edge invocations under the Supabase
-- Free-tier budget (~500K invocations/month).
--
-- Before: 19,008 edge invocations/day (~570K/month):
--   auto-dispatch         2,880/day  (latency-critical — kept)
--   send-push             5,760/day  (15s)
--   process-refunds       4,320/day  (20s)
--   send-alerts           2,880/day  (30s)
--   process-email-queue   2,880/day  (30s)
--   ai-dynamic-pricing      288/day  (5 min — self-throttles to 30 min)
--
-- After: ~10,176/day (~305K/month), safely under the 500K Free limit.
-- All re-schedules are idempotent (unschedule-then-schedule, same pattern as
-- earlier cron migrations). Latency rationale per job:
--   - process-refunds: enqueued card refunds tolerate 60s (async financial op)
--   - send-alerts:     ops webhook alerts tolerate 60s
--   - process-email-queue: transactional/auth emails tolerate 60s
--   - send-push:       customers get immediate drain via enqueue trigger;
--                      driver offers are drained by auto-dispatch each run;
--                      the cron is a 30s safety net (was 15s)
--   - ai-dynamic-pricing: edge fn self-throttles to run_interval_minutes (30);
--                       a 15-min cron keeps 3x slack without burning calls

-- 1) process-refunds: 20s -> 60s
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron')
     AND EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_net') THEN
    BEGIN
      PERFORM cron.unschedule('process-refunds-20s');
    EXCEPTION WHEN OTHERS THEN NULL;
    END;
    BEGIN
      PERFORM cron.unschedule('process-refunds-60s');
    EXCEPTION WHEN OTHERS THEN NULL;
    END;
    PERFORM cron.schedule(
      'process-refunds-60s',
      '* * * * *',
      $cron$
      SELECT net.http_post(
        url := 'https://ojkesspghyqmjmupybva.supabase.co/functions/v1/process-refunds',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'X-Cron-Secret', coalesce(current_setting('app.settings.cron_secret', true), '')
        ),
        body := '{"limit":10,"source":"cron"}'::jsonb
      );
      $cron$
    );
  END IF;
END $$;

-- 2) send-alerts: 30s -> 60s
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron')
     AND EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_net') THEN
    BEGIN
      PERFORM cron.unschedule('send-alerts-30s');
    EXCEPTION WHEN OTHERS THEN NULL;
    END;
    BEGIN
      PERFORM cron.unschedule('send-alerts-60s');
    EXCEPTION WHEN OTHERS THEN NULL;
    END;
    PERFORM cron.schedule(
      'send-alerts-60s',
      '* * * * *',
      $cron$
      SELECT net.http_post(
        url := 'https://ojkesspghyqmjmupybva.supabase.co/functions/v1/send-alerts',
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

-- 3) process-email-queue: 30s -> 60s (job created via Management API, so
--    update the row directly, same as 20260802140000)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'process-email-queue') THEN
    UPDATE cron.job SET schedule = '* * * * *' WHERE jobname = 'process-email-queue';
  END IF;
EXCEPTION WHEN undefined_table THEN
  NULL;
END $$;

-- 4) send-push: 15s -> 30s
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron')
     AND EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_net') THEN
    BEGIN
      PERFORM cron.unschedule('send-push-15s');
    EXCEPTION WHEN OTHERS THEN NULL;
    END;
    BEGIN
      PERFORM cron.unschedule('send-push-30s');
    EXCEPTION WHEN OTHERS THEN NULL;
    END;
    PERFORM cron.schedule(
      'send-push-30s',
      '30 seconds',
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

-- 5) ai-dynamic-pricing: every 5 min -> every 15 min (self-throttles to 30)
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
      '*/15 * * * *',
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