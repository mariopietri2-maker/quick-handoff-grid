-- Prune: delete oldest finished deliveries beyond 10 newest per store.

CREATE OR REPLACE FUNCTION public.prune_store_old_deliveries(p_store_id UUID)
RETURNS void
LANGUAGE plpgsql
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

  -- Keep the 10 newest finished deliveries; delete the rest starting from the oldest.
  DELETE FROM public.store_driver_calls c
  USING (
    SELECT id
    FROM public.store_driver_calls
    WHERE store_id = p_store_id
      AND status = 'closed'
      AND driver_call_id IS NOT NULL
    ORDER BY updated_at DESC, id DESC
    OFFSET 10
  ) old
  WHERE c.id = old.id;
END;
$fn$;
