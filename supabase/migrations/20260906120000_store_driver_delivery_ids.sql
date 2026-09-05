-- Driver delivery numbers for N-store calls (v2).
-- Every time an accepted store driver call finishes (accepted → closed) it
-- grabs the next delivery number FOR THIS STORE from a 1..9999 cycle that
-- wraps back to 1 forever. The store panel reads recent finished calls to show
-- the delivering driver's registry ID (DRV-N) and the delivery number, and
-- notifies the store with "Οδηγός DRV-N — Παράδοση ολοκληρώθηκε".

-- v1 used a shared global cycle; N stores want their own series.
DROP SEQUENCE IF EXISTS public.store_driver_call_id_seq;

ALTER TABLE public.store_driver_calls
  ADD COLUMN IF NOT EXISTS driver_call_id INTEGER;

-- Assign the next delivery number (per store, 1..9999 cyclic) when an
-- accepted call finishes. Expired/cancelled open calls (accepted_by IS NULL)
-- never get a number.
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
    SELECT COALESCE(MAX(driver_call_id), 0)
    INTO last_no
    FROM public.store_driver_calls
    WHERE store_id = NEW.store_id;
    NEW.driver_call_id := (last_no % 9999) + 1;
  END IF;
  RETURN NEW;
END;
$fn$;

DROP TRIGGER IF EXISTS trg_store_driver_call_delivery_id ON public.store_driver_calls;
CREATE TRIGGER trg_store_driver_call_delivery_id
BEFORE UPDATE ON public.store_driver_calls
FOR EACH ROW EXECUTE FUNCTION public.assign_store_driver_call_delivery_id();

-- One delivery number per store (NULLs stay free for unnumbered calls).
DROP INDEX IF EXISTS uniq_store_driver_call_delivery;
CREATE UNIQUE INDEX uniq_store_driver_call_delivery
  ON public.store_driver_calls (store_id, driver_call_id)
  WHERE driver_call_id IS NOT NULL;

-- Store owner: recent finished deliveries (newest first) incl. the store's
-- delivery number and the delivering driver's registry ID (DRV-N).
-- Wrapper because store_driver_calls has no direct SELECT policy.
CREATE OR REPLACE FUNCTION public.my_store_recent_deliveries(p_store_id UUID)
RETURNS TABLE(
  call_id UUID,
  driver_call_id INTEGER,
  driver_code TEXT,
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
  SELECT c.id, c.driver_call_id, dp.driver_code, p.full_name, c.updated_at
  FROM public.store_driver_calls c
  LEFT JOIN public.profiles p ON p.user_id = c.accepted_by
  LEFT JOIN public.driver_profiles dp ON dp.user_id = c.accepted_by
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