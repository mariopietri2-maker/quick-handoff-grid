/**
 * Canonical money helpers for store partner / receipts / P&L.
 * Always: finite number, 2 decimal cents, never NaN on screen.
 */

export function parseMoney(v: unknown): number {
  if (v == null || v === '') return 0;
  if (typeof v === 'number') return Number.isFinite(v) ? v : 0;
  const s = String(v).trim().replace(/€/g, '').replace(/\s/g, '').replace(',', '.');
  const n = Number(s.replace(/[^0-9.-]/g, ''));
  return Number.isFinite(n) ? n : 0;
}

/** Banker-safe round to cents. */
export function roundMoney(n: number): number {
  return Math.round((parseMoney(n) + Number.EPSILON) * 100) / 100;
}

export function formatEuro(v: unknown): string {
  return `€${roundMoney(parseMoney(v)).toFixed(2)}`;
}

export function formatMoneyPlain(v: unknown): string {
  return roundMoney(parseMoney(v)).toFixed(2);
}

export function lineTotal(unitPrice: unknown, quantity: unknown): number {
  return roundMoney(parseMoney(unitPrice) * parseMoney(quantity));
}

export type MoneyItem = { unit_price?: unknown; quantity?: unknown; price?: unknown };

/** Sum of line items (qty × unit_price). */
export function itemsSubtotal(items: MoneyItem[] | null | undefined): number {
  if (!items?.length) return 0;
  let sum = 0;
  for (const i of items) {
    const unit = i.unit_price != null ? i.unit_price : i.price;
    sum = roundMoney(sum + lineTotal(unit, i.quantity ?? 1));
  }
  return sum;
}

export type OrderMoneyFields = {
  total_amount?: unknown;
  delivery_fee?: unknown;
  tip_amount?: unknown;
  store_charge?: unknown;
  order_items?: MoneyItem[] | null;
};

/**
 * Single source of truth for what the store UI/receipt should show.
 * total prefers order.total_amount; if missing/0 but items exist, uses items sum + fees.
 */
export function orderMoney(order: OrderMoneyFields): {
  itemsSum: number;
  deliveryFee: number;
  tip: number;
  storeCharge: number;
  /** Customer-facing grand total */
  total: number;
  /** Food subtotal (total − delivery − tip), never negative */
  subtotal: number;
} {
  const itemsSum = itemsSubtotal(order.order_items);
  const deliveryFee = Math.max(0, parseMoney(order.delivery_fee));
  const tip = Math.max(0, parseMoney(order.tip_amount));
  const storeCharge = Math.max(0, parseMoney(order.store_charge));
  const rawTotal = parseMoney(order.total_amount);
  // Prefer DB total; if zero/missing but we have lines, reconstruct
  const total =
    rawTotal > 0
      ? roundMoney(rawTotal)
      : roundMoney(itemsSum + deliveryFee + tip);
  const subtotal = Math.max(0, roundMoney(total - deliveryFee - tip));
  return { itemsSum, deliveryFee, tip, storeCharge, total, subtotal };
}
