/*
  SystemDoctorPanel fixes:
  1) settle_order_now(p_order_id): settle an already-delivered order whose
     commission_settled_at is NULL (the panel's "Παραδοθείσες χωρίς settlement"
     check). Uses a session flag (app.force_settle) to let settle_order_commission
     run even though OLD.status is already 'delivered'. The store wallet credit is
     replicated inline (its trigger guards on OLD.status='delivered' and thus
     never fires here); it stays idempotent via store_wallet_ledger.
  2) backfill_orders_km(): fill NULL/<=0 distance_km for recent orders using the
     same haversine path as set_order_distance_and_payout.
  3) Unique index on wait_time_bonuses(order_id, driver_id) so the driver
     WaitTimeBonusBanner check-then-insert race cannot create duplicates.
*/

-- ---------------------------------------------------------------------------
-- 1) Allow re-settling an already-delivered order on demand.
--    Default behavior is unchanged: the bypass only activates while the
--    app.force_settle session setting is set to 'on'.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.settle_order_commission()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  split jsonb;
  admin_amt numeric := 0;
  pool_amt numeric := 0;
  delivery_amt numeric := 0;
  tip_amt numeric := 0;
  store_extra numeric := 0;
  store_keeps_amt numeric := 0;
  pool_balance numeric := 0;
  pool_take numeric := 0;
  admin_subsidy numeric := 0;
  is_cash boolean := false;
  cash_collected numeric := 0;
  driver_share_total numeric := 0;
  driver_base_pay numeric := 0;
  locked_payout numeric := 0;
  s_pause boolean := false;
  s_subsidize boolean := false;
  s_low numeric := 0;
  s_alert boolean := true;
  pay_paused boolean := false;
  shortfall numeric := 0;
  queued_amount numeric := 0;
  wait_bonus_amt numeric := 0;
