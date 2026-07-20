/*
  Platform test fixes:
  1) Guest/new-customer store browsing: stores_public is security_invoker and
     "Anyone reads active stores" was dropped, so anon + customers without prior
     orders saw an empty catalog. Recreate the view as security definer and
     filter to active, non-suspended stores only (public columns only).
  2) Double driver wallet credit on delivery: settle_money_bags_on_delivery and
     trg_settle_order_commission both insert earning_credit. Keep commission
     settle as canonical; drop the legacy money_bags trigger again.
*/

-- ---------------------------------------------------------------------------
-- 1) Public store catalog for anon + authenticated browsers
-- ---------------------------------------------------------------------------
DROP VIEW IF EXISTS public.stores_public CASCADE;

CREATE VIEW public.stores_public
WITH (security_invoker = false) AS
SELECT
  id,
  owner_id,
  name,
  address,
  latitude,
  longitude,
  image_url,
  is_active,
  busy_mode,
  prep_buffer_minutes,
  opening_hours,
  holiday_dates,
  promotion_status,
  promotion_starts_at,
  promotion_ends_at,
  covers_delivery_fee,
  created_at,
  updated_at
FROM public.stores
WHERE is_active = true
  AND suspended_at IS NULL;

GRANT SELECT ON public.stores_public TO anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 2) Single canonical driver wallet settlement path
-- ---------------------------------------------------------------------------
DROP TRIGGER IF EXISTS settle_money_bags_on_delivery ON public.orders;

-- Reverse duplicate Fair-pay credits that co-exist with Κέρδος παράδοσης
-- for the same order (idempotent: only touches unmatched Fair-pay rows).
DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT wt.id, wt.driver_id, wt.order_id, wt.amount
    FROM public.wallet_transactions wt
    WHERE wt.type = 'earning_credit'
      AND wt.description LIKE 'Fair pay%'
      AND EXISTS (
        SELECT 1
        FROM public.wallet_transactions other
        WHERE other.order_id = wt.order_id
          AND other.driver_id = wt.driver_id
          AND other.type = 'earning_credit'
          AND other.id <> wt.id
          AND other.description LIKE 'Κέρδος παράδοσης%'
      )
      AND NOT EXISTS (
        SELECT 1
        FROM public.wallet_transactions rev
        WHERE rev.order_id = wt.order_id
          AND rev.driver_id = wt.driver_id
          AND rev.type = 'admin_debit'
          AND rev.description LIKE 'Reversal: legacy duplicate Fair pay%'
      )
  LOOP
    UPDATE public.driver_wallets
       SET available_balance = GREATEST(available_balance - r.amount, 0),
           updated_at = now()
     WHERE driver_id = r.driver_id;

    INSERT INTO public.wallet_transactions (
      driver_id, type, amount, status, description, order_id
    ) VALUES (
      r.driver_id,
      'admin_debit',
      -r.amount,
      'completed',
      'Reversal: legacy duplicate Fair pay payout',
      r.order_id
    );
  END LOOP;
END $$;
