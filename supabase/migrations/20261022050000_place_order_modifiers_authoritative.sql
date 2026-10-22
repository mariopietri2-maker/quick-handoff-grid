-- Authoritative modifier attach after place_order.
-- Client sends selected options; server prices from menu_item_modifiers catalog.
CREATE OR REPLACE FUNCTION public.attach_order_modifiers(
  p_order_id uuid,
  p_lines jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_user uuid := auth.uid();
  v_order record;
  v_line jsonb;
  v_mod jsonb;
  v_oi_id uuid;
  v_menu_id uuid;
  v_delta numeric;
  v_group text;
  v_option text;
  v_unit numeric;
  v_suffix text;
  v_used uuid[] := ARRAY[]::uuid[];
  v_food numeric;
  v_prior_food numeric;
  v_discount numeric;
  v_found boolean;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  IF p_lines IS NULL OR jsonb_array_length(p_lines) = 0 THEN
    RETURN;
  END IF;

  SELECT id, customer_id, status, total_amount, delivery_fee, tip_amount
    INTO v_order
  FROM public.orders
  WHERE id = p_order_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Order not found';
  END IF;
  IF v_order.customer_id IS DISTINCT FROM v_user THEN
    RAISE EXCEPTION 'Not your order';
  END IF;
  IF v_order.status::text IN ('delivered', 'cancelled') THEN
    RETURN;
  END IF;

  SELECT COALESCE(SUM(oi.unit_price * oi.quantity), 0) INTO v_prior_food
  FROM public.order_items oi WHERE oi.order_id = p_order_id;

  FOR v_line IN SELECT * FROM jsonb_array_elements(p_lines) LOOP
    v_menu_id := NULLIF(v_line->>'menu_item_id', '')::uuid;
    IF v_menu_id IS NULL THEN
      CONTINUE;
    END IF;

    SELECT oi.id, oi.unit_price
      INTO v_oi_id, v_unit
    FROM public.order_items oi
    WHERE oi.order_id = p_order_id
      AND oi.menu_item_id = v_menu_id
      AND NOT (oi.id = ANY (v_used))
    ORDER BY oi.created_at
    LIMIT 1;

    IF v_oi_id IS NULL THEN
      CONTINUE;
    END IF;
    v_used := array_append(v_used, v_oi_id);
    v_suffix := '';

    IF v_line ? 'modifiers' AND jsonb_typeof(v_line->'modifiers') = 'array' THEN
      FOR v_mod IN SELECT * FROM jsonb_array_elements(v_line->'modifiers') LOOP
        v_option := COALESCE(NULLIF(v_mod->>'option_name', ''), NULLIF(v_mod->>'optionName', ''));
        IF v_option IS NULL OR length(trim(v_option)) = 0 THEN
          CONTINUE;
        END IF;

        v_delta := 0;
        v_group := COALESCE(NULLIF(v_mod->>'group_name', ''), NULLIF(v_mod->>'groupName', ''), 'Επιλογές');
        v_found := false;

        SELECT COALESCE(m.price_delta, 0), m.group_name, m.option_name
          INTO v_delta, v_group, v_option
        FROM public.menu_item_modifiers m
        WHERE m.menu_item_id = v_menu_id
          AND lower(m.option_name) = lower(trim(v_option))
        ORDER BY m.sort_order
        LIMIT 1;

        IF FOUND THEN
          v_found := true;
        ELSE
          v_delta := 0;
          v_option := COALESCE(NULLIF(v_mod->>'option_name', ''), NULLIF(v_mod->>'optionName', ''));
          v_group := COALESCE(NULLIF(v_mod->>'group_name', ''), NULLIF(v_mod->>'groupName', ''), 'Επιλογές');
        END IF;

        INSERT INTO public.order_item_modifiers (order_item_id, group_name, option_name, price_delta)
        VALUES (v_oi_id, v_group, v_option, COALESCE(v_delta, 0));

        v_unit := COALESCE(v_unit, 0) + COALESCE(v_delta, 0);
        IF length(v_suffix) > 0 THEN
          v_suffix := v_suffix || ', ' || v_option;
        ELSE
          v_suffix := v_option;
        END IF;
      END LOOP;
    END IF;

    UPDATE public.order_items
       SET unit_price = v_unit,
           name = CASE
             WHEN length(v_suffix) > 0 AND position(v_suffix in COALESCE(name, '')) = 0
             THEN name || ' (' || v_suffix || ')'
             ELSE name
           END
     WHERE id = v_oi_id;
  END LOOP;

  SELECT COALESCE(SUM(oi.unit_price * oi.quantity), 0) INTO v_food
  FROM public.order_items oi WHERE oi.order_id = p_order_id;

  -- Preserve discount baked into total at place_order time
  v_discount := GREATEST(
    0,
    v_prior_food
      - (COALESCE(v_order.total_amount, 0)
         - COALESCE(v_order.delivery_fee, 0)
         - COALESCE(v_order.tip_amount, 0))
  );

  UPDATE public.orders
     SET total_amount = GREATEST(0, v_food - v_discount)
                        + COALESCE(delivery_fee, 0)
                        + COALESCE(tip_amount, 0)
   WHERE id = p_order_id;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.attach_order_modifiers(uuid, jsonb) TO authenticated;
