/**
 * Thin wrapper around the local Capacitor Mapbox Maps plugin.
 * Safe to import on web — isNativeAvailable() returns false outside Android.
 */
import { Capacitor } from '@capacitor/core';

export async function openNativeMapboxMap(opts: {
  lat: number;
  lng: number;
  zoom?: number;
  markers?: Array<{ id: string; lat: number; lng: number; title?: string }>;
  styleUri?: string;
}): Promise<boolean> {
  if (Capacitor.getPlatform() !== 'android') return false;

  try {
    const { MapboxMaps } = await import('@fresh2go/capacitor-mapbox-maps');
    const { available } = await MapboxMaps.isNativeAvailable();
    if (!available) return false;

    const token = (import.meta.env.VITE_MAPBOX_TOKEN as string | undefined)?.replace(/^["']|["']$/g, '').trim();
    if (token) {
      await MapboxMaps.initialize({ accessToken: token });
    }

    await MapboxMaps.createMap({
      fullScreen: true,
      center: { lat: opts.lat, lng: opts.lng },
      zoom: opts.zoom ?? 14,
      styleUri: opts.styleUri ?? 'mapbox://styles/mapbox/streets-v12',
      markers: opts.markers,
    });
    return true;
  } catch (e) {
    console.warn('[native-mapbox] unavailable', e);
    return false;
  }
}
