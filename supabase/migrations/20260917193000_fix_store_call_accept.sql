-- Fix N-store call accept for K / both drivers:
-- 1) Allow accept when call_role is K or both (do not require profiles.role='driver' only —
--    some accounts have driver_profiles but mismatched profiles.role).
-- 2) Clear Greek errors when call is already taken / closed / missing.
-- 3) fetch_open_store_calls: include call_role 'both' (was K-only).

CREATE OR REPLACE FUNCTION public.accept_store_driver_call(p_call_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_store_id UUID;
  v_status TEXT;
  v_name TEXT;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Πρέπει να συνδεθείτε';
  END IF;

  -- Must be a call driver (K or both). driver_profiles is source of truth.
  IF NOT EXISTS (
    SELECT 1
    FROM public.driver_profiles dp
    WHERE dp.user_id = auth.uid()
      AND dp.call_role IN ('K', 'both')
  ) THEN
    RAISE EXCEPTION 'Μόνο οδηγοί κλήσεων (K) μπορούν να αποδεχτούν';
  END IF;

  -- Block if this driver already has an active accepted call
  IF EXISTS (
    SELECT 1
    FROM public.store_driver_calls c
    WHERE c.accepted_by = auth.uid()
      AND c.status = 'accepted'
  ) THEN
    RAISE EXCEPTION 'Έχετε ήδη ενεργή κλήση. Ολοκληρώστε την πριν δεχτείτε άλλη.';
  END IF;

  SELECT c.status INTO v_status
  FROM public.store_driver_calls c
  WHERE c.id = p_call_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Η κλήση δεν βρέθηκε';
  END IF;

  IF v_status IS DISTINCT FROM 'open' THEN
    IF v_status = 'accepted' THEN
      RAISE EXCEPTION 'Η κλήση έγινε ήδη αποδεκτή από άλλον οδηγό';
    END IF;
    RAISE EXCEPTION 'Η κλήση δεν είναι πλέον ανοιχτή';
  END IF;

  UPDATE public.store_driver_calls
  SET
    status = 'accepted',
    accepted_by = auth.uid(),
    accepted_at = now(),
    updated_at = now()
  WHERE id = p_call_id
    AND status = 'open'
  RETURNING store_id INTO v_store_id;

  IF v_store_id IS NULL THEN
    RAISE EXCEPTION 'Η κλήση έγινε ήδη αποδεκτή από άλλον οδηγό';
  END IF;

  SELECT s.name INTO v_name FROM public.stores s WHERE s.id = v_store_id;
  RETURN COALESCE(v_name, 'Κατάστημα');
END;
$$;

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
  ORDER BY c.created_at ASC;
END;
$$;

GRANT EXECUTE ON FUNCTION public.accept_store_driver_call(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.fetch_open_store_calls() TO authenticated;
