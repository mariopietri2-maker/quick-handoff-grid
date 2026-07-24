export interface GeocodeResult {
  latitude: number;
  longitude: number;
  formatted: string;
}

/** In-memory cache for the current session (shared across calls). */
const memCache = new Map<string, GeocodeResult | null>();
const LS_PREFIX = 'geo:v2:';

function readLS(key: string): GeocodeResult | null | undefined {
  try {
    const raw = localStorage.getItem(LS_PREFIX + key);
    if (!raw) return undefined;
    return JSON.parse(raw);
  } catch { return undefined; }
}
function writeLS(key: string, val: GeocodeResult | null) {
  try { localStorage.setItem(LS_PREFIX + key, JSON.stringify(val)); } catch { /* quota */ }
}

/** No-op kept for backwards compat with old DriverApp boot warmup. */
export function warmMapboxToken(): void { /* Google API is invoked on demand */ }

/**
 * Forward-geocode an address via the secure `google-geocode` edge function
 * (Google Geocoding API, biased to Greece). Cached in memory + localStorage.
 */
export async function geocodeAddress(address: string): Promise<GeocodeResult | null> {
  const q = address?.trim();
  if (!q) return null;
  const key = q.toLowerCase();

  if (memCache.has(key)) return memCache.get(key) ?? null;
  const cached = readLS(key);
  if (cached !== undefined) {
    memCache.set(key, cached);
    return cached;
  }

  let result: GeocodeResult | null = null;
  try {
    const { supabase } = await import('@/integrations/supabase/client');
    const { data, error } = await supabase.functions.invoke('google-geocode', {
      body: { q },
    });
    if (!error) {
      result = (data as any)?.result ?? null;
    }
  } catch { result = null; }

  memCache.set(key, result);
  writeLS(key, result);
  return result;
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

/**
 * Mapbox driving (road) distance in km. Returns null if token/routing fails.
 * Server validates against haversine via resolve_delivery_distance_km.
 */
export async function mapboxDrivingKm(
  from: { latitude: number; longitude: number },
  to: { latitude: number; longitude: number },
  accessToken: string | null | undefined,
): Promise<number | null> {
  const token = accessToken?.trim();
  if (!token) return null;
  if (![from.latitude, from.longitude, to.latitude, to.longitude].every(Number.isFinite)) {
    return null;
  }
  try {
    const url =
      `https://api.mapbox.com/directions/v5/mapbox/driving/` +
      `${from.longitude},${from.latitude};${to.longitude},${to.latitude}` +
      `?access_token=${encodeURIComponent(token)}&overview=false`;
    const res = await fetch(url);
    if (!res.ok) return null;
    const json = await res.json();
    const meters = json?.routes?.[0]?.distance;
    if (typeof meters !== 'number' || !Number.isFinite(meters) || meters <= 0) return null;
    return +(meters / 1000).toFixed(2);
  } catch {
    return null;
  }
}
