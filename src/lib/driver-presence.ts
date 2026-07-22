/** Fresh GPS heartbeat = driver is truly present (app open / foreground). */
export const DRIVER_PRESENCE_ONLINE_MS = 3 * 60 * 1000;

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
