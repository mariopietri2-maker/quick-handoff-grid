-- Batch apply a menu-price multiplier per store in a single UPDATE.
-- Replaces the per-item loop in ai-dynamic-pricing (up to 18,000 individual
-- row updates per run became 1 UPDATE per store via this RPC).

CREATE OR REPLACE FUNCTION public.apply_store_menu_price_multiplier(
  p_store_id uuid,
  p_mult numeric
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_updated integer;
BEGIN
  UPDATE public.menu_items
  SET
    price      = round((coalesce(base_price, price) * p_mult)::numeric, 2),
    base_price = coalesce(base_price, price)
  WHERE store_id = p_store_id
    AND coalesce(base_price, price) IS NOT NULL
    AND coalesce(base_price, price) <> 0
    AND round((coalesce(base_price, price) * p_mult)::numeric, 2) <> price;

  GET DIAGNOSTICS v_updated = ROW_COUNT;
  RETURN v_updated;
END;
$$;

REVOKE ALL ON FUNCTION public.apply_store_menu_price_multiplier(uuid, numeric) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.apply_store_menu_price_multiplier(uuid, numeric) TO service_role;