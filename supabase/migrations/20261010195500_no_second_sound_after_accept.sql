
-- Drivers who already accepted a call from a store must not get sound/push for
-- further open calls from that same store (or any new open call while they hold an accepted one from that store).

CREATE OR REPLACE FUNCTION public.notify_store_call_drivers(p_call_id uuid, p_store_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_store TEXT;
  v_count integer := 0;
BEGIN
  SELECT s.name INTO v_store FROM public.stores s WHERE s.id = p_store_id;

  INSERT INTO public.push_outbox (user_id, app, title, body, data, dedupe_key)
  SELECT dp.user_id,
         'driver',
         '📞 Νέα κλήση καταστήματος',
         COALESCE(v_store, 'Κατάστημα') || ' χρειάζεται οδηγό τώρα — πρώτος που δέχεται τον παίρνει.',
         jsonb_build_object(
           'type', 'store_call',
           'call_id', p_call_id,
           'store_id', p_store_id,
           'store_name', v_store
         ),
         'store-call:' || p_call_id::text || ':' || dp.user_id::text || ':' || floor(extract(epoch from now()) / 30)::text
  FROM public.driver_profiles dp
  JOIN public.driver_state ds ON ds.driver_id = dp.user_id
  WHERE dp.call_role IN ('K', 'both')
    AND ds.shift_started_at IS NOT NULL
    AND COALESCE(ds.on_break, false) = false
    -- Already accepted an active call from THIS store → no second sound/push
    AND NOT EXISTS (
      SELECT 1
      FROM public.store_driver_calls ac
      WHERE ac.store_id = p_store_id
        AND ac.accepted_by = dp.user_id
        AND ac.status = 'accepted'
    )
  ON CONFLICT (dedupe_key) DO NOTHING;

  GET DIAGNOSTICS v_count = ROW_COUNT;

  BEGIN
    PERFORM public.request_send_push_drain(40);
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;

  RETURN v_count;
END $fn$;

CREATE OR REPLACE FUNCTION public.fetch_open_store_calls()
RETURNS TABLE(id UUID, store_name TEXT, created_at TIMESTAMPTZ)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM public.driver_profiles dp
    WHERE dp.user_id = auth.uid()
      AND dp.call_role IN ('K', 'both')
  ) THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT c.id, s.name, c.created_at
  FROM public.store_driver_calls c
  JOIN public.stores s ON s.id = c.store_id
  WHERE c.status = 'open'
    AND c.created_at > now() - interval '15 minutes'
    -- Hide other open calls from stores this driver already accepted
    AND NOT EXISTS (
      SELECT 1
      FROM public.store_driver_calls ac
      WHERE ac.store_id = c.store_id
        AND ac.accepted_by = auth.uid()
        AND ac.status = 'accepted'
    )
  ORDER BY c.created_at ASC;
END;
$$;

GRANT EXECUTE ON FUNCTION public.notify_store_call_drivers(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.fetch_open_store_calls() TO authenticated;
