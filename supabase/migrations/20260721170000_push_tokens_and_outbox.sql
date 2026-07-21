/*
  Device push tokens for Capacitor FCM / APNs.
  Remote push is required when the app is backgrounded or the phone is locked.
*/

CREATE TABLE IF NOT EXISTS public.push_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  token text NOT NULL,
  platform text NOT NULL DEFAULT 'android',
  app text NOT NULL CHECK (app IN ('customer', 'driver', 'store', 'admin')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (token)
);

CREATE INDEX IF NOT EXISTS idx_push_tokens_user_app
  ON public.push_tokens (user_id, app);

ALTER TABLE public.push_tokens ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users manage own push tokens" ON public.push_tokens;
CREATE POLICY "Users manage own push tokens"
  ON public.push_tokens
  FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Service role all push tokens" ON public.push_tokens;
-- service role bypasses RLS; no extra policy needed.

/*
  Outbox so dispatch / status changes can enqueue pushes without waiting
  on the client. Drained by the send-push edge function (and auto-dispatch).
*/
CREATE TABLE IF NOT EXISTS public.push_outbox (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  app text NOT NULL CHECK (app IN ('customer', 'driver', 'store', 'admin')),
  title text NOT NULL,
  body text NOT NULL,
  data jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  sent_at timestamptz,
  error text
);

CREATE INDEX IF NOT EXISTS idx_push_outbox_pending
  ON public.push_outbox (created_at)
  WHERE sent_at IS NULL;

ALTER TABLE public.push_outbox ENABLE ROW LEVEL SECURITY;

-- No client access — only service role / edge functions.
DROP POLICY IF EXISTS "No direct client access to push_outbox" ON public.push_outbox;
CREATE POLICY "No direct client access to push_outbox"
  ON public.push_outbox
  FOR SELECT
  TO authenticated
  USING (false);

-- Enqueue driver offer pushes when a pending_offer is created.
CREATE OR REPLACE FUNCTION public.enqueue_offer_push()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'pending' THEN
    INSERT INTO public.push_outbox (user_id, app, title, body, data)
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
      )
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enqueue_offer_push ON public.pending_offers;
CREATE TRIGGER trg_enqueue_offer_push
  AFTER INSERT ON public.pending_offers
  FOR EACH ROW
  EXECUTE FUNCTION public.enqueue_offer_push();

-- Enqueue customer status pushes (driver en route / arriving / delivered).
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
      title := 'Έτοιμη';
      body := 'Έτοιμη — αναμένει τον οδηγό.';
    WHEN 'picked_up' THEN
      title := 'Ο οδηγός έρχεται!';
      body := 'Ο οδηγός παρέλαβε την παραγγελία και είναι καθ’ οδόν προς εσένα.';
    WHEN 'arrived' THEN
      title := 'Ο οδηγός στο κατάστημα';
      body := 'Ο οδηγός έφτασε στο κατάστημα για παραλαβή.';
    WHEN 'delivered' THEN
      title := 'Παραδόθηκε';
      body := 'Καλή σου όρεξη! Άφησε μια κριτική.';
    WHEN 'cancelled' THEN
      title := 'Ακυρώθηκε';
      body := 'Η παραγγελία σου ακυρώθηκε.';
    ELSE
      RETURN NEW;
  END CASE;

  INSERT INTO public.push_outbox (user_id, app, title, body, data)
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
    )
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enqueue_customer_status_push ON public.orders;
CREATE TRIGGER trg_enqueue_customer_status_push
  AFTER UPDATE OF status ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION public.enqueue_customer_status_push();
