/*
  Simplify platform commission to a clear 3-way food split:
    store_keeps% + driver_pool% + admin% = 100%
  Remove hard floors (15/5/10) so admin can set any valid split.
*/

-- ---------------------------------------------------------------------------
-- 1) Settings trigger: normalize 3-way split that sums to 100
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.enforce_commission_floors()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  admin_pct numeric;
  pool_pct numeric;
  store_pct numeric;
  total numeric;
BEGIN
  admin_pct := GREATEST(COALESCE(NEW.admin_share_pct, 0), 0);
  pool_pct  := GREATEST(COALESCE(NEW.driver_pool_pct_of_subtotal, 0), 0);

  -- Prefer explicit commission (= 100 - store keeps). If missing/inconsistent,
  -- derive from admin + driver pool.
  IF NEW.default_commission_pct IS NULL THEN
    NEW.default_commission_pct := admin_pct + pool_pct;
  END IF;

  NEW.default_commission_pct := GREATEST(LEAST(COALESCE(NEW.default_commission_pct, 0), 100), 0);
  NEW.admin_share_pct := GREATEST(LEAST(admin_pct, 100), 0);
  NEW.driver_pool_pct_of_subtotal := GREATEST(LEAST(pool_pct, 100), 0);

  -- If admin + pool don't match commission, scale them to fit (keep ratio).
  total := NEW.admin_share_pct + NEW.driver_pool_pct_of_subtotal;
  IF total > 0 AND ABS(total - NEW.default_commission_pct) > 0.05 THEN
    NEW.admin_share_pct := round(NEW.default_commission_pct * NEW.admin_share_pct / total, 2);
    NEW.driver_pool_pct_of_subtotal := round(NEW.default_commission_pct - NEW.admin_share_pct, 2);
  ELSIF total = 0 AND NEW.default_commission_pct > 0 THEN
    -- All commission → admin by default when pools are zeroed incorrectly
    NEW.admin_share_pct := NEW.default_commission_pct;
    NEW.driver_pool_pct_of_subtotal := 0;
  ELSIF NEW.default_commission_pct = 0 THEN
    NEW.admin_share_pct := 0;
    NEW.driver_pool_pct_of_subtotal := 0;
  END IF;

  -- Clamp residual drift
  store_pct := 100 - NEW.default_commission_pct;
  IF store_pct < 0 THEN
    NEW.default_commission_pct := 100;
    NEW.admin_share_pct := round(NEW.admin_share_pct * 100 / NULLIF(total, 0), 2);
    NEW.driver_pool_pct_of_subtotal := round(100 - NEW.admin_share_pct, 2);
  END IF;

  RETURN NEW;
END;
$$;

-- ---------------------------------------------------------------------------
-- 2) Per-store commission: allow any 0–100 (no forced 15% floor)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.enforce_store_commission_floor()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.commission_pct IS NOT NULL THEN
    NEW.commission_pct := GREATEST(LEAST(NEW.commission_pct, 100), 0);
  END IF;
  RETURN NEW;
END;
$$;

-- ---------------------------------------------------------------------------
-- 3) Split calculator: use configured % as-is (no GREATEST floors)
-- ---------------------------------------------------------------------------
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

  total_comm_pct := GREATEST(LEAST(COALESCE(s.commission_pct, ps.default_commission_pct, 15), 100), 0);
  admin_pct := GREATEST(LEAST(COALESCE(ps.admin_share_pct, 5), 100), 0);
  pool_pct  := GREATEST(LEAST(COALESCE(ps.driver_pool_pct_of_subtotal, 10), 100), 0);

  -- If store override changes total commission, keep admin/pool ratio of platform settings
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

-- ---------------------------------------------------------------------------
-- 4) Live pricing model view — no floors
-- ---------------------------------------------------------------------------
CREATE OR REPLACE VIEW public.v_pricing_model
WITH (security_invoker=on) AS
SELECT
  ps.id,
  COALESCE(ps.admin_share_pct, 0)               AS admin_pct,
  COALESCE(ps.driver_pool_pct_of_subtotal, 0)   AS driver_pool_pct,
  COALESCE(ps.default_commission_pct, 0)        AS default_commission_pct,
  100 - COALESCE(ps.default_commission_pct, 0)  AS default_store_keeps_pct
FROM public.platform_settings ps
WHERE ps.id = 1;

GRANT SELECT ON public.v_pricing_model TO authenticated;
