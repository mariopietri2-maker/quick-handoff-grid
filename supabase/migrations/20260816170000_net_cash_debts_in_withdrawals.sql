-- ---------------------------------------------------------------------------
-- Net outstanding cash debts against wallet withdrawals.
--
-- For a cash order the driver physically holds the customer's cash while the
-- platform also credits the driver's wallet (settle_order_commission). Without
-- netting, a driver could withdraw the full wallet balance and never remit the
-- cash, leaving the platform exposed for every unsettled driver_cash_debts row.
--
-- This recreates request_wallet_withdrawal (baseline: batch_07 line 585) so:
--   withdrawable = available_balance - SUM(unsettled amount_owed), floored at 0
-- The wallet row is locked (FOR UPDATE) so concurrent withdrawals serialize and
-- cannot overspend. A distinct error is raised when unsettled debts are what
-- block the withdrawal, so the client can tell the two cases apart.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.request_wallet_withdrawal(p_driver_id uuid, p_amount numeric)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_balance numeric;
  v_debt_total numeric;
  v_withdrawable numeric;
BEGIN
  IF auth.uid() IS NULL OR auth.uid() <> p_driver_id THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;
  IF p_amount <= 0 THEN
    RAISE EXCEPTION 'Amount must be positive';
  END IF;

  SELECT available_balance INTO v_balance
    FROM driver_wallets
   WHERE driver_id = p_driver_id
   FOR UPDATE;

  IF v_balance IS NULL THEN
    RAISE EXCEPTION 'Insufficient balance';
  END IF;

  SELECT COALESCE(SUM(amount_owed), 0) INTO v_debt_total
    FROM driver_cash_debts
   WHERE driver_id = p_driver_id
     AND NOT settled;

  v_withdrawable := GREATEST(v_balance - v_debt_total, 0);

  IF p_amount > v_withdrawable THEN
    IF v_debt_total > 0 THEN
      RAISE EXCEPTION 'Cannot withdraw: unsettled cash debts of €% block this amount. Settle the cash with admin first.', v_debt_total;
    END IF;
    RAISE EXCEPTION 'Insufficient balance';
  END IF;

  UPDATE driver_wallets
    SET available_balance = available_balance - p_amount,
        pending_balance = pending_balance + p_amount
   WHERE driver_id = p_driver_id;

  INSERT INTO wallet_transactions (driver_id, type, amount, status, description)
  VALUES (p_driver_id, 'withdrawal_request', p_amount, 'pending', 'Cash out request');
END;
$function$;
