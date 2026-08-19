-- Fill gaps in indexes for the hottest query patterns identified in the perf
-- audit. All CREATE INDEX statements are additive and safe to run on a live DB
-- (Postgres builds them without locking writes; add IF NOT EXISTS for rerun
-- safety in case the migration is applied more than once).

-- ai-dynamic-pricing + store menus filter menu_items by store_id.
CREATE INDEX IF NOT EXISTS idx_menu_items_store_id
  ON public.menu_items (store_id);

-- ai-dynamic-pricing + admin dashboards scan orders by created_at window.
CREATE INDEX IF NOT EXISTS idx_orders_created_at
  ON public.orders (created_at DESC);

-- Per-store order stats / store dashboards (store_id + recency).
CREATE INDEX IF NOT EXISTS idx_orders_store_created
  ON public.orders (store_id, created_at DESC);

-- Store apps list their own stores by owner.
CREATE INDEX IF NOT EXISTS idx_stores_owner_id
  ON public.stores (owner_id);

-- nearby_active_drivers + dispatch filter on active drivers.
CREATE INDEX IF NOT EXISTS idx_driver_profiles_active
  ON public.driver_profiles (is_active) WHERE is_active = true;

-- proactive alerting drains alert_outbox by sent_at IS NULL.
CREATE INDEX IF NOT EXISTS idx_alert_outbox_pending
  ON public.alert_outbox (created_at) WHERE sent_at IS NULL;

-- nearby_active_drivers earned_today subquery: driver + delivered + day.
CREATE INDEX IF NOT EXISTS idx_orders_driver_delivered_day
  ON public.orders (driver_id, updated_at DESC)
  WHERE status = 'delivered';