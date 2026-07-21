/** Canonical public site while Vercel builds are rate-limited. */
export const SITE_ORIGIN = 'https://quick-handoff-grid-production.up.railway.app';

/** Legacy / fallback hosts still allowed for Capacitor navigation & deep links. */
export const SITE_FALLBACK_ORIGINS = [
  'https://quick-handoff-grid.vercel.app',
  'https://freshdelivery.app',
] as const;

export function absoluteUrl(path = '/'): string {
  const p = path.startsWith('/') ? path : `/${path}`;
  return `${SITE_ORIGIN.replace(/\/$/, '')}${p}`;
}
