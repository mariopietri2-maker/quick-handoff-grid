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

export function openGoogleMapsNavigation(target: NavigationTarget) {
  const url = getGoogleMapsNavigationUrl(target);
  if (!url) return;
  window.location.assign(url);
}
