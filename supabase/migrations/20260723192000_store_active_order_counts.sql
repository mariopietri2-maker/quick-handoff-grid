-- Aggregate active kitchen orders per store for driver map badges.
-- Drivers cannot SELECT other drivers' assigned orders (RLS), so client-side
-- COUNT from `orders` undercounts. This returns only (store_id, count).

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
    AND (p_store_ids IS NULL OR cardinality(p_store_ids) = 0 OR o.store_id = ANY (p_store_ids))
  GROUP BY o.store_id;
$$;

REVOKE ALL ON FUNCTION public.get_store_active_order_counts(uuid[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_store_active_order_counts(uuid[]) TO authenticated, service_role;

COMMENT ON FUNCTION public.get_store_active_order_counts(uuid[]) IS
  'Driver map store-pin badges: active kitchen order counts without leaking order rows.';
