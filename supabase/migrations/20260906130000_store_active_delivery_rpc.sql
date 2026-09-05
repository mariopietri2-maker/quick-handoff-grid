-- Active in-progress delivery for N-store owner panel + safer delivery ID assign.

CREATE OR REPLACE FUNCTION public.my_store_active_delivery(p_store_id UUID)
RETURNS TABLE(
  call_id UUID,
  driver_call_id INTEGER,
  driver_code TEXT,
  driver_name TEXT,
  delivered_at TIMESTAMPTZ,
  status TEXT
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $fn$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.stores s
    WHERE s.id = p_store_id AND s.owner_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'Store not found or not yours';
  END IF;

  RETURN QUERY
  SELECT c.id, c.driver_call_id, dp.driver_code, p.full_name, c.updated_at, c.status
  FROM public.store_driver_calls c
  LEFT JOIN public.profiles p ON p.user_id = c.accepted_by
  LEFT JOIN public.driver_profiles dp ON dp.user_id = c.accepted_by
  WHERE c.store_id = p_store_id
    AND c.status = 'accepted'
    AND c.accepted_by IS NOT NULL
  ORDER BY c.updated_at DESC
  LIMIT 1;
END;
$fn$;

REVOKE EXECUTE ON FUNCTION public.my_store_active_delivery(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.my_store_active_delivery(uuid) TO authenticated;

-- Serialize delivery number assignment per store (avoid unique index races).
CREATE OR REPLACE FUNCTION public.assign_store_driver_call_delivery_id()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $fn$
DECLARE
  last_no INTEGER;
BEGIN
  IF NEW.status = 'closed' AND OLD.status = 'accepted' AND NEW.accepted_by IS NOT NULL THEN
    IF NEW.driver_call_id IS NOT NULL THEN
      RETURN NEW;
    END IF;
    PERFORM pg_advisory_xact_lock(hashtext(NEW.store_id::text));
    SELECT COALESCE(MAX(driver_call_id), 0)
    INTO last_no
    FROM public.store_driver_calls
    WHERE store_id = NEW.store_id;
    NEW.driver_call_id := (last_no % 9999) + 1;
  END IF;
  RETURN NEW;
END;
$fn$;
