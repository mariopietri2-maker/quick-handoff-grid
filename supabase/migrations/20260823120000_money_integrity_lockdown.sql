-- Money integrity lockdown: clients can never write money rows directly.
-- All legitimate writes already flow through SECURITY DEFINER RPCs (run as owner,
-- unaffected by these grants). Edge functions use service_role — also unaffected.
-- Admin UI keeps narrow column-level UPDATE on orders (status/driver_id only);
-- RLS continues to gate which rows are visible/selectable.

REVOKE ALL ON public.orders,
              public.refunds,
              public.driver_wallets,
              public.store_wallets,
              public.wallet_transactions,
              public.pending_driver_payouts,
              public.driver_cash_debts,
              public.customer_wallets,
              public.customer_wallet_ledger
  FROM anon, authenticated;

GRANT SELECT ON public.orders TO anon, authenticated;
GRANT SELECT ON public.refunds,
                public.driver_wallets,
                public.store_wallets,
                public.wallet_transactions,
                public.pending_driver_payouts,
                public.driver_cash_debts,
                public.customer_wallets,
                public.customer_wallet_ledger
  TO authenticated;

GRANT UPDATE (status, driver_id) ON public.orders TO authenticated;

-- Impossible / manipulated values become unrepresentable at the storage layer.
ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS orders_money_sanity;
ALTER TABLE public.orders ADD CONSTRAINT orders_money_sanity CHECK (
  total_amount   >= 0 AND total_amount   <= 1000
  AND delivery_fee >= 0 AND delivery_fee <= 50
  AND tip_amount   >= 0 AND tip_amount   <= 100
  AND (distance_km IS NULL OR (distance_km >= 0 AND distance_km <= 25))
);

ALTER TABLE public.refunds DROP CONSTRAINT IF EXISTS refunds_amount_sanity;
ALTER TABLE public.refunds ADD CONSTRAINT refunds_amount_sanity
  CHECK (amount > 0 AND amount <= 1000);

ALTER TABLE public.customer_wallets DROP CONSTRAINT IF EXISTS customer_wallet_balance_sanity;
ALTER TABLE public.customer_wallets ADD CONSTRAINT customer_wallet_balance_sanity
  CHECK (balance >= 0);

INSERT INTO supabase_migrations.schema_migrations (version, name)
VALUES ('20260823120000', 'money_integrity_lockdown')
ON CONFLICT (version) DO NOTHING;
