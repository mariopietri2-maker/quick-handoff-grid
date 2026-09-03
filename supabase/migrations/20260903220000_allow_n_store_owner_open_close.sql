-- N-store owners can open/close their own call store.
--
-- Problem: the protect_store_active trigger made is_active admin-only, so an N
-- owner whose store shows CLOSED could never reopen it — and the call button
-- stays disabled. Standard stores stay admin-only (existing intent).
--
-- This migration:
-- 1) Allows the OWNER of an N (call-only) store to toggle is_active on their
--    own store (owner/role must stay untouched in the same write).
-- 2) Refuses new driver calls from closed N stores server-side, so stale
--    clients can't bypass the disabled call button.
-- 3) Auto-closes live open calls when a store is deactivated.

CREATE OR REPLACE FUNCTION public.protect_store_active_status()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF OLD.is_active IS DISTINCT FROM NEW.is_active
     AND NOT public.has_role(auth.uid(), 'admin') THEN
    -- Non-admin: only the owner of an N store, without touching owner/role.
    IF OLD.owner_id IS DISTINCT FROM auth.uid()
       OR OLD.store_role IS DISTINCT FROM 'N'
       OR NEW.owner_id IS DISTINCT FROM OLD.owner_id
       OR NEW.store_role IS DISTINCT FROM OLD.store_role THEN
      RAISE EXCEPTION 'Μόνο οι διαχειριστές μπορούν να ενεργοποιήσουν/απενεργοποιήσουν καταστήματα';
    END IF;
  END IF;

  -- Closing a store must leave no live open calls behind (owner or admin).
  IF OLD.is_active IS DISTINCT FROM NEW.is_active AND NEW.is_active = false THEN
    UPDATE public.store_driver_calls
    SET status = 'closed', updated_at = now()
    WHERE store_id = NEW.id AND status = 'open';
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.create_store_driver_call(p_store_id UUID)
RETURNS TABLE(id UUID, status TEXT, created_at TIMESTAMPTZ)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_role TEXT;
  v_active BOOLEAN;
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
