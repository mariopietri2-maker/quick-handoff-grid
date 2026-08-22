import { minutesUntilReady } from '@/lib/driver-ready-eta';

/** City average incl. lights, stops and parking walks. */
const AVG_CITY_KMH = 26;

/** Hourly rate considered a good deal for drivers. */
export const GOOD_EUR_PER_HOUR = 12;

/**
 * Estimated minutes an offer occupies the driver:
 * remaining prep wait + drive legs (~city average).
 */
export function estimateOfferMinutes(opts: {
  distanceKm?: number | null;
  predictedReadyAt?: string | null;
  orderStatus?: string | null;
  estimatedPrepMin?: number | null;
}): number {
  const km = Math.max(0, Number(opts.distanceKm ?? 0));
  const driveMin = Math.max(3, Math.round((km / AVG_CITY_KMH) * 60));
  if (opts.orderStatus === 'ready') return driveMin;
  const prepMin =
    minutesUntilReady(opts.predictedReadyAt) ??
    (opts.estimatedPrepMin != null && opts.estimatedPrepMin > 0 ? opts.estimatedPrepMin : 10);
  return prepMin + driveMin;
}

/** Effective hourly rate (€/h), or null when unknown. */
export function eurosPerHour(payoutEur: number, totalMinutes: number): number | null {
  if (!Number.isFinite(payoutEur) || !totalMinutes || totalMinutes <= 0) return null;
  return (payoutEur / totalMinutes) * 60;
}
