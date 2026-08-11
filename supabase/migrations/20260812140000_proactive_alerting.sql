-- =============================================================================
-- Proactive alerting
-- -----------------------------------------------------------------------------
-- Outbox-style alert queue drained by the send-alerts edge function to a
-- webhook (Slack or any generic JSON endpoint). Also ships a watchdog that
-- flags orders stuck in an active status so support is alerted before the
-- customer complains.
--
-- Enqueue from anywhere:
--   SELECT public.enqueue_alert('stuck_order', 'warn', 'Title', 'Body',
--                               jsonb_build_object('order_id', id), 'dedupe:key');
-- Crons:
--   send-alerts-30s          → drain alert_outbox → ALERT_WEBHOOK_URL
--   watchdog-stuck-orders-5m → watchdog_check_stuck_orders()
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.alert_outbox (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  channel text NOT NULL DEFAULT 'webhook',      -- webhook | slack
  event_type text NOT NULL,
  severity text NOT NULL DEFAULT 'info',        -- info | warn | error | critical
  title text NOT NULL,
  body text,
  data jsonb,
  dedupe_key text,
  created_at timestamptz NOT NULL DEFAULT now(),
  sent_at timestamptz,
  attempts integer NOT NULL DEFAULT 0,
  error text
);

CREATE UNIQUE INDEX IF NOT EXISTS alert_outbox_dedupe_key_unique
  ON public.alert_outbox (dedupe_key);

ALTER TABLE public.alert_outbox ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins view alert outbox" ON public.alert_outbox;
CREATE POLICY "Admins view alert outbox" ON public.alert_outbox
  FOR SELECT USING (is_support_or_admin(auth.uid()));

