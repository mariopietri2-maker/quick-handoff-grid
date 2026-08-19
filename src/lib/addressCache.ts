import { SupabaseClient } from '@supabase/supabase-js';
import { mapboxDrivingKm, rememberGeocode } from './geocode';

interface CachedRoute {
  km: number;
  at: number;
}

const routeMem = new Map<string, CachedRoute>();
const ROUTE_LS_KEY = 'route:v1';
const ROUTE_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const ROUTE_MAX_LS = 300;

/**
 * Normalize an address for consistent hashing.
 */
export function normalizeAddress(addr: string): string {
  return addr
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/[,.\-—–']/g, '')
    .replace(/[áàäâã]/g, 'a')
    .replace(/[éèëê]/g, 'e')
    .replace(/[íìïî]/g, 'i')
    .replace(/[óòöôõ]/g, 'o')
    .replace(/[úùüû]/g, 'u')
    .replace(/[ýÿ]/g, 'y');
}

/** Stable ~110m route key (matches route_cache_key on the server). */
function routeKey(
  from: { latitude: number; longitude: number },
  to: { latitude: number; longitude: number },
): string {
  const p = (n: number) => n.toFixed(3);
  return `${p(from.latitude)},${p(from.longitude)}->${p(to.latitude)},${p(to.longitude)}`;
}

function readRouteLS(key: string): number | null {
  try {
    const map = JSON.parse(localStorage.getItem(ROUTE_LS_KEY) || '{}') as Record<string, CachedRoute>;
    const hit = map[key];
    if (hit && typeof hit.km === 'number' && Date.now() - hit.at < ROUTE_TTL_MS) return hit.km;
    return null;
  } catch {
    return null;
  }
}

function writeRouteLS(key: string, km: number) {
  try {
    const map = JSON.parse(localStorage.getItem(ROUTE_LS_KEY) || '{}') as Record<string, CachedRoute>;
    map[key] = { km, at: Date.now() };
    const entries = Object.entries(map);
    if (entries.length > ROUTE_MAX_LS) {
      entries.sort((a, b) => a[1].at - b[1].at);
      entries.slice(0, entries.length - ROUTE_MAX_LS).forEach(([k]) => delete map[k]);
    }
    localStorage.setItem(ROUTE_LS_KEY, JSON.stringify(map));
  } catch {}
}

/**
 * Driving distance in km with a 4-layer cache (session → localStorage →
 * shared Supabase route_cache → Mapbox Directions). Cuts Directions billing
 * for repeat store→delivery pairs to near zero.
 */
export async function mapboxDrivingKmWithCache(
  storeCoords: { latitude: number; longitude: number },
  deliveryAddress: string,
  deliveryCoords: { latitude: number; longitude: number },
  token: string | undefined,
  supabase: SupabaseClient,
): Promise<number | null> {
  // Always remember the delivery pin for future customers / reverse-geocode.
  void rememberGeocode(
    deliveryAddress,
    {
      latitude: deliveryCoords.latitude,
      longitude: deliveryCoords.longitude,
      formatted: deliveryAddress,
    },
    'checkout',
  );

  if (
    ![storeCoords.latitude, storeCoords.longitude, deliveryCoords.latitude, deliveryCoords.longitude]
      .every(Number.isFinite)
  ) {
    return null;
  }

  const key = routeKey(storeCoords, deliveryCoords);

  const mem = routeMem.get(key);
  if (mem && Date.now() - mem.at < ROUTE_TTL_MS) return mem.km;
  const ls = readRouteLS(key);
  if (ls != null) {
    routeMem.set(key, { km: ls, at: Date.now() });
    return ls;
  }

  try {
    const { data } = await (supabase as any).rpc('lookup_route_distance', {
      p_from_lat: storeCoords.latitude,
      p_from_lng: storeCoords.longitude,
      p_to_lat: deliveryCoords.latitude,
      p_to_lng: deliveryCoords.longitude,
    });
    const row = Array.isArray(data) ? data[0] : data;
    if (row?.distance_km != null) {
      const km = Number(row.distance_km);
      routeMem.set(key, { km, at: Date.now() });
      writeRouteLS(key, km);
      return km;
    }
  } catch { /* fall through to Mapbox */ }

  const km = await mapboxDrivingKm(storeCoords, deliveryCoords, token);
  if (km == null) return null;

  routeMem.set(key, { km, at: Date.now() });
  writeRouteLS(key, km);
  try {
    await (supabase as any).rpc('remember_route_distance', {
      p_from_lat: storeCoords.latitude,
      p_from_lng: storeCoords.longitude,
      p_to_lat: deliveryCoords.latitude,
      p_to_lng: deliveryCoords.longitude,
      p_distance_km: km,
    });
  } catch { /* shared cache is best-effort */ }

  return km;
}