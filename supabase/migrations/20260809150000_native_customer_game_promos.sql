
-- Native customer app game/promo fixes
--  1) promo_codes.free_delivery flag (supports the wheel/mystery "free delivery" deal)
--  2) Seed the default game codes + welcome code as real, active promo codes so the
--     discount shown in checkout is actually charged by place_order.
--  3) place_order honors free_delivery promos (delivery fee -> 0).
--  4) customer_cancel_order RPC: customers cancel through server policy instead of
--     writing status directly from the client.

-- 1) free_delivery flag
ALTER TABLE public.promo_codes
  ADD COLUMN IF NOT EXISTS free_delivery boolean NOT NULL DEFAULT false;

-- 2) Seed default game/welcome codes (idempotent; unique index on LOWER(code))
INSERT INTO public.promo_codes (code, discount_type, discount_value, free_delivery) VALUES
  ('FRESH5',   'percentage', 5,  false),
  ('FRESH10',  'percentage', 10, false),
  ('FRESH15',  'percentage', 15, false),
  ('FRESH20',  'percentage', 20, false),
  ('FRESH25',  'percentage', 25, false),
  ('ΠΑΡΑΔΟΣΗ', 'percentage', 0,  true),
  ('WELCOME',  'percentage', 0,  true)
ON CONFLICT DO NOTHING;

-- 3) place_order honors free_delivery promos
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
  v_free_delivery boolean := false;
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

GRANT EXECUTE ON FUNCTION public.place_order(uuid, jsonb, text, double precision, double precision, text, numeric, numeric, text, timestamp with time zone, numeric, text) TO anon, authenticated;

-- 4) Customers cancel their own orders through server policy
CREATE OR REPLACE FUNCTION public.customer_cancel_order(p_order_id uuid, p_reason text DEFAULT NULL)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = public
AS $function$
DECLARE
  v_order orders%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

  SELECT * INTO v_order FROM orders WHERE id = p_order_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Order not found'; END IF;

  IF v_order.customer_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'Not allowed to cancel this order';
  END IF;
  IF v_order.status NOT IN ('placed', 'pending') THEN
    RAISE EXCEPTION 'Η παραγγελία δεν μπορεί να ακυρωθεί πλέον';
  END IF;
  IF v_order.driver_id IS NOT NULL THEN
    RAISE EXCEPTION 'Η παραγγελία έχει ήδη ανατεθεί σε διανομέα';
  END IF;
  IF v_order.created_at < now() - interval '15 minutes' THEN
    RAISE EXCEPTION 'Η παραγγελία είναι μεγαλύτερη από 15 λεπτά και δεν ακυρώνεται αυτόματα';
  END IF;

  UPDATE orders
    SET status = 'cancelled',
        notes = CASE
          WHEN p_reason IS NOT NULL AND p_reason <> ''
            THEN COALESCE(notes || E'\n', '') || '❌ Ακυρώθηκε από τον πελάτη: ' || p_reason
          ELSE COALESCE(notes || E'\n', '') || '❌ Ακυρώθηκε από τον πελάτη'
        END,
        updated_at = now()
    WHERE id = p_order_id;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.customer_cancel_order(uuid, text) TO authenticated;

-- 5) Can this user manage the customer games (admin/support only)? Used to gate the
--    admin panel in the native customer app instead of exposing it to every customer.
CREATE OR REPLACE FUNCTION public.can_manage_games()
 RETURNS boolean
 LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT public.is_support_or_admin(auth.uid());
$$;

GRANT EXECUTE ON FUNCTION public.can_manage_games() TO authenticated;

-- 6) Store search that also matches menu item names and categories (native browse search).
CREATE OR REPLACE FUNCTION public.search_stores(p_q text)
 RETURNS TABLE (
   id uuid, name text, address text, latitude double precision, longitude double precision,
   is_active boolean, image_url text, prep_buffer_minutes integer,
   busy_mode boolean, opening_hours jsonb, holiday_dates date[]
 )
 LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT DISTINCT s.id, s.name, s.address, s.latitude, s.longitude,
         s.is_active, s.image_url, s.prep_buffer_minutes, s.busy_mode,
         s.opening_hours, s.holiday_dates
  FROM public.stores s
  LEFT JOIN public.menu_items mi ON mi.store_id = s.id
  WHERE s.is_active = true
    AND length(trim(p_q)) > 0
    AND (
      s.name ILIKE '%' || trim(p_q) || '%'
      OR s.address ILIKE '%' || trim(p_q) || '%'
      OR mi.name ILIKE '%' || trim(p_q) || '%'
      OR mi.category ILIKE '%' || trim(p_q) || '%'
    )
  ORDER BY s.name
  LIMIT 80;
$$;

GRANT EXECUTE ON FUNCTION public.search_stores(text) TO anon, authenticated;
