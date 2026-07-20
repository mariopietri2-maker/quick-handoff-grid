import type { DistanceUnit, NavApp } from '@/lib/driver-app-prefs';

/** Format meters using driver distance preference. */
export function formatDriverDistance(meters: number, unit: DistanceUnit = 'km'): string {
  const m = Math.max(0, Number(meters) || 0);
  if (unit === 'mi') {
    const miles = m / 1609.344;
    if (miles < 0.1) return `${Math.round(m * 3.28084)} ft`;
    return `${miles.toFixed(1)} mi`;
  }
  if (m < 1000) return `${Math.round(m)} μ`;
  return `${(m / 1000).toFixed(1)} χλμ`;
}

/** Build an external navigation deep-link for the driver's preferred app. */
export function buildExternalNavUrl(
  lat: number,
  lng: number,
  app: NavApp = 'google',
  label?: string,
): string {
  const qLabel = label ? encodeURIComponent(label) : '';
  switch (app) {
    case 'waze':
      return `https://waze.com/ul?ll=${lat},${lng}&navigate=yes`;
    case 'apple':
      return `https://maps.apple.com/?daddr=${lat},${lng}${qLabel ? `&q=${qLabel}` : ''}`;
    case 'google':
    default:
      return `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}${
        qLabel ? `&destination_place_id=&travelmode=driving` : '&travelmode=driving'
      }`;
  }
}

export function openExternalNav(lat: number, lng: number, app: NavApp = 'google', label?: string) {
  const url = buildExternalNavUrl(lat, lng, app, label);
  window.open(url, '_blank', 'noopener,noreferrer');
}
