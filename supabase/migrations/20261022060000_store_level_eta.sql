-- Per-store ETA from that store's recent deliveries + global dynamic base.
CREATE OR REPLACE FUNCTION public.get_store_delivery_eta(
  p_store_id uuid,
  p_prep_buffer integer DEFAULT 0
)
RETURNS TABLE (eta_min integer, eta_max integer)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_base record;
  v_hist_avg numeric;
  v_hist_count integer;
  v_min integer;
  v_max integer;
  v_buffer integer;
  v_hard_cap integer;
BEGIN
  -- Start from platform dynamic ETA (supply/demand + global history)
  SELECT g.eta_min, g.eta_max INTO v_min, v_max
  FROM public.get_dynamic_delivery_eta(0) g
  LIMIT 1;

  v_min := COALESCE(v_min, 25);
  v_max := COALESCE(v_max, 35);

  SELECT ps.eta_max_cap_minutes INTO v_hard_cap
  FROM public.platform_settings ps WHERE ps.id = 1;
  v_hard_cap := GREATEST(COALESCE(v_hard_cap, 50), v_max);

  IF p_store_id IS NOT NULL THEN
    SELECT AVG(EXTRACT(EPOCH FROM (o.updated_at - o.created_at)) / 60.0)::numeric,
           COUNT(*)::integer
      INTO v_hist_avg, v_hist_count
      FROM public.orders o
     WHERE o.store_id = p_store_id
       AND o.status = 'delivered'
       AND o.created_at > now() - interval '14 days'
       AND o.updated_at > o.created_at
       AND EXTRACT(EPOCH FROM (o.updated_at - o.created_at)) / 60.0 BETWEEN 10 AND 120;

    IF v_hist_count IS NOT NULL AND v_hist_count >= 5 AND v_hist_avg IS NOT NULL THEN
      -- Blend store history heavily for this store
      v_min := GREATEST(10, ROUND(v_hist_avg * 0.8 * 0.7 + v_min * 0.3)::integer);
      v_max := GREATEST(v_min + 5, ROUND(v_hist_avg * 1.2 * 0.7 + v_max * 0.3)::integer);
    END IF;
  END IF;

  v_buffer := COALESCE(p_prep_buffer, 0);
  eta_min := LEAST(v_min + v_buffer, v_hard_cap);
  eta_max := LEAST(GREATEST(v_max + v_buffer, eta_min + 5), v_hard_cap);
  RETURN NEXT;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.get_store_delivery_eta(uuid, integer) TO anon, authenticated, service_role;
