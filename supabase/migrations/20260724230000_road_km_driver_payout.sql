-- Prefer Mapbox road km for payout/fees when sane vs straight-line.
-- Falls back to haversine when road km is missing or fails sanity checks.
CREATE OR REPLACE FUNCTION public.resolve_delivery_distance_km(
  p_straight_km numeric,
  p_road_km numeric DEFAULT NULL
)
RETURNS numeric
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $$
DECLARE
  v_straight numeric := GREATEST(0, ROUND(COALESCE(p_straight_km, 0)::numeric, 2));
  v_road numeric := ROUND(COALESCE(p_road_km, 0)::numeric, 2);
  v_max numeric;
BEGIN
  IF v_road <= 0 THEN
    RETURN v_straight;
  END IF;
  -- Road cannot be meaningfully shorter than straight line (allow 15% GPS noise).
  IF v_straight > 0 AND v_road < (v_straight * 0.85) THEN
    RETURN v_straight;
  END IF;
  -- Cap abuse: allow up to 2.8× straight or +8 km, whichever is larger.
  IF v_straight > 0 THEN
    v_max := GREATEST(v_straight * 2.8, v_straight + 8);
    IF v_road > v_max THEN
      RETURN ROUND(v_max::numeric, 2);
    END IF;
  END IF;
  RETURN GREATEST(v_road, v_straight);
END;
$$;

COMMENT ON FUNCTION public.resolve_delivery_distance_km(numeric, numeric) IS
  'Picks road km for driver payout when sane vs haversine; otherwise straight-line.';

REVOKE ALL ON FUNCTION public.resolve_delivery_distance_km(numeric, numeric) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.resolve_delivery_distance_km(numeric, numeric) TO authenticated, service_role;


