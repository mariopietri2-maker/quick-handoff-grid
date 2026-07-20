/*
  Make custom/external orders behave like in-app orders:
  - Same customer delivery_fee + quote_driver_payout formulas
  - Do not lock store_charge at create (settlement fills it like in-app)
  - compute_order_split treats total_amount as food (matches place_order)
  - External marketplace sources still settle driver pay from locked payout
*/

-- ---------------------------------------------------------------------------
-- 1) food_subtotal = order total_amount (food only; delivery_fee is separate)
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
  -- place_order / create_external_order store FOOD in total_amount; fee is separate
  food_subtotal := GREATEST(COALESCE(o.total_amount, 0), 0);

  total_comm_pct := GREATEST(COALESCE(s.commission_pct, ps.default_commission_pct, 15), 15);
  admin_pct := GREATEST(COALESCE(ps.admin_share_pct, 5), 5);
  pool_pct  := GREATEST(COALESCE(ps.driver_pool_pct_of_subtotal, 10), 10);
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
-- 2) create_external_order — mirror place_order fee + payout fields
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.create_external_order(
  p_store_id uuid,
  p_source text,
  p_total_amount numeric,
  p_delivery_address text,
  p_delivery_lat double precision DEFAULT NULL,
  p_delivery_lng double precision DEFAULT NULL,
  p_distance_km numeric DEFAULT NULL,
  p_customer_name text DEFAULT NULL,
  p_customer_phone text DEFAULT NULL,
  p_notes text DEFAULT NULL,
  p_external_ref text DEFAULT NULL,
  p_driver_payout_override numeric DEFAULT NULL,
  p_store_charge_override numeric DEFAULT NULL,
  p_items_summary text DEFAULT NULL,
  p_payment_method text DEFAULT 'external'
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_store stores%ROWTYPE;
  v_settings platform_settings%ROWTYPE;
  v_km numeric;
  v_driver_pay numeric;
  v_delivery_fee numeric;
  v_base numeric;
  v_per_km numeric;
  v_order_id uuid;
  v_combined_notes text;
  v_is_owner boolean := false;
  v_is_priv boolean := false;
  v_pm text;
BEGIN
  SELECT * INTO v_store FROM stores WHERE id = p_store_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Store not found'; END IF;

  v_is_priv  := is_support_or_admin(auth.uid());
  v_is_owner := (v_store.owner_id = auth.uid());

  IF NOT (v_is_priv OR v_is_owner) THEN
    RAISE EXCEPTION 'Not allowed to create orders for this store';
  END IF;

  IF p_total_amount < 0 THEN
    RAISE EXCEPTION 'Total amount cannot be negative';
  END IF;

  IF NOT v_is_priv AND (p_driver_payout_override IS NOT NULL OR p_store_charge_override IS NOT NULL) THEN
    RAISE EXCEPTION 'Only admin/support can override pricing';
  END IF;

  IF p_source NOT IN ('manual','efood','wolt','box','other') THEN
    RAISE EXCEPTION 'Invalid source (got %)', p_source;
  END IF;

  v_pm := COALESCE(NULLIF(p_payment_method, ''), 'cash');
  IF v_pm NOT IN ('cash','card','external') THEN
    RAISE EXCEPTION 'Invalid payment_method (got %)', v_pm;
  END IF;

  -- Map legacy "external" payment to cash for lifecycle/cash-debt parity with in-app
  IF v_pm = 'external' THEN
    v_pm := 'cash';
  END IF;

  SELECT * INTO v_settings FROM platform_settings WHERE id = 1;
  v_km := GREATEST(0, ROUND(COALESCE(p_distance_km, 0)::numeric, 2));

  -- Same customer delivery fee as place_order
  v_base   := COALESCE(v_settings.customer_base_fee, 1.5);
  v_per_km := COALESCE(v_settings.customer_per_km_fee, 0.5);
  v_delivery_fee := ROUND(GREATEST(0, v_base + (v_per_km * v_km))::numeric, 2);

  -- Same driver payout as in-app (admin may override)
  IF p_driver_payout_override IS NOT NULL THEN
    IF p_driver_payout_override < 0 OR p_driver_payout_override > 50 THEN
      RAISE EXCEPTION 'Driver payout override must be between 0 and 50€ (got %)', p_driver_payout_override;
    END IF;
    v_driver_pay := ROUND(p_driver_payout_override::numeric, 2);
  ELSE
    v_driver_pay := public.quote_driver_payout(p_store_id, v_km);
  END IF;

  -- Optional admin store_charge override only — otherwise leave NULL so
  -- settle_order_commission fills store_keeps like in-app.
  -- (p_store_charge_override kept for privileged tools)

  v_combined_notes := CONCAT_WS(E'\n',
    NULLIF(p_notes, ''),
    CASE WHEN p_customer_name  IS NOT NULL THEN '👤 ' || p_customer_name  END,
    CASE WHEN p_customer_phone IS NOT NULL THEN '📞 ' || p_customer_phone END,
    CASE WHEN p_items_summary  IS NOT NULL THEN '🧾 ' || p_items_summary  END,
    CASE WHEN v_pm = 'cash' THEN '💶 ΜΕΤΡΗΤΑ — εισπράττει ο οδηγός' END,
    '📦 Custom · ' || upper(p_source)
  );

  INSERT INTO orders (
    store_id, status, source, external_ref,
    total_amount, delivery_fee, tip_amount, distance_km,
    delivery_address, delivery_latitude, delivery_longitude,
    notes, payment_method,
    store_charge, driver_payout, platform_profit
  ) VALUES (
    p_store_id, 'placed', p_source, p_external_ref,
    p_total_amount, v_delivery_fee, 0, v_km,
    p_delivery_address, p_delivery_lat, p_delivery_lng,
    v_combined_notes, v_pm,
    p_store_charge_override, v_driver_pay, NULL
  ) RETURNING id INTO v_order_id;

  INSERT INTO order_items (order_id, name, quantity, unit_price)
  VALUES (
    v_order_id,
    COALESCE(NULLIF(p_items_summary, ''), 'Custom order · ' || p_source),
    1,
    p_total_amount
  );

  IF has_role(auth.uid(), 'admin') THEN
    PERFORM log_admin_action(
      'create_external_order',
      'order',
      v_order_id::text,
      'Custom/external order from ' || p_source || ' (' || v_pm || ') for ' || p_total_amount,
      jsonb_build_object(
        'source', p_source,
        'payment_method', v_pm,
        'delivery_fee', v_delivery_fee,
        'driver_payout', v_driver_pay,
        'distance_km', v_km
      )
    );
  END IF;

  RETURN v_order_id;
END;
$function$;

-- ---------------------------------------------------------------------------
-- 3) create_custom_order — same fee/payout alignment (admin Ledger)
--    Keep exact arg list/order so CREATE OR REPLACE hits the live overload.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.create_custom_order(
  p_store_id uuid,
  p_total_amount numeric,
  p_delivery_address text,
  p_delivery_lat double precision DEFAULT NULL,
  p_delivery_lng double precision DEFAULT NULL,
  p_distance_km numeric DEFAULT NULL,
  p_customer_name text DEFAULT NULL,
  p_customer_phone text DEFAULT NULL,
  p_payment_method text DEFAULT 'cash',
  p_notes text DEFAULT NULL,
  p_items_summary text DEFAULT NULL,
  p_delivery_fee_override numeric DEFAULT NULL,
  p_driver_payout_override numeric DEFAULT NULL,
  p_store_charge_override numeric DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_settings platform_settings%ROWTYPE;
  v_km numeric;
  v_driver_pay numeric;
  v_delivery_fee numeric;
  v_base numeric;
  v_per_km numeric;
  v_order_id uuid;
  v_combined_notes text;
  v_pm text;
BEGIN
  IF NOT is_support_or_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Only admin/support can create custom orders';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM stores WHERE id = p_store_id) THEN
    RAISE EXCEPTION 'Store not found';
  END IF;

  IF p_total_amount < 0 THEN
    RAISE EXCEPTION 'Total amount cannot be negative';
  END IF;

  IF p_driver_payout_override IS NOT NULL AND (p_driver_payout_override < 0 OR p_driver_payout_override > 50) THEN
    RAISE EXCEPTION 'Driver payout override must be between 0 and 50€';
  END IF;
  IF p_store_charge_override IS NOT NULL AND (p_store_charge_override < 0 OR p_store_charge_override > 1000) THEN
    RAISE EXCEPTION 'Store charge override must be between 0 and 1000€';
  END IF;

  v_pm := COALESCE(NULLIF(p_payment_method, ''), 'cash');
  IF v_pm NOT IN ('cash','card') THEN
    RAISE EXCEPTION 'Invalid payment_method (got %)', v_pm;
  END IF;

  SELECT * INTO v_settings FROM platform_settings WHERE id = 1;
  v_km := GREATEST(0, ROUND(COALESCE(p_distance_km, 0)::numeric, 2));

  v_base   := COALESCE(v_settings.customer_base_fee, 1.5);
  v_per_km := COALESCE(v_settings.customer_per_km_fee, 0.5);
  v_delivery_fee := COALESCE(
    p_delivery_fee_override,
    ROUND(GREATEST(0, v_base + (v_per_km * v_km))::numeric, 2)
  );

  IF p_driver_payout_override IS NOT NULL THEN
    v_driver_pay := ROUND(p_driver_payout_override::numeric, 2);
  ELSE
    v_driver_pay := public.quote_driver_payout(p_store_id, v_km);
  END IF;

  v_combined_notes := CONCAT_WS(E'\n',
    NULLIF(p_notes, ''),
    CASE WHEN p_customer_name  IS NOT NULL THEN '👤 ' || p_customer_name  END,
    CASE WHEN p_customer_phone IS NOT NULL THEN '📞 ' || p_customer_phone END,
    CASE WHEN p_items_summary  IS NOT NULL THEN '🧾 ' || p_items_summary  END,
    CASE WHEN v_pm = 'cash' THEN '💶 ΜΕΤΡΗΤΑ — εισπράττει ο οδηγός' END,
    '📦 Custom · MANUAL'
  );

  INSERT INTO orders (
    store_id, status, source,
    total_amount, delivery_fee, tip_amount, distance_km,
    delivery_address, delivery_latitude, delivery_longitude,
    notes, payment_method,
    store_charge, driver_payout
  ) VALUES (
    p_store_id, 'placed', 'manual',
    p_total_amount, v_delivery_fee, 0, v_km,
    p_delivery_address, p_delivery_lat, p_delivery_lng,
    v_combined_notes, v_pm,
    p_store_charge_override, v_driver_pay
  ) RETURNING id INTO v_order_id;

  INSERT INTO order_items (order_id, name, quantity, unit_price)
  VALUES (
    v_order_id,
    COALESCE(NULLIF(p_items_summary, ''), 'Custom order'),
    1,
    p_total_amount
  );

  IF has_role(auth.uid(), 'admin') THEN
    PERFORM log_admin_action(
      'create_custom_order',
      'order',
      v_order_id::text,
      'Manual custom order (' || v_pm || ') for ' || p_total_amount,
      jsonb_build_object(
        'delivery_fee', v_delivery_fee,
        'driver_payout', v_driver_pay,
        'distance_km', v_km
      )
    );
  END IF;

  RETURN v_order_id;
END;
$function$;
