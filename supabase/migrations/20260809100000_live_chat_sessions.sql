-- Live-chat sessions: a chat channel (customer or driver) that only SUPPORT can close.
-- Customers keep full history and may reopen by starting a new request (new session).
-- Customer RLS: SELECT/INSERT own sessions only — NO UPDATE, so a customer can never close a chat.

CREATE TABLE public.live_chat_sessions (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  customer_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  driver_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'closed')),
  topic text,
  closed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_live_chat_sessions_customer ON public.live_chat_sessions (customer_id, status);
CREATE INDEX idx_live_chat_sessions_driver ON public.live_chat_sessions (driver_id, status);

ALTER TABLE public.live_chat_sessions ENABLE ROW LEVEL SECURITY;

-- Same XOR rule as live_chat_messages: exactly one of customer_id / driver_id.
CREATE OR REPLACE FUNCTION public.validate_live_chat_session_channel() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF (NEW.customer_id IS NOT NULL) = (NEW.driver_id IS NOT NULL) THEN
    RAISE EXCEPTION 'live_chat_sessions must have exactly one of customer_id / driver_id';
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER trg_validate_live_chat_session_channel
  BEFORE INSERT OR UPDATE ON public.live_chat_sessions
  FOR EACH ROW EXECUTE FUNCTION public.validate_live_chat_session_channel();

-- Participants see their own sessions.
CREATE POLICY "Participants view own live chat sessions"
  ON public.live_chat_sessions FOR SELECT
  USING (customer_id = auth.uid() OR driver_id = auth.uid());

-- Participants create their own sessions (starting a new request).
CREATE POLICY "Participants create own live chat sessions"
  ON public.live_chat_sessions FOR INSERT
  WITH CHECK (customer_id = auth.uid() OR driver_id = auth.uid());

-- IMPORTANT: NO customer/driver UPDATE policy -> only support/admin can modify sessions.

CREATE POLICY "Support and admins view all live chat sessions"
  ON public.live_chat_sessions FOR SELECT
  USING (public.has_role(auth.uid(), 'support'::public.app_role) OR public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY "Support and admins close live chat sessions"
  ON public.live_chat_sessions FOR UPDATE
  USING (public.has_role(auth.uid(), 'support'::public.app_role) OR public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'support'::public.app_role) OR public.has_role(auth.uid(), 'admin'::public.app_role));

-- ── RPCs ─────────────────────────────────────────────────────────────

-- Get the customer's latest session (resume history, see closed state).
CREATE OR REPLACE FUNCTION public.get_my_live_chat_session()
RETURNS TABLE (id uuid, status text, topic text, closed_at timestamptz)
LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  SELECT id, status, topic, closed_at
  FROM public.live_chat_sessions
  WHERE customer_id = auth.uid()
  ORDER BY created_at DESC
  LIMIT 1;
$$;

-- Open (or create) the customer's live chat request with the chosen topic.
CREATE OR REPLACE FUNCTION public.ensure_my_live_chat_session(p_topic text)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_id uuid;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  SELECT id INTO v_id
  FROM public.live_chat_sessions
  WHERE customer_id = v_uid AND status = 'open'
  ORDER BY created_at DESC LIMIT 1;
  IF v_id IS NULL THEN
    INSERT INTO public.live_chat_sessions (customer_id, topic)
    VALUES (v_uid, p_topic) RETURNING id INTO v_id;
  ELSIF p_topic IS NOT NULL THEN
    UPDATE public.live_chat_sessions
    SET topic = p_topic, updated_at = now()
    WHERE id = v_id;
  END IF;
  RETURN v_id;
END $$;

-- Close a customer's/driver's open live chat. Support and admins only.
CREATE OR REPLACE FUNCTION public.close_live_chat_for_user(p_participant_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT (public.has_role(auth.uid(), 'support'::public.app_role)
       OR public.has_role(auth.uid(), 'admin'::public.app_role)) THEN
    RAISE EXCEPTION 'Only support can close live chat';
  END IF;
  UPDATE public.live_chat_sessions
  SET status = 'closed', closed_at = now(), updated_at = now()
  WHERE status = 'open'
    AND (customer_id = p_participant_id OR driver_id = p_participant_id);
END $$;

-- Customers cannot keep chatting once their session is closed (must open a new request).
-- Support/admins can still post in a closed channel (e.g. a final closing note).
CREATE OR REPLACE FUNCTION public.check_live_chat_session_open() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_status text;
BEGIN
  IF NEW.customer_id IS NULL OR NEW.sender_role <> 'customer' THEN
    RETURN NEW; -- driver channels and support replies are unaffected
  END IF;
  SELECT status INTO v_status
  FROM public.live_chat_sessions
  WHERE customer_id = NEW.customer_id
  ORDER BY created_at DESC LIMIT 1;
  IF v_status = 'closed' THEN
    RAISE EXCEPTION 'This live chat is closed. Start a new request.';
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER trg_check_live_chat_session_open
  BEFORE INSERT OR UPDATE ON public.live_chat_messages
  FOR EACH ROW EXECUTE FUNCTION public.check_live_chat_session_open();

GRANT EXECUTE ON FUNCTION public.get_my_live_chat_session() TO authenticated;
GRANT EXECUTE ON FUNCTION public.ensure_my_live_chat_session(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.close_live_chat_for_user(uuid) TO authenticated, service_role;

-- ── Extend conversations view with session state (for the support console) ──
DROP VIEW IF EXISTS public.live_chat_conversations;

CREATE VIEW public.live_chat_conversations
WITH (security_invoker = true) AS
SELECT
  COALESCE(v.driver_id, v.customer_id) AS participant_id,
  CASE WHEN v.driver_id IS NOT NULL THEN 'driver' ELSE 'customer' END AS participant_role,
  v.order_id,
  v.created_at AS last_message_at,
  v.message AS last_message,
  v.sender_role AS last_sender_role,
  (SELECT COUNT(*)::int FROM public.live_chat_messages m
    WHERE (m.driver_id = v.driver_id AND m.driver_id IS NOT NULL)
       OR (m.customer_id = v.customer_id AND m.customer_id IS NOT NULL)) AS message_count,
  sess.id AS session_id,
  sess.status AS session_status,
  sess.topic AS session_topic,
  sess.closed_at AS session_closed_at
FROM (
  SELECT DISTINCT ON (COALESCE(driver_id, customer_id))
    driver_id, customer_id, order_id, message, sender_role, created_at
  FROM public.live_chat_messages
  ORDER BY COALESCE(driver_id, customer_id), created_at DESC
) v
LEFT JOIN LATERAL (
  SELECT id, status, topic, closed_at
  FROM public.live_chat_sessions s
  WHERE s.customer_id = v.customer_id OR s.driver_id = v.driver_id
  ORDER BY s.created_at DESC
  LIMIT 1
) sess ON true
ORDER BY v.created_at DESC;

GRANT SELECT ON public.live_chat_conversations TO authenticated;

-- Realtime for live close-state updates on the customer app.
ALTER PUBLICATION supabase_realtime ADD TABLE public.live_chat_sessions;
ALTER TABLE public.live_chat_sessions REPLICA IDENTITY FULL;
