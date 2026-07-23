/*
  compute_order_split ignored store_pricing_overrides / tiers and only read
  stores.commission_pct (often NULL). Use resolve_commission_pct so admin
  store commission changes apply to in-app AND custom order settlement.
*/

CREATE OR REPLACE FUNCTION public.compute_order_split(_order_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  o public.orders%ROWTYPE;
  s public.stores%ROWTYPE;
  ps public.platform_settings%ROWTYPE;
  food_subtotal numeric;
  total_comm_pct numeric;
  admin_pct numeric;
  pool_pct numeric;
  store_extra_pct numeric;
  delivery_fee numeric;
  store_pays_delivery boolean;
  res jsonb;
BEGIN
  SELECT * INTO o FROM public.orders WHERE id = _order_id;
  IF o.id IS NULL THEN RETURN NULL; END IF;
  SELECT * INTO s FROM public.stores WHERE id = o.store_id;
  SELECT * INTO ps FROM public.platform_settings WHERE id = 1;

  delivery_fee := COALESCE(o.delivery_fee, 0);
  food_subtotal := GREATEST(COALESCE(o.total_amount, 0), 0);

  -- Same resolution for in-app + custom: store → pricing override → tiers → platform default
  total_comm_pct := GREATEST(
    LEAST(COALESCE(public.resolve_commission_pct(o.store_id, food_subtotal), ps.default_commission_pct, 15), 100),
    0
  );
  admin_pct := GREATEST(LEAST(COALESCE(ps.admin_share_pct, 5), 100), 0);
  pool_pct  := GREATEST(LEAST(COALESCE(ps.driver_pool_pct_of_subtotal, 10), 100), 0);

  IF ABS((admin_pct + pool_pct) - total_comm_pct) > 0.05 AND (admin_pct + pool_pct) > 0 THEN
    admin_pct := round(total_comm_pct * admin_pct / (admin_pct + pool_pct), 2);
    pool_pct  := round(total_comm_pct - admin_pct, 2);
  END IF;

  store_extra_pct := GREATEST(total_comm_pct - admin_pct - pool_pct, 0);
  store_pays_delivery := COALESCE(s.covers_delivery_fee, false);

  res := jsonb_build_object(
    'food_subtotal', food_subtotal,
    'delivery_fee', delivery_fee,
    'tip_amount', COALESCE(o.tip_amount, 0),
    'total_commission_pct', total_comm_pct,
    'admin_pct', admin_pct,
    'driver_pool_pct', pool_pct,
    'driver_pool_pct_floor', pool_pct,
    'auto_balance_surcharge_pct', 0,
    'store_extra_commission_pct', store_extra_pct,
    'admin_amount', round(food_subtotal * admin_pct / 100, 2),
    'driver_pool_amount', round(food_subtotal * pool_pct / 100, 2),
    'store_extra_commission', round(food_subtotal * store_extra_pct / 100, 2),
    'store_keeps', round(food_subtotal * (100 - total_comm_pct) / 100, 2),
    'store_pays_delivery', store_pays_delivery,
    'driver_delivery_fee', delivery_fee,
    'driver_tip', COALESCE(o.tip_amount, 0)
  );
  RETURN res;
END;
$function$;
