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

/** In-memory cache for the current session (shared across calls). */
const memCache = new Map<string, GeocodeResult | null>();
const LS_PREFIX = 'geo:v1:';

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

/** Pre-warm the Mapbox token. Call once at app boot to remove first-use latency. */
export function warmMapboxToken(): void { void getMapboxToken(); }

/**
 * Forward-geocode an address using Mapbox. Returns null if not found / no token.
 * Biased to Greece (GR). Cached in memory + localStorage so repeat lookups are instant.
 * Falls back from limit=1 to a 5-result search if the first attempt is empty.
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

  const token = await getMapboxToken();
  if (!token) return null;

  const fetchOnce = async (limit: number) => {
    const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(
      q,
    )}.json?access_token=${token}&country=gr&limit=${limit}&language=el&autocomplete=true`;
    const res = await fetch(url);
    if (!res.ok) return null;
    const json = await res.json();
    const feat = json?.features?.[0];
    if (!feat?.center) return null;
    const [lng, lat] = feat.center as [number, number];
    return { latitude: lat, longitude: lng, formatted: feat.place_name ?? q } as GeocodeResult;
  };

  let result: GeocodeResult | null = null;
  try {
    result = await fetchOnce(1);
    if (!result) result = await fetchOnce(5); // wider net for partial / fuzzy addresses
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
