-- Scheduled delivery: validate p_scheduled_for in place_order.
-- The checkout picker offers +30min..~4.5h slots; reject past or absurdly far
-- slots so the auto-dispatch hold (scheduled_for <= now + 45min) and the store
-- queue stay consistent.
-- Mirrors the CURRENT place_order definition from
-- 20260809150000_native_customer_game_promos.sql (road-km distance via
-- resolve_delivery_distance_km + free_delivery promos) with the schedule
-- checks added.

CREATE OR REPLACE FUNCTION public.place_order(
  p_store_id uuid,
  p_items jsonb,
  p_delivery_address text,
  p_delivery_latitude double precision,
  p_delivery_longitude double precision,
  p_payment_method text,
  p_tip_amount numeric,
  p_delivery_fee numeric,
  p_notes text,
  p_scheduled_for timestamp with time zone,
  p_distance_km numeric,
  p_promo_code text
)
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
  v_free_delivery boolean := false;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF p_items IS NULL OR jsonb_array_length(p_items) = 0 THEN RAISE EXCEPTION 'No items'; END IF;
  IF p_payment_method NOT IN ('cash','card') THEN RAISE EXCEPTION 'Invalid payment method'; END IF;
  IF v_tip > 100 THEN RAISE EXCEPTION 'Tip too large'; END IF;

  -- Scheduled delivery sanity: must be in the future and within the horizon the
  -- checkout picker offers (auto-dispatch holds scheduled orders until 45 min
  -- before the slot, so anything later than ~6h out would sit untouched).
  IF p_scheduled_for IS NOT NULL THEN
    IF p_scheduled_for <= now() THEN
      RAISE EXCEPTION 'Η ώρα προγραμματισμένης παράδοσης πρέπει να είναι στο μέλλον.';
    END IF;
    IF p_scheduled_for > now() + interval '6 hours' THEN
      RAISE EXCEPTION 'Η ώρα προγραμματισμένης παράδοσης είναι πολύ μακριά στο μέλλον.';
    END IF;
  END IF;

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
      v_free_delivery := COALESCE(v_promo.free_delivery, false);
      IF v_promo.discount_type = 'percentage' THEN
        v_discount := LEAST(v_subtotal, v_subtotal * (v_promo.discount_value / 100));
      ELSE
        v_discount := LEAST(v_subtotal, v_promo.discount_value);
      END IF;
    END IF;
  END IF;

  IF v_free_delivery THEN
    v_fee := 0;
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

-- Keep the grants the current definition carries (survives CREATE OR REPLACE,
-- restated here so a fresh DB replay ends up identical).
GRANT EXECUTE ON FUNCTION public.place_order(uuid, jsonb, text, double precision, double precision, text, numeric, numeric, text, timestamp with time zone, numeric, text) TO anon, authenticated;

-- -----------------------------------------------------------------------------
-- Watchdog: exclude scheduled orders that are still waiting for their slot.
-- auto-dispatch holds scheduled_for orders until 45 min before the requested
-- time, so an order can legitimately sit in 'placed' for hours. Without this,
-- watchdog_check_stuck_orders() would fire critical alerts for every scheduled
-- order. Mirrors the definition in 20260812140000_proactive_alerting.sql.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.watchdog_check_stuck_orders()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  rec RECORD;
  v_count integer := 0;
BEGIN
  FOR rec IN
    SELECT o.id, o.status,
           EXTRACT(EPOCH FROM (now() - o.updated_at))::integer AS age_seconds
      FROM public.orders o
     WHERE o.status IN ('placed', 'accepted', 'preparing', 'picked_up')
       AND o.updated_at < now() - interval '15 minutes'
       AND (o.scheduled_for IS NULL OR o.scheduled_for <= now() + interval '45 minutes')
     ORDER BY o.updated_at ASC
     LIMIT 200
  LOOP
    IF (rec.status = 'placed'     AND rec.age_seconds <  900) THEN CONTINUE; END IF;
    IF (rec.status = 'accepted'   AND rec.age_seconds < 3600) THEN CONTINUE; END IF;
    IF (rec.status = 'preparing'  AND rec.age_seconds < 1800) THEN CONTINUE; END IF;
    IF (rec.status = 'picked_up'  AND rec.age_seconds < 2400) THEN CONTINUE; END IF;

    PERFORM public.enqueue_alert(
      p_event_type => 'stuck_order',
      p_severity   => CASE WHEN rec.status = 'placed' THEN 'critical' ELSE 'warn' END,
      p_title      => 'Stuck order #' || substring(rec.id::text, 1, 8),
      p_body       => 'Order is stuck in status ' || rec.status || ' for '
                      || (rec.age_seconds / 60)::text || ' minutes',
      p_data       => jsonb_build_object(
        'order_id', rec.id,
        'status', rec.status,
        'age_seconds', rec.age_seconds
      ),
      p_dedupe_key => 'stuck_order:' || rec.id::text || ':' || rec.status
    );
    v_count := v_count + 1;
  END LOOP;
  RETURN v_count;
END;
$$;

GRANT EXECUTE ON FUNCTION public.watchdog_check_stuck_orders() TO service_role;
