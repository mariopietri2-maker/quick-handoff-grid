import { supabase } from '@/integrations/supabase/client';

let tokenPromise: Promise<string | null> | null = null;

async function getMapboxToken(): Promise<string | null> {
  if (!tokenPromise) {
    tokenPromise = supabase.functions
      .invoke('get-mapbox-token')
      .then(({ data, error }) => (!error && data?.token ? (data.token as string) : null))
      .catch(() => null);
  }
  const token = await tokenPromise;
  // If the fetch failed, clear the cache so the next call retries instead of
  // permanently returning null for the rest of the session.
  if (!token) tokenPromise = null;
  return token;
}

export interface GeocodeResult {
  latitude: number;
  longitude: number;
  formatted: string;
}

/**
 * Forward-geocode an address using Mapbox. Returns null if not found / no token.
 * Biased to Greece (GR) since the platform operates locally.
 */
export async function geocodeAddress(address: string): Promise<GeocodeResult | null> {
  const q = address?.trim();
  if (!q) return null;
  const token = await getMapboxToken();
  if (!token) return null;
  try {
    const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(
      q,
    )}.json?access_token=${token}&country=gr&limit=1&language=el`;
    const res = await fetch(url);
    if (!res.ok) return null;
    const json = await res.json();
    const feat = json?.features?.[0];
    if (!feat?.center) return null;
    const [lng, lat] = feat.center as [number, number];
    return { latitude: lat, longitude: lng, formatted: feat.place_name ?? q };
  } catch {
    return null;
  }
}

/** Haversine distance in km between two coordinates. */
export function haversineKm(
  a: { latitude: number; longitude: number },
  b: { latitude: number; longitude: number },
): number {
  const R = 6371;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.latitude - a.latitude);
  const dLng = toRad(b.longitude - a.longitude);
  const lat1 = toRad(a.latitude);
  const lat2 = toRad(b.latitude);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}
