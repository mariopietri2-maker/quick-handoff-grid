-- Slow the backup send-push drain from 5s to 15s (superseded by the 30s job
-- in 20260819130000_slow_edge_crons.sql).
--
-- Customer order-status pushes are already drained immediately by
-- enqueue_customer_status_push -> request_send_push_drain (see
-- 20260724220000_fix_customer_push_latency.sql). The pg_cron job is a pure
-- safety net for driver offers / inbox email / refund pushes, which tolerate a
-- 15s drain. This cuts send-push edge-function invocations from ~17,280/day
-- to ~5,760/day.

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    BEGIN
      PERFORM cron.unschedule('send-push-5s');
    EXCEPTION WHEN OTHERS THEN NULL;
    END;
    BEGIN
      PERFORM cron.unschedule('send-push-10s');
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