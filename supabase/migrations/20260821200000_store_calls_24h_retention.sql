-- Store-driver call history auto-deletes after 24 hours.
--
-- Role N/K store calls are ephemeral side-project signals: once a call is
-- answered (or missed) there is nothing worth keeping. This prunes every
-- store_driver_calls row older than 24h so the table stays tiny and no
-- history accumulates.
--
-- Mirrors the nightly_cleanup_cron pattern: SECURITY DEFINER function pins
-- search_path; pg_cron runs it hourly at :05.
-- NOTE: like every cron in this project, the schedule must be re-created
-- manually if migrations are replayed from scratch (see GO_LIVE.md note).

CREATE OR REPLACE FUNCTION public.prune_old_store_calls()
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_deleted bigint;
BEGIN
  DELETE FROM public.store_driver_calls
  WHERE created_at < now() - interval '24 hours';
  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  RETURN v_deleted;
END;
$$;

-- Hourly at :05 (avoids colliding with the nightly 03:17 order prune).
DO $do$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'store-calls-24h-cleanup') THEN
    PERFORM cron.unschedule('store-calls-24h-cleanup');
  END IF;
  PERFORM cron.schedule(
    'store-calls-24h-cleanup',
    '5 * * * *',
    $cmd$SELECT public.prune_old_store_calls()$cmd$
  );
END
$do$;

COMMENT ON FUNCTION public.prune_old_store_calls() IS
'Deletes store_driver_calls older than 24h (role N/K side project). Calls never create orders, earnings or wallet transactions - drivers are not paid through the platform for them.';
