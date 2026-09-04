/**
 * Per-order store economics (the "what you earned vs the fees" breakdown).
 * Mirrors src/lib/driver-payout.ts and the settlement logic in the SQL
 * migrations so the store portal can show a transparent per-order P&L.
 *
 * Two distinct models:
 *
 *  - In-app orders: gross = subtotal + deliveryFee + tip. The store keeps the
 *    subtotal and pays commission on it; tip goes to the driver, delivery fee
 *    covers the driver. Net to store = subtotal - platformCommission.
 *
 *  - External (eFood/Wolt/Box) orders: the customer pays the external platform.
 *    The store is charged `store_charge` (computed by create_external_order) to
 *    cover the driver we dispatch. Net to store = subtotal - storeCharge.
 */

export type StoreOrderPnl = {
  /** Gross charged to the customer (total_amount). */
  gross: number;
  /** What the customer paid for delivery. */
  deliveryFee: number;
  /** Customer tip (goes to driver, not the store). */
  tip: number;
  /** Food/merchandise subtotal (gross - deliveryFee - tip). */
  subtotal: number;
  /** For in-app orders only: the store's commission rate (%). */
  commissionPct: number | null;
  /** Platform commission retained on in-app orders. */
  platformFee: number;
  /** For external orders only: what the store is charged to cover the driver. */
  storeCharge: number | null;
  /** Net the store actually earns for the order. */
  net: number;
  /** True for external (eFood/Wolt/Box) orders. */
  isExternal: boolean;
  /** Order has been settled / is revenue-affecting. */
  settled: boolean;
};

export type StoreOrderFields = {
  total_amount?: number | null;
  delivery_fee?: number | null;
  tip_amount?: number | null;
  store_charge?: number | null;
  source?: string | null;
  status?: string | null;
};

export function isExternalSource(source?: string | null): boolean {
  const s = (source ?? 'in_app').toLowerCase();
  return s !== 'in_app' && s !== 'manual';
}

export function getStoreOrderPnl(order: StoreOrderFields, defaultCommissionPct: number | null = null): StoreOrderPnl {
  const gross = Math.max(0, Number(order.total_amount ?? 0));
  const deliveryFee = Math.max(0, Number(order.delivery_fee ?? 0));
  const tip = Math.max(0, Number(order.tip_amount ?? 0));
  const subtotal = Math.max(0, Number((gross - deliveryFee - tip).toFixed(2)));

  const isExternal = isExternalSource(order.source);
  const settled = order.status === 'delivered';
  const commissionPct = defaultCommissionPct != null ? Math.max(0, defaultCommissionPct) : null;

  if (isExternal) {
    const storeCharge = Math.max(0, Number(order.store_charge ?? 0));
    return {
      gross,
      deliveryFee,
      tip,
      subtotal,
      commissionPct: null,
      platformFee: 0,
      storeCharge,
      net: Number((subtotal - storeCharge).toFixed(2)),
      isExternal,
      settled,
    };
  }

  // Settlement lands a single net amount = subtotal * (1 - commission/100); fall back to 15%.
  const effectivePct = commissionPct ?? 15;
  const platformFee = Number((subtotal * effectivePct / 100).toFixed(2));
  const net = Number((subtotal - platformFee).toFixed(2));

  return {
    gross,
    deliveryFee,
    tip,
    subtotal,
    commissionPct,
    platformFee,
    storeCharge: null,
    net,
    isExternal,
    settled,
  };
}