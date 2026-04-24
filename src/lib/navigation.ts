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

      // Build platform-specific URI that forces the OS to open the Google Maps app
      let nativeUri: string | null = null;
      if (platform === 'android') {
        // Android intent that opens Google Maps with turn-by-turn navigation
        nativeUri = hasCoords
          ? `geo:${target.lat},${target.lng}?q=${target.lat},${target.lng}`
          : target.address
            ? `geo:0,0?q=${encodeURIComponent(target.address)}`
            : null;
      } else if (platform === 'ios') {
        // comgooglemaps:// scheme — only works if Google Maps app is installed
        nativeUri = hasCoords
          ? `comgooglemaps://?daddr=${target.lat},${target.lng}&directionsmode=driving`
          : target.address
            ? `comgooglemaps://?q=${encodeURIComponent(target.address)}`
            : null;
      }

      // Use Capacitor App plugin to fire the native intent / URL scheme
      try {
        const { App } = await import('@capacitor/app');
        if (nativeUri) {
          await App.openUrl({ url: nativeUri });
          return;
        }
        // Fallback to https URL via App.openUrl (still uses external handler)
        await App.openUrl({ url });
        return;
      } catch {
        // App plugin failed — last resort
        window.location.href = nativeUri ?? url;
        return;
      }
    }
  } catch {
    // Capacitor not available — web behavior below
  }

  // Web fallback: open in a new tab
  const win = window.open(url, '_blank', 'noopener,noreferrer');
  if (!win) window.location.href = url;
}
