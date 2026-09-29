-- Restore store coverage in session open-check + close RPC (regressed by driver migration).
CREATE OR REPLACE FUNCTION public.check_live_chat_session_open()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_status text;
BEGIN
  IF NEW.sender_role IN ('support', 'admin') THEN
    RETURN NEW;
  END IF;

  IF NEW.customer_id IS NOT NULL AND NEW.sender_role = 'customer' THEN
    SELECT status INTO v_status
    FROM public.live_chat_sessions
    WHERE customer_id = NEW.customer_id
    ORDER BY created_at DESC LIMIT 1;
    IF v_status = 'closed' THEN
      RAISE EXCEPTION 'This live chat is closed. Start a new request.';
    END IF;
  END IF;

  IF NEW.driver_id IS NOT NULL AND NEW.sender_role = 'driver' THEN
    SELECT status INTO v_status
    FROM public.live_chat_sessions
    WHERE driver_id = NEW.driver_id
    ORDER BY created_at DESC LIMIT 1;
    IF v_status = 'closed' THEN
      RAISE EXCEPTION 'This live chat is closed. Start a new request.';
    END IF;
  END IF;

  IF NEW.store_id IS NOT NULL AND NEW.sender_role = 'store' THEN
    SELECT status INTO v_status
    FROM public.live_chat_sessions
    WHERE store_id = NEW.store_id
    ORDER BY created_at DESC LIMIT 1;
    IF v_status = 'closed' THEN
      RAISE EXCEPTION 'This live chat is closed. Start a new request.';
    END IF;
  END IF;

  RETURN NEW;
END
$fn$;

CREATE OR REPLACE FUNCTION public.close_live_chat_for_user(p_participant_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_updated int;
BEGIN
  IF NOT (
    public.has_role(auth.uid(), 'support'::public.app_role)
    OR public.has_role(auth.uid(), 'admin'::public.app_role)
  ) THEN
    RAISE EXCEPTION 'Only support can close live chat';
  END IF;

  UPDATE public.live_chat_sessions
  SET status = 'closed', closed_at = now(), updated_at = now()
  WHERE status = 'open'
    AND (
      customer_id = p_participant_id
      OR driver_id = p_participant_id
      OR store_id = p_participant_id
    );

  GET DIAGNOSTICS v_updated = ROW_COUNT;

  IF v_updated = 0 THEN
    IF EXISTS (SELECT 1 FROM public.live_chat_messages m WHERE m.driver_id = p_participant_id LIMIT 1) THEN
      INSERT INTO public.live_chat_sessions (driver_id, status, topic, closed_at)
      VALUES (p_participant_id, 'closed', 'closed_by_support', now());
    ELSIF EXISTS (SELECT 1 FROM public.live_chat_messages m WHERE m.customer_id = p_participant_id LIMIT 1) THEN
      INSERT INTO public.live_chat_sessions (customer_id, status, topic, closed_at)
      VALUES (p_participant_id, 'closed', 'closed_by_support', now());
    ELSIF EXISTS (SELECT 1 FROM public.live_chat_messages m WHERE m.store_id = p_participant_id LIMIT 1) THEN
      INSERT INTO public.live_chat_sessions (store_id, status, topic, closed_at)
      VALUES (p_participant_id, 'closed', 'closed_by_support', now());
    END IF;
  END IF;
END
$fn$;
