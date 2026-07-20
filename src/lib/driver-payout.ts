/**
 * Canonical driver offer / payout display.
 * Settlement pays `orders.driver_payout` (locked at place) + tip.
 * Never use customer `delivery_fee` as driver base — that caused offer ≠ wallet.
 */
export type PayoutOrderFields = {
  driver_payout?: number | null;
  delivery_fee?: number | null;
  tip_amount?: number | null;
  distance_km?: number | null;
  /** After settlement, driver_payout is rewritten to include tip. */
  commission_settled_at?: string | null;
  status?: string | null;
};

export function getDriverPayoutBreakdown(order: PayoutOrderFields) {
  const tip = Math.max(0, Number(order.tip_amount ?? 0));
  const locked = Math.max(0, Number(order.driver_payout ?? 0));
  const settled =
    !!order.commission_settled_at || order.status === 'delivered';

  // Post-settlement: driver_payout already = base + tip
  if (settled && locked > 0) {
    const basePay = Math.max(0, Number((locked - tip).toFixed(2)));
    return { basePay, tipAmount: tip, poolBonus: 0, total: Number(locked.toFixed(2)) };
  }

  const fallback = Math.max(2, Number(order.distance_km ?? 0) * 0.5 + 2);
  // Prefer locked quote; only fall back to delivery_fee if quote missing
  const basePay = locked > 0
    ? locked
    : (Number(order.delivery_fee ?? 0) > 0 ? Number(order.delivery_fee) : fallback);

  return {
    basePay: Number(basePay.toFixed(2)),
    tipAmount: tip,
    poolBonus: 0,
    total: Number((basePay + tip).toFixed(2)),
  };
}
