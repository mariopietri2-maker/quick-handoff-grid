/*
  Platform commission changes were ignored: resolve_commission_pct preferred a
  catch-all commission_tiers row (min=0, max=NULL, often stuck at 15%) over
  platform_settings.default_commission_pct.

  New order:
    1) stores.commission_pct
    2) store_pricing_overrides.commission_pct
    3) amount-specific tiers only (NOT the catch-all default tier)
    4) platform_settings.default_commission_pct
    5) hardcoded 15

  Also sync the catch-all tier row to the current platform default so admin
  UIs that still display tiers stay consistent.
*/

CREATE OR REPLACE FUNCTION public.resolve_commission_pct(p_store_id uuid, p_food_total numeric)
RETURNS numeric
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_store_override numeric;
  v_table_override numeric;
  v_tier_pct numeric;
  v_default numeric;
BEGIN
  SELECT commission_pct INTO v_store_override FROM stores WHERE id = p_store_id;
  IF v_store_override IS NOT NULL THEN
    RETURN GREATEST(LEAST(v_store_override, 100), 0);
  END IF;

  SELECT commission_pct INTO v_table_override
  FROM store_pricing_overrides
  WHERE store_id = p_store_id;
  IF v_table_override IS NOT NULL THEN
    RETURN GREATEST(LEAST(v_table_override, 100), 0);
  END IF;

  -- Amount-based tiers only — skip catch-all "default all orders" (min<=0, max NULL)
  SELECT commission_pct INTO v_tier_pct
  FROM commission_tiers
  WHERE is_active
    AND p_food_total >= min_amount
    AND (max_amount IS NULL OR p_food_total < max_amount)
    AND NOT (COALESCE(min_amount, 0) <= 0 AND max_amount IS NULL)
  ORDER BY min_amount DESC
  LIMIT 1;
  IF v_tier_pct IS NOT NULL THEN
    RETURN GREATEST(LEAST(v_tier_pct, 100), 0);
  END IF;

  SELECT default_commission_pct INTO v_default FROM platform_settings WHERE id = 1;
  RETURN GREATEST(LEAST(COALESCE(v_default, 15), 100), 0);
END;
$function$;

-- Keep catch-all tier label in sync with platform default (display / legacy tools)
UPDATE public.commission_tiers t
SET commission_pct = COALESCE(
  (SELECT default_commission_pct FROM public.platform_settings WHERE id = 1),
  t.commission_pct
),
updated_at = now()
WHERE t.is_active = true
  AND COALESCE(t.min_amount, 0) <= 0
  AND t.max_amount IS NULL;
