-- Batch per-store ETAs for customer home (avoids N+1 RPCs).
CREATE OR REPLACE FUNCTION public.get_stores_delivery_eta(
  p_store_ids uuid[],
  p_prep_buffers integer[] DEFAULT NULL
)
RETURNS TABLE (store_id uuid, eta_min integer, eta_max integer)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_base_min integer;
  v_base_max integer;
  v_hard_cap integer;
  v_sid uuid;
  v_buf integer;
  v_i integer;
  v_hist_avg numeric;
  v_hist_count integer;
  v_min integer;
  v_max integer;
BEGIN
  SELECT g.eta_min, g.eta_max INTO v_base_min, v_base_max
  FROM public.get_dynamic_delivery_eta(0) g LIMIT 1;
  v_base_min := COALESCE(v_base_min, 25);
  v_base_max := COALESCE(v_base_max, 35);

  SELECT ps.eta_max_cap_minutes INTO v_hard_cap
  FROM public.platform_settings ps WHERE ps.id = 1;
  v_hard_cap := GREATEST(COALESCE(v_hard_cap, 50), v_base_max);

  IF p_store_ids IS NULL OR array_length(p_store_ids, 1) IS NULL THEN
    RETURN;
  END IF;

  FOR v_i IN 1 .. array_length(p_store_ids, 1) LOOP
    v_sid := p_store_ids[v_i];
    v_buf := 0;
    IF p_prep_buffers IS NOT NULL AND array_length(p_prep_buffers, 1) >= v_i THEN
      v_buf := GREATEST(0, COALESCE(p_prep_buffers[v_i], 0));
    END IF;

    v_min := v_base_min;
    v_max := v_base_max;

    SELECT AVG(EXTRACT(EPOCH FROM (o.updated_at - o.created_at)) / 60.0)::numeric,
           COUNT(*)::integer
      INTO v_hist_avg, v_hist_count
      FROM public.orders o
     WHERE o.store_id = v_sid
       AND o.status = 'delivered'
       AND o.created_at > now() - interval '14 days'
       AND o.updated_at > o.created_at
       AND EXTRACT(EPOCH FROM (o.updated_at - o.created_at)) / 60.0 BETWEEN 10 AND 120;

    IF v_hist_count IS NOT NULL AND v_hist_count >= 5 AND v_hist_avg IS NOT NULL THEN
      v_min := GREATEST(10, ROUND(v_hist_avg * 0.8 * 0.7 + v_base_min * 0.3)::integer);
      v_max := GREATEST(v_min + 5, ROUND(v_hist_avg * 1.2 * 0.7 + v_base_max * 0.3)::integer);
    END IF;

    store_id := v_sid;
    eta_min := LEAST(v_min + v_buf, v_hard_cap);
    eta_max := LEAST(GREATEST(v_max + v_buf, eta_min + 5), v_hard_cap);
    RETURN NEXT;
  END LOOP;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.get_stores_delivery_eta(uuid[], integer[]) TO anon, authenticated, service_role;
