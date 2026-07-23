/*
  Make create_external_order / create_custom_order create rows the same way
  place_order does (aside from source / no customer_id):

  - Recompute distance_km via haversine when store + dropoff coords exist
  - Reject dropoff < 30m from store (same guard as place_order)
  - delivery_fee = platform base + per_km * distance (ignore client fee)
  - Leave driver_payout at 0 so trg_set_order_distance_and_payout quotes it
    (admin override still locks payout when provided)
  - Omit store_charge / platform_profit so column DEFAULT 0 applies
  - Status always 'placed' (custom has no Stripe pending step)
*/

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
  v_dist_m numeric;
  v_delivery_fee numeric;
  v_base numeric;
  v_per_km numeric;
  v_order_id uuid;
  v_combined_notes text;
  v_is_owner boolean := false;
  v_is_priv boolean := false;
  v_pm text;
  v_driver_pay numeric := 0;
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
  IF v_pm = 'external' THEN
    v_pm := 'cash';
  END IF;

  -- Distance: same haversine path as place_order
  IF v_store.latitude IS NOT NULL AND v_store.longitude IS NOT NULL
     AND p_delivery_lat IS NOT NULL AND p_delivery_lng IS NOT NULL THEN
    v_dist_m := 6371000 * acos(LEAST(1, GREATEST(-1,
        cos(radians(v_store.latitude)) * cos(radians(p_delivery_lat))
      * cos(radians(p_delivery_lng) - radians(v_store.longitude))
      + sin(radians(v_store.latitude)) * sin(radians(p_delivery_lat))
    )));
    IF v_dist_m < 30 THEN
      RAISE EXCEPTION 'Η διεύθυνση παράδοσης συμπίπτει με τη διεύθυνση του καταστήματος. Διάλεξε διαφορετική.';
    END IF;
    v_km := ROUND((v_dist_m / 1000.0)::numeric, 2);
  ELSE
    v_km := GREATEST(0, ROUND(COALESCE(p_distance_km, 0)::numeric, 2));
  END IF;

  SELECT * INTO v_settings FROM platform_settings WHERE id = 1;
  v_base   := COALESCE(v_settings.customer_base_fee, 1.5);
  v_per_km := COALESCE(v_settings.customer_per_km_fee, 0.5);
  v_delivery_fee := ROUND(GREATEST(0, v_base + (v_per_km * v_km))::numeric, 2);

  -- Admin may lock payout; otherwise leave 0 for BEFORE INSERT trigger (like place_order)
  IF p_driver_payout_override IS NOT NULL THEN
    IF p_driver_payout_override < 0 OR p_driver_payout_override > 50 THEN
      RAISE EXCEPTION 'Driver payout override must be between 0 and 50€ (got %)', p_driver_payout_override;
    END IF;
    v_driver_pay := ROUND(p_driver_payout_override::numeric, 2);
  ELSE
    v_driver_pay := 0;
  END IF;

  IF p_store_charge_override IS NOT NULL AND (p_store_charge_override < 0 OR p_store_charge_override > 1000) THEN
    RAISE EXCEPTION 'Store charge override must be between 0 and 1000€';
  END IF;

  v_combined_notes := CONCAT_WS(E'\n',
    NULLIF(p_notes, ''),
    CASE WHEN p_customer_name  IS NOT NULL THEN '👤 ' || p_customer_name  END,
    CASE WHEN p_customer_phone IS NOT NULL THEN '📞 ' || p_customer_phone END,
    CASE WHEN p_items_summary  IS NOT NULL THEN '🧾 ' || p_items_summary  END,
    CASE WHEN v_pm = 'cash' THEN '💶 ΜΕΤΡΗΤΑ — εισπράττει ο οδηγός' END,
    '📦 Custom · ' || upper(p_source)
  );

  -- Mirror place_order INSERT shape (no store_charge / platform_profit → DEFAULT 0)
  INSERT INTO orders (
    store_id, status, source, external_ref,
    total_amount, delivery_fee, tip_amount, distance_km,
    delivery_address, delivery_latitude, delivery_longitude,
    notes, payment_method,
    driver_payout,
    store_charge
  ) VALUES (
    p_store_id, 'placed', p_source, p_external_ref,
    p_total_amount, v_delivery_fee, 0, v_km,
    p_delivery_address, p_delivery_lat, p_delivery_lng,
    v_combined_notes, v_pm,
    v_driver_pay,
    COALESCE(p_store_charge_override, 0)
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
        'distance_km', v_km
      )
    );
  END IF;

  RETURN v_order_id;
END;
$function$;

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
  v_store stores%ROWTYPE;
  v_settings platform_settings%ROWTYPE;
  v_km numeric;
  v_dist_m numeric;
  v_driver_pay numeric := 0;
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

  SELECT * INTO v_store FROM stores WHERE id = p_store_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Store not found'; END IF;

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

  IF v_store.latitude IS NOT NULL AND v_store.longitude IS NOT NULL
     AND p_delivery_lat IS NOT NULL AND p_delivery_lng IS NOT NULL THEN
    v_dist_m := 6371000 * acos(LEAST(1, GREATEST(-1,
        cos(radians(v_store.latitude)) * cos(radians(p_delivery_lat))
      * cos(radians(p_delivery_lng) - radians(v_store.longitude))
      + sin(radians(v_store.latitude)) * sin(radians(p_delivery_lat))
    )));
    IF v_dist_m < 30 THEN
      RAISE EXCEPTION 'Η διεύθυνση παράδοσης συμπίπτει με τη διεύθυνση του καταστήματος. Διάλεξε διαφορετική.';
    END IF;
    v_km := ROUND((v_dist_m / 1000.0)::numeric, 2);
  ELSE
    v_km := GREATEST(0, ROUND(COALESCE(p_distance_km, 0)::numeric, 2));
  END IF;

  SELECT * INTO v_settings FROM platform_settings WHERE id = 1;
  v_base   := COALESCE(v_settings.customer_base_fee, 1.5);
  v_per_km := COALESCE(v_settings.customer_per_km_fee, 0.5);
  -- Same as place_order: ignore client/admin delivery_fee override
  v_delivery_fee := ROUND(GREATEST(0, v_base + (v_per_km * v_km))::numeric, 2);

  IF p_driver_payout_override IS NOT NULL THEN
    v_driver_pay := ROUND(p_driver_payout_override::numeric, 2);
  ELSE
    v_driver_pay := 0;
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
    driver_payout,
    store_charge
  ) VALUES (
    p_store_id, 'placed', 'manual',
    p_total_amount, v_delivery_fee, 0, v_km,
    p_delivery_address, p_delivery_lat, p_delivery_lng,
    v_combined_notes, v_pm,
    v_driver_pay,
    COALESCE(p_store_charge_override, 0)
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
        'distance_km', v_km
      )
    );
  END IF;

  RETURN v_order_id;
END;
$function$;
