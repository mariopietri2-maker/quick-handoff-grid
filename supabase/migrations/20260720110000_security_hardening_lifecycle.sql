/*
  Platform hardening:
  1) Order lifecycle state machine + RPCs (no free-form status/driver writes)
  2) Server-side delivery fee/distance in place_order + atomic promo use
  3) Payment-backed post-delivery tips (debit customer wallet)
  4) Fix admin_refund_order schema
  5) Revoke sensitive RPCs from anon / tighten create_driver_earning
  6) Disable stacking by default (align with no-double-booking E2E)
*/

-- ---------------------------------------------------------------------------
-- RPCs for intentional transitions
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.transition_order_status(
  p_order_id uuid,
  p_new_status text,
  p_estimated_prep_time integer DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_order public.orders%ROWTYPE;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

  SELECT * INTO v_order FROM public.orders WHERE id = p_order_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Order not found'; END IF;

  UPDATE public.orders
     SET status = p_new_status::order_status,
         estimated_prep_time = COALESCE(p_estimated_prep_time, estimated_prep_time),
         updated_at = now()
   WHERE id = p_order_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_assign_order_driver(
  p_order_id uuid,
  p_driver_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'Admin only';
  END IF;

  UPDATE public.orders
     SET driver_id = p_driver_id,
         status = CASE
           WHEN p_driver_id IS NOT NULL AND status::text IN ('placed', 'pending') THEN 'accepted'::order_status
           ELSE status
         END,
         updated_at = now()
   WHERE id = p_order_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.driver_claim_order(p_order_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_max int;
  v_active int;
  v_claimed uuid;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF NOT public.has_role(v_uid, 'driver'::app_role)
     AND NOT public.has_role(v_uid, 'admin'::app_role) THEN
    RAISE EXCEPTION 'Driver only';
  END IF;

  SELECT GREATEST(1, COALESCE(max_stacked_orders, 1)) INTO v_max
  FROM public.platform_settings WHERE id = 1;

  SELECT COUNT(*)::int INTO v_active
  FROM public.orders
  WHERE driver_id = v_uid
    AND status IN ('accepted','preparing','ready','arrived','picked_up');

  IF v_active >= v_max AND NOT public.has_role(v_uid, 'admin'::app_role) THEN
    RAISE EXCEPTION 'Driver at capacity';
  END IF;

  UPDATE public.orders
     SET driver_id = v_uid,
         status = CASE WHEN status = 'placed' THEN 'accepted'::order_status ELSE status END,
         updated_at = now()
   WHERE id = p_order_id
     AND (driver_id IS NULL OR public.has_role(v_uid, 'admin'::app_role))
  RETURNING id INTO v_claimed;

  IF v_claimed IS NULL THEN
    RAISE EXCEPTION 'Order already taken';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.transition_order_status(uuid, text, integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_assign_order_driver(uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.driver_claim_order(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.transition_order_status(uuid, text, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_assign_order_driver(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.driver_claim_order(uuid) TO authenticated;

-- ---------------------------------------------------------------------------
-- 2) place_order: recompute fee/distance server-side + atomic promo
-- ---------------------------------------------------------------------------
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
    v_distance_km := ROUND((v_dist_m / 1000.0)::numeric, 2);
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
      IF v_promo.discount_type = 'percentage' THEN
        v_discount := LEAST(v_subtotal, v_subtotal * (v_promo.discount_value / 100));
      ELSE
        v_discount := LEAST(v_subtotal, v_promo.discount_value);
      END IF;
    END IF;
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

-- ---------------------------------------------------------------------------
-- 3) Payment-backed tips: debit customer wallet, then credit driver
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.add_post_delivery_tip(
  p_order_id uuid,
  p_amount numeric
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order RECORD;
  v_amount numeric;
  v_balance numeric := 0;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  v_amount := ROUND(COALESCE(p_amount, 0)::numeric, 2);
  IF v_amount <= 0 THEN RAISE EXCEPTION 'Tip amount must be positive'; END IF;
  IF v_amount > 100 THEN RAISE EXCEPTION 'Tip amount too large'; END IF;

  SELECT id, customer_id, driver_id, status
    INTO v_order
    FROM public.orders
   WHERE id = p_order_id
   FOR UPDATE;

  IF NOT FOUND THEN RAISE EXCEPTION 'Order not found'; END IF;
  IF v_order.customer_id <> auth.uid() THEN RAISE EXCEPTION 'Not allowed'; END IF;
  IF v_order.status::text <> 'delivered' THEN RAISE EXCEPTION 'Order is not delivered'; END IF;
  IF v_order.driver_id IS NULL THEN RAISE EXCEPTION 'Order has no driver'; END IF;

  SELECT COALESCE(available_balance, 0) INTO v_balance
  FROM public.customer_wallets
  WHERE user_id = auth.uid()
  FOR UPDATE;

  IF COALESCE(v_balance, 0) < v_amount THEN
    RAISE EXCEPTION 'Insufficient wallet balance for tip. Add funds or tip at checkout.';
  END IF;

  UPDATE public.customer_wallets
     SET available_balance = available_balance - v_amount,
         updated_at = now()
   WHERE user_id = auth.uid();

  INSERT INTO public.customer_wallet_ledger (user_id, order_id, type, amount, description)
  VALUES (auth.uid(), p_order_id, 'order_redemption', -v_amount, 'Επιπλέον φιλοδώρημα οδηγού');

  INSERT INTO public.wallet_transactions (driver_id, type, amount, status, description, order_id)
  VALUES (
    v_order.driver_id,
    'extra_tip',
    v_amount,
    'completed',
    'Επιπλέον φιλοδώρημα από πελάτη',
    p_order_id
  );

  INSERT INTO public.driver_wallets (driver_id, available_balance, pending_balance, total_withdrawn)
  VALUES (v_order.driver_id, v_amount, 0, 0)
  ON CONFLICT (driver_id) DO UPDATE
    SET available_balance = public.driver_wallets.available_balance + v_amount,
        updated_at = now();

  -- Use session auth null path for tip bump: set local role bypass via direct update as security definer
  -- Temporarily disable tip immutability by updating as SECURITY DEFINER (auth.uid still set).
  -- Admin-style: use a dedicated column update with a GUC flag.
  PERFORM set_config('app.allow_tip_update', '1', true);
  UPDATE public.orders
     SET tip_amount = COALESCE(tip_amount, 0) + v_amount
   WHERE id = p_order_id;
END;
$$;

-- Allow tip update when GUC is set (from tip RPC)
CREATE OR REPLACE FUNCTION public.enforce_order_lifecycle()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_is_admin boolean := false;
  v_is_store boolean := false;
  v_is_driver boolean := false;
  v_old text;
  v_new text;
  v_allow_tip boolean := false;
BEGIN
  IF TG_OP <> 'UPDATE' THEN RETURN NEW; END IF;

  IF v_uid IS NULL THEN
    RETURN NEW;
  END IF;

  BEGIN
    v_allow_tip := current_setting('app.allow_tip_update', true) = '1';
  EXCEPTION WHEN OTHERS THEN
    v_allow_tip := false;
  END;

  v_is_admin := public.has_role(v_uid, 'admin'::app_role);
  v_is_store := EXISTS (
    SELECT 1 FROM public.stores s WHERE s.id = COALESCE(NEW.store_id, OLD.store_id) AND s.owner_id = v_uid
  );
  v_is_driver := (NEW.driver_id = v_uid OR OLD.driver_id = v_uid);

  IF NEW.total_amount IS DISTINCT FROM OLD.total_amount
     OR NEW.delivery_fee IS DISTINCT FROM OLD.delivery_fee
     OR NEW.customer_id IS DISTINCT FROM OLD.customer_id
     OR NEW.store_id IS DISTINCT FROM OLD.store_id THEN
    IF NOT v_is_admin THEN
      RAISE EXCEPTION 'Cannot modify protected order financial fields';
    END IF;
  END IF;

  IF NEW.tip_amount IS DISTINCT FROM OLD.tip_amount AND NOT v_is_admin AND NOT v_allow_tip THEN
    RAISE EXCEPTION 'Cannot modify tip_amount directly';
  END IF;

  v_old := OLD.status::text;
  v_new := NEW.status::text;

  IF v_old = v_new THEN
    IF NEW.driver_id IS DISTINCT FROM OLD.driver_id THEN
      IF v_is_admin THEN RETURN NEW; END IF;
      IF OLD.driver_id IS NULL AND NEW.driver_id = v_uid THEN RETURN NEW; END IF;
      RAISE EXCEPTION 'Not allowed to change driver assignment';
    END IF;
    RETURN NEW;
  END IF;

  IF v_is_admin THEN RETURN NEW; END IF;

  IF v_is_store THEN
    IF (v_old = 'placed' AND v_new IN ('accepted', 'preparing', 'cancelled'))
       OR (v_old = 'accepted' AND v_new IN ('preparing', 'cancelled'))
       OR (v_old = 'preparing' AND v_new IN ('ready', 'cancelled'))
       OR (v_old = 'ready' AND v_new = 'cancelled') THEN
      IF NEW.driver_id IS DISTINCT FROM OLD.driver_id THEN
        RAISE EXCEPTION 'Store cannot change driver assignment';
      END IF;
      RETURN NEW;
    END IF;
  END IF;

  IF OLD.driver_id = v_uid AND NEW.driver_id = v_uid THEN
    IF (v_old IN ('accepted', 'preparing', 'ready') AND v_new = 'arrived')
       OR (v_old IN ('ready', 'arrived') AND v_new = 'picked_up')
       OR (v_old = 'picked_up' AND v_new = 'delivered') THEN
      RETURN NEW;
    END IF;
  END IF;

  RAISE EXCEPTION 'Illegal order status transition: % → %', v_old, v_new;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_order_lifecycle ON public.orders;
CREATE TRIGGER trg_enforce_order_lifecycle
BEFORE UPDATE ON public.orders
FOR EACH ROW
EXECUTE FUNCTION public.enforce_order_lifecycle();

-- ---------------------------------------------------------------------------
-- 4) Fix admin_refund_order to use user_id + valid ledger type
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_refund_order(
  p_order_id uuid,
  p_amount numeric,
  p_reason text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order RECORD;
  v_amount numeric;
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'Admin only';
  END IF;

  v_amount := ROUND(COALESCE(p_amount, 0)::numeric, 2);
  IF v_amount <= 0 THEN RAISE EXCEPTION 'Refund amount must be positive'; END IF;

  SELECT id, customer_id, total_amount, delivery_fee, tip_amount, status
    INTO v_order FROM public.orders WHERE id = p_order_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Order not found'; END IF;

  IF v_amount > (COALESCE(v_order.total_amount,0) + COALESCE(v_order.delivery_fee,0) + COALESCE(v_order.tip_amount,0)) THEN
    RAISE EXCEPTION 'Refund exceeds order total';
  END IF;

  INSERT INTO public.customer_wallets (user_id, available_balance, pending_balance)
  VALUES (v_order.customer_id, v_amount, 0)
  ON CONFLICT (user_id) DO UPDATE
    SET available_balance = public.customer_wallets.available_balance + v_amount,
        updated_at = now();

  INSERT INTO public.customer_wallet_ledger (user_id, order_id, type, amount, description)
  VALUES (
    v_order.customer_id,
    p_order_id,
    'refund_credit',
    v_amount,
    COALESCE(NULLIF(p_reason, ''), 'Admin refund')
  );

  UPDATE public.orders
     SET refund_reason = COALESCE(NULLIF(p_reason, ''), refund_reason),
         updated_at = now()
   WHERE id = p_order_id;
END;
$$;

-- ---------------------------------------------------------------------------
-- 5) Revoke sensitive execute grants
-- ---------------------------------------------------------------------------
REVOKE EXECUTE ON FUNCTION public.nearby_active_drivers(
  double precision, double precision, numeric, uuid[], integer, uuid, double precision, double precision
) FROM anon, authenticated, PUBLIC;
GRANT EXECUTE ON FUNCTION public.nearby_active_drivers(
  double precision, double precision, numeric, uuid[], integer, uuid, double precision, double precision
) TO service_role;

-- Also try common overloads without dropoff args if present
DO $$
BEGIN
  BEGIN
    REVOKE EXECUTE ON FUNCTION public.nearby_active_drivers(double precision, double precision, numeric, uuid[], integer, uuid)
      FROM anon, authenticated, PUBLIC;
    GRANT EXECUTE ON FUNCTION public.nearby_active_drivers(double precision, double precision, numeric, uuid[], integer, uuid)
      TO service_role;
  EXCEPTION WHEN undefined_function THEN NULL;
  END;

  BEGIN
    REVOKE EXECUTE ON FUNCTION public.create_driver_earning(uuid, uuid, numeric, numeric, numeric)
      FROM anon, authenticated, PUBLIC;
    GRANT EXECUTE ON FUNCTION public.create_driver_earning(uuid, uuid, numeric, numeric, numeric)
      TO service_role;
  EXCEPTION WHEN undefined_function THEN NULL;
  END;
END $$;

-- ---------------------------------------------------------------------------
-- 6) Align stacking with no-double-booking product rule
-- ---------------------------------------------------------------------------
UPDATE public.platform_settings
SET max_stacked_orders = 1,
    stacking_enabled = false
WHERE id = 1;

-- Payment amount tracking columns for webhook validation
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS stripe_session_id text,
  ADD COLUMN IF NOT EXISTS expected_charge_cents integer,
  ADD COLUMN IF NOT EXISTS paid_amount_cents integer;
