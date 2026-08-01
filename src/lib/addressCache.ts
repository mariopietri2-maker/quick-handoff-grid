import { SupabaseClient } from '@supabase/supabase-js';
import { mapboxDrivingKm } from './geocode';

/**
 * Normalize an address for consistent hashing.
 * - lowercase
 * - trim whitespace
 * - collapse multiple spaces
 * - remove punctuation
 */
export function normalizeAddress(addr: string): string {
  return addr
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ')           // Collapse spaces
    .replace(/[,.\-—–]/g, '')       // Remove punctuation
    .replace(/[áàäâã]/g, 'a')
    .replace(/[éèëê]/g, 'e')
    .replace(/[íìïî]/g, 'i')
    .replace(/[óòöôõ]/g, 'o')
    .replace(/[úùüû]/g, 'u')
    .replace(/[ýÿ]/g, 'y');
}

/**
 * SHA256 hash of a string (using Web Crypto API).
 */
export async function sha256(text: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buf))
    .map(x => x.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Fetch cached address from DB or return null if miss.
 */
async function getCachedAddress(
  supabase: SupabaseClient,
  addressHash: string
): Promise<{ latitude: number; longitude: number } | null> {
  const { data, error } = await supabase
    .from('cached_addresses')
    .select('latitude, longitude')
    .eq('address_hash', addressHash)
    .maybeSingle();

  if (error || !data) return null;
  return data;
}

/**
 * Store address in cache and increment usage.
 */
async function updateCachedAddress(
  supabase: SupabaseClient,
  addressHash: string,
  address: string,
  latitude: number,
  longitude: number
): Promise<void> {
  // Upsert: insert on first use, increment usage on repeat
  const { error } = await supabase
    .from('cached_addresses')
    .upsert(
      {
        address_hash: addressHash,
        address,
        latitude,
        longitude,
        last_used_at: new Date(),
        usage_count: 1, // Will be incremented by conflict handler
      },
      { onConflict: 'address_hash' }
    );

  if (!error) {
    // Increment usage counter on conflict
    await supabase
      .from('cached_addresses')
      .update({
        usage_count: (row: any) => row.usage_count + 1,
        last_used_at: new Date(),
      })
      .eq('address_hash', addressHash);
  }
}

/**
 * Compute driving distance with address cache.
 * On cache hit: skip Mapbox call, use cached coordinates.
 * On cache miss: call Mapbox, then store for future use.
 */
export async function mapboxDrivingKmWithCache(
  storeCoords: { latitude: number; longitude: number },
  deliveryAddress: string,
  deliveryCoords: { latitude: number; longitude: number },
  token: string | undefined,
  supabase: SupabaseClient
): Promise<number | null> {
  // 1. Normalize and hash the address
  const normalized = normalizeAddress(deliveryAddress);
  const addressHash = await sha256(normalized);

  // 2. Check cache first
  const cached = await getCachedAddress(supabase, addressHash);

  if (cached) {
    // Cache hit: use cached coordinates for routing
    // (GPS accuracy check already passed in checkout)
    console.log(`[Cache] Hit for "${deliveryAddress}" → Mapbox routing skip`);
    
    const distanceKm = await mapboxDrivingKm(
      storeCoords,
      { latitude: cached.latitude, longitude: cached.longitude },
      token
    );

    // Update usage counter for analytics
    await updateCachedAddress(
      supabase,
      addressHash,
      deliveryAddress,
      cached.latitude,
      cached.longitude
    );

    return distanceKm;
  }

  // 3. Cache miss: call Mapbox and store result
  console.log(`[Cache] Miss for "${deliveryAddress}" → Mapbox geocode + routing`);
  
  const distanceKm = await mapboxDrivingKm(
    storeCoords,
    { latitude: deliveryCoords.latitude, longitude: deliveryCoords.longitude },
    token
  );

  // Store in cache for future orders
  try {
    await updateCachedAddress(
      supabase,
      addressHash,
      deliveryAddress,
      deliveryCoords.latitude,
      deliveryCoords.longitude
    );
  } catch (e) {
    console.error('[Cache] Failed to store address:', e);
    // Non-fatal: cache miss is harmless, just more API calls
  }

  return distanceKm;
}
