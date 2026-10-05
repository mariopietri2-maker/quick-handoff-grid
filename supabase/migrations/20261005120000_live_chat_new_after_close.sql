-- After support closes a chat, customer must get a brand-new open session.
CREATE OR REPLACE FUNCTION public.ensure_my_live_chat_session(p_topic text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
  ORDER BY created_at DESC
  LIMIT 1;

  IF v_id IS NULL THEN
    INSERT INTO public.live_chat_sessions (customer_id, status, topic)
    VALUES (v_uid, 'open', NULLIF(trim(p_topic), ''))
    RETURNING id INTO v_id;
  ELSIF p_topic IS NOT NULL AND trim(p_topic) <> '' THEN
    UPDATE public.live_chat_sessions
    SET topic = trim(p_topic), updated_at = now()
    WHERE id = v_id;
  END IF;

  RETURN v_id;
END;
$$;

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

GRANT EXECUTE ON FUNCTION public.ensure_my_live_chat_session(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_my_live_chat_session() TO authenticated;
