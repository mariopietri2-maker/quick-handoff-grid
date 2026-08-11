-- ============================================================================
-- VERIFY automated refunds + alerting + saved cards (read-only diagnostic)
-- ============================================================================
-- Checks that the three migrations were applied to the REAL Supabase project:
--   20260812130000_automated_card_refunds.sql
--   20260812140000_proactive_alerting.sql
--   20260812150000_saved_cards.sql
--
-- After applying all three, every row below should show OK. Anything that is
-- NOT OK means a migration is missing / failed / was edited after the fact.
-- ============================================================================
-- HOW TO RUN: Supabase Dashboard → SQL Editor → paste + run (read-only, safe).
-- ============================================================================

-- 1) orders: refund-supporting columns -----------------------------------------
SELECT
  CASE
    WHEN count(*) = 2
      AND count(*) FILTER (WHERE column_name = 'stripe_payment_intent_id') = 1
      AND count(*) FILTER (WHERE column_name = 'stripe_environment') = 1
    THEN 'OK (orders.stripe_payment_intent_id + stripe_environment)'
    ELSE 'FAIL (missing column on orders)'
  END AS orders_check
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'orders'
  AND column_name IN ('stripe_payment_intent_id', 'stripe_environment');

-- 2) refunds: lifecycle columns + status check constraint ----------------------
SELECT
  CASE
    WHEN count(*) = 8 THEN 'OK (refunds lifecycle columns)'
    ELSE 'FAIL (missing column on refunds — expected 8, got ' || count(*) || ')'
  END AS refunds_columns_check
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'refunds'
  AND column_name IN (
    'status', 'stripe_payment_intent_id', 'stripe_env', 'stripe_refund_id',
    'attempts', 'processed_by', 'processed_at', 'failure_message'
  );

SELECT
  CASE
    WHEN count(*) = 1 THEN 'OK (refunds_status_check constraint)'
    ELSE 'FAIL (refunds_status_check missing)'
  END AS refunds_constraint_check
FROM pg_constraint
WHERE conname = 'refunds_status_check';

-- 3) old admin_refund_order bug is gone (delegates to refund_order) ------------
SELECT
  CASE
    WHEN pg_get_functiondef(p.oid) LIKE '%wallet_credit%'
      AND pg_get_functiondef(p.oid) LIKE '%refund_order%'
      AND pg_get_functiondef(p.oid) NOT LIKE '%customer_wallets.customer_id%'
    THEN 'OK (admin_refund_order delegates to refund_order — old bug fixed)'
    ELSE 'FAIL (admin_refund_order not rewritten — it would crash at runtime)'
  END AS admin_refund_order_check
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public' AND p.proname = 'admin_refund_order';

-- 4) new RPCs exist ------------------------------------------------------------
SELECT p.proname AS rpc_name,
  CASE
    WHEN p.proname = 'refund_order'
      AND pg_get_functiondef(p.oid) LIKE '%original_payment%'
    THEN 'OK (supports card refunds)'
    WHEN p.proname IN (
      'claim_pending_card_refunds', 'complete_card_refund', 'retry_failed_card_refund',
      'enqueue_alert', 'claim_alert_outbox', 'complete_alert_send',
      'watchdog_check_stuck_orders', 'set_default_payment_method'
    ) THEN 'OK (exists)'
    ELSE 'FAIL (missing)'
  END AS status
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname IN (
    'refund_order', 'claim_pending_card_refunds', 'complete_card_refund',
    'retry_failed_card_refund',
    'enqueue_alert', 'claim_alert_outbox', 'complete_alert_send',
    'watchdog_check_stuck_orders', 'set_default_payment_method'
  )
ORDER BY p.proname;

-- 5) key grants -----------------------------------------------------------------
SELECT
  CASE
    WHEN has_function_privilege('authenticated', f.oid, 'EXECUTE')
      AND has_function_privilege('service_role', f.oid, 'EXECUTE')
    THEN 'OK (enqueue_alert granted)'
    ELSE 'FAIL (enqueue_alert grant missing)'
  END AS enqueue_alert_grant
FROM pg_proc f
JOIN pg_namespace n ON n.oid = f.pronamespace
WHERE n.nspname = 'public' AND f.proname = 'enqueue_alert';

SELECT
  CASE
    WHEN has_function_privilege('service_role', f.oid, 'EXECUTE')
    THEN 'OK (claim_pending_card_refunds granted to service_role)'
    ELSE 'FAIL (claim_pending_card_refunds grant missing)'
  END AS claim_refunds_grant
