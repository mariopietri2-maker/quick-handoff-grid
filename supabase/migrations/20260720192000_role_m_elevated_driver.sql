-- Role "M": elevated drivers (floor leads) with extra ops privileges.
-- They use the driver app, can see/claim all open orders, and still act as drivers.
-- NOTE: enum value 'm' must already exist (added in a prior statement / deploy step).

ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'm';

-- Helper: M or admin
CREATE OR REPLACE FUNCTION public.is_m_or_admin(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.has_role(_user_id, 'm'::app_role)
      OR public.has_role(_user_id, 'admin'::app_role);
$$;

-- Helper: regular driver OR M (M are still drivers)
CREATE OR REPLACE FUNCTION public.is_driver_like(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.has_role(_user_id, 'driver'::app_role)
      OR public.has_role(_user_id, 'm'::app_role)
      OR public.has_role(_user_id, 'admin'::app_role);
$$;

GRANT EXECUTE ON FUNCTION public.is_m_or_admin(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_driver_like(uuid) TO authenticated;

-- Orders: M can view/update all (ops board)
DROP POLICY IF EXISTS "M can view all orders" ON public.orders;
CREATE POLICY "M can view all orders"
  ON public.orders FOR SELECT
  USING (public.has_role(auth.uid(), 'm'::app_role));

DROP POLICY IF EXISTS "M can update all orders" ON public.orders;
CREATE POLICY "M can update all orders"
  ON public.orders FOR UPDATE
  USING (public.has_role(auth.uid(), 'm'::app_role));

DO $$ BEGIN
  CREATE POLICY "M can view all order items"
    ON public.order_items FOR SELECT
    USING (public.has_role(auth.uid(), 'm'::app_role));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "M can view all driver locations"
    ON public.driver_locations FOR SELECT
    USING (public.has_role(auth.uid(), 'm'::app_role));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "M can view all profiles"
    ON public.profiles FOR SELECT
    USING (public.has_role(auth.uid(), 'm'::app_role));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Assign / steal order: admin OR M
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
  IF auth.uid() IS NULL OR NOT public.is_m_or_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Admin or M only';
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

-- Claim: drivers + M + admin; M/admin can steal assigned orders and ignore capacity
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
  v_elevated boolean;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF NOT public.is_driver_like(v_uid) THEN
    RAISE EXCEPTION 'Driver only';
  END IF;

  v_elevated := public.is_m_or_admin(v_uid);

  SELECT GREATEST(1, COALESCE(max_stacked_orders, 1)) INTO v_max
  FROM public.platform_settings WHERE id = 1;

  SELECT COUNT(*)::int INTO v_active
  FROM public.orders
  WHERE driver_id = v_uid
    AND status IN ('accepted','preparing','ready','arrived','picked_up');

  IF v_active >= v_max AND NOT v_elevated THEN
    RAISE EXCEPTION 'Driver at capacity';
  END IF;

  UPDATE public.orders
     SET driver_id = v_uid,
         status = CASE WHEN status = 'placed' THEN 'accepted'::order_status ELSE status END,
         updated_at = now()
   WHERE id = p_order_id
     AND (driver_id IS NULL OR v_elevated)
  RETURNING id INTO v_claimed;

  IF v_claimed IS NULL THEN
    RAISE EXCEPTION 'Order already taken';
  END IF;
END;
$$;

-- Cash settle: allow M with the same settlement logic as admin
CREATE OR REPLACE FUNCTION public.admin_settle_driver_cash(p_debt_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_debt driver_cash_debts%ROWTYPE;
BEGIN
  IF NOT public.is_m_or_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Only admins or M can settle cash';
  END IF;
  SELECT * INTO v_debt FROM driver_cash_debts WHERE id = p_debt_id AND NOT settled;
  IF NOT FOUND THEN RAISE EXCEPTION 'Debt not found or already settled'; END IF;

  UPDATE admin_treasury
    SET admin_balance = admin_balance + v_debt.admin_share,
        platform_pool = platform_pool + v_debt.platform_share,
        updated_at = now()
    WHERE id = 1;

  INSERT INTO admin_treasury_ledger (order_id, type, bag, amount, description)
  VALUES (v_debt.order_id, 'cash_settled', 'admin', v_debt.admin_share, 'Cash settlement from driver'),
         (v_debt.order_id, 'cash_settled', 'platform', v_debt.platform_share, 'Cash settlement from driver');

  INSERT INTO store_wallet_ledger (store_id, order_id, type, amount, description, created_by)
  SELECT o.store_id, v_debt.order_id, 'cash_settled', v_debt.store_share,
         'Cash from driver settlement', auth.uid()
  FROM orders o WHERE o.id = v_debt.order_id;

  UPDATE driver_state
    SET shift_cash_balance = GREATEST(0, shift_cash_balance - v_debt.amount_owed),
        updated_at = now()
    WHERE driver_id = v_debt.driver_id;

  UPDATE driver_cash_debts
    SET settled = true, settled_at = now(), settled_by = auth.uid()
    WHERE id = p_debt_id;

  PERFORM log_admin_action('settle_driver_cash', 'driver', v_debt.driver_id::text,
    'Settled ' || v_debt.amount_owed || '€ cash debt', jsonb_build_object('debt_id', p_debt_id));
END;
$$;
