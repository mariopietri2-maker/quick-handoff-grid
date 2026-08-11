-- ============================================================================
-- VERIFY cron jobs + AADE autosubmit trigger (read-only diagnostic)
-- ============================================================================
-- Checks that the auto-dispatch pg_cron jobs and the AADE autosubmit trigger
-- point at the REAL Supabase project (ojkesspghyqmjmupybva) and authenticate
-- via X-Cron-Secret, and that the app.settings.cron_secret GUC is configured.
--
-- After applying 20260812120000_fix_cron_urls_and_aade_trigger.sql, every
-- row below should show OK / the correct project ref / SET.
-- ============================================================================
-- HOW TO RUN: Supabase Dashboard → SQL Editor → paste + run (read-only, safe).
-- ============================================================================

-- 1) Auto-dispatch cron jobs -------------------------------------------------
SELECT
  jobname,
  schedule,
  CASE
    WHEN command LIKE '%ojkesspghyqmjmupybva%' THEN 'OK (correct project)'
    WHEN command LIKE '%ajkefntritjjynzofprq%'  THEN 'FAIL (stale project!)'
    ELSE 'CHECK (unexpected URL)'
  END AS url_check,
  CASE
    WHEN command LIKE '%X-Cron-Secret%' THEN 'OK (X-Cron-Secret header)'
    WHEN command LIKE '%Authorization%' THEN 'CHECK (Authorization header)'
    ELSE 'CHECK (no auth header)'
  END AS auth_check
FROM cron.job
WHERE jobname LIKE 'auto-dispatch%'
ORDER BY jobname;

-- 2) AADE autosubmit trigger function ----------------------------------------
SELECT
  p.proname,
  CASE
    WHEN pg_get_functiondef(p.oid) LIKE '%ojkesspghyqmjmupybva%' THEN 'OK (correct project)'
    WHEN pg_get_functiondef(p.oid) LIKE '%ajkefntritjjynzofprq%'  THEN 'FAIL (stale project!)'
    ELSE 'CHECK (unexpected URL)'
  END AS url_check,
  CASE
    WHEN pg_get_functiondef(p.oid) LIKE '%X-Cron-Secret%' THEN 'OK (X-Cron-Secret header)'
    WHEN pg_get_functiondef(p.oid) LIKE '%apikey%'        THEN 'FAIL (apikey header — rejected)'
    ELSE 'CHECK (no auth header)'
  END AS auth_check
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public' AND p.proname = 'trg_aade_autosubmit_on_delivered';

-- 3) Trigger is attached to orders --------------------------------------------
SELECT
  t.tgname,
  CASE WHEN t.tgenabled = 'O' THEN 'OK (enabled)' ELSE 'CHECK (disabled)' END AS state
FROM pg_trigger t
JOIN pg_class c ON c.oid = t.tgrelid
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public' AND c.relname = 'orders' AND t.tgname = 'orders_aade_autosubmit';

-- 4) app.settings.cron_secret GUC --------------------------------------------
SELECT
  CASE
    WHEN current_setting('app.settings.cron_secret', true) IS NOT NULL
      AND current_setting('app.settings.cron_secret', true) <> ''
    THEN 'OK (SET)'
    ELSE 'FAIL (NOT SET — run: ALTER ROLE postgres SET app.settings.cron_secret = ''<CRON_SECRET>'';)'
  END AS cron_secret_guc;
