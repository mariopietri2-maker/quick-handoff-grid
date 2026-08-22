-- =============================================================================
-- rotate_cron_secret.sql
-- -----------------------------------------------------------------------------
-- Rotates the baked-in CRON_SECRET across every pg_cron HTTP job in one shot.
--
-- Background: this project's `postgres` role is NOT a superuser, so the usual
-- `ALTER ROLE postgres SET app.settings.cron_secret …` GUC pattern fails and the
-- secret is instead baked into each job's command (`cron.job.command`) as
-- `'X-Cron-Secret', '<64-hex>'`. That also means a rotation has to touch every
-- job command — which this script does.
--
-- HOW TO USE (Supabase Dashboard → SQL Editor):
--   1) Generate a new secret:  openssl rand -hex 32
--   2) Paste it in place of  __PASTE_NEW_CRON_SECRET_64_HEX__  below.
--   3) Run this script. It updates every cron job whose X-Cron-Secret header
--      contains a 64-hex value, and refuses to run if the placeholder is left.
--   4) ALSO set the edge-function secret to the SAME value:
--        scripts/setup-production-secrets.sh   (or dashboard → Edge Functions
--        → Secrets → CRON_SECRET), otherwise the functions return 401 and the
--        crons will mark alerts/drains as failed again.
-- =============================================================================

DO $$
DECLARE
  new_secret text := '__PASTE_NEW_CRON_SECRET_64_HEX__';
  r record;
  updated int := 0;
BEGIN
  IF new_secret ~ '^[0-9a-fA-F]{64}$' = false THEN
    RAISE EXCEPTION 'Rotate CRON_SECRET: replace __PASTE_NEW_CRON_SECRET_64_HEX__ with a 64-char hex value first (openssl rand -hex 32).';
  END IF;

  FOR r IN
    SELECT jobid, command
      FROM cron.job
     WHERE command LIKE '%X-Cron-Secret%'
  LOOP
    UPDATE cron.job
       SET command = regexp_replace(
             r.command,
             'X-Cron-Secret'', ''[0-9a-fA-F]{64}',
             'X-Cron-Secret'', ''' || new_secret,
             'g'
           )
     WHERE jobid = r.jobid;
    updated := updated + 1;
  END LOOP;

  RAISE NOTICE 'Rotated X-Cron-Secret in % cron job command(s).',
               updated;
END $$;

-- Dry-run check: show the (now-updated) commands so you can eyeball them.
SELECT jobid, jobname, schedule, command
  FROM cron.job
 WHERE command LIKE '%X-Cron-Secret%'
 ORDER BY jobname;
