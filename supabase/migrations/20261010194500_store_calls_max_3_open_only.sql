
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

  -- Max 3 simultaneous OPEN calls (seeking drivers). Accepted does not block new calls.
  SELECT count(*)::int INTO v_open_count
  FROM public.store_driver_calls c
  WHERE c.store_id = p_store_id
    AND c.status = 'open';

  IF v_open_count >= 3 THEN
    RAISE EXCEPTION 'Μέγιστο 3 ανοιχτές κλήσεις ταυτόχρονα';
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

GRANT EXECUTE ON FUNCTION public.create_store_driver_call(uuid) TO authenticated;
