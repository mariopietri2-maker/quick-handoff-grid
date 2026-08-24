// Business rules for the «one-at-a-time» («μία-μία») driver flow.
// Single source of truth shared by edge functions so gating never drifts.

export const ONE_AT_A_TIME = {
  /**
   * The second (stacked) order ALWAYS pays half of its own priced payout.
   * The first order keeps whatever the pricing engine computed at checkout.
   */
  secondOrderFactor: 0.5,
  /** Hard cap of simultaneously active orders per driver (first + second). */
  maxActiveOrders: 2,
} as const;

/** Round to 2 decimals like the DB does. */
export function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/**
 * Payout for a claimed order. First order: unchanged (as priced).
 * Second order: exactly half of its own priced payout.
 */
export function claimPayout(currentPayout: number | null | undefined, isSecond: boolean): number | null {
  const existing = Number(currentPayout ?? 0);
  if (!isSecond) return existing > 0 ? existing : null;
  return existing > 0 ? round2(existing * ONE_AT_A_TIME.secondOrderFactor) : null;
}

/** 4-digit pickup code shown to the driver at the counter. */
export function generatePickupCode(): string {
  return String(Math.floor(1000 + Math.random() * 9000));
}

/** Statuses counted as "still before pickup" for gating purposes. */
export const PRE_PICKUP_STATUSES = ["accepted", "preparing", "ready", "arrived"] as const;

/** Statuses counted as "on the driver" (all active work). */
export const ACTIVE_STATUSES = [...PRE_PICKUP_STATUSES, "picked_up"] as const;
