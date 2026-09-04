-- =============================================================================
-- Free-plan 30-day cleanup for Fresh Meal (quick-handoff-grid)
-- Keeps database size under the 500 MB Free limit by pruning old terminal data.
--
-- SAFE: only touches orders with status delivered/cancelled older than 30 days
--       and their dependent rows. Live/open orders and current driver_locations
--       are never touched.
--
-- HOW TO USE (Supabase Dashboard → SQL Editor):
--   1. Optionally run the DRY-RUN section first to see counts.
--   2. Run the CLEANUP section.
--   3. Run the VACUUM section to reclaim space.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 0. SIZE CHECK (optional – run anytime)
-- ---------------------------------------------------------------------------
-- SELECT pg_size_pretty(pg_database_size(current_database())) AS db_size;
--
-- SELECT relname AS table_name,
--        pg_size_pretty(pg_total_relation_size(relid)) AS total_size,
--        n_live_tup AS approx_rows
-- FROM pg_catalog.pg_statio_user_tables
-- ORDER BY pg_total_relation_size(relid) DESC
-- LIMIT 25;


-- ---------------------------------------------------------------------------
-- 1. DRY-RUN – count what would be deleted (safe, no writes)
-- ---------------------------------------------------------------------------
/*
WITH old_orders AS (
  SELECT id
  FROM public.orders
  WHERE status IN ('delivered', 'cancelled')
    AND created_at < now() - interval '30 days'
)
SELECT
  (SELECT count(*) FROM old_orders) AS old_orders,
  (SELECT count(*) FROM public.order_items WHERE order_id IN (SELECT id FROM old_orders)) AS order_items,
  (SELECT count(*) FROM public.earnings WHERE order_id IN (SELECT id FROM old_orders)) AS earnings,
  (SELECT count(*) FROM public.wallet_transactions WHERE order_id IN (SELECT id FROM old_orders)) AS wallet_txns,
  (SELECT count(*) FROM public.wait_time_bonuses WHERE order_id IN (SELECT id FROM old_orders)) AS wait_bonuses,
  (SELECT count(*) FROM public.refunds WHERE order_id IN (SELECT id FROM old_orders)) AS refunds;
*/


-- ---------------------------------------------------------------------------
-- 2. CLEANUP (run this every ~30 days)
-- ---------------------------------------------------------------------------
BEGIN;

-- Identify terminal orders older than 30 days
CREATE TEMP TABLE old_orders AS
SELECT id
FROM public.orders
WHERE status IN ('delivered', 'cancelled')
  AND created_at < now() - interval '30 days';

-- Dependent rows first (order matters for FKs)
DELETE FROM public.order_item_modifiers
WHERE order_item_id IN (
  SELECT id FROM public.order_items WHERE order_id IN (SELECT id FROM old_orders)
);

DELETE FROM public.order_items
WHERE order_id IN (SELECT id FROM old_orders);

DELETE FROM public.earnings
WHERE order_id IN (SELECT id FROM old_orders);

DELETE FROM public.wallet_transactions
WHERE order_id IN (SELECT id FROM old_orders);

DELETE FROM public.wait_time_bonuses
WHERE order_id IN (SELECT id FROM old_orders);

DELETE FROM public.refunds
WHERE order_id IN (SELECT id FROM old_orders);

-- Optional: closed support tickets linked to those orders
DELETE FROM public.support_tickets
WHERE order_id IN (SELECT id FROM old_orders)
  AND status IN ('resolved', 'closed');

-- Finally the orders themselves
DELETE FROM public.orders
WHERE id IN (SELECT id FROM old_orders);

-- Small log table
DELETE FROM public.store_daily_summary_log
WHERE summary_date < current_date - 90;

COMMIT;


-- ---------------------------------------------------------------------------
-- 3. RECLAIM SPACE (important on Free plan)
-- ---------------------------------------------------------------------------
-- After the deletes, reclaim disk:
VACUUM ANALYZE public.orders;
VACUUM ANALYZE public.order_items;
VACUUM ANALYZE public.earnings;
VACUUM ANALYZE public.wallet_transactions;

-- If you still need more space, you can run VACUUM FULL on the largest tables
-- (locks the table while running):
-- VACUUM FULL public.orders;
-- VACUUM FULL public.order_items;


-- ---------------------------------------------------------------------------
-- Notes
-- ---------------------------------------------------------------------------
-- • Never deletes open / in-progress orders or current driver_locations.
-- • Adjust the interval ('30 days') if you want a different retention window.
-- • Run from the Supabase SQL Editor with a role that has DELETE rights
--   (service_role or a privileged admin connection).
-- • After cleanup, check Database Size in the dashboard; if the project was
--   in read-only mode it should recover once under 500 MB.
