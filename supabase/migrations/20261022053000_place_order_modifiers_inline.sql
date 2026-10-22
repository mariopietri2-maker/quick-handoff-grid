-- place_order: price + persist modifiers in the same transaction
CREATE OR REPLACE FUNCTION public.place_order(p_store_id uuid, p_items jsonb, p_delivery_address text, p_delivery_latitude double precision, p_delivery_longitude double precision, p_payment_method text, p_tip_amount numeric, p_delivery_fee numeric, p_notes text, p_scheduled_for timestamp with time zone, p_distance_km numeric, p_promo_code text, p_fulfilment text DEFAULT 'delivery'::text)
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
  v_store_name text;
  v_dist_m numeric;
  v_distance_km numeric := 0;
  v_base numeric := 0;
  v_per_km numeric := 0;
  v_promo_ok boolean := false;
  v_free_delivery boolean := false;
  v_fulfilment text := lower(COALESCE(NULLIF(p_fulfilment, ''), 'delivery'));
  v_delivery_address text := NULLIF(p_delivery_address, '');
  v_delivery_lat double precision := p_delivery_latitude;
  v_delivery_lng double precision := p_delivery_longitude;
  v_mod jsonb;
  v_mod_extra numeric;
  v_unit numeric;
  v_suffix text;
  v_delta numeric;
  v_group text;
  v_option text;
  v_oi_id uuid;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF p_items IS NULL OR jsonb_array_length(p_items) = 0 THEN RAISE EXCEPTION 'No items'; END IF;
  IF p_payment_method NOT IN ('cash','card','viva') THEN RAISE EXCEPTION 'Invalid payment method'; END IF;
  IF v_tip > 100 THEN RAISE EXCEPTION 'Tip too large'; END IF;
  IF v_fulfilment NOT IN ('delivery','pickup') THEN RAISE EXCEPTION 'Invalid fulfilment mode'; END IF;

  -- Scheduled delivery sanity: must be in the future and within the horizon the
  -- checkout picker offers (auto-dispatch holds scheduled orders until 45 min
  -- before the slot, so anything later than ~6h out would sit untouched).
  IF p_scheduled_for IS NOT NULL THEN
    IF p_scheduled_for <= now() THEN
      RAISE EXCEPTION '? ??? ????????????????? ????????? ?????? ?? ????? ??? ??????.';
    END IF;
    IF p_scheduled_for > now() + interval '6 hours' THEN
      RAISE EXCEPTION '? ??? ????????????????? ????????? ????? ???? ?????? ??? ??????.';
    END IF;
  END IF;

  SELECT latitude, longitude, name INTO v_store_lat, v_store_lon, v_store_name FROM public.stores WHERE id = p_store_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Store not found'; END IF;

  IF v_fulfilment = 'pickup' THEN
    -- Customer collects from the store: zero distance/fee, coords land on the store.
    v_delivery_address := COALESCE(v_delivery_address, v_store_name);
    IF v_delivery_address NOT ILIKE '????????%' THEN
      v_delivery_address := '???????? � ' || v_delivery_address;
    END IF;
    v_delivery_lat := COALESCE(v_delivery_lat, v_store_lat);
    v_delivery_lng := COALESCE(v_delivery_lng, v_store_lon);
    v_distance_km := 0;
    v_fee := 0;
  ELSE
    IF v_store_lat IS NOT NULL AND v_store_lon IS NOT NULL
       AND v_delivery_lat IS NOT NULL AND v_delivery_lng IS NOT NULL THEN
      v_dist_m := 6371000 * acos(LEAST(1, GREATEST(-1,
          cos(radians(v_store_lat)) * cos(radians(v_delivery_lat))
        * cos(radians(v_delivery_lng) - radians(v_store_lon))
        + sin(radians(v_store_lat)) * sin(radians(v_delivery_lat))
      )));
      IF v_dist_m < 30 THEN
        RAISE EXCEPTION '? ????????? ????????? ????????? ?? ?? ????????? ??? ????????????. ??????? ???????????.';
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
  END IF;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    v_qty := GREATEST(1, COALESCE((v_item->>'quantity')::int, 1));
    SELECT mi.id, mi.name, mi.price, mi.store_id, mi.is_available, mi.is_snoozed
      INTO v_menu FROM public.menu_items mi WHERE mi.id = (v_item->>'menu_item_id')::uuid;
    IF NOT FOUND THEN RAISE EXCEPTION 'Menu item not found'; END IF;
    IF v_menu.store_id <> p_store_id THEN RAISE EXCEPTION 'Menu item does not belong to store'; END IF;
    IF COALESCE(v_menu.is_available, true) = false OR COALESCE(v_menu.is_snoozed, false) = true THEN
      RAISE EXCEPTION 'Menu item unavailable: %', v_menu.name;
    END IF;
    -- Authoritative modifier extras from catalog
    v_mod_extra := 0;
    IF v_item ? 'modifiers' AND jsonb_typeof(v_item->'modifiers') = 'array' THEN
      FOR v_mod IN SELECT * FROM jsonb_array_elements(v_item->'modifiers') LOOP
        v_option := COALESCE(NULLIF(v_mod->>'option_name', ''), NULLIF(v_mod->>'optionName', ''));
        IF v_option IS NULL THEN CONTINUE; END IF;
        SELECT COALESCE(m.price_delta, 0) INTO v_delta
          FROM public.menu_item_modifiers m
         WHERE m.menu_item_id = v_menu.id
           AND lower(m.option_name) = lower(trim(v_option))
         ORDER BY m.sort_order
         LIMIT 1;
        IF FOUND THEN
          v_mod_extra := v_mod_extra + COALESCE(v_delta, 0);
        END IF;
      END LOOP;
    END IF;
    v_subtotal := v_subtotal + ((v_menu.price + v_mod_extra) * v_qty);
  END LOOP;

  -- Stack multiple promos: "CODE1|CODE2" (roulette + loyalty coupon).
  v_discount := 0;
  v_free_delivery := false;
  v_promo_id := NULL;
  PERFORM set_config('app.promo_ids', '', true);

  IF p_promo_code IS NOT NULL AND length(trim(p_promo_code)) > 0 THEN
    PERFORM public._apply_stacked_promos(
      p_promo_code, v_subtotal, p_store_id, v_user
    );
    v_discount := COALESCE(nullif(current_setting('app.promo_discount', true), '')::numeric, 0);
    v_free_delivery := COALESCE(nullif(current_setting('app.promo_free_delivery', true), '')::boolean, false);
    BEGIN
      v_promo_id := nullif(current_setting('app.promo_id', true), '')::uuid;
    EXCEPTION WHEN OTHERS THEN
      v_promo_id := NULL;
    END;
  END IF;

  IF v_free_delivery THEN
    v_fee := 0;
  END IF;

  v_total := GREATEST(0, v_subtotal - v_discount);
  v_status := CASE WHEN p_payment_method IN ('card','viva') THEN 'pending'::order_status ELSE 'placed'::order_status END;

  INSERT INTO public.orders (
    customer_id, store_id, status, payment_method,
    total_amount, delivery_fee, tip_amount,
    delivery_address, delivery_latitude, delivery_longitude,
    distance_km, notes, scheduled_for, fulfilment
  ) VALUES (
    v_user, p_store_id, v_status, p_payment_method,
    v_total, v_fee, v_tip,
    v_delivery_address, v_delivery_lat, v_delivery_lng,
    v_distance_km, NULLIF(p_notes, ''), p_scheduled_for, v_fulfilment
  ) RETURNING id INTO v_order_id;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    v_qty := GREATEST(1, COALESCE((v_item->>'quantity')::int, 1));
    SELECT mi.id, mi.name, mi.price INTO v_menu FROM public.menu_items mi WHERE mi.id = (v_item->>'menu_item_id')::uuid;
    v_mod_extra := 0;
    v_suffix := '';
    IF v_item ? 'modifiers' AND jsonb_typeof(v_item->'modifiers') = 'array' THEN
      FOR v_mod IN SELECT * FROM jsonb_array_elements(v_item->'modifiers') LOOP
        v_option := COALESCE(NULLIF(v_mod->>'option_name', ''), NULLIF(v_mod->>'optionName', ''));
        IF v_option IS NULL THEN CONTINUE; END IF;
        v_group := COALESCE(NULLIF(v_mod->>'group_name', ''), NULLIF(v_mod->>'groupName', ''), 'Επιλογές');
        v_delta := 0;
        SELECT COALESCE(m.price_delta, 0), m.group_name, m.option_name
          INTO v_delta, v_group, v_option
          FROM public.menu_item_modifiers m
         WHERE m.menu_item_id = v_menu.id
           AND lower(m.option_name) = lower(trim(v_option))
         ORDER BY m.sort_order
         LIMIT 1;
        IF NOT FOUND THEN
          v_delta := 0;
          v_option := COALESCE(NULLIF(v_mod->>'option_name', ''), NULLIF(v_mod->>'optionName', ''));
          v_group := COALESCE(NULLIF(v_mod->>'group_name', ''), NULLIF(v_mod->>'groupName', ''), 'Επιλογές');
        END IF;
        v_mod_extra := v_mod_extra + COALESCE(v_delta, 0);
        IF length(v_suffix) > 0 THEN
          v_suffix := v_suffix || ', ' || v_option;
        ELSE
          v_suffix := v_option;
        END IF;
      END LOOP;
    END IF;
    v_unit := v_menu.price + v_mod_extra;
    INSERT INTO public.order_items (order_id, menu_item_id, name, quantity, unit_price)
    VALUES (
      v_order_id,
      v_menu.id,
      CASE WHEN length(v_suffix) > 0 THEN v_menu.name || ' (' || v_suffix || ')' ELSE v_menu.name END,
      v_qty,
      v_unit
    )
    RETURNING id INTO v_oi_id;

    IF v_item ? 'modifiers' AND jsonb_typeof(v_item->'modifiers') = 'array' THEN
      FOR v_mod IN SELECT * FROM jsonb_array_elements(v_item->'modifiers') LOOP
        v_option := COALESCE(NULLIF(v_mod->>'option_name', ''), NULLIF(v_mod->>'optionName', ''));
        IF v_option IS NULL THEN CONTINUE; END IF;
        v_group := COALESCE(NULLIF(v_mod->>'group_name', ''), NULLIF(v_mod->>'groupName', ''), 'Επιλογές');
        v_delta := 0;
        SELECT COALESCE(m.price_delta, 0), m.group_name, m.option_name
          INTO v_delta, v_group, v_option
          FROM public.menu_item_modifiers m
         WHERE m.menu_item_id = v_menu.id
           AND lower(m.option_name) = lower(trim(v_option))
         ORDER BY m.sort_order
         LIMIT 1;
        IF NOT FOUND THEN
          v_delta := 0;
          v_option := COALESCE(NULLIF(v_mod->>'option_name', ''), NULLIF(v_mod->>'optionName', ''));
          v_group := COALESCE(NULLIF(v_mod->>'group_name', ''), NULLIF(v_mod->>'groupName', ''), 'Επιλογές');
        END IF;
        INSERT INTO public.order_item_modifiers (order_item_id, group_name, option_name, price_delta)
        VALUES (v_oi_id, v_group, v_option, COALESCE(v_delta, 0));
      END LOOP;
    END IF;
  END LOOP;

  -- Increment all stacked promo codes
  IF length(COALESCE(current_setting('app.promo_ids', true), '')) > 0 THEN
    UPDATE public.promo_codes p
       SET current_uses = current_uses + 1
     WHERE p.id = ANY(string_to_array(current_setting('app.promo_ids', true), ',')::uuid[])
       AND (p.max_uses IS NULL OR p.current_uses < p.max_uses);
  ELSIF v_promo_id IS NOT NULL THEN
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

GRANT EXECUTE ON FUNCTION public.place_order(uuid, jsonb, text, double precision, double precision, text, numeric, numeric, text, timestamp with time zone, numeric, text, text) TO anon, authenticated;
