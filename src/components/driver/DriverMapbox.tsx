import { useEffect, useRef, useState, useCallback, forwardRef, useImperativeHandle } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { useMapboxToken } from '@/hooks/useMapboxToken';

export interface DriverMapboxHandle {
  recenter: () => void;
  focusOn: (target: 'store' | 'customer') => void;
}

export interface RouteInfo {
  distance: number; // meters
  duration: number; // seconds
  steps: { instruction: string; distance: number; duration: number }[];
}

interface NearbyStorePin {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  image_url: string | null;
  pendingOrders: number;
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
  nearbyStores?: NearbyStorePin[];
  /** When true: camera follows driver position with heading-up rotation + 3D tilt (like Google Maps nav) */
  followMode?: boolean;
}

const DriverMapbox = forwardRef<DriverMapboxHandle, DriverMapboxProps>(function DriverMapbox({
  className,
  storeLat, storeLng, storeName,
  customerLat, customerLng, customerName, customerAddress,
  navigatingTo,
  onRouteUpdate,
  nearbyStores,
  followMode = false,
}, ref) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const driverMarkerRef = useRef<mapboxgl.Marker | null>(null);
  const storeMarkerRef = useRef<mapboxgl.Marker | null>(null);
  const customerMarkerRef = useRef<mapboxgl.Marker | null>(null);
  const nearbyMarkersRef = useRef<Map<string, mapboxgl.Marker>>(new Map());
  const { token, loading } = useMapboxToken();
  const [pos, setPos] = useState<{ lat: number; lng: number; heading: number | null } | null>(null);
  const lastPosRef = useRef<{ lat: number; lng: number } | null>(null);
  const smoothedHeadingRef = useRef<number | null>(null);
  const watchRef = useRef<number | null>(null);
  const routeFetchRef = useRef<AbortController | null>(null);
  const lastRouteKey = useRef('');
  const followModeRef = useRef(followMode);
  useEffect(() => { followModeRef.current = followMode; }, [followMode]);
  // When the user manually pans/zooms/rotates during follow mode, pause auto-camera until they recenter
  const userInteractingRef = useRef(false);

  // Compute bearing between two coords (fallback when GPS heading unavailable, e.g. desktop)
  const bearingBetween = (a: { lat: number; lng: number }, b: { lat: number; lng: number }) => {
    const toRad = (d: number) => (d * Math.PI) / 180;
    const toDeg = (r: number) => (r * 180) / Math.PI;
    const dLng = toRad(b.lng - a.lng);
    const lat1 = toRad(a.lat), lat2 = toRad(b.lat);
    const y = Math.sin(dLng) * Math.cos(lat2);
    const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLng);
    return (toDeg(Math.atan2(y, x)) + 360) % 360;
  };

  // Watch position (now also captures heading)
  useEffect(() => {
    if (!('geolocation' in navigator)) return;
    watchRef.current = navigator.geolocation.watchPosition(
      (p) => {
        const next = { lat: p.coords.latitude, lng: p.coords.longitude };
        let heading: number | null = (typeof p.coords.heading === 'number' && !isNaN(p.coords.heading)) ? p.coords.heading : null;
        // Fallback: derive heading from movement vector if GPS doesn't provide one
        if (heading == null && lastPosRef.current) {
          const movedM = Math.hypot(
            (next.lat - lastPosRef.current.lat) * 111000,
            (next.lng - lastPosRef.current.lng) * 111000 * Math.cos(next.lat * Math.PI / 180),
          );
          if (movedM > 3) heading = bearingBetween(lastPosRef.current, next);
        }
        lastPosRef.current = next;
        setPos({ ...next, heading });
      },
      () => setPos({ lat: 39.6650, lng: 20.8537, heading: null }),
      { enableHighAccuracy: true, maximumAge: 1000, timeout: 20000 }
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

    // Detect manual user interaction so the follow camera doesn't fight the user
    const onUserMove = (e: any) => {
      if (e?.originalEvent) userInteractingRef.current = true;
    };
    map.on('dragstart', onUserMove);
    map.on('rotatestart', onUserMove);
    map.on('pitchstart', onUserMove);
    map.on('zoomstart', onUserMove);

    mapRef.current = map;
    return () => { map.remove(); mapRef.current = null; };
  }, [token]);

  // Update driver marker (arrow that rotates with heading when in followMode)
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !pos) return;

    const heading = pos.heading ?? 0;
    // Marker visual rotation: in followMode the map rotates so arrow stays "up";
    // otherwise rotate marker to show direction of travel.
    const markerRotation = followMode ? 0 : heading;

    if (driverMarkerRef.current) {
      driverMarkerRef.current.setLngLat([pos.lng, pos.lat]);
      const inner = driverMarkerRef.current.getElement().querySelector<HTMLDivElement>('[data-driver-arrow]');
      if (inner) inner.style.transform = `rotate(${markerRotation}deg)`;
    } else {
      const el = document.createElement('div');
      el.innerHTML = `
        <div style="position:relative;width:34px;height:34px;">
          <div style="position:absolute;inset:-6px;border-radius:50%;background:rgba(59,130,246,0.18);animation:pulse 2s infinite;"></div>
          <div data-driver-arrow style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;transition:transform 250ms ease-out;transform:rotate(${markerRotation}deg);">
            <svg width="34" height="34" viewBox="0 0 34 34" xmlns="http://www.w3.org/2000/svg">
              <circle cx="17" cy="17" r="13" fill="#3b82f6" stroke="white" stroke-width="3"/>
              <path d="M17 7 L23 19 L17 16 L11 19 Z" fill="white"/>
            </svg>
          </div>
        </div>`;
      driverMarkerRef.current = new mapboxgl.Marker({ element: el, anchor: 'center' })
        .setLngLat([pos.lng, pos.lat])
        .addTo(map);
    }
  }, [pos, followMode]);

  // Follow-camera: smoothly track driver with heading-up bearing + 3D pitch
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !pos) return;

    if (!followMode) return;
    if (userInteractingRef.current) return;

    // Smooth heading transitions to avoid jitter
    const rawHeading = pos.heading;
    if (rawHeading != null) {
      const prev = smoothedHeadingRef.current;
      if (prev == null) {
        smoothedHeadingRef.current = rawHeading;
      } else {
        // Take shortest angular path
        let delta = rawHeading - prev;
        if (delta > 180) delta -= 360;
        if (delta < -180) delta += 360;
        smoothedHeadingRef.current = (prev + delta * 0.4 + 360) % 360;
      }
    }

    map.easeTo({
      center: [pos.lng, pos.lat],
      bearing: smoothedHeadingRef.current ?? map.getBearing(),
      // Don't override zoom on every position update — it causes the map to
      // randomly snap back to 17 while the user is navigating.
      duration: 600,
      essential: true,
    });
  }, [pos, followMode]);

  // When entering/leaving followMode, set pitch/zoom ONCE so subsequent
  // position updates don't keep snapping the camera back.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (followMode) {
      userInteractingRef.current = false;
      map.easeTo({ pitch: 55, zoom: Math.max(map.getZoom(), 17), duration: 600 });
    } else {
      smoothedHeadingRef.current = null;
      map.easeTo({ bearing: 0, pitch: 0, duration: 500 });
    }
  }, [followMode]);


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

  // Nearby stores markers (admin-toggleable)
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const incoming = nearbyStores ?? [];
    const incomingIds = new Set(incoming.map(s => s.id));

    // Remove markers no longer in list
    nearbyMarkersRef.current.forEach((marker, id) => {
      if (!incomingIds.has(id)) {
        marker.remove();
        nearbyMarkersRef.current.delete(id);
      }
    });

    // Add or update
    incoming.forEach(s => {
      // Don't show a nearby pin where the active store/customer pin already is
      if (storeLat != null && storeLng != null
          && Math.abs(storeLat - s.latitude) < 1e-5
          && Math.abs(storeLng - s.longitude) < 1e-5) {
        const existing = nearbyMarkersRef.current.get(s.id);
        if (existing) { existing.remove(); nearbyMarkersRef.current.delete(s.id); }
        return;
      }

      const safeName = s.name.replace(/[<>"]/g, '');
      const initials = safeName.split(/\s+/).map(w => w[0]).filter(Boolean).slice(0, 2).join('').toUpperCase() || '🏪';
      const badge = s.pendingOrders > 0
        ? `<div style="position:absolute;top:-6px;right:-6px;min-width:20px;height:20px;padding:0 5px;background:#ef4444;color:white;border-radius:10px;border:2px solid white;font-size:11px;font-weight:700;display:flex;align-items:center;justify-content:center;font-family:system-ui,sans-serif;box-shadow:0 2px 6px rgba(0,0,0,0.3);">${s.pendingOrders}</div>`
        : '';
      const imgInner = s.image_url
        ? `<img src="${s.image_url}" alt="" style="width:100%;height:100%;object-fit:cover;" onerror="this.replaceWith(Object.assign(document.createElement('div'),{innerText:'${initials}',style:'width:100%;height:100%;display:flex;align-items:center;justify-content:center;font-weight:700;color:#fff;font-size:11px;background:linear-gradient(135deg,#f97316,#ea580c);'}))" />`
        : `<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;font-weight:700;color:#fff;font-size:11px;background:linear-gradient(135deg,#f97316,#ea580c);">${initials}</div>`;

      const html = `
        <div style="position:relative;cursor:pointer;">
          <div style="width:36px;height:36px;border-radius:10px;border:2.5px solid white;overflow:hidden;box-shadow:0 3px 10px rgba(0,0,0,0.4);background:#1f2937;">
            ${imgInner}
          </div>
          ${badge}
        </div>`;

      const existing = nearbyMarkersRef.current.get(s.id);
      if (existing) {
        existing.getElement().innerHTML = html;
        existing.setLngLat([s.longitude, s.latitude]);
      } else {
        const el = document.createElement('div');
        el.innerHTML = html;
        const popupContent = `<strong style="font-size:13px;">${safeName}</strong><br/><span style="font-size:11px;color:#6b7280;">${s.pendingOrders} ενεργ${s.pendingOrders === 1 ? 'ή' : 'ές'} παραγγελί${s.pendingOrders === 1 ? 'α' : 'ες'}</span>`;
        const marker = new mapboxgl.Marker({ element: el, anchor: 'center' })
          .setLngLat([s.longitude, s.latitude])
          .setPopup(new mapboxgl.Popup({ offset: 24 }).setHTML(popupContent))
          .addTo(map);
        nearbyMarkersRef.current.set(s.id, marker);
      }
    });
  }, [nearbyStores, storeLat, storeLng]);

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

      // Fit route — skip while in followMode so we don't fight the follow camera
      if (!followModeRef.current) {
        const bounds = new mapboxgl.LngLatBounds();
        coords.forEach((c: [number, number]) => bounds.extend(c));
        bounds.extend([pos.lng, pos.lat]);
        map.fitBounds(bounds, { padding: { top: 80, bottom: 200, left: 50, right: 50 }, maxZoom: 16 });
      }

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
    if (!map || !pos) return;
    // Resume follow camera tracking after a manual pan/zoom
    userInteractingRef.current = false;
    if (followModeRef.current) {
      map.easeTo({
        center: [pos.lng, pos.lat],
        bearing: smoothedHeadingRef.current ?? pos.heading ?? 0,
        pitch: 55,
        zoom: Math.max(map.getZoom(), 17),
        duration: 800,
        essential: true,
      });
    } else {
      map.flyTo({ center: [pos.lng, pos.lat], zoom: 15, duration: 800 });
    }
  }, [pos]);

  const focusOn = useCallback((target: 'store' | 'customer') => {
    const map = mapRef.current;
    if (!map) return;
    const lat = target === 'store' ? storeLat : customerLat;
    const lng = target === 'store' ? storeLng : customerLng;
    if (lat == null || lng == null) return;

    if (pos) {
      const bounds = new mapboxgl.LngLatBounds();
      bounds.extend([pos.lng, pos.lat]);
      bounds.extend([lng, lat]);
      map.fitBounds(bounds, { padding: { top: 120, bottom: 260, left: 60, right: 60 }, maxZoom: 16, duration: 800 });
    } else {
      map.flyTo({ center: [lng, lat], zoom: 15, duration: 800 });
    }
  }, [storeLat, storeLng, customerLat, customerLng, pos]);

  useImperativeHandle(ref, () => ({ recenter, focusOn }), [recenter, focusOn]);

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
