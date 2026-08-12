export interface GeocodeResult {
  latitude: number;
  longitude: number;
  formatted: string;
}

/** In-memory cache for the current session (shared across calls). */
const memCache = new Map<string, GeocodeResult | null>();
const LS_PREFIX = 'geo:v3:';

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

function normalizeKey(address: string): string {
  return address.trim().toLowerCase().replace(/\s+/g, ' ');
}

/** Persist resolved coords into shared DB cache (other customers reuse). */
export async function rememberGeocode(
  query: string,
  result: GeocodeResult,
  _source = 'client',
): Promise<void> {
  const q = query?.trim();
  if (!q || !result) return;
  const key = normalizeKey(q);
  memCache.set(key, result);
  writeLS(key, result);
  try {
    const { supabase } = await import('@/integrations/supabase/client');
    await (supabase as any).rpc('remember_address_geocode', {
      p_q: q,
      p_display: result.formatted || q,
      p_lat: result.latitude,
      p_lng: result.longitude,
      p_source: _source,
    });
  } catch { /* local cache still helps */ }
}

/** Shared DB autocomplete suggestions — no Mapbox cost. */
export async function suggestCachedAddresses(query: string, limit = 8): Promise<GeocodeResult[]> {
  const q = query?.trim();
  if (!q || q.length < 3) return [];
  try {
    const { supabase } = await import('@/integrations/supabase/client');
    const { data, error } = await (supabase as any).rpc('suggest_cached_addresses', {
      p_q: q,
      p_limit: limit,
    });
    if (error || !data) return [];
    return (data as Array<{ display_address: string; latitude: number; longitude: number }>).map((row) => ({
      formatted: row.display_address,
      latitude: Number(row.latitude),
      longitude: Number(row.longitude),
    }));
  } catch {
    return [];
  }
}

/** Nearby cache hit for reverse-geocode (~40 m). */
export async function lookupGeocodeNearby(
  lat: number,
  lng: number,
  radiusM = 40,
): Promise<GeocodeResult | null> {
  try {
    const { supabase } = await import('@/integrations/supabase/client');
    const { data, error } = await (supabase as any).rpc('lookup_address_geocode_nearby', {
      p_lat: lat,
      p_lng: lng,
      p_radius_m: radiusM,
    });
    if (error || !data?.length) return null;
    const row = data[0];
    return {
      formatted: row.display_address,
      latitude: Number(row.latitude),
      longitude: Number(row.longitude),
    };
  } catch {
    return null;
  }
}

/** Save on signed-in customer + shared cache. */
export async function rememberMyDeliveryAddress(
  address: string,
  lat?: number | null,
  lng?: number | null,
  label = 'Σπίτι',
): Promise<void> {
  const q = address?.trim();
  if (!q || q.length < 5) return;
  try {
    localStorage.setItem('customer_delivery_address', q);
    if (lat != null && lng != null) {
      localStorage.setItem('customer_delivery_coords', JSON.stringify({ lat, lon: lng }));
    }
  } catch { /* ignore */ }
  try {
    const { supabase } = await import('@/integrations/supabase/client');
    await (supabase as any).rpc('remember_my_delivery_address', {
      p_address: q,
      p_lat: lat ?? null,
      p_lng: lng ?? null,
      p_label: label,
    });
  } catch { /* guest */ }
  if (lat != null && lng != null) {
    void rememberGeocode(q, { latitude: lat, longitude: lng, formatted: q }, 'saved_address');
  }
}

/**
 * Forward-geocode: memory → localStorage → shared DB → google-geocode edge.
 */
export async function geocodeAddress(address: string): Promise<GeocodeResult | null> {
  const q = address?.trim();
  if (!q) return null;
  const key = normalizeKey(q);

  if (memCache.has(key)) return memCache.get(key) ?? null;
  const cached = readLS(key);
  if (cached !== undefined) {
    memCache.set(key, cached);
    return cached;
  }

  try {
    const { supabase } = await import('@/integrations/supabase/client');
    const { data } = await (supabase as any).rpc('lookup_address_geocode', { p_q: q });
    const row = Array.isArray(data) ? data[0] : data;
    if (row?.latitude != null && row?.longitude != null) {
      const result: GeocodeResult = {
        latitude: Number(row.latitude),
        longitude: Number(row.longitude),
        formatted: row.display_address || q,
      };
      memCache.set(key, result);
      writeLS(key, result);
      return result;
    }
  } catch { /* fall through */ }

  let result: GeocodeResult | null = null;
  try {
    const { supabase } = await import('@/integrations/supabase/client');
    const { data, error } = await supabase.functions.invoke('google-geocode', {
      body: { q },
    });
    if (!error) {
      const r = (data as any)?.result;
      if (r?.latitude != null && r?.longitude != null) {
        result = {
          latitude: Number(r.latitude),
          longitude: Number(r.longitude),
          formatted: r.formatted || q,
        };
      }
    }
  } catch { result = null; }

  memCache.set(key, result);
  writeLS(key, result);
  if (result) void rememberGeocode(q, result, 'google');
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
