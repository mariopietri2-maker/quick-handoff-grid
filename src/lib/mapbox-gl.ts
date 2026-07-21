/**
 * Shared Mapbox GL setup for Vite.
 * Registers the CSP worker once so style/tiles paint reliably
 * (blob workers are blocked in some Capacitor / strict CSP contexts).
 */
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import mapboxWorkerUrl from 'mapbox-gl/dist/mapbox-gl-csp-worker.js?url';

let configured = false;

export function ensureMapboxWorker() {
  if (configured || typeof window === 'undefined') return;
  try {
    mapboxgl.workerUrl = mapboxWorkerUrl;
  } catch {
    /* keep Mapbox default worker */
  }
  configured = true;
}

ensureMapboxWorker();

export { mapboxgl };
export default mapboxgl;
