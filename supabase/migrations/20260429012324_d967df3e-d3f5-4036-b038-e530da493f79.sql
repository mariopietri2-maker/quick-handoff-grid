-- One-off production data correction. Safe no-op on fresh databases
-- where the referenced orders/drivers do not exist.

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'protect_order_financials_trigger') THEN
    ALTER TABLE orders DISABLE TRIGGER protect_order_financials_trigger;
  END IF;

  UPDATE orders SET delivery_fee=5.50, driver_payout=5.50, platform_profit=-2.50, updated_at=now()
    WHERE id='bb24b006-19e0-4d08-a3cc-c41356035c73';
  UPDATE orders SET delivery_fee=4.60, driver_payout=4.60, platform_profit=-1.60, updated_at=now()
    WHERE id='66f0dd20-7921-4cb3-b973-d88589ab99c3';

  IF EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'protect_order_financials_trigger') THEN
    ALTER TABLE orders ENABLE TRIGGER protect_order_financials_trigger;
  END IF;

  UPDATE earnings SET base_pay=5.50 WHERE order_id='bb24b006-19e0-4d08-a3cc-c41356035c73';
  UPDATE earnings SET base_pay=4.60 WHERE order_id='66f0dd20-7921-4cb3-b973-d88589ab99c3';

  UPDATE driver_wallets
  SET available_balance = available_balance - 411.90,
      updated_at = now()
  WHERE driver_id = '3fbd26ff-f356-4cb9-903d-2854bf9d09ba'
    AND EXISTS (SELECT 1 FROM driver_wallets WHERE driver_id = '3fbd26ff-f356-4cb9-903d-2854bf9d09ba');

  INSERT INTO wallet_transactions (driver_id, type, amount, status, description, order_id)
  SELECT v.driver_id, v.type, v.amount, v.status, v.description, v.order_id
  FROM (VALUES
    ('3fbd26ff-f356-4cb9-903d-2854bf9d09ba'::uuid, 'admin_debit', -205.50, 'completed',
     'Διόρθωση λάθους εισαγωγής: payout 211€ → 5.50€', 'bb24b006-19e0-4d08-a3cc-c41356035c73'::uuid),
    ('3fbd26ff-f356-4cb9-903d-2854bf9d09ba'::uuid, 'admin_debit', -206.40, 'completed',
     'Διόρθωση λάθους εισαγωγής: payout 211€ → 4.60€', '66f0dd20-7921-4cb3-b973-d88589ab99c3'::uuid)
  ) AS v(driver_id, type, amount, status, description, order_id)
  WHERE EXISTS (SELECT 1 FROM orders o WHERE o.id = v.order_id);
END $$;
