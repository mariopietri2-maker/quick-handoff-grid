/**
 * Fresh2GO marketplace money path — same stages as efood/Wolt/Uber-class platforms.
 *
 * Stages:
 *   1. Quote     — cart totals, locked driver_payout
 *   2. Pay-in    — cash | card (Stripe) | viva
 *   3. Authorize — card hold / checkout session (pending order)
 *   4. Capture   — webhook marks paid → status pending→placed
 *   5. Fulfill   — store accept → driver → delivered
 *   6. Settle    — settle_order_commission on delivered (wallets + commission_settled_at)
 *   7. Payout    — admin store payables / driver wallet balance (batch bank later)
 *
 * Cash is parallel: no PSP capture; driver collects; shift_cash_balance reconciles.
 */
import { parseMoney, roundMoney, orderMoney, type OrderMoneyFields } from './money';
import { getDriverPayoutBreakdown, type PayoutOrderFields } from './driver-payout';

export type PaymentRail = 'cash' | 'card' | 'viva';

/** Customer-facing / order status related to money (not kitchen status). */
export type MoneyStage =
  | 'quoted'
  | 'awaiting_payment' // card/viva pending
  | 'paid_authorized' // treated as paid in our flow (capture-at-place)
  | 'cash_cod'
  | 'in_fulfillment'
  | 'settled'
  | 'refunded'
  | 'failed';

export type SplitPercents = {
  /** % of food subtotal the store keeps (default ~85) */
  storeKeepsPct: number;
  /** % of food → driver pool / basket (default ~10) */
  poolPct: number;
  /** residual % → platform admin (default ~5) */
  adminPct: number;
};

export const DEFAULT_SPLIT: SplitPercents = {
  storeKeepsPct: 85,
  poolPct: 10,
  adminPct: 5,
};

export type OrderMoneyPathInput = OrderMoneyFields &
  PayoutOrderFields & {
    payment_method?: string | null;
    status?: string | null;
    commission_settled_at?: string | null;
    stripe_payment_intent_id?: string | null;
    cash_received?: number | null;
  };

/** Pure food split — matches money-math tests / settle_order_commission intent. */
export function splitFoodSubtotal(
  foodSubtotal: number,
  pct: SplitPercents = DEFAULT_SPLIT,
): { store: number; pool: number; admin: number } {
  const food = Math.max(0, roundMoney(foodSubtotal));
  const store = roundMoney((food * pct.storeKeepsPct) / 100);
  const pool = roundMoney((food * pct.poolPct) / 100);
  // residual cent → admin so store+pool+admin === food
  const admin = roundMoney(food - store - pool);
  return { store, pool, admin };
}

/**
 * Full order ledger lines (customer total vs internal bags).
 * Driver gets delivery fee (or locked driver_payout) + tip — not a % of food.
 */
export function buildOrderLedger(
  order: OrderMoneyPathInput,
  pct: SplitPercents = DEFAULT_SPLIT,
) {
  const m = orderMoney(order);
  const food = m.subtotal; // total − delivery − tip
  const bags = splitFoodSubtotal(food, pct);
  const driver = getDriverPayoutBreakdown(order);
  const rail = normalizeRail(order.payment_method);

  return {
    rail,
    stage: resolveMoneyStage(order),
    customerTotal: m.total,
    foodSubtotal: food,
    deliveryFee: m.deliveryFee,
    tip: m.tip,
    storeKeeps: bags.store,
    pool: bags.pool,
    platformAdmin: bags.admin,
    driverBase: driver.basePay,
    driverTip: driver.tipAmount,
    driverTotal: driver.total,
    /** What store partner owes/receives narrative for cash vs card */
    cashToCollect:
      rail === 'cash'
        ? roundMoney(
            parseMoney(order.cash_received) > 0
              ? order.cash_received
              : m.total,
          )
        : 0,
  };
}

export function normalizeRail(method: string | null | undefined): PaymentRail {
  const m = (method || 'cash').toLowerCase();
  if (m === 'card' || m === 'stripe') return 'card';
  if (m === 'viva') return 'viva';
  return 'cash';
}

export function resolveMoneyStage(order: OrderMoneyPathInput): MoneyStage {
  const status = (order.status || '').toLowerCase();
  const rail = normalizeRail(order.payment_method);

  if (status === 'cancelled' || status === 'rejected') {
    return order.stripe_payment_intent_id ? 'refunded' : 'failed';
  }
  if (order.commission_settled_at || status === 'delivered') {
    return order.commission_settled_at ? 'settled' : 'in_fulfillment';
  }
  if (rail === 'cash') {
    if (status === 'pending' || status === 'placed' || !status) return 'cash_cod';
    return 'in_fulfillment';
  }
  // card / viva
  if (status === 'pending') return 'awaiting_payment';
  if (status === 'placed' || status === 'accepted' || status === 'preparing' || status === 'ready' || status === 'picked_up' || status === 'on_the_way') {
    return 'in_fulfillment';
  }
  return 'quoted';
}

/** Invariants for S+ money path (unit-tested). */
export function assertLedgerTiesOut(ledger: ReturnType<typeof buildOrderLedger>): boolean {
  const foodParts = roundMoney(ledger.storeKeeps + ledger.pool + ledger.platformAdmin);
  if (Math.abs(foodParts - ledger.foodSubtotal) > 0.02) return false;
  const customer = roundMoney(ledger.foodSubtotal + ledger.deliveryFee + ledger.tip);
  if (Math.abs(customer - ledger.customerTotal) > 0.02) return false;
  return true;
}
