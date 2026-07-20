/*
  Ops note (applied as no-op):
  auto-dispatch no longer accepts the public anon JWT as a cron credential.
  Configure edge function secret CRON_SECRET and update pg_cron / scheduler
  headers to send either:
    Authorization: Bearer <CRON_SECRET>
    or X-Cron-Secret: <CRON_SECRET>
*/
SELECT 1;
