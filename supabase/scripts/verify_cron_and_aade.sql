-- ============================================================================
-- VERIFY cron jobs + AADE autosubmit trigger (read-only diagnostic)
-- ============================================================================
-- Checks that the auto-dispatch pg_cron jobs and the AADE autosubmit trigger
-- point at the REAL Supabase project (ojkesspghyqmjmupybva) and authenticate
-- via X-Cron-Secret, and that the secret is BAKED (as a literal 64-hex value)
-- into each cron command by supabase/scripts/rotate_cron_secret.sql.
--
-- After applying 20260812120000_fix_cron_urls_and_aade_trigger.sql and running
-- rotate_cron_secret.sql, every row below should show OK / the correct project
-- ref / a literal 64-hex secret.
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

-- 4) X-Cron-Secret is BAKED as a literal 64-hex into each cron command ----------
--    The postgres role here is NOT superuser, so the canonical
--    `ALTER ROLE ... SET app.settings.cron_secret` GUC pattern fails and is never
--    read at runtime. Instead the secret is baked into cron.job.command by
--    supabase/scripts/rotate_cron_secret.sql and must match the edge-function
--    CRON_SECRET. Checks: (a) every header-declaring job carries a real literal,
--    (b) all jobs share the SAME literal, (c) the AADE trigger bakes one too.
WITH baked AS (
  SELECT
    jobname,
    substring(command from '''X-Cron-Secret'', ''([0-9a-fA-F]{64})''') AS secret
  FROM cron.job
  WHERE command LIKE '%X-Cron-Secret%'
)
-- 4a) header present but NO literal 64-hex (empty/GUC expression) = not rotated
SELECT
  jobname,
  CASE
    WHEN secret IS NOT NULL THEN 'OK (literal baked)'
    ELSE 'FAIL (no literal 64-hex secret — run rotate_cron_secret.sql)'
  END AS baked_secret_check
FROM baked
ORDER BY jobname;

-- 4b) a rotation must never be left half-applied (all jobs agree on ONE secret)
SELECT
  CASE
    WHEN count(*) = 0 THEN 'OK (no X-Cron-Secret jobs to check)'
    WHEN count(*) = count(secret) AND count(DISTINCT secret) = 1
      THEN 'OK (single shared secret across ' || count(*) || ' job(s))'
    ELSE 'FAIL (inconsistent or missing secrets — re-run rotate_cron_secret.sql)'
  END AS baked_secret_consistency
FROM baked;

-- 4c) the AADE autosubmit trigger function must bake the same literal secret
SELECT
  CASE
    WHEN pg_get_functiondef(p.oid) ~ '''X-Cron-Secret'', ''[0-9a-fA-F]{64}'''
      THEN 'OK (literal baked)'
    WHEN pg_get_functiondef(p.oid) LIKE '%X-Cron-Secret%'
      THEN 'FAIL (header present but not a literal — run rotate_cron_secret.sql)'
    ELSE 'FAIL (no X-Cron-Secret header)'
  END AS trigger_secret_check
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public' AND p.proname = 'trg_aade_autosubmit_on_delivered';
