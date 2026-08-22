-- Driver map badges: count only orders not yet offered / not assigned to a driver.
-- Previous definition counted all kitchen-active orders (including already assigned).

CREATE OR REPLACE FUNCTION public.get_store_active_order_counts(p_store_ids uuid[] DEFAULT NULL)
RETURNS TABLE(store_id uuid, active_count bigint)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT o.store_id, COUNT(*)::bigint AS active_count
  FROM public.orders o
  WHERE o.status IN ('placed', 'accepted', 'preparing', 'ready')
    AND o.driver_id IS NULL
    AND NOT EXISTS (
      SELECT 1
      FROM public.pending_offers po
      WHERE po.order_id = o.id
        AND po.status = 'pending'
        AND po.expires_at > now()
    )
    AND (p_store_ids IS NULL OR cardinality(p_store_ids) = 0 OR o.store_id = ANY (p_store_ids))
  GROUP BY o.store_id;
$$;

COMMENT ON FUNCTION public.get_store_active_order_counts(uuid[]) IS
  'Driver map store-pin badges: count of kitchen orders still waiting (no driver, no live pending offer).';
