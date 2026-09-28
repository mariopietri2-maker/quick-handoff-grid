CREATE OR REPLACE FUNCTION public.admin_delete_store(p_store_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_name text;
  v_orders int;
  v_trg text;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Only admins can delete stores';
  END IF;

  SELECT name INTO v_name FROM public.stores WHERE id = p_store_id;
  IF v_name IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Store not found');
  END IF;

  SELECT count(*)::int INTO v_orders FROM public.orders WHERE store_id = p_store_id;

  IF v_orders = 0 THEN
    DELETE FROM public.stores WHERE id = p_store_id;
    RETURN jsonb_build_object('ok', true, 'mode', 'hard', 'name', v_name);
  END IF;

  SELECT t.tgname INTO v_trg
  FROM pg_trigger t
  JOIN pg_class c ON c.oid = t.tgrelid
  JOIN pg_proc p ON p.oid = t.tgfoid
  WHERE c.relname = 'stores'
    AND c.relnamespace = 'public'::regnamespace
    AND p.proname = 'protect_store_active_status'
    AND NOT t.tgisinternal
  LIMIT 1;

  IF v_trg IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.stores DISABLE TRIGGER %I', v_trg);
  END IF;

  UPDATE public.stores
  SET
    is_active = false,
    suspension_reason = 'Deleted by admin',
    suspended_at = coalesce(suspended_at, now()),
    updated_at = now()
  WHERE id = p_store_id;

  IF v_trg IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.stores ENABLE TRIGGER %I', v_trg);
  END IF;

  RETURN jsonb_build_object('ok', true, 'mode', 'soft', 'name', v_name, 'orders', v_orders);
END;
$function$;

GRANT EXECUTE ON FUNCTION public.admin_delete_store(uuid) TO authenticated;

DROP POLICY IF EXISTS "Admins can delete stores" ON public.stores;
CREATE POLICY "Admins can delete stores"
  ON public.stores FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));