BEGIN
  IF NEW.status::text <> 'delivered' THEN RETURN NEW; END IF;
  IF NEW.commission_settled_at IS NOT NULL THEN RETURN NEW; END IF;
  IF OLD.status::text = 'delivered'
     AND NOT COALESCE(current_setting('app.force_settle', true) = 'on', false) THEN
    RETURN NEW;
  END IF;

  split := public.compute_order_split(NEW.id);
  IF split IS NULL THEN
    NEW.commission_settled_at := now();
    RETURN NEW;
  END IF;

  SELECT pause_bonus_when_critical, subsidize_min_pay, low_pool_threshold, pool_alert_enabled
    INTO s_pause, s_subsidize, s_low, s_alert
    FROM public.platform_settings WHERE id = 1;

  is_cash         := COALESCE(NEW.payment_method, 'card') = 'cash';
  admin_amt       := COALESCE((split->>'admin_amount')::numeric, 0);
  pool_amt        := COALESCE((split->>'driver_pool_amount')::numeric, 0);
  delivery_amt    := COALESCE((split->>'driver_delivery_fee')::numeric, 0);
  tip_amt         := COALESCE(NEW.tip_amount, 0);
  store_extra     := COALESCE((split->>'store_extra_commission')::numeric, 0);
  store_keeps_amt := COALESCE((split->>'store_keeps')::numeric, 0);

  locked_payout := COALESCE(NEW.driver_payout, 0);
  IF locked_payout > 0 THEN
    driver_base_pay := ROUND(locked_payout::numeric, 2);
  ELSE
    driver_base_pay := public.quote_driver_payout(NEW.store_id, NEW.distance_km);
  END IF;

  IF delivery_amt > driver_base_pay THEN
    driver_base_pay := delivery_amt;
  END IF;

  -- Extra for store wait after grace period (admin-configured €/min)
  SELECT COALESCE(w.bonus_amount, 0)
    INTO wait_bonus_amt
    FROM public.wait_time_bonuses w
   WHERE w.order_id = NEW.id
     AND (NEW.driver_id IS NULL OR w.driver_id = NEW.driver_id)
   ORDER BY w.created_at DESC
   LIMIT 1;
  wait_bonus_amt := COALESCE(wait_bonus_amt, 0);

  IF admin_amt > 0 THEN
    INSERT INTO public.admin_treasury_ledger (amount, bag, type, order_id, description)
    VALUES (admin_amt, 'admin', 'commission', NEW.id, '5% admin share');
    UPDATE public.admin_treasury
      SET admin_balance = admin_balance + admin_amt,
          lifetime_admin_earned = lifetime_admin_earned + admin_amt,
          updated_at = now()
      WHERE id = 1;
  END IF;

  IF pool_amt > 0 THEN
    INSERT INTO public.admin_treasury_ledger (amount, bag, type, order_id, description)
    VALUES (pool_amt, 'platform', 'driver_pool', NEW.id, '10% driver pool top-up');
    UPDATE public.admin_treasury
      SET platform_pool = platform_pool + pool_amt,
          lifetime_platform_earned = lifetime_platform_earned + pool_amt,
          updated_at = now()
      WHERE id = 1;
  END IF;

  IF store_extra > 0 THEN
    INSERT INTO public.admin_treasury_ledger (amount, bag, type, order_id, description)
    VALUES (store_extra, 'platform', 'commission_extra', NEW.id, 'Store commission above 15%');
    UPDATE public.admin_treasury
      SET platform_pool = platform_pool + store_extra,
          lifetime_platform_earned = lifetime_platform_earned + store_extra,
          updated_at = now()
      WHERE id = 1;
  END IF;

  IF NEW.driver_id IS NOT NULL THEN
    SELECT COALESCE(platform_pool, 0) INTO pool_balance FROM public.admin_treasury WHERE id = 1;
    shortfall := GREATEST(driver_base_pay - pool_balance, 0);

    pay_paused := (COALESCE(s_pause, false)
                   AND NOT COALESCE(s_subsidize, false)
                   AND shortfall > 0
                   AND pool_balance < COALESCE(s_low, 0));

    IF pay_paused THEN
      INSERT INTO public.pending_driver_payouts (driver_id, order_id, amount, reason)
      VALUES (NEW.driver_id, NEW.id, driver_base_pay + tip_amt + wait_bonus_amt, 'pool_insufficient')
      ON CONFLICT (order_id, driver_id) DO NOTHING;

      IF COALESCE(s_alert, true) THEN
        INSERT INTO public.announcements (title, message, target_audience, expires_at)
        VALUES (
          'Driver Buffer χαμηλό',
          'Παραγγελία ' || COALESCE(NEW.external_ref, NEW.id::text)
            || ' δεν πληρώθηκε σε driver (απαιτείται €' || ROUND(driver_base_pay,2)
            || ', διαθέσιμο €' || ROUND(pool_balance,2) || '). Top-up το Driver Buffer.',
          'admin',
          now() + interval '24 hours'
        );
      END IF;

      pool_take := 0;
      admin_subsidy := 0;
      driver_share_total := 0;

      INSERT INTO public.earnings (driver_id, order_id, base_pay, bonus, tip)
      SELECT NEW.driver_id, NEW.id, driver_base_pay, wait_bonus_amt, tip_amt
      WHERE NOT EXISTS (
        SELECT 1 FROM public.earnings e WHERE e.order_id = NEW.id AND e.driver_id = NEW.driver_id
      );
    ELSE
      pool_take := LEAST(GREATEST(pool_balance, 0), GREATEST(driver_base_pay, 0));
      admin_subsidy := GREATEST(driver_base_pay - pool_take, 0);

      IF admin_subsidy > 0 AND NOT COALESCE(s_subsidize, false) THEN
        queued_amount := admin_subsidy;
        INSERT INTO public.pending_driver_payouts (driver_id, order_id, amount, reason)
        VALUES (NEW.driver_id, NEW.id, queued_amount, 'pool_insufficient')
        ON CONFLICT (order_id, driver_id) DO NOTHING;

        IF COALESCE(s_alert, true) THEN
          INSERT INTO public.announcements (title, message, target_audience, expires_at)
          VALUES (
            'Driver Buffer χαμηλό',
            'Λείπουν €' || ROUND(queued_amount,2) || ' από driver payout (order '
              || COALESCE(NEW.external_ref, NEW.id::text) || '). Top-up το Driver Buffer.',
            'admin',
            now() + interval '24 hours'
          );
        END IF;
        admin_subsidy := 0;
        driver_base_pay := pool_take;
      END IF;

      -- Wait bonus is paid from platform pool (extra), then admin bag if needed
      IF wait_bonus_amt > 0 THEN
        SELECT COALESCE(platform_pool, 0) INTO pool_balance FROM public.admin_treasury WHERE id = 1;
        IF pool_balance >= wait_bonus_amt THEN
          INSERT INTO public.admin_treasury_ledger (amount, bag, type, order_id, description)
          VALUES (-wait_bonus_amt, 'platform', 'wait_bonus', NEW.id, 'Wait-time bonus');
          UPDATE public.admin_treasury
            SET platform_pool = GREATEST(platform_pool - wait_bonus_amt, 0),
                lifetime_driver_topup = lifetime_driver_topup + wait_bonus_amt,
                updated_at = now()
            WHERE id = 1;
        ELSE
          INSERT INTO public.admin_treasury_ledger (amount, bag, type, order_id, description)
          VALUES (-wait_bonus_amt, 'admin', 'wait_bonus', NEW.id, 'Wait-time bonus (admin)');
          UPDATE public.admin_treasury
            SET admin_balance = admin_balance - wait_bonus_amt,
                updated_at = now()
            WHERE id = 1;
        END IF;
      END IF;

      driver_share_total := COALESCE(driver_base_pay, 0) + COALESCE(tip_amt, 0) + COALESCE(wait_bonus_amt, 0);

      IF pool_take > 0 THEN
        INSERT INTO public.admin_treasury_ledger (amount, bag, type, order_id, description)
        VALUES (-pool_take, 'platform', 'driver_payout', NEW.id, 'Driver pay from pool');
        UPDATE public.admin_treasury
          SET platform_pool = GREATEST(platform_pool - pool_take, 0),
              lifetime_driver_topup = lifetime_driver_topup + pool_take,
              updated_at = now()
          WHERE id = 1;
      END IF;

      IF admin_subsidy > 0 THEN
        INSERT INTO public.admin_treasury_ledger (amount, bag, type, order_id, description)
        VALUES (-admin_subsidy, 'admin', 'driver_subsidy', NEW.id, 'Admin subsidy for driver pay');
        UPDATE public.admin_treasury
          SET admin_balance = admin_balance - admin_subsidy,
              updated_at = now()
          WHERE id = 1;
      END IF;

      INSERT INTO public.earnings (driver_id, order_id, base_pay, bonus, tip)
      SELECT NEW.driver_id, NEW.id, driver_base_pay, wait_bonus_amt, tip_amt
      WHERE NOT EXISTS (
        SELECT 1 FROM public.earnings e WHERE e.order_id = NEW.id AND e.driver_id = NEW.driver_id
      );

      IF driver_share_total > 0 THEN
        INSERT INTO public.driver_wallets (driver_id, available_balance, pending_balance, total_withdrawn)
        SELECT NEW.driver_id, driver_share_total, 0, 0
        WHERE NOT EXISTS (
          SELECT 1 FROM public.wallet_transactions wt
          WHERE wt.order_id = NEW.id
            AND wt.driver_id = NEW.driver_id
            AND wt.type = 'earning_credit'
        )
        ON CONFLICT (driver_id) DO UPDATE
          SET available_balance = public.driver_wallets.available_balance + driver_share_total,
              updated_at = now();

        INSERT INTO public.wallet_transactions (driver_id, type, amount, status, description, order_id)
        SELECT NEW.driver_id, 'earning_credit', driver_share_total, 'completed',
               CASE WHEN wait_bonus_amt > 0
                 THEN 'Κέρδος παράδοσης + μπόνους αναμονής'
                 ELSE 'Κέρδος παράδοσης'
               END,
               NEW.id
        WHERE NOT EXISTS (
          SELECT 1 FROM public.wallet_transactions wt
          WHERE wt.order_id = NEW.id
            AND wt.driver_id = NEW.driver_id
            AND wt.type = 'earning_credit'
        );
      END IF;

      IF wait_bonus_amt > 0 THEN
        UPDATE public.wait_time_bonuses
           SET is_applied = true
         WHERE order_id = NEW.id
           AND driver_id = NEW.driver_id
           AND bonus_amount > 0;
      END IF;
    END IF;

    IF is_cash THEN
      cash_collected := COALESCE(NEW.cash_received, 0);
      IF cash_collected <= 0 THEN
        cash_collected := COALESCE(NEW.total_amount, 0) + COALESCE(NEW.delivery_fee, 0) + COALESCE(NEW.tip_amount, 0);
      END IF;

      IF cash_collected > 0 THEN
        INSERT INTO public.driver_cash_debts (
          driver_id, order_id, cash_collected,
          driver_share, amount_owed, store_share, platform_share, admin_share, settled
        )
        SELECT NEW.driver_id, NEW.id, cash_collected,
               driver_share_total, cash_collected, store_keeps_amt, pool_amt + store_extra, admin_amt, false
        WHERE NOT EXISTS (
          SELECT 1 FROM public.driver_cash_debts d WHERE d.order_id = NEW.id AND d.driver_id = NEW.driver_id
        );
      END IF;
    END IF;
  END IF;

  NEW.commission_settled_at := now();
  NEW.platform_profit := admin_amt;
  NEW.driver_payout := driver_share_total;
  NEW.store_charge := store_keeps_amt;
  NEW.driver_pool_bonus := driver_base_pay;
  RETURN NEW;
