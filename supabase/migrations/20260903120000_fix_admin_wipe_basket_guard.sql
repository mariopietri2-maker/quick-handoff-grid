-- Soft-launch fix: admin_wipe_transactions / admin_reset_money_to_zero were failing
-- because trg_guard_basket blocks decreasing platform_pool without the session flag.

CREATE OR REPLACE FUNCTION public.admin_wipe_transactions()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_snapshot jsonb;
  v_orders int;
BEGIN
  IF NOT has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'Only admins can wipe transactions';
  END IF;

  SELECT COUNT(*) INTO v_orders FROM orders;

  v_snapshot := jsonb_build_object(
    'wiped_at', now(),
    'wiped_by', auth.uid(),
    'orders_deleted', v_orders
  );

  DELETE FROM order_item_modifiers WHERE true;
  DELETE FROM order_items WHERE true;
  DELETE FROM earnings WHERE true;
  DELETE FROM driver_cash_debts WHERE true;
  DELETE FROM driver_offer_events WHERE true;
  DELETE FROM pending_offers WHERE true;
  DELETE FROM wait_time_bonuses WHERE true;
  DELETE FROM wallet_transactions WHERE true;
  DELETE FROM refunds WHERE true;
  DELETE FROM reviews WHERE true;
  DELETE FROM reward_history WHERE true;
  DELETE FROM ticket_messages WHERE true;
  DELETE FROM support_tickets WHERE true;
  DELETE FROM driver_notifications WHERE true;
  DELETE FROM group_order_participants WHERE true;
  DELETE FROM group_orders WHERE true;
  DELETE FROM store_daily_summary_log WHERE true;
  DELETE FROM monthly_reports WHERE true;
  DELETE FROM fraud_signals WHERE true;
  DELETE FROM transactions WHERE true;
  DELETE FROM loyalty_ledger WHERE true;
  DELETE FROM live_chat_messages WHERE true;
  DELETE FROM api_outbox WHERE true;
  DELETE FROM aade_delivery_reports WHERE true;
  DELETE FROM store_driver_calls WHERE true;
  DELETE FROM push_outbox WHERE true;
  DELETE FROM alert_outbox WHERE true;
  UPDATE referral_tracking SET first_order_id = NULL WHERE first_order_id IS NOT NULL;
  DELETE FROM customer_wallet_ledger WHERE true;
  DELETE FROM store_wallet_ledger WHERE true;
  DELETE FROM admin_treasury_ledger WHERE true;
  UPDATE orders SET stacked_with_order_id = NULL WHERE stacked_with_order_id IS NOT NULL;
  DELETE FROM orders WHERE true;

  PERFORM set_config('app.basket_distribution_active', '1', true);
  UPDATE admin_treasury
     SET admin_balance = 0, platform_pool = 0,
         lifetime_admin_earned = 0, lifetime_platform_earned = 0,
         lifetime_driver_topup = 0, updated_at = now()
   WHERE id = 1;
  PERFORM set_config('app.basket_distribution_active', '0', true);

  UPDATE store_wallets SET available_balance = 0, pending_balance = 0, updated_at = now();
  UPDATE driver_wallets SET available_balance = 0, pending_balance = 0, total_withdrawn = 0, updated_at = now();
  UPDATE driver_state SET shift_cash_balance = 0, updated_at = now();
  UPDATE customer_wallets SET balance = 0, lifetime_credit = 0, updated_at = now();
  UPDATE customer_rewards SET points = 0, lifetime_points = 0, tier = 'bronze', updated_at = now();

  DELETE FROM transactions WHERE true;

  INSERT INTO admin_audit_log (actor_id, action, target_type, description, metadata)
  VALUES (auth.uid(), 'wipe_transactions', 'system',
          'Wiped all transactional data and reset balances to zero', v_snapshot);

  RETURN v_snapshot;
END;
$function$;

CREATE OR REPLACE FUNCTION public.admin_reset_money_to_zero()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_snapshot jsonb;
BEGIN
  IF NOT has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'Only admins can reset money';
  END IF;

  SELECT jsonb_build_object(
    'reset_at', now(),
    'admin_balance', admin_balance,
    'platform_pool', platform_pool
  ) INTO v_snapshot FROM admin_treasury WHERE id = 1;

  PERFORM set_config('app.basket_distribution_active', '1', true);
  UPDATE admin_treasury
     SET admin_balance = 0, platform_pool = 0, updated_at = now()
   WHERE id = 1;
  PERFORM set_config('app.basket_distribution_active', '0', true);

  UPDATE store_wallets SET available_balance = 0, pending_balance = 0, updated_at = now();
  UPDATE driver_wallets SET available_balance = 0, pending_balance = 0, updated_at = now();
  UPDATE driver_state SET shift_cash_balance = 0, updated_at = now();
  UPDATE customer_wallets SET balance = 0, updated_at = now();

  INSERT INTO admin_audit_log (actor_id, action, target_type, description, metadata)
  VALUES (auth.uid(), 'reset_money_to_zero', 'system', 'All wallets and treasury reset to 0', v_snapshot);

  RETURN v_snapshot;
END;
$function$;
