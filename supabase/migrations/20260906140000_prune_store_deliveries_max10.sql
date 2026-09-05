-- Keep at most 10 finished numbered deliveries per store; delete older ones.

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

  DELETE FROM public.store_driver_calls c
  WHERE c.store_id = p_store_id
    AND c.status = 'closed'
    AND c.driver_call_id IS NOT NULL
    AND c.id NOT IN (
      SELECT id
      FROM public.store_driver_calls
      WHERE store_id = p_store_id
        AND status = 'closed'
        AND driver_call_id IS NOT NULL
      ORDER BY updated_at DESC
      LIMIT 10
    );
END;
$fn$;

REVOKE EXECUTE ON FUNCTION public.prune_store_old_deliveries(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.prune_store_old_deliveries(uuid) TO authenticated;

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
