import { supabase } from '@/integrations/supabase/client';

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

/** No-op kept for backwards compat (Google is invoked on-demand via edge function). */
export function warmMapboxToken(): void { /* deprecated — kept to avoid breaking imports */ }

/**
 * Forward-geocode an address using Google Geocoding API (via secure edge function).
 * Biased to Greece (GR). Cached in memory + localStorage so repeat lookups are instant.
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
    const { data, error } = await supabase.functions.invoke('google-geocode', {
      method: 'GET' as any,
      body: undefined,
      headers: {},
      // supabase-js doesn't natively support GET query params — fall back to fetch
    } as any);
    if (error || !data) {
      // Fallback: direct fetch with query string
      const base = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/google-geocode?q=${encodeURIComponent(q)}`;
      const res = await fetch(base, {
        headers: { apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string },
      });
      const json = await res.json();
      result = json?.result ?? null;
    } else {
      result = (data as any)?.result ?? null;
    }
  } catch { result = null; }

  // Always retry via direct fetch with query param to ensure correctness
  if (!result) {
    try {
      const base = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/google-geocode?q=${encodeURIComponent(q)}`;
      const res = await fetch(base, {
        headers: { apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string },
      });
      const json = await res.json();
      result = json?.result ?? null;
    } catch { /* ignore */ }
  }

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