-- -----------------------------------------------------------------------------
-- Enqueue an alert (idempotent via dedupe_key). Security definer so it can be
-- called from triggers, edge functions and authenticated support/admin clients.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.enqueue_alert(
  p_event_type text DEFAULT NULL,
  p_severity text DEFAULT 'info',
  p_title text DEFAULT NULL,
  p_body text DEFAULT NULL,
  p_data jsonb DEFAULT NULL,
  p_dedupe_key text DEFAULT NULL,
  p_channel text DEFAULT 'webhook'
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id uuid;
BEGIN
  IF p_event_type IS NULL OR p_title IS NULL THEN
    RETURN NULL;
  END IF;
  -- Only support/admin (UI/RPC) or the service role / cron (no auth.uid())
  -- may enqueue alerts, so a random customer can't spam the ops webhook.
  IF auth.uid() IS NOT NULL AND NOT is_support_or_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;
  IF NOT p_severity IN ('info', 'warn', 'error', 'critical') THEN
    p_severity := 'info';
  END IF;
  INSERT INTO public.alert_outbox (channel, event_type, severity, title, body, data, dedupe_key)
  VALUES (p_channel, p_event_type, p_severity, p_title, p_body, p_data, p_dedupe_key)
  ON CONFLICT (dedupe_key) DO NOTHING
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;

REVOKE ALL ON FUNCTION public.enqueue_alert(text, text, text, text, jsonb, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.enqueue_alert(text, text, text, text, jsonb, text, text)
  TO authenticated, service_role;

-- -----------------------------------------------------------------------------
-- Claim pending alerts (concurrent-drain safe)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.claim_alert_outbox(p_limit integer DEFAULT 20)
RETURNS SETOF public.alert_outbox
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  WITH picked AS (
    SELECT id
    FROM public.alert_outbox
    WHERE sent_at IS NULL
      AND COALESCE(error, '') <> 'no_webhook_url'
      AND attempts < 10
    ORDER BY created_at ASC
    LIMIT GREATEST(1, LEAST(COALESCE(p_limit, 20), 100))
    FOR UPDATE SKIP LOCKED
  )
  UPDATE public.alert_outbox a
  SET error = 'sending',
      attempts = a.attempts + 1
  FROM picked
  WHERE a.id = picked.id
  RETURNING a.*;
END;
$$;

REVOKE ALL ON FUNCTION public.claim_alert_outbox(integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.claim_alert_outbox(integer) TO service_role;

-- -----------------------------------------------------------------------------
-- Complete an alert send. Failure keeps sent_at NULL so it is retried next run.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.complete_alert_send(
  p_id uuid,
  p_succeeded boolean,
  p_error text DEFAULT NULL
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_succeeded THEN
    UPDATE public.alert_outbox
    SET sent_at = now(), error = NULL
    WHERE id = p_id;
  ELSE
    UPDATE public.alert_outbox
    SET error = LEFT(COALESCE(p_error, 'send failed'), 500)
    WHERE id = p_id;
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.complete_alert_send(uuid, boolean, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.complete_alert_send(uuid, boolean, text) TO service_role;

-- -----------------------------------------------------------------------------
-- Watchdog: flag orders stuck in an active status.
--   placed   > 15 min  (never dispatched / dispatch failed)   → critical
--   accepted > 60 min  (store accepted, driver never en route) → warn
--   preparing> 30 min  (store slow or status not updated)      → warn
--   picked_up> 40 min  (driver stuck en route)                 → warn
-- Fires once per order+status via the dedupe key.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.watchdog_check_stuck_orders()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  rec RECORD;
  v_count integer := 0;
BEGIN
  FOR rec IN
    SELECT o.id, o.status,
           EXTRACT(EPOCH FROM (now() - o.updated_at))::integer AS age_seconds
      FROM public.orders o
     WHERE o.status IN ('placed', 'accepted', 'preparing', 'picked_up')
       AND o.updated_at < now() - interval '15 minutes'
     ORDER BY o.updated_at ASC
     LIMIT 200
  LOOP
    IF (rec.status = 'placed'     AND rec.age_seconds <  900) THEN CONTINUE; END IF;
    IF (rec.status = 'accepted'   AND rec.age_seconds < 3600) THEN CONTINUE; END IF;
    IF (rec.status = 'preparing'  AND rec.age_seconds < 1800) THEN CONTINUE; END IF;
    IF (rec.status = 'picked_up'  AND rec.age_seconds < 2400) THEN CONTINUE; END IF;

    PERFORM public.enqueue_alert(
      p_event_type => 'stuck_order',
      p_severity   => CASE WHEN rec.status = 'placed' THEN 'critical' ELSE 'warn' END,
      p_title      => 'Stuck order #' || substring(rec.id::text, 1, 8),
      p_body       => 'Order is stuck in status ' || rec.status || ' for '
                      || (rec.age_seconds / 60)::text || ' minutes',
      p_data       => jsonb_build_object(
        'order_id', rec.id,
        'status', rec.status,
        'age_seconds', rec.age_seconds
      ),
      p_dedupe_key => 'stuck_order:' || rec.id::text || ':' || rec.status
    );
    v_count := v_count + 1;
  END LOOP;
  RETURN v_count;
END;
$$;

REVOKE ALL ON FUNCTION public.watchdog_check_stuck_orders() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.watchdog_check_stuck_orders() TO service_role;

-- -----------------------------------------------------------------------------
-- Crons
-- -----------------------------------------------------------------------------
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron')
     AND EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_net') THEN
    BEGIN
      PERFORM cron.unschedule('send-alerts-30s');
    EXCEPTION WHEN OTHERS THEN NULL;
    END;
    PERFORM cron.schedule(
      'send-alerts-30s',
      '30 seconds',
      $cron$
      SELECT net.http_post(
        url := 'https://ojkesspghyqmjmupybva.supabase.co/functions/v1/send-alerts',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'X-Cron-Secret', coalesce(current_setting('app.settings.cron_secret', true), '')
        ),
        body := '{"limit":20,"source":"cron"}'::jsonb
      );
      $cron$
    );
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    BEGIN
      PERFORM cron.unschedule('watchdog-stuck-orders-5m');
    EXCEPTION WHEN OTHERS THEN NULL;
    END;
    PERFORM cron.schedule(
      'watchdog-stuck-orders-5m',
      '*/5 * * * *',
      $cron$
      SELECT public.watchdog_check_stuck_orders();
      $cron$
    );
  END IF;
END $$;
