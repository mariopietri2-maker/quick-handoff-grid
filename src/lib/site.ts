/** Canonical public production origins. `SITE_ORIGIN` is the primary serving
 *  host; the rest are mirrors that serve the same SPA. Keep in sync with
 *  Capacitor `allowNavigation` lists. */
export const SITE_ORIGINS = [
  'https://quick-handoff-grid-8qu8.vercel.app',
  'https://freshdelivery.app',
  'https://fresh-delivery-rho.vercel.app',
  'https://quick-handoff-grid-production.up.railway.app',
] as const;

/** Primary production host (Vercel). */
export const SITE_ORIGIN = SITE_ORIGINS[0];

/** Optional extra hosts still allowed for Capacitor navigation & deep links. */
export const SITE_FALLBACK_ORIGINS = SITE_ORIGINS.slice(1) as readonly string[];

/** The origin the current page is actually served from, when it is one of ours. */
export function currentOrigin(): string | null {
  if (typeof window === 'undefined') return null;
  const o = window.location.origin;
  return SITE_ORIGINS.some((h) => new URL(h).host === new URL(o).host) ? o : null;
}

/** Same as `currentOrigin()`, but falls back to the primary origin. */
export function effectiveOrigin(): string {
  return currentOrigin() ?? SITE_ORIGIN;
}

export function absoluteUrl(path = '/'): string {
  const p = path.startsWith('/') ? path : `/${path}`;
  return `${SITE_ORIGIN.replace(/\/$/, '')}${p}`;
}

/** Full URL for `path` on the host the user is already on when possible. */
export function relativeUrlToOrigin(path: string, origin = effectiveOrigin()): string {
  const p = path.startsWith('/') ? path : `/${path}`;
  return `${origin.replace(/\/$/, '')}${p}`;
}

/**
 * Responds with the first origin that serves the SPA. Used to pick a healthy
 * host for absolute links (e.g. QR landing pages).
 */
export async function pickHealthyOrigin(path = '/'): Promise<string> {
  const current = currentOrigin();
  if (current) return current;
  for (const origin of SITE_ORIGINS) {
    try {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), 3500);
      const res = await fetch(relativeUrlToOrigin(path, origin), {
        redirect: 'follow',
        signal: ctrl.signal,
        headers: { accept: 'text/html' },
      });
      clearTimeout(t);
      if (res.ok) return origin;
    } catch {
      // next origin
    }
  }
  return SITE_ORIGIN;
}

/**
 * Fetch through the app origins with failover: tries `SITE_ORIGIN` first, then
 * each `SITE_FALLBACK_ORIGINS` entry. Only fails over for network errors / 5xx.
 */
export async function fetchWithOriginFailover(
  path: string,
  init?: RequestInit,
): Promise<Response> {
  const errors: unknown[] = [];
  for (const origin of SITE_ORIGINS) {
    try {
      const res = await fetch(relativeUrlToOrigin(path, origin), init);
      if (res.ok || (res.status >= 400 && res.status < 500)) return res;
      errors.push(new Error(`${origin} → ${res.status}`));
    } catch (e) {
      errors.push(e);
    }
  }
  throw errors[errors.length - 1] ?? new Error('All origins failed');
}
