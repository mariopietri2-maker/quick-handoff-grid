-- Driver delivery IDs for N-store calls.
-- Every time an accepted store driver call finishes (accepted → closed) it
-- grabs the next ID from a shared cyclic sequence: 1 → 9999 → 1 → ... forever.
-- The store panel reads recent finished calls to show the delivered driver ID
-- and to notify the store with "Οδηγός #ID — Παράδοση ολοκληρώθηκε".

-- Cyclic sequence (1..9999, wraps back to 1 forever).
CREATE SEQUENCE IF NOT EXISTS public.store_driver_call_id_seq
  INCREMENT BY 1
  MINVALUE 1
  MAXVALUE 9999
  START WITH 1
  CYCLE
  OWNED BY NONE;

ALTER TABLE public.store_driver_calls
  ADD COLUMN IF NOT EXISTS driver_call_id INTEGER;

-- Assign the next delivery ID when an accepted call finishes. Expired/cancelled
-- open calls (accepted_by IS NULL) never get an ID.
CREATE OR REPLACE FUNCTION public.assign_store_driver_call_delivery_id()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $fn$
BEGIN
  IF NEW.status = 'closed' AND OLD.status = 'accepted' AND NEW.accepted_by IS NOT NULL THEN
    NEW.driver_call_id := nextval('public.store_driver_call_id_seq');
  END IF;
  RETURN NEW;
END;
$fn$;

DROP TRIGGER IF EXISTS trg_store_driver_call_delivery_id ON public.store_driver_calls;
CREATE TRIGGER trg_store_driver_call_delivery_id
BEFORE UPDATE ON public.store_driver_calls
FOR EACH ROW EXECUTE FUNCTION public.assign_store_driver_call_delivery_id();

-- Store owner: recent finished deliveries (newest first) incl. the assigned ID.
-- wrapper because store_driver_calls has no direct SELECT policy.
CREATE OR REPLACE FUNCTION public.my_store_recent_deliveries(p_store_id UUID)
RETURNS TABLE(
  call_id UUID,
  driver_call_id INTEGER,
  driver_name TEXT,
  delivered_at TIMESTAMPTZ
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
  SELECT c.id, c.driver_call_id, p.full_name, c.updated_at
  FROM public.store_driver_calls c
  LEFT JOIN public.profiles p ON p.user_id = c.accepted_by
  WHERE c.store_id = p_store_id
    AND c.status = 'closed'
    AND c.driver_call_id IS NOT NULL
  ORDER BY c.updated_at DESC
  LIMIT 10;
END;
$fn$;

REVOKE EXECUTE ON FUNCTION public.assign_store_driver_call_delivery_id() FROM public;
REVOKE EXECUTE ON FUNCTION public.my_store_recent_deliveries(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.my_store_recent_deliveries(uuid) TO authenticated;