-- Rebuild dispatch cron for this environment. Safe on fresh DBs (missing jobs ignored).
DO $$
DECLARE
  j text;
BEGIN
  FOREACH j IN ARRAY ARRAY[
    'auto-dispatch-10s-10','auto-dispatch-10s-20','auto-dispatch-10s-40','auto-dispatch-10s-50',
    'auto-dispatch-10s-0','auto-dispatch-10s-30','auto-dispatch-30s-0','auto-dispatch-30s-30'
  ] LOOP
    BEGIN
      PERFORM cron.unschedule(j);
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'cron.unschedule(%) skipped: %', j, SQLERRM;
    END;
  END LOOP;
END $$;

-- Point cron at the new project. Set app.settings.cron_secret (or edge CRON_SECRET
-- via a vault-backed setting) before relying on these jobs.
SELECT cron.schedule(
  'auto-dispatch-30s-0',
  '* * * * *',
  $$SELECT net.http_post(
      url:='https://ojkesspghyqmjmupybva.supabase.co/functions/v1/auto-dispatch',
      headers:=jsonb_build_object(
        'Content-Type','application/json',
        'X-Cron-Secret', coalesce(current_setting('app.settings.cron_secret', true), '')
      ),
      body:='{"source":"cron"}'::jsonb
   ) AS request_id;$$
);

SELECT cron.schedule(
  'auto-dispatch-30s-30',
  '* * * * *',
  $$SELECT pg_sleep(30); SELECT net.http_post(
      url:='https://ojkesspghyqmjmupybva.supabase.co/functions/v1/auto-dispatch',
      headers:=jsonb_build_object(
        'Content-Type','application/json',
        'X-Cron-Secret', coalesce(current_setting('app.settings.cron_secret', true), '')
      ),
      body:='{"source":"cron"}'::jsonb
   ) AS request_id;$$
);
