-- Remove AI support: drop is_ai column, feature flags, and the auto-reply cron.
-- Reverses the AI parts of 20260802140000 (applied earlier).

ALTER TABLE public.ticket_messages
  DROP COLUMN IF EXISTS is_ai;

DROP INDEX IF EXISTS idx_ticket_messages_is_ai;

DELETE FROM public.feature_flags
  WHERE key IN ('ai_support_enabled', 'ai_support_auto_reply');

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    BEGIN
      PERFORM cron.unschedule('support-ai-auto-reply');
    EXCEPTION WHEN OTHERS THEN NULL;
    END;
  END IF;
END $$;
