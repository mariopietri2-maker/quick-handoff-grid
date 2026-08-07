-- ============================================================================
-- FULL BUSINESS-DATA RESET (manual, destructive — run ONLY on the live DB)
-- ============================================================================
-- What it does:
--   * Deletes ALL business/transactional data (orders, wallets ledger, tickets,
--     chats, notifications, rewards, referrals, reports, pricing events...).
--   * Keeps accounts & configuration: profiles, user_roles, stores, driver_profiles,
--     menu catalog, store rules, platform_settings, feature_flags, admin_permissions,
--     admin_audit_log, support_channels/team, canned_replies, promo_codes,
--     push_tokens, email infra, banned_devices, saved_addresses, favorites, zones.
--   * Keeps wallet ROWS but zeroes every balance (fresh start for all actors).
--   * Seeds the driver top-up pool: admin_treasury.platform_pool = 500 EUR.
-- ============================================================================
-- HOW TO RUN:
--   Option A (Supabase Dashboard → SQL Editor): paste this file, run it.
--   Option B (CLI):  supabase db push  (or psql $DATABASE_URL -f this file)
-- ============================================================================

BEGIN;

-- ── 1. Delete all business/transactional rows (dependency-safe via CASCADE) ──
TRUNCATE TABLE
  public.orders,
  public.order_items,
  public.order_item_modifiers,
  public.group_orders,
  public.group_order_participants,
  public.live_chat_messages,
  public.support_tickets,
  public.ticket_messages,
  public.wallet_transactions,
  public.wait_time_bonuses,
  public.customer_wallet_ledger,
  public.store_wallet_ledger,
  public.admin_treasury_ledger,
  public.driver_cash_debts,
  public.refunds,
  public.earnings,
  public.transactions,
  public.reviews,
  public.driver_notifications,
  public.driver_quest_progress,
  public.streak_bonuses,
  public.loyalty_points,
  public.loyalty_ledger,
  public.customer_rewards,
  public.reward_history,
  public.customer_referrals,
  public.driver_referrals,
  public.referral_codes,
  public.referral_tracking,
  public.pending_offers,
  public.pending_driver_payouts,
  public.dispatch_runs,
  public.driver_offer_events,
  public.surge_events,
  public.demand_pricing_events,
  public.ai_pricing_adjustments,
  public.ai_pricing_runs,
  public.fraud_signals,
  public.basket_distributions,
  public.basket_distribution_payouts,
  public.store_daily_summary_log,
  public.aade_delivery_reports,
  public.monthly_reports,
  public.driver_state,
  public.driver_locations,
  public.customer_locations,
  public.push_outbox
CASCADE;

-- ── 2. Zero all wallet balances (rows kept so balances render as 0.00) ──
UPDATE public.driver_wallets
   SET available_balance = 0,
       pending_balance  = 0,
       total_withdrawn  = 0,
       updated_at       = now();

UPDATE public.customer_wallets
   SET balance        = 0,
       lifetime_credit = 0,
       updated_at     = now();

UPDATE public.store_wallets
   SET available_balance = 0,
       pending_balance   = 0,
       lifetime_earnings = 0,
       updated_at        = now();

-- ── 3. Reset treasury and seed the driver top-up pool with 500 EUR ──
INSERT INTO public.admin_treasury (id) VALUES (1) ON CONFLICT DO NOTHING;

UPDATE public.admin_treasury
   SET admin_balance             = 0,
       platform_pool             = 500,          -- <-- driver pool, 500 EUR
       lifetime_admin_earned     = 0,
       lifetime_platform_earned  = 0,
       lifetime_driver_topup     = 0,
       updated_at                = now()
 WHERE id = 1;

-- ── 4. Audit the reset (only when run by an authenticated admin) ──
DO $$
BEGIN
  IF public.has_role(auth.uid(), 'admin') THEN
    PERFORM public.log_admin_action(
      'full_business_data_reset', 'platform', 'all',
      'All business data wiped; driver pool seeded to 500 EUR',
      jsonb_build_object('platform_pool', (SELECT platform_pool FROM public.admin_treasury WHERE id = 1))
    );
  END IF;
END $$;

COMMIT;
