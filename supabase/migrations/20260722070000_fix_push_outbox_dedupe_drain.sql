-- Dedupe + claim push_outbox so drains don't flood / double-send.
-- Also schedule an independent send-push cron (not only auto-dispatch success path).

ALTER TABLE public.push_outbox
  ADD COLUMN IF NOT EXISTS dedupe_key text;

DROP INDEX IF EXISTS uq_push_outbox_dedupe_key;
CREATE UNIQUE INDEX uq_push_outbox_dedupe_key
  ON public.push_outbox (dedupe_key);

-- Drop stale backlog that would otherwise dump as a burst once FCM works again.
UPDATE public.push_outbox
SET sent_at = COALESCE(sent_at, now()),
    error = COALESCE(NULLIF(error, ''), 'stale_backlog_cleared')
WHERE sent_at IS NULL
  AND created_at < now() - interval '30 minutes';

CREATE OR REPLACE FUNCTION public.enqueue_offer_push()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'pending' THEN
    INSERT INTO public.push_outbox (user_id, app, title, body, data, dedupe_key)
    VALUES (
      NEW.driver_id,
      'driver',
      'Νέα παράδοση!',
      'Έχεις νέα προσφορά παραγγελίας — άνοιξε την εφαρμογή για αποδοχή.',
      jsonb_build_object(
        'type', 'offer',
        'order_id', NEW.order_id,
        'offer_id', NEW.id,
        'path', '/driver'
      ),
      'offer:' || NEW.id::text
    )
    ON CONFLICT (dedupe_key) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;

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

  -- High-signal transitions only (stops intermediate status spam / backlog dumps).
  CASE NEW.status
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
      'path', '/order-tracking/' || NEW.id::text
    ),
    'order:' || NEW.id::text || ':' || NEW.status
  )
  ON CONFLICT (dedupe_key) DO NOTHING;
  RETURN NEW;
END;
$$;

-- Claim pending rows (sets sent_at immediately) so concurrent drains cannot double-send.
CREATE OR REPLACE FUNCTION public.claim_push_outbox(p_limit integer DEFAULT 40)
RETURNS SETOF public.push_outbox
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  WITH picked AS (
    SELECT id
    FROM public.push_outbox
    WHERE sent_at IS NULL
    ORDER BY created_at ASC
    LIMIT GREATEST(1, LEAST(COALESCE(p_limit, 40), 100))
    FOR UPDATE SKIP LOCKED
  )
  UPDATE public.push_outbox o
  SET sent_at = now(),
      error = 'sending'
  FROM picked
  WHERE o.id = picked.id
  RETURNING o.*;
END;
$$;

REVOKE ALL ON FUNCTION public.claim_push_outbox(integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.claim_push_outbox(integer) TO service_role;

-- Independent drain so pushes don't wait for a successful auto-dispatch run.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron')
     AND EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_net') THEN
    BEGIN
      PERFORM cron.unschedule('send-push-15s');
    EXCEPTION WHEN OTHERS THEN NULL;
    END;
    PERFORM cron.schedule(
      'send-push-15s',
      '15 seconds',
      $cron$
      SELECT net.http_post(
        url := 'https://ojkesspghyqmjmupybva.supabase.co/functions/v1/send-push',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'X-Cron-Secret', coalesce(current_setting('app.settings.cron_secret', true), '')
        ),
        body := '{"limit":40,"source":"cron"}'::jsonb
      );
      $cron$
    );
  END IF;
END $$;
