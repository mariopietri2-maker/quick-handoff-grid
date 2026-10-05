
CREATE OR REPLACE FUNCTION public.run_ops_assistant(p_trigger text DEFAULT 'manual')
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_settings public.ops_assistant_settings%ROWTYPE;
  v_cfg jsonb;
  v_promos jsonb;
  v_new_promos jsonb := '[]'::jsonb;
  v_enabled text[] := ARRAY[]::text[];
  v_max int := 3;
  v_day int;
  v_i int := 0;
  v_start int;
  v_count int;
  v_el jsonb;
  v_title text;
  v_tag text;
  v_health jsonb := '{}'::jsonb;
  v_stuck int := 0;
  v_open_chats int := 0;
  v_open_tickets int := 0;
  v_stores int := 0;
  v_ok boolean := true;
  v_notes text := '';
BEGIN
  IF auth.uid() IS NOT NULL THEN
    IF NOT (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'support')) THEN
      RAISE EXCEPTION 'Only admin/support can run ops assistant';
    END IF;
  END IF;

  SELECT * INTO v_settings FROM public.ops_assistant_settings WHERE id = 1;
  IF NOT FOUND THEN
    INSERT INTO public.ops_assistant_settings (id) VALUES (1);
    SELECT * INTO v_settings FROM public.ops_assistant_settings WHERE id = 1;
  END IF;

  v_max := GREATEST(1, LEAST(COALESCE(v_settings.max_active_promos, 3), 6));

  IF COALESCE(v_settings.health_checks, true) THEN
    -- Valid order_status values only (no on_the_way)
    SELECT COUNT(*) INTO v_stuck
    FROM public.orders
    WHERE status IN (
      'pending'::order_status,
      'placed'::order_status,
      'accepted'::order_status,
      'preparing'::order_status,
      'ready'::order_status,
      'arrived'::order_status,
      'picked_up'::order_status
    )
      AND created_at < now() - interval '45 minutes';

    SELECT COUNT(*) INTO v_open_chats
    FROM public.live_chat_sessions
    WHERE status = 'open' AND created_at < now() - interval '2 hours';

    SELECT COUNT(*) INTO v_open_tickets
    FROM public.support_tickets
    WHERE status IN ('open', 'pending') AND created_at < now() - interval '24 hours';

    SELECT COUNT(*) INTO v_stores
    FROM public.stores
    WHERE COALESCE(is_active, true) = true;

    v_health := jsonb_build_object(
      'stuck_orders_45m', v_stuck,
      'open_chats_over_2h', v_open_chats,
      'open_tickets_24h', v_open_tickets,
      'active_stores', v_stores
    );
    IF v_stuck > 5 THEN
      v_ok := false;
      v_notes := v_notes || 'High stuck orders. ';
    END IF;
  END IF;

  IF COALESCE(v_settings.rotate_promos, true) THEN
    SELECT COALESCE(published_config, draft_config, '{}'::jsonb)
      INTO v_cfg
    FROM public.customer_app_config
    WHERE id = true
    LIMIT 1;

    v_promos := COALESCE(v_cfg->'promos', '[]'::jsonb);
    v_count := jsonb_array_length(v_promos);
    IF v_count > 0 THEN
      v_day := EXTRACT(DOY FROM now())::int;
      v_start := v_day % v_count;
      v_new_promos := '[]'::jsonb;
      FOR v_i IN 0..v_count-1 LOOP
        v_el := v_promos->((v_start + v_i) % v_count);
        v_title := COALESCE(v_el->>'title', v_el->>'tag', 'promo');
        v_tag := COALESCE(v_el->>'tag', '');
        IF v_i < v_max THEN
          v_el := jsonb_set(v_el, '{enabled}', 'true'::jsonb, true);
          v_enabled := array_append(v_enabled, trim(both FROM (v_tag || ' ' || v_title)));
        ELSE
          v_el := jsonb_set(v_el, '{enabled}', 'false'::jsonb, true);
        END IF;
        v_new_promos := v_new_promos || jsonb_build_array(v_el);
      END LOOP;

      v_cfg := jsonb_set(v_cfg, '{promos}', v_new_promos, true);

      UPDATE public.customer_app_config
      SET published_config = v_cfg,
          draft_config = v_cfg,
          updated_at = now()
      WHERE id = true;
    ELSE
      v_notes := v_notes || 'No promos in config. ';
    END IF;
  END IF;

  UPDATE public.ops_assistant_settings
  SET last_run_at = now(), updated_at = now()
  WHERE id = 1;

  INSERT INTO public.ops_assistant_runs (trigger, promos_enabled, health, ok, notes, summary)
  VALUES (
    COALESCE(p_trigger, 'manual'),
    v_enabled,
    v_health,
    v_ok,
    NULLIF(trim(v_notes), ''),
    jsonb_build_object(
      'max_active_promos', v_max,
      'promos_rotated', COALESCE(v_settings.rotate_promos, true),
      'health_checks', COALESCE(v_settings.health_checks, true)
    )
  );

  RETURN jsonb_build_object(
    'ok', v_ok,
    'promos_enabled', to_jsonb(v_enabled),
    'health', v_health,
    'notes', NULLIF(trim(v_notes), '')
  );
END;
$fn$;

GRANT EXECUTE ON FUNCTION public.run_ops_assistant(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.run_ops_assistant(text) TO service_role;