CREATE OR REPLACE FUNCTION public.place_order(p_store_id uuid, p_items jsonb, p_delivery_address text, p_delivery_latitude double precision, p_delivery_longitude double precision, p_payment_method text, p_tip_amount numeric, p_delivery_fee numeric, p_notes text, p_scheduled_for timestamp with time zone, p_distance_km numeric, p_promo_code text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_user uuid := auth.uid();
  v_subtotal numeric := 0;
  v_discount numeric := 0;
  v_promo record;
  v_promo_id uuid := NULL;
  v_order_id uuid;
  v_item jsonb;
  v_menu record;
  v_qty int;
  v_total numeric;
  v_fee numeric := 0;
  v_tip numeric := GREATEST(COALESCE(p_tip_amount, 0), 0);
  v_status order_status;
  v_store_lat double precision;
  v_store_lon double precision;
  v_dist_m numeric;
  v_distance_km numeric := 0;
  v_base numeric := 0;
  v_per_km numeric := 0;
  v_promo_ok boolean := false;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF p_items IS NULL OR jsonb_array_length(p_items) = 0 THEN RAISE EXCEPTION 'No items'; END IF;
  IF p_payment_method NOT IN ('cash','card') THEN RAISE EXCEPTION 'Invalid payment method'; END IF;
  IF v_tip > 100 THEN RAISE EXCEPTION 'Tip too large'; END IF;

  SELECT latitude, longitude INTO v_store_lat, v_store_lon FROM public.stores WHERE id = p_store_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Store not found'; END IF;

  IF v_store_lat IS NOT NULL AND v_store_lon IS NOT NULL
     AND p_delivery_latitude IS NOT NULL AND p_delivery_longitude IS NOT NULL THEN
    v_dist_m := 6371000 * acos(LEAST(1, GREATEST(-1,
        cos(radians(v_store_lat)) * cos(radians(p_delivery_latitude))
      * cos(radians(p_delivery_longitude) - radians(v_store_lon))
      + sin(radians(v_store_lat)) * sin(radians(p_delivery_latitude))
    )));
    IF v_dist_m < 30 THEN
      RAISE EXCEPTION 'Η διεύθυνση παράδοσης συμπίπτει με τη διεύθυνση του καταστήματος. Διάλεξε διαφορετική.';
    END IF;
    v_distance_km := public.resolve_delivery_distance_km(
      ROUND((v_dist_m / 1000.0)::numeric, 2),
      p_distance_km
    );
  ELSE
    v_distance_km := GREATEST(0, ROUND(COALESCE(p_distance_km, 0)::numeric, 2));
  END IF;

  SELECT COALESCE(customer_base_fee, 1.5), COALESCE(customer_per_km_fee, 0.5)
    INTO v_base, v_per_km
    FROM public.platform_settings WHERE id = 1;

  v_fee := ROUND(GREATEST(0, v_base + (v_per_km * v_distance_km))::numeric, 2);
  -- Ignore client-supplied fee (p_delivery_fee kept for API compat)

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    v_qty := GREATEST(1, COALESCE((v_item->>'quantity')::int, 1));
    SELECT mi.id, mi.name, mi.price, mi.store_id, mi.is_available, mi.is_snoozed
      INTO v_menu FROM public.menu_items mi WHERE mi.id = (v_item->>'menu_item_id')::uuid;
    IF NOT FOUND THEN RAISE EXCEPTION 'Menu item not found'; END IF;
    IF v_menu.store_id <> p_store_id THEN RAISE EXCEPTION 'Menu item does not belong to store'; END IF;
    IF COALESCE(v_menu.is_available, true) = false OR COALESCE(v_menu.is_snoozed, false) = true THEN
      RAISE EXCEPTION 'Menu item unavailable: %', v_menu.name;
    END IF;
    v_subtotal := v_subtotal + (v_menu.price * v_qty);
  END LOOP;

  IF p_promo_code IS NOT NULL AND length(trim(p_promo_code)) > 0 THEN
    SELECT * INTO v_promo FROM public.promo_codes
      WHERE lower(code) = lower(trim(p_promo_code)) AND is_active = true
        AND (expires_at IS NULL OR expires_at > now())
        AND (max_uses IS NULL OR current_uses < max_uses)
        AND (store_id IS NULL OR store_id = p_store_id)
        AND min_order_amount <= v_subtotal
      FOR UPDATE
      LIMIT 1;
    IF FOUND THEN
      v_promo_id := v_promo.id;
      IF v_promo.discount_type = 'percentage' THEN
        v_discount := LEAST(v_subtotal, v_subtotal * (v_promo.discount_value / 100));
      ELSE
        v_discount := LEAST(v_subtotal, v_promo.discount_value);
      END IF;
    END IF;
  END IF;

  v_total := GREATEST(0, v_subtotal - v_discount);
  v_status := CASE WHEN p_payment_method = 'card' THEN 'pending'::order_status ELSE 'placed'::order_status END;

  INSERT INTO public.orders (
    customer_id, store_id, status, payment_method,
    total_amount, delivery_fee, tip_amount,
    delivery_address, delivery_latitude, delivery_longitude,
    distance_km, notes, scheduled_for
  ) VALUES (
    v_user, p_store_id, v_status, p_payment_method,
    v_total, v_fee, v_tip,
    p_delivery_address, p_delivery_latitude, p_delivery_longitude,
    v_distance_km, NULLIF(p_notes, ''), p_scheduled_for
  ) RETURNING id INTO v_order_id;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    v_qty := GREATEST(1, COALESCE((v_item->>'quantity')::int, 1));
    SELECT mi.id, mi.name, mi.price INTO v_menu FROM public.menu_items mi WHERE mi.id = (v_item->>'menu_item_id')::uuid;
    INSERT INTO public.order_items (order_id, menu_item_id, name, quantity, unit_price)
    VALUES (v_order_id, v_menu.id, v_menu.name, v_qty, v_menu.price);
  END LOOP;

  IF v_promo_id IS NOT NULL THEN
    UPDATE public.promo_codes
       SET current_uses = current_uses + 1
     WHERE id = v_promo_id
       AND (max_uses IS NULL OR current_uses < max_uses)
    RETURNING true INTO v_promo_ok;
    IF NOT COALESCE(v_promo_ok, false) THEN
      RAISE EXCEPTION 'Promo code no longer available';
    END IF;
  END IF;

  RETURN v_order_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.create_external_order(p_store_id uuid, p_source text, p_total_amount numeric, p_delivery_address text, p_delivery_lat double precision DEFAULT NULL::double precision, p_delivery_lng double precision DEFAULT NULL::double precision, p_distance_km numeric DEFAULT NULL::numeric, p_customer_name text DEFAULT NULL::text, p_customer_phone text DEFAULT NULL::text, p_notes text DEFAULT NULL::text, p_external_ref text DEFAULT NULL::text, p_driver_payout_override numeric DEFAULT NULL::numeric, p_store_charge_override numeric DEFAULT NULL::numeric, p_items_summary text DEFAULT NULL::text, p_payment_method text DEFAULT 'external'::text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
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
    v_km := public.resolve_delivery_distance_km(
      ROUND((v_dist_m / 1000.0)::numeric, 2),
      p_distance_km
    );
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

CREATE OR REPLACE FUNCTION public.create_custom_order(p_store_id uuid, p_total_amount numeric, p_delivery_address text, p_delivery_lat double precision DEFAULT NULL::double precision, p_delivery_lng double precision DEFAULT NULL::double precision, p_distance_km numeric DEFAULT NULL::numeric, p_customer_name text DEFAULT NULL::text, p_customer_phone text DEFAULT NULL::text, p_payment_method text DEFAULT 'cash'::text, p_notes text DEFAULT NULL::text, p_items_summary text DEFAULT NULL::text, p_delivery_fee_override numeric DEFAULT NULL::numeric, p_driver_payout_override numeric DEFAULT NULL::numeric, p_store_charge_override numeric DEFAULT NULL::numeric)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
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
    v_km := public.resolve_delivery_distance_km(
      ROUND((v_dist_m / 1000.0)::numeric, 2),
      p_distance_km
    );
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

CREATE OR REPLACE FUNCTION public.quote_driver_payout(p_store_id uuid, p_distance_km numeric)
 RETURNS numeric
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  s public.platform_settings%ROWTYPE;
  o public.store_pricing_overrides%ROWTYPE;
  v_first numeric; v_per_km numeric; v_min numeric; v_max numeric; v_km numeric; v_raw numeric;
BEGIN
  SELECT * INTO s FROM public.platform_settings WHERE id = 1;
  SELECT * INTO o FROM public.store_pricing_overrides WHERE store_id = p_store_id;
  v_first  := COALESCE(o.first_km_price, s.first_km_price, o.base_pay, s.base_pay, 5);
  v_per_km := COALESCE(o.per_km_rate, s.per_km_rate, 0.5);
  v_min    := COALESCE(o.min_pay, s.min_pay, 5);
  v_max    := COALESCE(o.max_pay, s.max_pay, 999999);
  v_km     := COALESCE(p_distance_km, 0);
  v_raw    := v_first + v_per_km * GREATEST(v_km - 1, 0);
  RETURN ROUND(LEAST(GREATEST(v_raw, v_min), v_max)::numeric, 2);
END $function$;


-- Stronger driver minimum; keep wait bonus settings.
UPDATE public.platform_settings
SET
  min_pay = GREATEST(COALESCE(min_pay, 0), 5),
  first_km_price = GREATEST(COALESCE(first_km_price, base_pay, 0), 5),
  base_pay = GREATEST(COALESCE(base_pay, 0), 5),
  max_pay = GREATEST(COALESCE(max_pay, 0), 15),
  wait_bonus_rate_per_min = COALESCE(wait_bonus_rate_per_min, 0.10),
  wait_bonus_grace_minutes = COALESCE(wait_bonus_grace_minutes, 10),
  wait_bonus_cap = GREATEST(COALESCE(wait_bonus_cap, 0), 10)
WHERE id = 1;

