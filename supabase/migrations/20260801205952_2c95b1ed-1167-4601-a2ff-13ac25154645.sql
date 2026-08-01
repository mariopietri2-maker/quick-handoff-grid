CREATE OR REPLACE FUNCTION public.quote_driver_payout(p_store_id uuid, p_distance_km numeric)
 RETURNS numeric
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  s public.platform_settings%ROWTYPE;
  o public.store_pricing_overrides%ROWTYPE;
  v_first numeric; v_per_km numeric; v_min numeric; v_max numeric; v_km numeric; v_raw numeric; v_mult numeric;
BEGIN
  SELECT * INTO s FROM public.platform_settings WHERE id = 1;
  SELECT * INTO o FROM public.store_pricing_overrides WHERE store_id = p_store_id;
  v_first  := COALESCE(o.first_km_price, s.first_km_price, o.base_pay, s.base_pay, 3);
  v_per_km := COALESCE(o.per_km_rate, s.per_km_rate, 0.5);
  v_min    := COALESCE(o.min_pay, s.min_pay, 3);
  v_max    := COALESCE(o.max_pay, s.max_pay, 999999);
  v_km     := COALESCE(p_distance_km, 0);
  v_mult   := GREATEST(0.5, LEAST(3, COALESCE(s.ai_driver_pay_multiplier, 1)));
  v_raw    := (v_first + v_per_km * GREATEST(v_km - 1, 0)) * v_mult;
  RETURN ROUND(LEAST(GREATEST(v_raw, v_min), v_max)::numeric, 2);
END $function$;

CREATE OR REPLACE FUNCTION public.set_order_distance_and_payout()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  s record;
  v_fee_mult numeric;
BEGIN
  IF NEW.distance_km IS NULL OR NEW.distance_km <= 0 THEN
    SELECT latitude, longitude INTO s FROM public.stores WHERE id = NEW.store_id;
    IF s.latitude IS NOT NULL AND NEW.delivery_latitude IS NOT NULL THEN
      NEW.distance_km := public.haversine_km(s.latitude, s.longitude, NEW.delivery_latitude, NEW.delivery_longitude);
    END IF;
  END IF;

  IF TG_OP = 'INSERT' AND COALESCE(NEW.delivery_fee, 0) > 0 THEN
    SELECT GREATEST(0.5, LEAST(3, COALESCE(ai_delivery_fee_multiplier, 1)))
      INTO v_fee_mult FROM public.platform_settings WHERE id = 1;
    NEW.delivery_fee := ROUND((NEW.delivery_fee * COALESCE(v_fee_mult, 1))::numeric, 2);
  END IF;

  IF NEW.driver_payout IS NULL OR NEW.driver_payout = 0 THEN
    NEW.driver_payout := public.quote_driver_payout(NEW.store_id, NEW.distance_km);
  END IF;
  RETURN NEW;
END $function$;