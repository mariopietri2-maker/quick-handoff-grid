-- =============================================================================
-- Freeze order money/payout columns against driver & store-owner REST updates.
-- -----------------------------------------------------------------------------
-- Drivers and store owners can UPDATE orders through RLS policies
-- ("Drivers can update assigned orders", "Store owners can update store orders"),
-- but those policies do not restrict WHICH columns. Nothing stops a driver or
-- store owner from rewriting stored amounts (total_amount, delivery_fee,
-- tip_amount, store_charge, driver_payout, platform_profit,
-- expected_charge_cents, paid_amount_cents, distance_km, surge_multiplier_used),
-- corrupting records and payouts.
--
-- RLS WITH CHECK can only inspect NEW rows, so the freeze is enforced by a
-- BEFORE UPDATE trigger comparing OLD vs NEW. It allows the change when:
--   - the effective session role is a privileged DB role (postgres /
--     supabase_admin / service_role), i.e. any SECURITY DEFINER RPC,
--     service-role edge-function write, or SQL-editor run; or
--   - the caller is support/admin (already has full RLS access); or
--   - no frozen column actually changed (all operational fields stay editable).
--
-- Legitimate money writes all run through SECURITY DEFINER RPCs and triggers
-- (place_order, add_post_delivery_tip, backfill_orders_km, settle_order_now,
-- payout settlement) or service-role edge functions (payments-webhook,
-- process-refunds) — every one of those passes the privileged-role branch.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.guard_order_money_columns()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.total_amount IS NOT DISTINCT FROM OLD.total_amount
 AND NEW.delivery_fee IS NOT DISTINCT FROM OLD.delivery_fee
 AND NEW.tip_amount IS NOT DISTINCT FROM OLD.tip_amount
 AND NEW.store_charge IS NOT DISTINCT FROM OLD.store_charge
 AND NEW.driver_payout IS NOT DISTINCT FROM OLD.driver_payout
 AND NEW.platform_profit IS NOT DISTINCT FROM OLD.platform_profit
 AND NEW.expected_charge_cents IS NOT DISTINCT FROM OLD.expected_charge_cents
 AND NEW.paid_amount_cents IS NOT DISTINCT FROM OLD.paid_amount_cents
 AND NEW.distance_km IS NOT DISTINCT FROM OLD.distance_km
 AND NEW.surge_multiplier_used IS NOT DISTINCT FROM OLD.surge_multiplier_used
  THEN
    RETURN NEW;
  END IF;

  -- Privileged paths (SECURITY DEFINER RPCs, service-role edge functions,
  -- SQL editor) may adjust money columns.
  IF current_user IN ('postgres', 'supabase_admin', 'service_role')
     OR is_support_or_admin(auth.uid())
  THEN
    RETURN NEW;
  END IF;

  RAISE EXCEPTION 'Order money/payout columns are read-only for this role';
END;
$$;

DROP TRIGGER IF EXISTS guard_order_money_columns_trg ON public.orders;
CREATE TRIGGER guard_order_money_columns_trg
BEFORE UPDATE ON public.orders
FOR EACH ROW EXECUTE FUNCTION public.guard_order_money_columns();
