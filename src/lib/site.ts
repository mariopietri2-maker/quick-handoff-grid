/** Canonical public production origin (Railway only). */
export const SITE_ORIGIN = 'https://quick-handoff-grid-production.up.railway.app';

/** Extra hosts still allowed for Capacitor navigation & deep links. */
export const SITE_FALLBACK_ORIGINS = [
  'https://freshdelivery.app',
] as const;

export function absoluteUrl(path = '/'): string {
  const p = path.startsWith('/') ? path : `/${path}`;
  return `${SITE_ORIGIN.replace(/\/$/, '')}${p}`;
}
