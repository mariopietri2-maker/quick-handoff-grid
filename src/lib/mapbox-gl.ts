/**
 * Shared Mapbox GL setup for Vite.
 * Use the default mapbox-gl worker (blob). Do NOT point workerUrl at the
 * CSP worker while importing the standard mapbox-gl build — that mismatch
 * blanks the canvas in many browsers / WebViews.
 */
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';

export function ensureMapboxWorker() {
  // Intentionally no-op: mapbox-gl ships a working default worker.
}

export { mapboxgl };
export default mapboxgl;
