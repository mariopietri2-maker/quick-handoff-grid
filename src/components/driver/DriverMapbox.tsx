import { useEffect, useRef, useState, useCallback, forwardRef, useImperativeHandle } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { useMapboxToken } from '@/hooks/useMapboxToken';

export interface RouteInfo {
  distance: number; // meters
  duration: number; // seconds
  steps: { instruction: string; distance: number; duration: number }[];
}

interface DriverMapboxProps {
  className?: string;
  storeLat?: number | null;
  storeLng?: number | null;
  storeName?: string;
  customerLat?: number | null;
  customerLng?: number | null;
  customerName?: string;
  customerAddress?: string | null;
  navigatingTo?: 'store' | 'customer' | null;
  onRouteUpdate?: (route: RouteInfo | null) => void;
}

const DriverMapbox = forwardRef<DriverMapboxHandle, DriverMapboxProps>(function DriverMapbox({
  className,
  storeLat, storeLng, storeName,
  customerLat, customerLng, customerName, customerAddress,
  navigatingTo,
  onRouteUpdate,
}, ref) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const driverMarkerRef = useRef<mapboxgl.Marker | null>(null);
  const storeMarkerRef = useRef<mapboxgl.Marker | null>(null);
  const customerMarkerRef = useRef<mapboxgl.Marker | null>(null);
  const { token, loading } = useMapboxToken();
  const [pos, setPos] = useState<{ lat: number; lng: number } | null>(null);
  const watchRef = useRef<number | null>(null);
  const routeFetchRef = useRef<AbortController | null>(null);
  const lastRouteKey = useRef('');

  // Watch position
  useEffect(() => {
    if (!('geolocation' in navigator)) return;
    watchRef.current = navigator.geolocation.watchPosition(
      (p) => setPos({ lat: p.coords.latitude, lng: p.coords.longitude }),
      () => setPos({ lat: 39.6650, lng: 20.8537 }),
      { enableHighAccuracy: true, maximumAge: 2000, timeout: 20000 }
    );
    return () => { if (watchRef.current !== null) navigator.geolocation.clearWatch(watchRef.current); };
  }, []);

  // Init map
  useEffect(() => {
    if (!token || !mapContainer.current || mapRef.current) return;
    mapboxgl.accessToken = token;

    const map = new mapboxgl.Map({
      container: mapContainer.current,
      style: 'mapbox://styles/mapbox/navigation-night-v1',
      center: [pos?.lng ?? 20.8537, pos?.lat ?? 39.6650],
      zoom: 14,
      attributionControl: false,
      pitchWithRotate: false,
    });

    // GeolocateControl removed — custom recenter button used instead

    map.on('load', () => {
      // Route source + layers
      map.addSource('route', {
        type: 'geojson',
        data: { type: 'Feature', geometry: { type: 'LineString', coordinates: [] }, properties: {} },
      });
      // Glow layer
      map.addLayer({
        id: 'route-glow',
        type: 'line',
        source: 'route',
        paint: {
          'line-color': '#3b82f6',
          'line-width': 12,
          'line-opacity': 0.2,
          'line-blur': 8,
        },
        layout: { 'line-join': 'round', 'line-cap': 'round' },
      });
      // Border
      map.addLayer({
        id: 'route-border',
        type: 'line',
        source: 'route',
        paint: {
          'line-color': '#1d4ed8',
          'line-width': 6,
          'line-opacity': 0.6,
        },
        layout: { 'line-join': 'round', 'line-cap': 'round' },
      });
      // Main line
      map.addLayer({
        id: 'route-line',
        type: 'line',
        source: 'route',
        paint: {
          'line-color': '#3b82f6',
          'line-width': 4,
          'line-opacity': 0.9,
        },
        layout: { 'line-join': 'round', 'line-cap': 'round' },
      });
    });

    mapRef.current = map;
    return () => { map.remove(); mapRef.current = null; };
  }, [token]);

  // Update driver marker
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !pos) return;
    if (driverMarkerRef.current) {
      driverMarkerRef.current.setLngLat([pos.lng, pos.lat]);
    } else {
      const el = document.createElement('div');
      el.innerHTML = `
        <div style="position:relative;">
          <div style="width:22px;height:22px;background:#3b82f6;border-radius:50%;border:3px solid white;box-shadow:0 0 0 4px rgba(59,130,246,0.3),0 2px 8px rgba(0,0,0,0.3);"></div>
          <div style="position:absolute;top:-3px;left:-3px;width:28px;height:28px;border-radius:50%;background:rgba(59,130,246,0.2);animation:pulse 2s infinite;"></div>
        </div>`;
      driverMarkerRef.current = new mapboxgl.Marker({ element: el })
        .setLngLat([pos.lng, pos.lat])
        .addTo(map);
    }
  }, [pos]);

  // Store marker
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    storeMarkerRef.current?.remove();
    storeMarkerRef.current = null;
    if (storeLat != null && storeLng != null) {
      const el = document.createElement('div');
      const isTarget = navigatingTo === 'store';
      el.innerHTML = `<div style="width:40px;height:40px;background:${isTarget ? '#f97316' : '#f97316'};border-radius:14px;border:3px solid white;box-shadow:0 2px 16px rgba(249,115,22,0.5);display:flex;align-items:center;justify-content:center;font-size:20px;${isTarget ? 'animation:bounce 1s infinite;' : ''}">🏪</div>`;
      storeMarkerRef.current = new mapboxgl.Marker({ element: el, anchor: 'center' })
        .setLngLat([storeLng, storeLat])
        .setPopup(new mapboxgl.Popup({ offset: 24 }).setHTML(`<strong style="font-size:13px;">${storeName || 'Κατάστημα'}</strong>`))
        .addTo(map);
    }
  }, [storeLat, storeLng, storeName, navigatingTo]);

  // Customer marker
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    customerMarkerRef.current?.remove();
    customerMarkerRef.current = null;
    if (customerLat != null && customerLng != null) {
      const el = document.createElement('div');
      const isTarget = navigatingTo === 'customer';
      el.innerHTML = `<div style="width:40px;height:40px;background:#22c55e;border-radius:14px;border:3px solid white;box-shadow:0 2px 16px rgba(34,197,94,0.5);display:flex;align-items:center;justify-content:center;font-size:20px;${isTarget ? 'animation:bounce 1s infinite;' : ''}">📍</div>`;
      customerMarkerRef.current = new mapboxgl.Marker({ element: el, anchor: 'center' })
        .setLngLat([customerLng, customerLat])
        .setPopup(new mapboxgl.Popup({ offset: 24 }).setHTML(`<strong style="font-size:13px;">${customerName || 'Παράδοση'}</strong><br/><span style="font-size:11px;">${customerAddress || ''}</span>`))
        .addTo(map);
    }
  }, [customerLat, customerLng, customerName, customerAddress, navigatingTo]);

  // Fetch & draw route
  const fetchRoute = useCallback(async () => {
    const map = mapRef.current;
    if (!map || !token || !pos || !navigatingTo) {
      // Clear route
      if (map?.getSource('route')) {
        (map.getSource('route') as mapboxgl.GeoJSONSource).setData({
          type: 'Feature', geometry: { type: 'LineString', coordinates: [] }, properties: {},
        });
      }
      onRouteUpdate?.(null);
      return;
    }

    let destLat: number | null = null;
    let destLng: number | null = null;
    if (navigatingTo === 'store' && storeLat != null && storeLng != null) {
      destLat = storeLat; destLng = storeLng;
    } else if (navigatingTo === 'customer' && customerLat != null && customerLng != null) {
      destLat = customerLat; destLng = customerLng;
    }
    if (destLat == null || destLng == null) return;

    const routeKey = `${pos.lat.toFixed(4)},${pos.lng.toFixed(4)}-${destLat},${destLng}`;
    if (routeKey === lastRouteKey.current) return;
    lastRouteKey.current = routeKey;

    routeFetchRef.current?.abort();
    const ctrl = new AbortController();
    routeFetchRef.current = ctrl;

    try {
      const url = `https://api.mapbox.com/directions/v5/mapbox/driving/${pos.lng},${pos.lat};${destLng},${destLat}?geometries=geojson&overview=full&steps=true&access_token=${token}`;
      const res = await fetch(url, { signal: ctrl.signal });
      const data = await res.json();
      const route = data.routes?.[0];
      if (!route) return;

      const coords = route.geometry.coordinates;

      if (map.getSource('route')) {
        (map.getSource('route') as mapboxgl.GeoJSONSource).setData({
          type: 'Feature',
          geometry: { type: 'LineString', coordinates: coords },
          properties: {},
        });
      }

      // Fit route
      const bounds = new mapboxgl.LngLatBounds();
      coords.forEach((c: [number, number]) => bounds.extend(c));
      bounds.extend([pos.lng, pos.lat]);
      map.fitBounds(bounds, { padding: { top: 80, bottom: 200, left: 50, right: 50 }, maxZoom: 16 });

      // Parse steps
      const steps = route.legs[0]?.steps?.map((s: any) => ({
        instruction: s.maneuver?.instruction || '',
        distance: s.distance,
        duration: s.duration,
      })) || [];

      onRouteUpdate?.({
        distance: route.distance,
        duration: route.duration,
        steps,
      });
    } catch (e: any) {
      if (e.name !== 'AbortError') console.error('Route fetch error:', e);
    }
  }, [pos, navigatingTo, storeLat, storeLng, customerLat, customerLng, token, onRouteUpdate]);

  // Fetch route on change (throttled)
  useEffect(() => {
    const timer = setTimeout(fetchRoute, 1500);
    return () => clearTimeout(timer);
  }, [fetchRoute]);

  // Clear route when not navigating
  useEffect(() => {
    if (!navigatingTo) {
      const map = mapRef.current;
      if (map?.getSource('route')) {
        (map.getSource('route') as mapboxgl.GeoJSONSource).setData({
          type: 'Feature', geometry: { type: 'LineString', coordinates: [] }, properties: {},
        });
      }
      onRouteUpdate?.(null);
      lastRouteKey.current = '';
    }
  }, [navigatingTo]);

  // Expose recenter method
  const recenter = useCallback(() => {
    const map = mapRef.current;
    if (map && pos) {
      map.flyTo({ center: [pos.lng, pos.lat], zoom: 15, duration: 800 });
    }
  }, [pos]);

  useImperativeHandle(ref, () => ({ recenter }), [recenter]);

  if (loading || !token) {
    return (
      <div className={`bg-muted/50 flex items-center justify-center ${className}`}>
        <div className="h-6 w-6 border-3 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return <div ref={mapContainer} className={className} style={{ minHeight: '200px' }} />;
});

export default DriverMapbox;
