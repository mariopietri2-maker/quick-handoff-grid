-- Fix push delivery: retryable claims, one-per-user pacing, full customer
-- status chronology, and one-at-a-time driver offer FCM.

ALTER TABLE public.push_outbox
  ADD COLUMN IF NOT EXISTS claimed_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_push_outbox_pending_claim
  ON public.push_outbox (created_at ASC)
  WHERE sent_at IS NULL;

-- Customer: chronological kitchen/delivery statuses (not only picked_up/delivered).
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
  ON CONFLICT (dedupe_key) DO NOTHING;
  RETURN NEW;
END;
$$;

-- Driver offers: only FCM the oldest live pending offer (UI shows one at a time).
CREATE OR REPLACE FUNCTION public.enqueue_offer_push()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'pending' THEN
    -- Older pending offer already owns the driver's attention — skip FCM.
    IF EXISTS (
      SELECT 1
      FROM public.pending_offers po
      WHERE po.driver_id = NEW.driver_id
        AND po.status = 'pending'
        AND po.id IS DISTINCT FROM NEW.id
        AND po.created_at < NEW.created_at
    ) THEN
      RETURN NEW;
    END IF;

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
        'path', '/driver',
        'collapse_key', 'driver-offer:' || NEW.driver_id::text
      ),
      'offer:' || NEW.id::text
    )
    ON CONFLICT (dedupe_key) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;

-- When an offer leaves pending, notify for the next oldest pending offer (if any).
CREATE OR REPLACE FUNCTION public.enqueue_next_offer_push()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  next_offer public.pending_offers%ROWTYPE;
BEGIN
  IF TG_OP = 'UPDATE'
     AND OLD.status = 'pending'
     AND NEW.status IS DISTINCT FROM 'pending' THEN
    SELECT * INTO next_offer
    FROM public.pending_offers po
    WHERE po.driver_id = NEW.driver_id
      AND po.status = 'pending'
    ORDER BY po.created_at ASC
    LIMIT 1;

    IF FOUND THEN
      INSERT INTO public.push_outbox (user_id, app, title, body, data, dedupe_key)
      VALUES (
        next_offer.driver_id,
        'driver',
        'Νέα παράδοση!',
        'Έχεις νέα προσφορά παραγγελίας — άνοιξε την εφαρμογή για αποδοχή.',
        jsonb_build_object(
          'type', 'offer',
          'order_id', next_offer.order_id,
          'offer_id', next_offer.id,
          'path', '/driver',
          'collapse_key', 'driver-offer:' || next_offer.driver_id::text
        ),
        'offer:' || next_offer.id::text
      )
      ON CONFLICT (dedupe_key) DO NOTHING;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enqueue_next_offer_push ON public.pending_offers;
CREATE TRIGGER trg_enqueue_next_offer_push
  AFTER UPDATE OF status ON public.pending_offers
  FOR EACH ROW
  EXECUTE FUNCTION public.enqueue_next_offer_push();

-- Claim: at most one row per user, FIFO, retryable (sent_at only set by send-push on success).
CREATE OR REPLACE FUNCTION public.claim_push_outbox(p_limit integer DEFAULT 10)
RETURNS SETOF public.push_outbox
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  WITH ranked AS (
    SELECT
      o.id,
      o.created_at,
      ROW_NUMBER() OVER (PARTITION BY o.user_id ORDER BY o.created_at ASC) AS rn
    FROM public.push_outbox o
    WHERE o.sent_at IS NULL
      AND o.created_at > now() - interval '6 hours'
      AND coalesce(o.error, '') IS DISTINCT FROM 'stale_backlog_cleared'
      AND (
        o.claimed_at IS NULL
        OR o.claimed_at < now() - interval '90 seconds'
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

-- Smaller paced drains every 10s (one notification per user per tick).
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron')
     AND EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_net') THEN
    BEGIN
      PERFORM cron.unschedule('send-push-15s');
    EXCEPTION WHEN OTHERS THEN NULL;
    END;
    BEGIN
      PERFORM cron.unschedule('send-push-10s');
    EXCEPTION WHEN OTHERS THEN NULL;
    END;
    PERFORM cron.schedule(
      'send-push-10s',
      '10 seconds',
      $cron$
      SELECT net.http_post(
        url := 'https://ojkesspghyqmjmupybva.supabase.co/functions/v1/send-push',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'X-Cron-Secret', coalesce(current_setting('app.settings.cron_secret', true), '')
        ),
        body := '{"limit":12,"source":"cron"}'::jsonb
      );
      $cron$
    );
  END IF;
END $$;
