import { haversineKm } from '@/lib/geocode';

/** Canonical service city — fresh2go operates in Ioannina only. */
export const IOANNINA_CENTER = {
  lat: 39.6650,
  lng: 20.8537,
} as const;

/** Mapbox / MapLibre center as [lng, lat]. */
export const IOANNINA_MAP_CENTER: [number, number] = [
  IOANNINA_CENTER.lng,
  IOANNINA_CENTER.lat,
];

/**
 * Delivery coverage radius (km) around Ioannina center.
 * Covers the city basin + nearby villages (Ανατολή, Κατσικάς, Πεδινή, Πέραμα, …).
 * Must stay in sync with the seeded `service_zones` row.
 */
export const IOANNINA_SERVICE_RADIUS_KM = 18;

/**
 * Mapbox Geocoding bbox for Ioannina + surroundings
 * (minLng, minLat, maxLng, maxLat) — roughly matches the 18 km circle with margin.
 */
export const IOANNINA_GEOCODE_BBOX = '20.55,39.45,21.20,39.90';

/** Google Geocoding `bounds` southwest|northeast for the same area. */
export const IOANNINA_GOOGLE_BOUNDS = '39.45,20.55|39.90,21.20';

export function isWithinIoanninaServiceArea(
  lat: number,
  lng: number,
  radiusKm: number = IOANNINA_SERVICE_RADIUS_KM,
): boolean {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return false;
  return (
    haversineKm(
      { latitude: IOANNINA_CENTER.lat, longitude: IOANNINA_CENTER.lng },
      { latitude: lat, longitude: lng },
    ) <= radiusKm
  );
}

export const OUT_OF_ZONE_MESSAGE =
  'Η διεύθυνση είναι εκτός ζώνης κάλυψης (Ιωάννινα και γύρω περιοχή).';
