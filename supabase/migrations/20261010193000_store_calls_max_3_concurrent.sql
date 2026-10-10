-- Ghost Stores can have up to 3 concurrent active driver calls (open or accepted).
-- Previously create_store_driver_call returned the single existing open call.

CREATE OR REPLACE FUNCTION public.create_store_driver_call(p_store_id UUID)
RETURNS TABLE(id UUID, status TEXT, created_at TIMESTAMPTZ)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_role TEXT;
  v_active BOOLEAN;
  v_open_count INT;
  v_id UUID;
  v_status TEXT;
  v_created TIMESTAMPTZ;
BEGIN
  SELECT s.store_role, s.is_active INTO v_role, v_active
  FROM public.stores s
  WHERE s.id = p_store_id AND s.owner_id = auth.uid();

  IF NOT FOUND OR v_role IS DISTINCT FROM 'N' THEN
    RAISE EXCEPTION 'Store not found or not a call store';
  END IF;

  IF v_active IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'Το κατάστημα είναι κλειστό — άνοιξέ το για κλήση';
  END IF;

  SELECT count(*)::int INTO v_open_count
  FROM public.store_driver_calls c
  WHERE c.store_id = p_store_id
    AND c.status IN ('open', 'accepted');

  IF v_open_count >= 3 THEN
    RAISE EXCEPTION 'Μέγιστο 3 ενεργές κλήσεις — κλείσε μία πριν καλέσεις ξανά';
  END IF;

  INSERT INTO public.store_driver_calls (store_id, status)
  VALUES (p_store_id, 'open')
  RETURNING store_driver_calls.id, store_driver_calls.status, store_driver_calls.created_at
  INTO v_id, v_status, v_created;

  id := v_id;
  status := v_status;
  created_at := v_created;
  RETURN NEXT;
END $fn$;

-- List all active calls for the store (up to 3)
CREATE OR REPLACE FUNCTION public.my_store_driver_calls(p_store_id UUID)
RETURNS TABLE(
  id UUID, status TEXT, created_at TIMESTAMPTZ,
  accepted_by UUID, accepted_at TIMESTAMPTZ, driver_name TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.stores s
    WHERE s.id = p_store_id AND s.owner_id = auth.uid()
  ) THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT c.id, c.status, c.created_at, c.accepted_by, c.accepted_at,
         CASE WHEN c.accepted_by IS NOT NULL THEN p.full_name ELSE NULL END
  FROM public.store_driver_calls c
  LEFT JOIN public.profiles p ON p.user_id = c.accepted_by
  WHERE c.store_id = p_store_id
    AND c.status IN ('open', 'accepted')
  ORDER BY c.created_at ASC;
END $fn$;

GRANT EXECUTE ON FUNCTION public.create_store_driver_call(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.my_store_driver_calls(uuid) TO authenticated;

-- Keep single-call helper for backward compat (most recent active)
CREATE OR REPLACE FUNCTION public.my_store_driver_call(p_store_id UUID)
RETURNS TABLE(
  id UUID, status TEXT, created_at TIMESTAMPTZ,
  accepted_by UUID, accepted_at TIMESTAMPTZ, driver_name TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
BEGIN
  RETURN QUERY
  SELECT * FROM public.my_store_driver_calls(p_store_id)
  ORDER BY created_at DESC
  LIMIT 1;
END $fn$;

GRANT EXECUTE ON FUNCTION public.my_store_driver_call(uuid) TO authenticated;