END;
$function$;

-- ---------------------------------------------------------------------------
-- 2) On-demand settlement for delivered orders with commission_settled_at NULL
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.settle_order_now(p_order_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $fn$
DECLARE
  v_order public.orders%ROWTYPE;
  v_store_charge numeric;
  v_was_forced boolean;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  SELECT * INTO v_order FROM public.orders WHERE id = p_order_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Order % not found', p_order_id;
  END IF;
  IF v_order.status <> 'delivered' OR v_order.commission_settled_at IS NOT NULL THEN
    RETURN;
  END IF;

  v_was_forced := COALESCE(current_setting('app.force_settle', true) = 'on', false);
  IF NOT v_was_forced THEN
    PERFORM set_config('app.force_settle', 'on', true);
  END IF;

  BEGIN
    -- No-op column update: fires AFTER UPDATE triggers without changing status,
    -- so settle_order_commission re-runs (bypass above) and is idempotent
    -- (commission_settled_at still NULL; internal NOT EXISTS guards).
    UPDATE public.orders SET notes = notes WHERE id = p_order_id;

    -- Store wallet credit lives in credit_store_wallet_on_delivery, which is
    -- guarded by OLD.status='delivered' and never fires here. Replicate it
    -- using the freshly persisted store_charge. Idempotent via ledger row.
    SELECT store_charge INTO v_store_charge FROM public.orders WHERE id = p_order_id;
    IF v_order.store_id IS NOT NULL AND COALESCE(v_store_charge, 0) > 0
       AND NOT EXISTS (
         SELECT 1 FROM public.store_wallet_ledger swl
          WHERE swl.order_id = p_order_id AND swl.type = 'order_earning'
       ) THEN
      INSERT INTO public.store_wallets (store_id, available_balance, pending_balance, lifetime_earnings)
      VALUES (v_order.store_id, v_store_charge, 0, v_store_charge)
      ON CONFLICT (store_id) DO UPDATE
        SET available_balance = public.store_wallets.available_balance + EXCLUDED.available_balance,
            lifetime_earnings = public.store_wallets.lifetime_earnings + EXCLUDED.lifetime_earnings,
            updated_at = now();

      INSERT INTO public.store_wallet_ledger (store_id, order_id, type, amount, description)
      VALUES (v_order.store_id, p_order_id, 'order_earning', v_store_charge,
              CASE WHEN COALESCE(v_order.payment_method, 'card') = 'cash'
                   THEN 'Μερίδιο καταστήματος (μετρητά)'
                   ELSE 'Μερίδιο καταστήματος (κάρτα)' END);
    END IF;
  EXCEPTION WHEN OTHERS THEN
    IF NOT v_was_forced THEN
      PERFORM set_config('app.force_settle', 'off', true);
    END IF;
    RAISE;
  END;

  IF NOT v_was_forced THEN
    PERFORM set_config('app.force_settle', 'off', true);
  END IF;
END;
$fn$;

REVOKE ALL ON FUNCTION public.settle_order_now(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.settle_order_now(uuid) TO authenticated;

-- ---------------------------------------------------------------------------
-- 3) Backfill missing distance_km (SystemDoctorPanel "Παραγγελίες χωρίς km")
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.backfill_orders_km()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $fn$
DECLARE
  v_updated integer := 0;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  UPDATE public.orders o
     SET distance_km = public.haversine_km(
           s.latitude, s.longitude, o.delivery_latitude, o.delivery_longitude
         )
    FROM public.stores s
   WHERE s.id = o.store_id
     AND s.latitude IS NOT NULL
     AND s.longitude IS NOT NULL
     AND o.delivery_latitude IS NOT NULL
     AND o.delivery_longitude IS NOT NULL
     AND (o.distance_km IS NULL OR o.distance_km <= 0)
     AND o.created_at > now() - interval '7 days';

  GET DIAGNOSTICS v_updated = ROW_COUNT;
  RETURN v_updated;
END;
$fn$;

REVOKE ALL ON FUNCTION public.backfill_orders_km() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.backfill_orders_km() TO authenticated;

-- ---------------------------------------------------------------------------
-- 4) wait_time_bonuses: prevent duplicate (order_id, driver_id) rows from the
--    driver app's check-then-insert (race on double mount).
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT order_id, driver_id, min(id) AS keep_id
      FROM public.wait_time_bonuses
     GROUP BY order_id, driver_id
    HAVING count(*) > 1
  LOOP
    DELETE FROM public.wait_time_bonuses w
     WHERE w.order_id = r.order_id
       AND w.driver_id = r.driver_id
       AND w.id <> r.keep_id;
  END LOOP;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS wait_time_bonuses_order_driver_unique
  ON public.wait_time_bonuses (order_id, driver_id);
