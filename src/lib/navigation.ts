export interface NavigationTarget {
  lat?: number | null;
  lng?: number | null;
  address?: string | null;
}

export function getGoogleMapsNavigationUrl({ lat, lng, address }: NavigationTarget) {
  if (lat != null && lng != null) {
    const destination = encodeURIComponent(`${lat},${lng}`);
    return `https://www.google.com/maps/dir/?api=1&destination=${destination}&travelmode=driving`;
  }

  const query = address?.trim();
  if (query) {
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
  }

  return null;
}

export async function openGoogleMapsNavigation(target: NavigationTarget) {
  const url = getGoogleMapsNavigationUrl(target);
  if (!url) return;

  // On native (Capacitor), force-open in the OS — this triggers the Google Maps app via intent
  try {
    const { Capacitor } = await import('@capacitor/core');
    if (Capacitor.isNativePlatform()) {
      // Prefer the geo: scheme on Android so the Maps app opens directly with route
      if (Capacitor.getPlatform() === 'android' && target.lat != null && target.lng != null) {
        const geoUrl = `google.navigation:q=${target.lat},${target.lng}&mode=d`;
        // _system tells Capacitor to hand the URL to the OS — fires Android intent
        window.open(geoUrl, '_system');
        return;
      }
      window.open(url, '_system');
      return;
    }
  } catch {
    // Capacitor not available — fall through to web behavior
  }

  // Web fallback: open in a new tab
  const win = window.open(url, '_blank', 'noopener,noreferrer');
  if (!win) window.location.href = url;
}
