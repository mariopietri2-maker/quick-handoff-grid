-- Customer status pushes were arriving late (often after delivery) because:
-- 1) every mid-status was enqueued
-- 2) claim_push_outbox paced ONE oldest row per user every ~10s
-- So delivered waited behind accepted/preparing/ready/… in FIFO.
--
-- Fix: supersede unsent same-order statuses on each new status, drain
-- send-push immediately, tighten cron, and skip dead no_tokens head-of-line.

CREATE OR REPLACE FUNCTION public.request_send_push_drain(p_limit integer DEFAULT 20)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_net') THEN
    RETURN;
  END IF;
  PERFORM net.http_post(
    url := 'https://ojkesspghyqmjmupybva.supabase.co/functions/v1/send-push',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'X-Cron-Secret', coalesce(current_setting('app.settings.cron_secret', true), '')
    ),
    body := jsonb_build_object(
      'limit', GREATEST(1, LEAST(COALESCE(p_limit, 20), 40)),
      'source', 'enqueue'
    )
  );
EXCEPTION WHEN OTHERS THEN
  -- Never fail the order transition if drain request fails.
  NULL;
END;
$$;

REVOKE ALL ON FUNCTION public.request_send_push_drain(integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.request_send_push_drain(integer) TO service_role;

CREATE OR REPLACE FUNCTION public.enqueue_customer_status_push()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  title text;
  body text;
BEGIN
  IF NEW.customer_id IS NULL THEN
    RETURN NEW;
  END IF;
  IF NEW.status IS NOT DISTINCT FROM OLD.status THEN
    RETURN NEW;
  END IF;

  CASE NEW.status
    WHEN 'accepted' THEN
      title := 'Παραγγελία αποδεκτή';
      body := 'Το κατάστημα έλαβε την παραγγελία σου.';
    WHEN 'preparing' THEN
      title := 'Ετοιμάζεται';
      body := 'Η παραγγελία σου ετοιμάζεται.';
    WHEN 'ready' THEN
      title := 'Έτοιμη για παραλαβή';
      body := 'Έτοιμη — αναμένει τον οδηγό.';
    WHEN 'arrived' THEN
      title := 'Οδηγός στο κατάστημα';
      body := 'Ο οδηγός έφτασε στο κατάστημα για παραλαβή.';
    WHEN 'picked_up' THEN
      title := 'Ο οδηγός έρχεται!';
      body := 'Ο οδηγός παρέλαβε την παραγγελία και είναι καθ’ οδόν προς εσένα.';
    WHEN 'delivered' THEN
      title := 'Παραδόθηκε';
      body := 'Καλή σου όρεξη! Άφησε μια κριτική.';
    WHEN 'cancelled' THEN
      title := 'Ακυρώθηκε';
      body := 'Η παραγγελία σου ακυρώθηκε.';
    ELSE
      RETURN NEW;
  END CASE;

  -- Drop unsent older statuses for this order so delivered is never stuck
  -- behind a multi-step FIFO queue (matches FCM collapse_key semantics).
  UPDATE public.push_outbox
  SET
    sent_at = coalesce(sent_at, now()),
    error = 'superseded',
    claimed_at = coalesce(claimed_at, now())
  WHERE user_id = NEW.customer_id
    AND app = 'customer'
    AND sent_at IS NULL
    AND coalesce(data->>'type', '') = 'order_status'
    AND coalesce(data->>'order_id', '') = NEW.id::text;

  INSERT INTO public.push_outbox (user_id, app, title, body, data, dedupe_key)
  VALUES (
    NEW.customer_id,
    'customer',
    title,
    body,
    jsonb_build_object(
      'type', 'order_status',
      'order_id', NEW.id,
      'status', NEW.status,
      'path', '/order-tracking/' || NEW.id::text,
      'collapse_key', 'order:' || NEW.id::text
    ),
    'order:' || NEW.id::text || ':' || NEW.status
  )
  ON CONFLICT (dedupe_key) DO UPDATE
    SET
      title = EXCLUDED.title,
      body = EXCLUDED.body,
      data = EXCLUDED.data,
      sent_at = NULL,
      claimed_at = NULL,
      error = NULL,
      created_at = now();

  -- Fire send-push immediately (cron remains as backup).
  PERFORM public.request_send_push_drain(24);

  RETURN NEW;
END;
$$;

-- Prefer newest customer order_status per user; keep FIFO for driver offers.
CREATE OR REPLACE FUNCTION public.claim_push_outbox(p_limit integer DEFAULT 10)
RETURNS SETOF public.push_outbox
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Unblock queues stuck on missing tokens for >2 minutes.
  UPDATE public.push_outbox
  SET
    sent_at = now(),
    error = 'skipped_no_tokens'
  WHERE sent_at IS NULL
    AND coalesce(error, '') = 'no_tokens'
    AND claimed_at IS NOT NULL
    AND claimed_at < now() - interval '2 minutes'
    AND created_at > now() - interval '6 hours';

  RETURN QUERY
  WITH ranked AS (
    SELECT
      o.id,
      o.created_at,
      ROW_NUMBER() OVER (
        PARTITION BY o.user_id
        ORDER BY
          CASE
            WHEN o.app = 'customer'
                 AND coalesce(o.data->>'type', '') = 'order_status'
              THEN o.created_at
            ELSE NULL
          END DESC NULLS LAST,
          o.created_at ASC
      ) AS rn
    FROM public.push_outbox o
    WHERE o.sent_at IS NULL
      AND o.created_at > now() - interval '6 hours'
      AND coalesce(o.error, '') IS DISTINCT FROM 'stale_backlog_cleared'
      AND coalesce(o.error, '') IS DISTINCT FROM 'superseded'
      AND coalesce(o.error, '') IS DISTINCT FROM 'skipped_no_tokens'
      AND (
        o.claimed_at IS NULL
        OR o.claimed_at < now() - interval '45 seconds'
      )
  ),
  picked AS (
    SELECT p.id
    FROM public.push_outbox p
    INNER JOIN ranked r ON r.id = p.id AND r.rn = 1
    ORDER BY r.created_at ASC
    LIMIT GREATEST(1, LEAST(COALESCE(p_limit, 10), 40))
    FOR UPDATE OF p SKIP LOCKED
  )
  UPDATE public.push_outbox o
  SET claimed_at = now(),
      error = 'sending'
  FROM picked
  WHERE o.id = picked.id
  RETURNING o.*;
END;
$$;

REVOKE ALL ON FUNCTION public.claim_push_outbox(integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.claim_push_outbox(integer) TO service_role;

-- One-time: collapse existing pending customer order status backlog per order
-- to the newest status only.
WITH pending AS (
  SELECT
    id,
    user_id,
    data->>'order_id' AS order_id,
    created_at,
    ROW_NUMBER() OVER (
      PARTITION BY user_id, data->>'order_id'
      ORDER BY created_at DESC
    ) AS rn
  FROM public.push_outbox
  WHERE sent_at IS NULL
    AND app = 'customer'
    AND coalesce(data->>'type', '') = 'order_status'
    AND coalesce(data->>'order_id', '') <> ''
)
UPDATE public.push_outbox o
SET
  sent_at = now(),
  error = 'superseded_backlog',
  claimed_at = coalesce(o.claimed_at, now())
FROM pending p
WHERE o.id = p.id
  AND p.rn > 1;

-- Faster backup drain (immediate enqueue drain is primary for customers).
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron')
     AND EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_net') THEN
    BEGIN
      PERFORM cron.unschedule('send-push-10s');
    EXCEPTION WHEN OTHERS THEN NULL;
    END;
    BEGIN
      PERFORM cron.unschedule('send-push-5s');
    EXCEPTION WHEN OTHERS THEN NULL;
    END;
    PERFORM cron.schedule(
      'send-push-5s',
      '5 seconds',
      $cron$
      SELECT net.http_post(
        url := 'https://ojkesspghyqmjmupybva.supabase.co/functions/v1/send-push',
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

-- Kick an immediate drain for whatever is still pending after backlog cleanup.
SELECT public.request_send_push_drain(30);
