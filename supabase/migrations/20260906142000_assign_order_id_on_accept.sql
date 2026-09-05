-- Assign delivery/order number when driver accepts (so store sees it in progress).

CREATE OR REPLACE FUNCTION public.assign_store_driver_call_delivery_id()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $fn$
DECLARE
  last_no INTEGER;
BEGIN
  -- Assign on accept (open → accepted). Keep existing number on close.
  IF NEW.status = 'accepted'
     AND (OLD.status IS DISTINCT FROM 'accepted')
     AND NEW.accepted_by IS NOT NULL
     AND NEW.driver_call_id IS NULL THEN
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

DROP TRIGGER IF EXISTS trg_store_driver_call_delivery_id ON public.store_driver_calls;
CREATE TRIGGER trg_store_driver_call_delivery_id
BEFORE UPDATE ON public.store_driver_calls
FOR EACH ROW EXECUTE FUNCTION public.assign_store_driver_call_delivery_id();
