-- Driver live chat: topic/title on open + session close works for drivers
-- Support close was disabled when session_status was NULL (drivers never created sessions).

CREATE OR REPLACE FUNCTION public.ensure_driver_live_chat_session(p_topic text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_uid uuid := auth.uid();
  v_id uuid;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.user_id = v_uid AND p.role = 'driver'
  ) THEN
    RAISE EXCEPTION 'Only drivers can open a driver live chat session';
  END IF;

  SELECT s.id INTO v_id
  FROM public.live_chat_sessions s
  WHERE s.driver_id = v_uid AND s.status = 'open'
  ORDER BY s.created_at DESC
  LIMIT 1;

  IF v_id IS NULL THEN
    INSERT INTO public.live_chat_sessions (driver_id, topic)
    VALUES (v_uid, NULLIF(trim(p_topic), ''))
    RETURNING id INTO v_id;
  ELSIF p_topic IS NOT NULL AND trim(p_topic) <> '' THEN
    UPDATE public.live_chat_sessions
    SET topic = trim(p_topic), updated_at = now()
    WHERE id = v_id;
  END IF;

  RETURN v_id;
END $fn$;

GRANT EXECUTE ON FUNCTION public.ensure_driver_live_chat_session(text) TO authenticated;

CREATE OR REPLACE FUNCTION public.check_live_chat_session_open() RETURNS trigger
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

  RETURN NEW;
END $fn$;

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
    AND (customer_id = p_participant_id OR driver_id = p_participant_id);

  GET DIAGNOSTICS v_updated = ROW_COUNT;

  IF v_updated = 0 THEN
    IF EXISTS (
      SELECT 1 FROM public.live_chat_messages m
      WHERE m.driver_id = p_participant_id LIMIT 1
    ) THEN
      INSERT INTO public.live_chat_sessions (driver_id, status, topic, closed_at)
      VALUES (p_participant_id, 'closed', 'closed_by_support', now());
    ELSIF EXISTS (
      SELECT 1 FROM public.live_chat_messages m
      WHERE m.customer_id = p_participant_id LIMIT 1
    ) THEN
      INSERT INTO public.live_chat_sessions (customer_id, status, topic, closed_at)
      VALUES (p_participant_id, 'closed', 'closed_by_support', now());
    END IF;
  END IF;
END $fn$;

GRANT EXECUTE ON FUNCTION public.close_live_chat_for_user(uuid) TO authenticated, service_role;

INSERT INTO supabase_migrations.schema_migrations (version, name)
VALUES ('20260824140000', 'driver_live_chat_topic_and_close')
ON CONFLICT (version) DO NOTHING;
