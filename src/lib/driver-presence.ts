/** Fresh GPS heartbeat = driver is present for admin Online + dispatch. */
export const DRIVER_PRESENCE_ONLINE_MS = 10 * 60 * 1000;

export function isDriverPresenceOnline(
  lastLocationAt: string | null | undefined,
  nowMs: number = Date.now(),
  windowMs: number = DRIVER_PRESENCE_ONLINE_MS,
): boolean {
  if (!lastLocationAt) return false;
  const t = new Date(lastLocationAt).getTime();
  if (!Number.isFinite(t)) return false;
  return nowMs - t < windowMs;
}
