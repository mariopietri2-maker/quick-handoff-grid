-- Fix N-store → K-driver call flow
-- Bugs:
-- 1) create_store_driver_call used RETURN QUERY + IF NOT FOUND (fragile) and
--    reusing an existing open call never re-fired the push trigger.
-- 2) Core RPCs lacked explicit GRANT EXECUTE TO authenticated.
-- 3) Push required driver_state.shift_started_at; also notify when store re-calls.
-- 4) Extract notify helper so create can re-ping online K drivers.

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
           'store_name', v_store
         ),
         -- include epoch bucket so re-calls still notify
         'store-call:' || p_call_id::text || ':' || dp.user_id::text || ':' || floor(extract(epoch from now()) / 30)::text
  FROM public.driver_profiles dp
  JOIN public.driver_state ds ON ds.driver_id = dp.user_id
  WHERE dp.call_role = 'K'
    AND ds.shift_started_at IS NOT NULL
    AND COALESCE(ds.on_break, false) = false
  ON CONFLICT (dedupe_key) DO NOTHING;

  GET DIAGNOSTICS v_count = ROW_COUNT;

  BEGIN
    PERFORM public.request_send_push_drain(40);
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;

  RETURN v_count;
END $fn$;

CREATE OR REPLACE FUNCTION public.enqueue_store_call_pushes()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
BEGIN
  IF NEW.status <> 'open' THEN
    RETURN NEW;
  END IF;
  PERFORM public.notify_store_call_drivers(NEW.id, NEW.store_id);
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RETURN NEW;
END $fn$;

DROP TRIGGER IF EXISTS trg_store_call_push ON public.store_driver_calls;
CREATE TRIGGER trg_store_call_push
AFTER INSERT ON public.store_driver_calls
FOR EACH ROW EXECUTE FUNCTION public.enqueue_store_call_pushes();

CREATE OR REPLACE FUNCTION public.create_store_driver_call(p_store_id UUID)
RETURNS TABLE(id UUID, status TEXT, created_at TIMESTAMPTZ)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_role TEXT;
  v_id UUID;
  v_status TEXT;
  v_created TIMESTAMPTZ;
BEGIN
  SELECT s.store_role INTO v_role
  FROM public.stores s
  WHERE s.id = p_store_id AND s.owner_id = auth.uid();

  IF NOT FOUND OR v_role IS DISTINCT FROM 'N' THEN
    RAISE EXCEPTION 'Store not found or not a call store';
  END IF;

  SELECT c.id, c.status, c.created_at
    INTO v_id, v_status, v_created
  FROM public.store_driver_calls c
  WHERE c.store_id = p_store_id AND c.status = 'open'
  ORDER BY c.created_at DESC
  LIMIT 1;

  IF v_id IS NULL THEN
    INSERT INTO public.store_driver_calls (store_id, status)
    VALUES (p_store_id, 'open')
    RETURNING store_driver_calls.id, store_driver_calls.status, store_driver_calls.created_at
    INTO v_id, v_status, v_created;
  ELSE
    PERFORM public.notify_store_call_drivers(v_id, p_store_id);
  END IF;

  id := v_id;
  status := v_status;
  created_at := v_created;
  RETURN NEXT;
END $fn$;

CREATE OR REPLACE FUNCTION public.fetch_open_store_calls()
RETURNS TABLE(id UUID, store_name TEXT, created_at TIMESTAMPTZ)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.driver_profiles dp
    WHERE dp.user_id = auth.uid() AND dp.call_role = 'K'
  ) THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT c.id, s.name, c.created_at
  FROM public.store_driver_calls c
  JOIN public.stores s ON s.id = c.store_id
  WHERE c.status = 'open'
  ORDER BY c.created_at ASC;
END $fn$;

GRANT EXECUTE ON FUNCTION public.create_store_driver_call(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.accept_store_driver_call(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.close_store_driver_call(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.my_store_driver_call(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.fetch_open_store_calls() TO authenticated;
GRANT EXECUTE ON FUNCTION public.my_active_store_driver_call() TO authenticated;
GRANT EXECUTE ON FUNCTION public.complete_store_driver_call(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.notify_store_call_drivers(uuid, uuid) TO service_role;

INSERT INTO supabase_migrations.schema_migrations (version, name)
VALUES ('20260824130000', 'fix_store_call_notify')
ON CONFLICT (version) DO NOTHING;
