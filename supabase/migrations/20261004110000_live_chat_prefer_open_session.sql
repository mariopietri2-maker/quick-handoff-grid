-- Phase 1: after support closes a chat, get_my must prefer an open session.
CREATE OR REPLACE FUNCTION public.get_my_live_chat_session()
RETURNS TABLE (id uuid, status text, topic text, closed_at timestamptz)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id, status, topic, closed_at
  FROM public.live_chat_sessions
  WHERE customer_id = auth.uid()
     OR driver_id = auth.uid()
  ORDER BY (status = 'open') DESC, created_at DESC
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.check_live_chat_session_open()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_status text;
BEGIN
  IF NEW.sender_role IS DISTINCT FROM 'customer' THEN
    RETURN NEW;
  END IF;
  SELECT status INTO v_status
  FROM public.live_chat_sessions
  WHERE customer_id = COALESCE(NEW.customer_id, auth.uid())
  ORDER BY (status = 'open') DESC, created_at DESC
  LIMIT 1;
  IF v_status = 'closed' THEN
    RAISE EXCEPTION 'This live chat is closed. Start a new conversation.';
  END IF;
  RETURN NEW;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_my_live_chat_session() TO authenticated;
