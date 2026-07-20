/**
 * Measured / documented platform capacity benchmarks.
 * Sourced from live stress runs (2026-07-20) + operational defaults.
 * Used by the Admin Capacity tab — not hard rate limiters.
 */
export const CAPACITY_BENCHMARKS = {
  /** Concurrent place_order cash burst — 100% success */
  placeOrderBurstRps: 45,
  placeOrderBurstConcurrency: 12,
  placeOrderP50Ms: 129,
  placeOrderP95Ms: 426,

  /** Sustained ops generate rate used in load-sim-orders-20pm */
  safePlacePerMinute: 20,
  safePlacePerHour: 1200,

  /** Read probe (25 concurrency, 25s) */
  readMixRps: 296,
  spaP50Ms: 7,
  postgrestP95Ms: 155,

  /** Mapbox edge token endpoint — keep well under this */
  mapboxHealthyRps: 45,
  mapboxCautionRps: 14,
  mapboxNote: 'Rare 503s / hung calls observed above ~14 sustained RPS @ high concurrency',

  /** Assumed real-world delivery cycle when no delivered samples today (minutes) */
  fallbackCycleMinutes: 25,

  /** Supply rule of thumb used elsewhere in admin */
  ordersPerDriverConcurrent: 3,

  /** Client location write cadence (cost guardrails default) */
  driverLocationIntervalSec: 15,

  measuredAt: '2026-07-20',
} as const;
