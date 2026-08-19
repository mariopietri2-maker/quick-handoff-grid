-- Schedule the 30-day terminal-order cleanup automatically.
--
-- The Free plan's 500 MB limit can flip the database to READ-ONLY. Supabase
-- ships cleanup_old_orders_30d.sql as a manual script; if it is forgotten the
-- platform locks the DB until it shrinks. This migration schedules the same
-- cleanup as a nightly pg_cron job so retention is always enforced.
--
-- A SECURITY DEFINER function wraps the deletes (cron runs as the scheduler
-- role, and the function pins search_path; VACUUM stays manual since it cannot
-- run inside a function/cron transaction — autovacuum will reclaim space).

CREATE OR REPLACE FUNCTION public.prune_old_terminal_orders(p_days integer DEFAULT 30)
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_deleted bigint := 0;
  v_orders bigint;
BEGIN
  -- Only terminal orders older than the retention window; never touches
  -- open/in-progress orders or current driver_locations.
  WITH old_orders AS (
    SELECT id
    FROM public.orders
    WHERE status IN ('delivered', 'cancelled')
      AND created_at < now() - make_interval(days => p_days)
  ),
  old_items AS (
    SELECT id FROM public.order_items WHERE order_id IN (SELECT id FROM old_orders)
  )
  DELETE FROM public.order_item_modifiers
  WHERE order_item_id IN (SELECT id FROM old_items);

  WITH old_orders AS (
    SELECT id
    FROM public.orders
    WHERE status IN ('delivered', 'cancelled')
      AND created_at < now() - make_interval(days => p_days)
  )
  DELETE FROM public.order_items
  WHERE order_id IN (SELECT id FROM old_orders);

  WITH old_orders AS (
    SELECT id
    FROM public.orders
    WHERE status IN ('delivered', 'cancelled')
      AND created_at < now() - make_interval(days => p_days)
  )
  DELETE FROM public.earnings
  WHERE order_id IN (SELECT id FROM old_orders);

  WITH old_orders AS (
    SELECT id
    FROM public.orders
    WHERE status IN ('delivered', 'cancelled')
      AND created_at < now() - make_interval(days => p_days)
  )
  DELETE FROM public.wallet_transactions
  WHERE order_id IN (SELECT id FROM old_orders);

  WITH old_orders AS (
    SELECT id
    FROM public.orders
    WHERE status IN ('delivered', 'cancelled')
      AND created_at < now() - make_interval(days => p_days)
  )
  DELETE FROM public.wait_time_bonuses
  WHERE order_id IN (SELECT id FROM old_orders);

  WITH old_orders AS (
    SELECT id
    FROM public.orders
    WHERE status IN ('delivered', 'cancelled')
      AND created_at < now() - make_interval(days => p_days)
  )
  DELETE FROM public.refunds
  WHERE order_id IN (SELECT id FROM old_orders);

  WITH old_orders AS (
    SELECT id
    FROM public.orders
    WHERE status IN ('delivered', 'cancelled')
      AND created_at < now() - make_interval(days => p_days)
  )
  DELETE FROM public.support_tickets
  WHERE order_id IN (SELECT id FROM old_orders)
    AND status IN ('resolved', 'closed');

  WITH old_orders AS (
    SELECT id
    FROM public.orders
    WHERE status IN ('delivered', 'cancelled')
      AND created_at < now() - make_interval(days => p_days)
  )
  DELETE FROM public.orders
  WHERE id IN (SELECT id FROM old_orders);
  GET DIAGNOSTICS v_orders = ROW_COUNT;
  v_deleted := v_deleted + v_orders;

  DELETE FROM public.store_daily_summary_log
  WHERE summary_date < current_date - 90;

  RETURN v_deleted;
END;
$$;

REVOKE ALL ON FUNCTION public.prune_old_terminal_orders(integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.prune_old_terminal_orders(integer) TO service_role;

-- Replace any prior schedule so we don't double-schedule.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    BEGIN
      PERFORM cron.unschedule('prune-old-terminal-orders-nightly');
    EXCEPTION WHEN OTHERS THEN
      NULL;
    END;
    PERFORM cron.schedule(
      'prune-old-terminal-orders-nightly',
      '0 4 * * *',  -- 04:00 UTC daily
      $$ SELECT public.prune_old_terminal_orders(30); $$
    );
  END IF;
END $$;