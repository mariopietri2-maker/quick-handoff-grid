-- Cost fix, part 2: gate the remaining drain crons on pending work.
-- send-push-30s, process-refunds-60s and send-alerts-60s each invoke an edge
-- function on schedule even when their queues are empty (~5,760/day combined
-- idle burn). Same pattern as the api-* gating: keep the cadence, but only
-- fire the HTTP call when work exists. The predicates below match each
-- function's own claim filter exactly, so retry behavior is preserved.
--
-- NOT touched: process-email-queue (body created via Management API with a
-- vault key — reconstructing it here could break email auth), auto-dispatch
-- (latency-critical offer timing), ai-dynamic-pricing (already 15 min).
-- Expected cron edge total after this: ~130K/month worst case, ~near-zero
-- typical idle (auto-dispatch 86K + email 43K dominate).

-- 1) send-push-30s: only invoke when unsent push rows exist.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron')
     AND EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_net') THEN
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
      )
      WHERE EXISTS (
        SELECT 1 FROM public.push_outbox WHERE sent_at IS NULL
      );
      $cron$
    );
  END IF;
END $$;

-- 2) process-refunds-60s: only invoke when claimable refunds exist.
-- Matches api_claim_outbox: pending, or processing stuck > 10 min.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron')
     AND EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_net') THEN
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
      )
      WHERE EXISTS (
        SELECT 1 FROM public.refunds
        WHERE status = 'pending'
           OR (status = 'processing' AND processed_at < now() - interval '10 minutes')
      );
      $cron$
    );
  END IF;
END $$;

-- 3) send-alerts-60s: only invoke when unsent alerts exist.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron')
     AND EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_net') THEN
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
      )
      WHERE EXISTS (
        SELECT 1 FROM public.alert_outbox WHERE sent_at IS NULL
      );
      $cron$
    );
  END IF;
END $$;
