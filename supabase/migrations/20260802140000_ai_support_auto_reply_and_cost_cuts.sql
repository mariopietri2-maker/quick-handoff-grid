-- AI support: mark AI messages, auto-reply flag, slower crons (cost cuts).

ALTER TABLE public.ticket_messages
  ADD COLUMN IF NOT EXISTS is_ai boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_ticket_messages_is_ai
  ON public.ticket_messages (ticket_id, is_ai)
  WHERE is_ai = true;

-- Manual AI assistant (already seeded historically — ensure on).
INSERT INTO public.feature_flags (key, label, description, category, is_enabled)
VALUES (
  'ai_support_enabled',
  'AI Support',
  'Ενεργοποιεί τον AI βοηθό υποστήριξης (πρόταση/αποστολή απαντήσεων)',
  'support',
  true
)
ON CONFLICT (key) DO NOTHING;

-- Optional first-line auto reply for open non-SOS tickets (off by default).
INSERT INTO public.feature_flags (key, label, description, category, is_enabled)
VALUES (
  'ai_support_auto_reply',
  'AI Auto-reply',
  'Αυτόματη πρώτη AI απάντηση σε ανοιχτά tickets (όχι SOS). Απαιτεί AI Support ON.',
  'support',
  false
)
ON CONFLICT (key) DO NOTHING;

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

-- AI auto-reply queue: every minute (no-op when flag off).
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron')
     AND EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_net') THEN
    BEGIN
      PERFORM cron.unschedule('support-ai-auto-reply');
    EXCEPTION WHEN OTHERS THEN NULL;
    END;
    PERFORM cron.schedule(
      'support-ai-auto-reply',
      '* * * * *',
      $cron$
      SELECT net.http_post(
        url := 'https://ojkesspghyqmjmupybva.supabase.co/functions/v1/support-ai',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'X-Cron-Secret', coalesce(current_setting('app.settings.cron_secret', true), '')
        ),
        body := '{"action":"process_queue"}'::jsonb
      );
      $cron$
    );
  END IF;
END $$;
