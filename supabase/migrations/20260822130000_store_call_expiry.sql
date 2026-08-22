-- Store driver calls: auto-expire open calls after 3 minutes
-- An ignored call must never trap the driver UI or block the store from re-calling.
-- create_store_driver_call returns any existing 'open' call, so expiry unblocks both sides.

SELECT cron.unschedule('store-call-expiry')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'store-call-expiry');

SELECT cron.schedule(
  'store-call-expiry',
  '30 seconds',
  $$
  UPDATE public.store_driver_calls
     SET status = 'closed'
   WHERE status = 'open'
     AND created_at < now() - interval '3 minutes'
  $$
);
