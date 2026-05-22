
-- Drop 4 of the 6 staggered dispatch jobs; keep 2 (0s and 30s offset).
SELECT cron.unschedule('auto-dispatch-10s-10');
SELECT cron.unschedule('auto-dispatch-10s-20');
SELECT cron.unschedule('auto-dispatch-10s-40');
SELECT cron.unschedule('auto-dispatch-10s-50');

-- Rebuild remaining two to fire once at :00 and once at :30 (instead of every 10s).
SELECT cron.unschedule('auto-dispatch-10s-0');
SELECT cron.unschedule('auto-dispatch-10s-30');

SELECT cron.schedule(
  'auto-dispatch-30s-0',
  '* * * * *',
  $$SELECT net.http_post(
      url:='https://ajkefntritjjynzofprq.supabase.co/functions/v1/auto-dispatch',
      headers:='{"Content-Type":"application/json","Authorization":"Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFqa2VmbnRyaXRqanluem9mcHJxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUxNzI2MTEsImV4cCI6MjA5MDc0ODYxMX0.Iyf-emE5fzsomvpiHxqxyRu5fybO4b8DRj00QvqTcjk"}'::jsonb,
      body:='{"source":"cron"}'::jsonb
   ) AS request_id;$$
);

SELECT cron.schedule(
  'auto-dispatch-30s-30',
  '* * * * *',
  $$SELECT pg_sleep(30); SELECT net.http_post(
      url:='https://ajkefntritjjynzofprq.supabase.co/functions/v1/auto-dispatch',
      headers:='{"Content-Type":"application/json","Authorization":"Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFqa2VmbnRyaXRqanluem9mcHJxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUxNzI2MTEsImV4cCI6MjA5MDc0ODYxMX0.Iyf-emE5fzsomvpiHxqxyRu5fybO4b8DRj00QvqTcjk"}'::jsonb,
      body:='{"source":"cron"}'::jsonb
   ) AS request_id;$$
);
