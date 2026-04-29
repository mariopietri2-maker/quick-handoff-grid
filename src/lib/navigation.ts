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

  try {
    const { Capacitor } = await import('@capacitor/core');

    if (Capacitor.isNativePlatform()) {
      const platform = Capacitor.getPlatform();
      const hasCoords = target.lat != null && target.lng != null;

      if (platform === 'android') {
        // Use Google Maps Android intent — forces the Maps app to handle it.
        // The geo: URI is intercepted by Android and routed to the Maps app.
        const intentUrl = hasCoords
          ? `geo:${target.lat},${target.lng}?q=${target.lat},${target.lng}(Destination)`
          : target.address
            ? `geo:0,0?q=${encodeURIComponent(target.address)}`
            : null;

        if (intentUrl) {
          // Assigning to window.location.href triggers the Android URI handler,
          // which opens the Maps app outside the WebView.
          window.location.href = intentUrl;
          return;
        }
      } else if (platform === 'ios') {
        // Try the Google Maps iOS scheme first; if not installed, fall back to Apple Maps.
        const gmapsUri = hasCoords
          ? `comgooglemaps://?daddr=${target.lat},${target.lng}&directionsmode=driving`
          : target.address
            ? `comgooglemaps://?q=${encodeURIComponent(target.address)}`
            : null;

        if (gmapsUri) {
          // Attempt to open Google Maps app; iOS will silently ignore if not installed.
          window.location.href = gmapsUri;
          // Fallback to Apple Maps after a short delay if Google Maps didn't open
          setTimeout(() => {
            const appleUri = hasCoords
              ? `maps://?daddr=${target.lat},${target.lng}&dirflg=d`
              : `maps://?q=${encodeURIComponent(target.address ?? '')}`;
            window.location.href = appleUri;
          }, 1500);
          return;
        }
      }

      // Fallback for native if no coords/address scheme path matched
      window.location.href = url;
      return;
    }
  } catch {
    // Capacitor not available — web behavior below
  }

  // Web fallback: ALWAYS open in a new tab — never navigate the current view.
  // Using a synthetic <a> click is more reliable than window.open against
  // popup blockers, sandboxed iframes, and embedded preview environments,
  // and guarantees the link opens externally instead of replacing the app.
  const a = document.createElement('a');
  a.href = url;
  a.target = '_blank';
  a.rel = 'noopener noreferrer';
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}
