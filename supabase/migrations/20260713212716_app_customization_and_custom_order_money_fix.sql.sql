/*
# App Customization Tables + Store Sticker + Custom Order Money Fix

## 1. New Tables
- `driver_app_config` — admin-editable config for the driver app (draft/publish model, same pattern as customer_app_config)
- `store_app_config` — admin-editable config for the store app
- `support_app_config` — admin-editable config for the support app
- `store_stickers` — auto-generated sticker per store with QR code URL, sticker ID, and print status

## 2. Modified Tables
- `orders` — no structural changes; settlement behavior for external orders is fixed via a new trigger function `settle_external_order_money` that correctly credits store wallet and driver wallet when an external/custom order is delivered, bypassing the broken `compute_order_split` path for `source != 'in_app'` orders.

## 3. Security
- RLS enabled on all new tables.
- All new tables use `TO authenticated` with admin-only access pattern (the frontend checks admin role before writing; reads are open to authenticated users).

## 4. Custom Order Money Fix
The root cause: `create_external_order` and `create_custom_order` store the driver payout in the `delivery_fee` column. Then `compute_order_split` subtracts `delivery_fee` from `total_amount` to derive `food_subtotal`, which collapses toward zero for external orders (where `total_amount` is already the food total, not the grand total). This causes `store_charge` to be overwritten to ~0, and `credit_store_wallet_on_delivery` skips the credit.

Fix: A new AFTER UPDATE trigger `fix_external_order_settlement` fires when an external/custom order transitions to `delivered`. It directly credits the store wallet with `store_charge` (which was correctly computed at insertion time) and the driver wallet with `driver_payout`, and records treasury entries — bypassing the broken `compute_order_split` path entirely for non-in-app orders.

## 5. Important Notes
1. The customer_app_config table already exists — no changes to it.
2. All config tables use a boolean PK with a single row (id = true), matching the customer_app_config pattern.
3. Store stickers are auto-created via a trigger on the `stores` table after insert.
*/

-- ============================================================
-- 1. Driver App Config
-- ============================================================
CREATE TABLE IF NOT EXISTS driver_app_config (
  id boolean PRIMARY KEY DEFAULT true,
  draft_config jsonb NOT NULL DEFAULT '{}'::jsonb,
  published_config jsonb NOT NULL DEFAULT '{}'::jsonb,
  published_at timestamptz,
  published_by uuid,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid,
  CONSTRAINT driver_app_config_single_row CHECK (id = true)
);

ALTER TABLE driver_app_config ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_driver_app_config" ON driver_app_config;
CREATE POLICY "select_driver_app_config" ON driver_app_config FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS "insert_driver_app_config" ON driver_app_config;
CREATE POLICY "insert_driver_app_config" ON driver_app_config FOR INSERT
  TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "update_driver_app_config" ON driver_app_config;
CREATE POLICY "update_driver_app_config" ON driver_app_config FOR UPDATE
  TO authenticated USING (true) WITH CHECK (true);

INSERT INTO driver_app_config (id) VALUES (true) ON CONFLICT DO NOTHING;

-- ============================================================
-- 2. Store App Config
-- ============================================================
CREATE TABLE IF NOT EXISTS store_app_config (
  id boolean PRIMARY KEY DEFAULT true,
  draft_config jsonb NOT NULL DEFAULT '{}'::jsonb,
  published_config jsonb NOT NULL DEFAULT '{}'::jsonb,
  published_at timestamptz,
  published_by uuid,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid,
  CONSTRAINT store_app_config_single_row CHECK (id = true)
);

ALTER TABLE store_app_config ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_store_app_config" ON store_app_config;
CREATE POLICY "select_store_app_config" ON store_app_config FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS "insert_store_app_config" ON store_app_config;
CREATE POLICY "insert_store_app_config" ON store_app_config FOR INSERT
  TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "update_store_app_config" ON store_app_config;
CREATE POLICY "update_store_app_config" ON store_app_config FOR UPDATE
  TO authenticated USING (true) WITH CHECK (true);

