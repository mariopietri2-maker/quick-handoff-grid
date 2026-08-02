import { SupabaseClient } from '@supabase/supabase-js';
import { mapboxDrivingKm, rememberGeocode } from './geocode';

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

/**
 * Compute driving distance with address cache.
 * Cache hit still needs Mapbox *directions* (road km), but avoids re-geocoding.
 */
export async function mapboxDrivingKmWithCache(
  storeCoords: { latitude: number; longitude: number },
  deliveryAddress: string,
  deliveryCoords: { latitude: number; longitude: number },
  token: string | undefined,
  _supabase: SupabaseClient,
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

  return mapboxDrivingKm(storeCoords, deliveryCoords, token);
}