FROM pg_proc f
JOIN pg_namespace n ON n.oid = f.pronamespace
WHERE n.nspname = 'public' AND f.proname = 'claim_pending_card_refunds';

SELECT
  CASE
    WHEN has_function_privilege('authenticated', f.oid, 'EXECUTE')
      AND has_function_privilege('service_role', f.oid, 'EXECUTE')
    THEN 'OK (retry_failed_card_refund granted)'
    ELSE 'FAIL (retry_failed_card_refund grant missing)'
  END AS retry_refund_grant
FROM pg_proc f
JOIN pg_namespace n ON n.oid = f.pronamespace
WHERE n.nspname = 'public' AND f.proname = 'retry_failed_card_refund';

-- 6) alert_outbox table + dedupe + RLS -----------------------------------------
SELECT
  CASE
    WHEN to_regclass('public.alert_outbox') IS NOT NULL THEN 'OK (alert_outbox)'
    ELSE 'FAIL (alert_outbox missing)'
  END AS alert_outbox_check;

SELECT
  CASE
    WHEN count(*) = 1 THEN 'OK (alert_outbox unique dedupe index)'
    ELSE 'FAIL (alert_outbox dedupe index missing)'
  END AS alert_outbox_dedupe_check
FROM pg_indexes
WHERE schemaname = 'public' AND tablename = 'alert_outbox'
  AND indexname = 'alert_outbox_dedupe_key_unique';

SELECT
  CASE
    WHEN c.relrowsecurity THEN 'OK (RLS on alert_outbox)'
    ELSE 'FAIL (RLS not enabled on alert_outbox)'
  END AS alert_outbox_rls_check
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public' AND c.relname = 'alert_outbox';

-- 7) saved cards: profiles + customer_payment_methods + indexes + RLS ----------
SELECT
  CASE
    WHEN count(*) = 1 THEN 'OK (profiles.stripe_customer_id)'
    ELSE 'FAIL (profiles.stripe_customer_id missing)'
  END AS profiles_customer_check
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'profiles'
  AND column_name = 'stripe_customer_id';

SELECT
  CASE
    WHEN count(*) = 11 THEN 'OK (customer_payment_methods table)'
    ELSE 'FAIL (customer_payment_methods missing — got ' || count(*) || ' cols)'
  END AS cards_table_check
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'customer_payment_methods'
  AND column_name IN (
    'id', 'user_id', 'stripe_customer_id', 'stripe_payment_method_id',
    'stripe_env', 'brand', 'last4', 'exp_month', 'exp_year',
    'is_default', 'created_at'
  );

SELECT
  CASE
    WHEN count(*) FILTER (WHERE indexdef LIKE '%stripe_payment_method_id%' AND indexdef LIKE '%UNIQUE%') >= 1
      AND count(*) FILTER (WHERE indexdef LIKE '%is_default%' AND indexdef LIKE '%UNIQUE%') >= 1
    THEN 'OK (unique PM id + one-default-per-user indexes)'
    ELSE 'FAIL (customer_payment_methods unique indexes missing)'
  END AS cards_indexes_check
FROM pg_indexes
WHERE schemaname = 'public' AND tablename = 'customer_payment_methods';

SELECT
  CASE
    WHEN c.relrowsecurity THEN 'OK (RLS on customer_payment_methods)'
    ELSE 'FAIL (RLS not enabled on customer_payment_methods)'
  END AS cards_rls_check
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public' AND c.relname = 'customer_payment_methods';

-- 8) new pg_cron jobs point at the real project with X-Cron-Secret -------------
SELECT
  jobname,
  schedule,
  CASE
    WHEN command LIKE '%ojkesspghyqmjmupybva%' THEN 'OK (correct project)'
    ELSE 'FAIL (wrong/stale URL)'
  END AS url_check,
  CASE
    WHEN command LIKE '%X-Cron-Secret%' THEN 'OK (X-Cron-Secret header)'
    ELSE 'FAIL (missing X-Cron-Secret)'
  END AS auth_check
FROM cron.job
WHERE jobname IN ('process-refunds-20s', 'send-alerts-30s', 'watchdog-stuck-orders-5m')
ORDER BY jobname;

-- 9) app.settings.cron_secret GUC ----------------------------------------------
SELECT
  CASE
    WHEN current_setting('app.settings.cron_secret', true) IS NOT NULL
      AND current_setting('app.settings.cron_secret', true) <> ''
    THEN 'OK (SET)'
    ELSE 'FAIL (NOT SET — run: ALTER ROLE postgres SET app.settings.cron_secret = ''<CRON_SECRET>'';)'
  END AS cron_secret_guc;