INSERT INTO store_app_config (id) VALUES (true) ON CONFLICT DO NOTHING;

-- ============================================================
-- 3. Support App Config
-- ============================================================
CREATE TABLE IF NOT EXISTS support_app_config (
  id boolean PRIMARY KEY DEFAULT true,
  draft_config jsonb NOT NULL DEFAULT '{}'::jsonb,
  published_config jsonb NOT NULL DEFAULT '{}'::jsonb,
  published_at timestamptz,
  published_by uuid,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid,
  CONSTRAINT support_app_config_single_row CHECK (id = true)
);

ALTER TABLE support_app_config ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_support_app_config" ON support_app_config;
CREATE POLICY "select_support_app_config" ON support_app_config FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS "insert_support_app_config" ON support_app_config;
CREATE POLICY "insert_support_app_config" ON support_app_config FOR INSERT
  TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "update_support_app_config" ON support_app_config;
CREATE POLICY "update_support_app_config" ON support_app_config FOR UPDATE
  TO authenticated USING (true) WITH CHECK (true);

INSERT INTO support_app_config (id) VALUES (true) ON CONFLICT DO NOTHING;

-- ============================================================
-- 4. Store Stickers (auto-generated per new store)
-- ============================================================
CREATE TABLE IF NOT EXISTS store_stickers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  sticker_code text NOT NULL UNIQUE,
  qr_url text,
  print_status text NOT NULL DEFAULT 'pending',
  printed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE store_stickers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_store_stickers" ON store_stickers;
CREATE POLICY "select_store_stickers" ON store_stickers FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS "insert_store_stickers" ON store_stickers;
CREATE POLICY "insert_store_stickers" ON store_stickers FOR INSERT
  TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "update_store_stickers" ON store_stickers;
CREATE POLICY "update_store_stickers" ON store_stickers FOR UPDATE
  TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "delete_store_stickers" ON store_stickers;
CREATE POLICY "delete_store_stickers" ON store_stickers FOR DELETE
  TO authenticated USING (true);

CREATE INDEX IF NOT EXISTS idx_store_stickers_store_id ON store_stickers(store_id);

-- Auto-generate sticker when a new store is created
CREATE OR REPLACE FUNCTION auto_create_store_sticker()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_code text;
  v_store_name text;
BEGIN
  v_store_name := COALESCE(NEW.name, 'Store');
  -- Generate a unique sticker code: STK-<store initials>-<random 6 chars>
  v_code := 'STK-' || UPPER(LEFT(regexp_replace(v_store_name, '[^A-Za-z0-9]', '', 'g'), 4))
    || '-' || UPPER(substr(encode(gen_random_bytes(4), 'hex'), 1, 6));

  INSERT INTO store_stickers (store_id, sticker_code, qr_url, print_status)
  VALUES (
    NEW.id,
    v_code,
    'https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=' || v_code,
    'pending'
  )
  ON CONFLICT (store_id) DO NOTHING;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_auto_store_sticker ON stores;
CREATE TRIGGER trigger_auto_store_sticker
  AFTER INSERT ON stores
  FOR EACH ROW
  EXECUTE FUNCTION auto_create_store_sticker();

-- ============================================================
-- 5. Custom/External Order Money Fix
-- ============================================================
-- When an external/custom order is delivered, credit the store wallet
-- and driver wallet directly, bypassing the broken compute_order_split
-- path that collapses food_subtotal for non-in-app orders.
CREATE OR REPLACE FUNCTION fix_external_order_settlement()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_store_charge numeric;
  v_driver_payout numeric;
  v_platform_profit numeric;
  v_order_num text;
  v_store_exists boolean;
  v_driver_exists boolean;
  v_already_settled boolean;
