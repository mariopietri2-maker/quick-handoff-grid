-- Fix stale Supabase project URLs + auth headers in the auto-dispatch crons and
-- the AADE autosubmit trigger.
--
-- batch_12 (20260709230542) recreated the auto-dispatch pg_cron jobs pointing at
-- the OLD project (ajkefntritjjynzofprq) with that project's anon key, and both
-- 20260521142148 and batch_12 left the AADE trigger hitting the old project with
-- only an `apikey` header (which aade-submit-delivery rejects — it requires the
-- service-role key, a CRON_SECRET, or an admin JWT).
--
-- This migration re-schedules the jobs and re-creates the trigger against the
-- real project (ojkesspghyqmjmupybva) using the X-Cron-Secret pattern already
-- used by the send-push cron.
--
-- Before relying on these, set the GUC (must match the edge function secret
-- CRON_SECRET):
--   ALTER ROLE postgres SET app.settings.cron_secret = '<CRON_SECRET>';

-- 1) Rebuild auto-dispatch crons (safe on fresh DBs; missing jobs ignored).
DO $$
DECLARE
  j text;
BEGIN
  FOREACH j IN ARRAY ARRAY[
    'auto-dispatch-10s-0','auto-dispatch-10s-30',
    'auto-dispatch-30s-0','auto-dispatch-30s-30'
  ] LOOP
    BEGIN
      PERFORM cron.unschedule(j);
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'cron.unschedule(%) skipped: %', j, SQLERRM;
    END;
  END LOOP;
END $$;

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

-- 2) Re-create the AADE autosubmit trigger against the correct project with the
--    cron-secret header aade-submit-delivery actually accepts.
CREATE OR REPLACE FUNCTION public.trg_aade_autosubmit_on_delivered()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_enabled boolean;
BEGIN
  IF NEW.status::text <> 'delivered' THEN
    RETURN NEW;
  END IF;
  IF OLD.status::text = 'delivered' THEN
    RETURN NEW;
  END IF;

  SELECT platform_reporting_enabled INTO v_enabled
  FROM public.aade_platform_config
  LIMIT 1;
  IF COALESCE(v_enabled, false) = false THEN
    RETURN NEW;
  END IF;

  -- Skip if already sent
  IF EXISTS (
    SELECT 1 FROM public.aade_delivery_reports
    WHERE order_id = NEW.id AND status = 'sent'
  ) THEN
    RETURN NEW;
  END IF;

  PERFORM net.http_post(
    url := 'https://ojkesspghyqmjmupybva.supabase.co/functions/v1/aade-submit-delivery',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'X-Cron-Secret', coalesce(current_setting('app.settings.cron_secret', true), '')
    ),
    body := jsonb_build_object('order_id', NEW.id)
  );

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- never block order updates due to reporting failures
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS orders_aade_autosubmit ON public.orders;
CREATE TRIGGER orders_aade_autosubmit
AFTER UPDATE OF status ON public.orders
FOR EACH ROW
EXECUTE FUNCTION public.trg_aade_autosubmit_on_delivered();
