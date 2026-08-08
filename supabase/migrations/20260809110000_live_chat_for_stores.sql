-- Live chat for stores: a store OWNER user becomes a chat participant.
-- Extends live_chat_messages / live_chat_sessions with a store_id channel.
-- Exactly one of customer_id / driver_id / store_id per channel (XOR over 3).

-- ── live_chat_messages ────────────────────────────────────────────────
ALTER TABLE public.live_chat_messages
  ADD COLUMN IF NOT EXISTS store_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_live_chat_store
  ON public.live_chat_messages (store_id, created_at);

CREATE OR REPLACE FUNCTION public.validate_live_chat_channel() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF (NEW.driver_id IS NOT NULL)::int
     + (NEW.customer_id IS NOT NULL)::int
     + (NEW.store_id IS NOT NULL)::int <> 1 THEN
    RAISE EXCEPTION 'live_chat_messages must have exactly one of driver_id / customer_id / store_id';
  END IF;
  RETURN NEW;
END $$;

CREATE POLICY "Stores view own live chat"
  ON public.live_chat_messages FOR SELECT
  USING (store_id = auth.uid());

CREATE POLICY "Stores post on own live chat"
  ON public.live_chat_messages FOR INSERT
  WITH CHECK (
    store_id = auth.uid()
    AND sender_id = auth.uid()
    AND sender_role = 'store'
  );

-- ── live_chat_sessions ────────────────────────────────────────────────
ALTER TABLE public.live_chat_sessions
  ADD COLUMN IF NOT EXISTS store_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_live_chat_sessions_store
  ON public.live_chat_sessions (store_id, status);

CREATE OR REPLACE FUNCTION public.validate_live_chat_session_channel() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF (NEW.customer_id IS NOT NULL)::int
     + (NEW.driver_id IS NOT NULL)::int
     + (NEW.store_id IS NOT NULL)::int <> 1 THEN
    RAISE EXCEPTION 'live_chat_sessions must have exactly one of customer_id / driver_id / store_id';
  END IF;
  RETURN NEW;
END $$;

CREATE POLICY "Stores view own live chat sessions"
  ON public.live_chat_sessions FOR SELECT
  USING (store_id = auth.uid());

CREATE POLICY "Stores create own live chat sessions"
  ON public.live_chat_sessions FOR INSERT
  WITH CHECK (store_id = auth.uid());

-- ── RPCs for the store participant ────────────────────────────────────
CREATE OR REPLACE FUNCTION public.get_store_live_chat_session()
RETURNS TABLE (id uuid, status text, topic text, closed_at timestamptz)
LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  SELECT id, status, topic, closed_at
  FROM public.live_chat_sessions
  WHERE store_id = auth.uid()
  ORDER BY created_at DESC
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.ensure_store_live_chat_session(p_topic text)
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
  WHERE store_id = v_uid AND status = 'open'
  ORDER BY created_at DESC LIMIT 1;
  IF v_id IS NULL THEN
    INSERT INTO public.live_chat_sessions (store_id, topic)
    VALUES (v_uid, p_topic) RETURNING id INTO v_id;
  ELSIF p_topic IS NOT NULL THEN
    UPDATE public.live_chat_sessions
    SET topic = p_topic, updated_at = now()
    WHERE id = v_id;
  END IF;
  RETURN v_id;
END $$;

GRANT EXECUTE ON FUNCTION public.get_store_live_chat_session() TO authenticated;
GRANT EXECUTE ON FUNCTION public.ensure_store_live_chat_session(text) TO authenticated;

-- ── Close + send-block now cover store channels ───────────────────────
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
    AND (customer_id = p_participant_id OR driver_id = p_participant_id OR store_id = p_participant_id);
END $$;

CREATE OR REPLACE FUNCTION public.check_live_chat_session_open() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_status text;
BEGIN
  IF (NEW.customer_id IS NULL AND NEW.store_id IS NULL)
     OR NEW.sender_role NOT IN ('customer', 'store') THEN
    RETURN NEW; -- driver channels and support replies are unaffected
  END IF;
  SELECT status INTO v_status
  FROM public.live_chat_sessions
  WHERE (customer_id = NEW.customer_id OR store_id = NEW.store_id)
  ORDER BY created_at DESC LIMIT 1;
  IF v_status = 'closed' THEN
    RAISE EXCEPTION 'This live chat is closed. Start a new request.';
  END IF;
  RETURN NEW;
END $$;

-- ── Extend conversations view with store channels ─────────────────────
DROP VIEW IF EXISTS public.live_chat_conversations;

CREATE VIEW public.live_chat_conversations
WITH (security_invoker = true) AS
SELECT
  COALESCE(v.driver_id, v.customer_id, v.store_id) AS participant_id,
  CASE
    WHEN v.driver_id IS NOT NULL THEN 'driver'
    WHEN v.store_id IS NOT NULL THEN 'store'
    ELSE 'customer'
  END AS participant_role,
  v.order_id,
  v.created_at AS last_message_at,
  v.message AS last_message,
  v.sender_role AS last_sender_role,
  (SELECT COUNT(*)::int FROM public.live_chat_messages m
    WHERE (m.driver_id = v.driver_id AND m.driver_id IS NOT NULL)
       OR (m.customer_id = v.customer_id AND m.customer_id IS NOT NULL)
       OR (m.store_id = v.store_id AND m.store_id IS NOT NULL)) AS message_count,
  sess.id AS session_id,
  sess.status AS session_status,
  sess.topic AS session_topic,
  sess.closed_at AS session_closed_at
FROM (
  SELECT DISTINCT ON (COALESCE(driver_id, customer_id, store_id))
    driver_id, customer_id, store_id, order_id, message, sender_role, created_at
  FROM public.live_chat_messages
  ORDER BY COALESCE(driver_id, customer_id, store_id), created_at DESC
) v
LEFT JOIN LATERAL (
  SELECT id, status, topic, closed_at
  FROM public.live_chat_sessions s
  WHERE s.customer_id = v.customer_id OR s.driver_id = v.driver_id OR s.store_id = v.store_id
  ORDER BY s.created_at DESC
  LIMIT 1
) sess ON true
ORDER BY v.created_at DESC;

GRANT SELECT ON public.live_chat_conversations TO authenticated;