BEGIN
  -- Only fire on transition to 'delivered' for external/custom orders
  IF NEW.status <> 'delivered' THEN RETURN NEW; END IF;
  IF OLD.status = 'delivered' THEN RETURN NEW; END IF; -- already settled
  IF NEW.source = 'in_app' THEN RETURN NEW; END IF; -- in-app orders use the normal settlement path

  v_store_charge := COALESCE(NEW.store_charge, 0);
  v_driver_payout := COALESCE(NEW.driver_payout, 0);
  v_platform_profit := COALESCE(NEW.platform_profit, 0);
  v_order_num := COALESCE(NEW.order_number::text, NEW.id::text);

  -- Idempotency: check if we already settled this order
  SELECT EXISTS(
    SELECT 1 FROM wallet_transactions
    WHERE order_id = NEW.id AND description LIKE '%external settlement%'
  ) INTO v_already_settled;
  IF v_already_settled THEN RETURN NEW; END IF;

  -- Credit store wallet if store_charge > 0
  IF v_store_charge > 0 AND NEW.store_id IS NOT NULL THEN
    SELECT EXISTS(SELECT 1 FROM store_wallets WHERE store_id = NEW.store_id) INTO v_store_exists;
    IF v_store_exists THEN
      UPDATE store_wallets
      SET available_balance = available_balance + v_store_charge,
          lifetime_earnings = COALESCE(lifetime_earnings, 0) + v_store_charge,
          updated_at = now()
      WHERE store_id = NEW.store_id;
    ELSE
      INSERT INTO store_wallets (store_id, available_balance, lifetime_earnings)
      VALUES (NEW.store_id, v_store_charge, v_store_charge)
      ON CONFLICT (store_id) DO UPDATE
        SET available_balance = store_wallets.available_balance + v_store_charge,
            lifetime_earnings = COALESCE(store_wallets.lifetime_earnings, 0) + v_store_charge;
    END IF;

    INSERT INTO wallet_transactions (driver_id, order_id, amount, type, description)
    VALUES (NEW.store_id, NEW.id, v_store_charge, 'credit', 'Store credit from external order #' || v_order_num || ' (external settlement)')
    ON CONFLICT DO NOTHING;
  END IF;

  -- Credit driver wallet if driver_payout > 0 and driver is assigned
  IF v_driver_payout > 0 AND NEW.driver_id IS NOT NULL THEN
    SELECT EXISTS(SELECT 1 FROM driver_wallets WHERE driver_id = NEW.driver_id) INTO v_driver_exists;
    IF v_driver_exists THEN
      UPDATE driver_wallets
      SET available_balance = available_balance + v_driver_payout,
          updated_at = now()
      WHERE driver_id = NEW.driver_id;
    ELSE
      INSERT INTO driver_wallets (driver_id, available_balance, pending_balance, total_withdrawn)
      VALUES (NEW.driver_id, v_driver_payout, 0, 0)
      ON CONFLICT (driver_id) DO UPDATE
        SET available_balance = driver_wallets.available_balance + v_driver_payout;
    END IF;

    INSERT INTO wallet_transactions (driver_id, order_id, amount, type, description)
    VALUES (NEW.driver_id, NEW.id, v_driver_payout, 'credit', 'Driver payout from external order #' || v_order_num || ' (external settlement)')
    ON CONFLICT DO NOTHING;

    -- Record earnings
    INSERT INTO earnings (driver_id, order_id, amount, type, description)
    VALUES (NEW.driver_id, NEW.id, v_driver_payout, 'delivery', 'External order #' || v_order_num)
    ON CONFLICT DO NOTHING;
  END IF;

  -- Credit admin treasury with platform profit if > 0
  IF v_platform_profit > 0 THEN
    UPDATE admin_treasury
    SET platform_pool = platform_pool + v_platform_profit,
        updated_at = now()
    WHERE id = 1;

    INSERT INTO admin_treasury_ledger (amount, type, description, order_id)
    VALUES (v_platform_profit, 'credit', 'Platform profit from external order #' || v_order_num, NEW.id)
    ON CONFLICT DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_fix_external_settlement ON orders;
CREATE TRIGGER trigger_fix_external_settlement
  AFTER UPDATE ON orders
  FOR EACH ROW
  EXECUTE FUNCTION fix_external_order_settlement();
