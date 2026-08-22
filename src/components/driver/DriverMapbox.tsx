import { useEffect, useRef, useState, useCallback, forwardRef, useImperativeHandle } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { useMapboxToken } from '@/hooks/useMapboxToken';
import { escapeHtml } from '@/lib/escape-html';
import { readyEtaShortTag } from '@/lib/driver-ready-eta';

// Real road traffic-light signals (highway=traffic_signals) come from
// OpenStreetMap via the Overpass API. Multiple mirrors are tried in order.
const OVERPASS_ENDPOINTS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
  'https://maps.mail.ru/osm/tools/overpass/api/interpreter',
];
// Only draw signal icons once the driver zooms into navigation level.
const TRAFFIC_LIGHT_MINZOOM = 14;
const TRAFFIC_LIGHT_ICON = 'traffic-light-symbol';

const TRAFFIC_LIGHT_SVG = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(
  `<svg xmlns="http://www.w3.org/2000/svg" width="22" height="44" viewBox="0 0 22 44">
    <rect x="3.5" y="1" width="15" height="42" rx="4.5" fill="#14181f" stroke="#ffffff" stroke-width="1.8"/>
    <circle cx="11" cy="9.5" r="4.3" fill="#ef4444"/>
    <circle cx="11" cy="22" r="4.3" fill="#f59e0b"/>
    <circle cx="11" cy="34.5" r="4.3" fill="#22c55e"/>
  </svg>`,
)}`;

const expandBounds = (b: mapboxgl.LngLatBounds, meters: number) => {
  const lat = (b.getNorth() + b.getSouth()) / 2;
  const dLat = meters / 111320;
  const dLng = meters / (111320 * Math.max(Math.cos((lat * Math.PI) / 180), 0.2));
  return new mapboxgl.LngLatBounds(
    [b.getWest() - dLng, b.getSouth() - dLat],
    [b.getEast() + dLng, b.getNorth() + dLat],
  );
};

const queryTrafficSignals = async (
  west: number, south: number, east: number, north: number, signal: AbortSignal,
): Promise<[number, number][]> => {
  if (west >= east || south >= north) return [];
  const query = `[out:json][timeout:8];node["highway"="traffic_signals"](${south},${west},${north},${east});out;`;
  for (const endpoint of OVERPASS_ENDPOINTS) {
    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: `data=${encodeURIComponent(query)}`,
        signal,
      });
      if (!res.ok) continue;
      const json = await res.json();
      const els: any[] = Array.isArray(json.elements) ? json.elements : [];
      return els
        .filter((e) => typeof e.lat === 'number' && typeof e.lon === 'number')
        .map((e) => [e.lon, e.lat] as [number, number]);
    } catch {
      // try next mirror (abort aborts the loop too)
    }
  }
  return [];
};

export interface DriverMapboxHandle {
  recenter: () => void;
  focusOn: (target: 'store' | 'customer') => void;
  /** Fit driver + store + customer (+ route) into the visible map area. */
  fitOverview: () => void;
}

export interface RouteStep {
  instruction: string;
  distance: number;
  duration: number;
  /** Maneuver type: turn, roundabout, merge, fork, arrive, depart, … */
  maneuverType?: string;
  /** Modifier: left, right, slight left, sharp right, straight, uturn, … */
  modifier?: string;
  /** Step start coordinate [lng, lat] */
  location?: [number, number];
  /** Name of the road the step ends on (for the next-street strip) */
  name?: string;
}

export interface RouteInfo {
  distance: number; // meters
  duration: number; // seconds
  steps: RouteStep[];
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
  /** Order status for the active store pin ready tag */
  storeOrderStatus?: string | null;
  /** Absolute predicted ready timestamp for the active order */
  storePredictedReadyAt?: string | null;
  /** Fallback prep minutes when predicted_ready_at is missing */
  storeEstimatedPrepMin?: number | null;
  customerLat?: number | null;
  customerLng?: number | null;
  customerName?: string;
  customerAddress?: string | null;
  navigatingTo?: 'store' | 'customer' | null;
  onRouteUpdate?: (route: RouteInfo | null) => void;
  /** Reports the driver's live position so callers can compute live distance to next maneuver, etc. */
  onDriverPosUpdate?: (pos: { lat: number; lng: number; heading: number | null } | null) => void;
  nearbyStores?: NearbyStorePin[];
  /** When true: camera follows driver position with heading-up rotation + 3D tilt (like Google Maps nav) */
  followMode?: boolean;
  /**
   * Extra fitBounds padding so routes/pins aren't hidden under top chrome / bottom sheets.
   * Values in CSS pixels.
   */
  overlayPadding?: { top?: number; bottom?: number; left?: number; right?: number };
  /** Optional external GPS — when set, map adopts these coords. */
  externalPos?: { lat: number; lng: number; heading: number | null } | null;
  /**
   * When true, never start an internal watchPosition — parent owns GPS
   * (even while externalPos is still null waiting for the first fix).
   */
  useExternalGps?: boolean;
  /** When false, map stays mounted but hidden (tab switch) — triggers resize on show. */
  visible?: boolean;
  /** When true, freeze map pan/zoom so the incoming offer stays the focus. */
  interactionLocked?: boolean;
}

const DEFAULT_PADDING = { top: 100, bottom: 220, left: 48, right: 48 };

const DriverMapbox = forwardRef<DriverMapboxHandle, DriverMapboxProps>(function DriverMapbox({
  className,
  storeLat, storeLng, storeName,
  storeOrderStatus, storePredictedReadyAt, storeEstimatedPrepMin,
  customerLat, customerLng, customerName, customerAddress,
  navigatingTo,
  onRouteUpdate,
  onDriverPosUpdate,
  nearbyStores,
  followMode = false,
  overlayPadding,
  interactionLocked = false,
  externalPos = null,
  useExternalGps = false,
  visible = true,
}, ref) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const driverMarkerRef = useRef<mapboxgl.Marker | null>(null);
  const storeMarkerRef = useRef<mapboxgl.Marker | null>(null);
  const customerMarkerRef = useRef<mapboxgl.Marker | null>(null);
  const nearbyMarkersRef = useRef<Map<string, mapboxgl.Marker>>(new Map());
  const { token, loading } = useMapboxToken();
  const [pos, setPos] = useState<{ lat: number; lng: number; heading: number | null } | null>(null);
  const [mapReady, setMapReady] = useState(false);
  const lastPosRef = useRef<{ lat: number; lng: number } | null>(null);
  const posRef = useRef<{ lat: number; lng: number; heading: number | null } | null>(null);
  const smoothedHeadingRef = useRef<number | null>(null);
  const watchRef = useRef<number | null>(null);
  const routeFetchRef = useRef<AbortController | null>(null);
  const lastRouteKey = useRef('');
  // In-memory cache of recent route responses so we don't re-hit the
  // Mapbox Directions API on every refresh / re-render. Keyed by routeKey.
  const routeCacheRef = useRef<Map<string, { at: number; data: any }>>(new Map());
  const routeCoordsRef = useRef<[number, number][]>([]);
  const ROUTE_CACHE_TTL_MS = 25_000;
  const trafficAbortRef = useRef<AbortController | null>(null);
  const lastTrafficKeyRef = useRef('');
  const lastRouteCoordsKeyRef = useRef('');
  const hasRouteRef = useRef(false);

  const followModeRef = useRef(followMode);
  useEffect(() => { followModeRef.current = followMode; }, [followMode]);
  // When the user manually pans/zooms/rotates during follow mode, pause auto-camera until they recenter
  const userInteractingRef = useRef(false);

  const paddingRef = useRef({ ...DEFAULT_PADDING, ...overlayPadding });
  useEffect(() => {
    paddingRef.current = { ...DEFAULT_PADDING, ...overlayPadding };
  }, [overlayPadding?.top, overlayPadding?.bottom, overlayPadding?.left, overlayPadding?.right]);

  // Freeze pan/zoom while an offer is on screen so the driver focuses on Accept/Decline.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const handlers = [
      'dragPan',
      'scrollZoom',
      'boxZoom',
      'dragRotate',
      'touchZoomRotate',
      'keyboard',
      'doubleClickZoom',
    ] as const;
    for (const h of handlers) {
      try {
        if (interactionLocked) map[h].disable();
        else map[h].enable();
      } catch { /* map handler may be unavailable */ }
    }
  }, [interactionLocked]);

  const getPadding = useCallback(() => ({ ...paddingRef.current }), []);

  // Traffic-signal layer helpers — fetch real highway=traffic_signals nodes from
  // OSM (Overpass) and push them into the map as small traffic-light icons.
  const setTrafficSignals = useCallback((coords: [number, number][]) => {
    const map = mapRef.current;
    if (!map?.isStyleLoaded()) return;
    try {
      (map.getSource('traffic-signals') as mapboxgl.GeoJSONSource | undefined)?.setData({
        type: 'FeatureCollection',
        features: coords.map((c) => ({
          type: 'Feature',
          geometry: { type: 'Point', coordinates: c },
          properties: {},
        })),
      });
    } catch {/* layer may not be ready yet */}
  }, []);

  const refreshTrafficSignals = useCallback((bounds: mapboxgl.LngLatBounds, key: string) => {
    if (!key || key === lastTrafficKeyRef.current) return;
    lastTrafficKeyRef.current = key;
    trafficAbortRef.current?.abort();
    const ctrl = new AbortController();
    trafficAbortRef.current = ctrl;
    queryTrafficSignals(bounds.getWest(), bounds.getSouth(), bounds.getEast(), bounds.getNorth(), ctrl.signal)
      .then((coords) => { if (!ctrl.signal.aborted) setTrafficSignals(coords); })
      .catch(() => {/* aborted or Overpass unavailable */});
  }, [setTrafficSignals]);

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

  // Watch position — skipped when parent owns GPS (Capacitor / useDriverLocation).
  useEffect(() => {
    if (useExternalGps) return;
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
        const nextPos = { ...next, heading };
        posRef.current = nextPos;
        setPos(nextPos);
      },
      () => {
        const fallback = { lat: 39.6650, lng: 20.8537, heading: null };
        posRef.current = fallback;
        setPos(fallback);
      },
      { enableHighAccuracy: true, maximumAge: 1000, timeout: 20000 }
    );
    return () => { if (watchRef.current !== null) navigator.geolocation.clearWatch(watchRef.current); };
  }, [useExternalGps]);

  // Adopt parent GPS stream (single watch).
  useEffect(() => {
    if (!useExternalGps || !externalPos) return;
    lastPosRef.current = { lat: externalPos.lat, lng: externalPos.lng };
    posRef.current = externalPos;
    setPos(externalPos);
  }, [useExternalGps, externalPos?.lat, externalPos?.lng, externalPos?.heading]);

  // Keep a ref of the latest pos so the map-load race can still draw the pin.
  useEffect(() => {
    posRef.current = pos;
  }, [pos]);

  // Forward live driver position to parent only when map owns the watch.
  useEffect(() => {
    if (useExternalGps) return;
    onDriverPosUpdate?.(pos);
  }, [pos, onDriverPosUpdate, useExternalGps]);

  // Tab switches keep the map mounted but hidden — resize when shown again.
  useEffect(() => {
    if (!visible) return;
    const map = mapRef.current;
    if (!map) return;
    const id = window.setTimeout(() => {
      try { map.resize(); } catch { /* ignore */ }
    }, 50);
    return () => window.clearTimeout(id);
  }, [visible]);

  // Auto day/night style based on local hour (06-19 = day)
  const isDaytime = () => {
    const h = new Date().getHours();
    return h >= 6 && h < 19;
  };

  // Init map
  useEffect(() => {
    if (!token || !mapContainer.current || mapRef.current) return;
    mapboxgl.accessToken = token;

    const styleUrl = isDaytime()
      ? 'mapbox://styles/mapbox/navigation-day-v1'
      : 'mapbox://styles/mapbox/navigation-night-v1';

    const map = new mapboxgl.Map({
      container: mapContainer.current,
      style: styleUrl,
      center: [pos?.lng ?? 20.8537, pos?.lat ?? 39.6650],
      zoom: 14,
      pitch: 0,
      attributionControl: false,
      antialias: true,
      fadeDuration: 100,
      maxTileCacheSize: 200,
    });

    // GeolocateControl removed — custom recenter button used instead

    const addRouteLayers = () => {
      if (map.getSource('route')) return;
      // Route source + layers (data-driven color by traffic congestion)
      map.addSource('route', {
        type: 'geojson',
        lineMetrics: true,
        data: { type: 'Feature', geometry: { type: 'LineString', coordinates: [] }, properties: { congestion: [] } },
      });
      // Glow layer
      map.addLayer({
        id: 'route-glow',
        type: 'line',
        source: 'route',
        paint: {
          'line-color': '#3b82f6',
          'line-width': 14,
          'line-opacity': 0.18,
          'line-blur': 10,
        },
        layout: { 'line-join': 'round', 'line-cap': 'round' },
      });
      // Border
      map.addLayer({
        id: 'route-border',
        type: 'line',
        source: 'route',
        paint: {
          'line-color': '#0b2545',
          'line-width': 8,
          'line-opacity': 0.85,
        },
        layout: { 'line-join': 'round', 'line-cap': 'round' },
      });
      // Main line — traffic-aware gradient (green/yellow/orange/red)
      map.addLayer({
        id: 'route-line',
        type: 'line',
        source: 'route',
        paint: {
          'line-color': '#22c55e',
          'line-width': 6,
          'line-opacity': 0.95,
          'line-gradient': [
            'interpolate', ['linear'], ['line-progress'],
            0, '#22c55e',
            1, '#22c55e',
          ],
        },
        layout: { 'line-join': 'round', 'line-cap': 'round' },
      });
    };

    const setupTrafficSignals = () => {
      if (map.getSource('traffic-signals')) return;
      map.addSource('traffic-signals', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] },
      });
      map.loadImage(TRAFFIC_LIGHT_SVG, (err, image) => {
        if (err || !image || !map.getSource('traffic-signals')) return;
        if (!map.hasImage(TRAFFIC_LIGHT_ICON)) map.addImage(TRAFFIC_LIGHT_ICON, image);
        if (map.getLayer('traffic-signal-layer')) return;
        map.addLayer({
          id: 'traffic-signal-layer',
          type: 'symbol',
          source: 'traffic-signals',
          minzoom: TRAFFIC_LIGHT_MINZOOM,
          layout: {
            'icon-image': TRAFFIC_LIGHT_ICON,
            'icon-size': 0.85,
            'icon-allow-overlap': false,
            'icon-ignore-placement': false,
          },
        });
      });
    };

    const add3DBuildings = () => {
      // Find first symbol layer to insert buildings beneath labels
      const layers = map.getStyle().layers || [];
      const labelLayer = layers.find((l: any) => l.type === 'symbol' && l.layout?.['text-field']);
      const labelLayerId = labelLayer?.id;
      if (map.getLayer('3d-buildings')) return;
      const compositeSource = map.getStyle().sources?.composite;
      if (!compositeSource) return;
      map.addLayer(
        {
          id: '3d-buildings',
          source: 'composite',
          'source-layer': 'building',
          filter: ['==', 'extrude', 'true'],
          type: 'fill-extrusion',
          minzoom: 14,
          paint: {
            'fill-extrusion-color': isDaytime() ? '#d6d6d6' : '#2a3340',
            'fill-extrusion-height': [
              'interpolate', ['linear'], ['zoom'],
              14, 0,
              15.5, ['get', 'height'],
            ],
            'fill-extrusion-base': [
              'interpolate', ['linear'], ['zoom'],
              14, 0,
              15.5, ['get', 'min_height'],
            ],
            'fill-extrusion-opacity': 0.65,
          },
        },
        labelLayerId,
      );
    };

    map.on('load', () => {
      addRouteLayers();
      setupTrafficSignals();
      // Ensure the GL canvas matches the full-bleed container (esp. after Capacitor / lazy mount).
      map.resize();
      requestAnimationFrame(() => {
        try { map.resize(); } catch { /* noop */ }
      });
      setMapReady(true);
      // 3D buildings are expensive on mobile; only add them when the driver
      // enters turn-by-turn navigation (followMode). See effect below.
    });


    // Detect manual user interaction so the follow camera doesn't fight the user
    const onUserMove = (e: any) => {
      if (e?.originalEvent) userInteractingRef.current = true;
    };
    map.on('dragstart', onUserMove);
    map.on('rotatestart', onUserMove);
    map.on('pitchstart', onUserMove);
    map.on('zoomstart', onUserMove);

    // When zoomed into nav level with no active route, show nearby traffic
    // signals for the current viewport.
    const onMoveEnd = () => {
      if (hasRouteRef.current) return;
      if (map.getZoom() < TRAFFIC_LIGHT_MINZOOM) return;
      const b = map.getBounds();
      refreshTrafficSignals(
        b,
        `vp:${b.getWest().toFixed(3)}:${b.getSouth().toFixed(3)}:${b.getEast().toFixed(3)}:${b.getNorth().toFixed(3)}`,
      );
    };
    map.on('moveend', onMoveEnd);

    mapRef.current = map;

    // Keep canvas sized when the viewport / sheet changes (orientation, keyboard, etc.)
    const onWinResize = () => { try { map.resize(); } catch { /* noop */ } };
    window.addEventListener('resize', onWinResize);
    const shell = mapContainer.current?.parentElement ?? mapContainer.current;
    const ro = typeof ResizeObserver !== 'undefined' && shell
      ? new ResizeObserver(() => onWinResize())
      : null;
    if (ro && shell) ro.observe(shell);
    // Catch late layout (fonts, safe-area, mobile browser chrome).
    const bootTimers = [50, 200, 600].map((ms) => window.setTimeout(onWinResize, ms));

    return () => {
      window.removeEventListener('resize', onWinResize);
      ro?.disconnect();
      bootTimers.forEach((id) => window.clearTimeout(id));
      map.off('moveend', onMoveEnd);
      trafficAbortRef.current?.abort();
      map.remove();
      mapRef.current = null;
      setMapReady(false);
      driverMarkerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, refreshTrafficSignals]);


  // Update driver marker (arrow that rotates with heading when in followMode)
  useEffect(() => {
    const map = mapRef.current;
    const current = pos ?? posRef.current;
    if (!map || !mapReady || !current) return;

    const heading = current.heading ?? 0;
    // Marker visual rotation: in followMode the map rotates so arrow stays "up";
    // otherwise rotate marker to show direction of travel.
    const markerRotation = followMode ? 0 : heading;

    if (driverMarkerRef.current) {
      driverMarkerRef.current.setLngLat([current.lng, current.lat]);
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
        .setLngLat([current.lng, current.lat])
        .addTo(map);
    }
  }, [pos, followMode, mapReady]);

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
    const apply = () => {
      if (followMode) {
        userInteractingRef.current = false;
        // Lazily add 3D buildings the first time the driver enters navigation
        if (!map.getLayer('3d-buildings')) {
          try {
            const layers = map.getStyle().layers || [];
            const labelLayer = layers.find((l: any) => l.type === 'symbol' && l.layout?.['text-field']);
            const compositeSource = map.getStyle().sources?.composite;
            if (compositeSource) {
              map.addLayer(
                {
                  id: '3d-buildings',
                  source: 'composite',
                  'source-layer': 'building',
                  filter: ['==', 'extrude', 'true'],
                  type: 'fill-extrusion',
                  minzoom: 14,
                  paint: {
                    'fill-extrusion-color': isDaytime() ? '#d6d6d6' : '#2a3340',
                    'fill-extrusion-height': [
                      'interpolate', ['linear'], ['zoom'],
                      14, 0,
                      15.5, ['get', 'height'],
                    ],
                    'fill-extrusion-base': [
                      'interpolate', ['linear'], ['zoom'],
                      14, 0,
                      15.5, ['get', 'min_height'],
                    ],
                    'fill-extrusion-opacity': 0.65,
                  },
                },
                labelLayer?.id,
              );
            }
          } catch { /* no-op */ }
        }

        map.easeTo({ pitch: 55, zoom: Math.max(map.getZoom(), 17), duration: 600 });
      } else {
        smoothedHeadingRef.current = null;
        map.easeTo({ bearing: 0, pitch: 0, duration: 500 });
      }
    };
    if (map.isStyleLoaded()) apply(); else map.once('load', apply);
  }, [followMode]);



  // Store marker — badge shows ready / minutes-until-ready while heading to store
  const [readyTick, setReadyTick] = useState(0);
  useEffect(() => {
    if (!storePredictedReadyAt || storeOrderStatus === 'ready') return;
    const id = window.setInterval(() => setReadyTick((n) => n + 1), 15_000);
    return () => window.clearInterval(id);
  }, [storePredictedReadyAt, storeOrderStatus]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    storeMarkerRef.current?.remove();
    storeMarkerRef.current = null;
    if (storeLat != null && storeLng != null) {
      const el = document.createElement('div');
      const isTarget = navigatingTo === 'store';
      const tag = readyEtaShortTag(storePredictedReadyAt, storeOrderStatus, storeEstimatedPrepMin);
      const badgeBg = tag?.ready ? '#16a34a' : '#ea580c';
      const badge = tag
        ? `<div style="position:absolute;top:-10px;left:50%;transform:translateX(-50%);white-space:nowrap;padding:2px 7px;background:${badgeBg};color:#fff;border-radius:999px;border:2px solid #fff;font-size:10px;font-weight:800;line-height:1.2;font-family:system-ui,sans-serif;box-shadow:0 2px 8px rgba(0,0,0,0.25);letter-spacing:0.02em;">${escapeHtml(tag.text)}</div>`
        : '';
      el.style.position = 'relative';
      el.innerHTML = `<div style="position:relative;width:40px;height:40px;background:#f97316;border-radius:14px;border:3px solid white;box-shadow:0 2px 16px rgba(249,115,22,0.5);display:flex;align-items:center;justify-content:center;font-size:20px;${isTarget ? 'animation:bounce 1s infinite;' : ''}">🏪${badge}</div>`;
      const popupReady = tag
        ? `<br/><span style="font-size:11px;color:${tag.ready ? '#16a34a' : '#ea580c'};font-weight:700;">${escapeHtml(tag.ready ? 'Έτοιμη για παραλαβή' : `Έτοιμη σε ${tag.text}`)}</span>`
        : '';
      storeMarkerRef.current = new mapboxgl.Marker({ element: el, anchor: 'center' })
        .setLngLat([storeLng, storeLat])
        .setPopup(new mapboxgl.Popup({ offset: 28 }).setHTML(
          `<strong style="font-size:13px;">${escapeHtml(storeName || 'Κατάστημα')}</strong>${popupReady}`,
        ))
        .addTo(map);
    }
  }, [storeLat, storeLng, storeName, navigatingTo, storeOrderStatus, storePredictedReadyAt, storeEstimatedPrepMin, readyTick]);

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
        .setPopup(new mapboxgl.Popup({ offset: 24 }).setHTML(`<strong style="font-size:13px;">${escapeHtml(customerName || 'Παράδοση')}</strong><br/><span style="font-size:11px;">${escapeHtml(customerAddress || '')}</span>`))
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

      const safeName = escapeHtml(s.name);
      const hasOrders = s.pendingOrders > 0;

      // Minimal Uber-style dot — small enough to never fight the active route.
      // Gray when idle, orange when orders are waiting, tiny count badge on top.
      const dotSize = hasOrders ? 16 : 13;
      const badge = hasOrders
        ? `<div style="position:absolute;top:-8px;right:-8px;min-width:17px;height:17px;padding:0 4px;background:#ef4444;color:#fff;border-radius:9px;border:1.5px solid #fff;box-sizing:border-box;font-size:9.5px;font-weight:800;line-height:1;display:flex;align-items:center;justify-content:center;font-family:system-ui,sans-serif;box-shadow:0 2px 5px rgba(239,68,68,0.55);">${s.pendingOrders}</div>`
        : '';

      const html = `
        <div style="position:relative;width:${dotSize}px;height:${dotSize}px;">
          <div style="position:absolute;inset:0;border-radius:50%;background:${hasOrders ? '#f97316' : '#94a3b8'};border:2px solid rgba(255,255,255,0.95);box-shadow:0 1px 5px rgba(0,0,0,0.35);"></div>
          ${badge}
        </div>`;

      const popupContent = `<strong style="font-size:13px;">${safeName}</strong><br/><span style="font-size:11px;color:#6b7280;">${s.pendingOrders} ενεργ${s.pendingOrders === 1 ? 'ή' : 'ές'} παραγγελί${s.pendingOrders === 1 ? 'α' : 'ες'}</span>`;
      const existing = nearbyMarkersRef.current.get(s.id);
      if (existing) {
        existing.getElement().innerHTML = html;
        existing.setLngLat([s.longitude, s.latitude]);
        existing.setPopup(new mapboxgl.Popup({ offset: 8 }).setHTML(popupContent));
      } else {
        const el = document.createElement('div');
        el.innerHTML = html;
        const marker = new mapboxgl.Marker({ element: el, anchor: 'center' })
          .setLngLat([s.longitude, s.latitude])
          .setPopup(new mapboxgl.Popup({ offset: 10 }).setHTML(popupContent))
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
      routeCoordsRef.current = [];
      if (map?.getSource('route')) {
        (map.getSource('route') as mapboxgl.GeoJSONSource).setData({
          type: 'Feature', geometry: { type: 'LineString', coordinates: [] }, properties: {},
        });
      }
      hasRouteRef.current = false;
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

    // Round driver pos to ~110m so small GPS jitter doesn't keep invalidating the route
    const routeKey = `${pos.lat.toFixed(3)},${pos.lng.toFixed(3)}-${destLat},${destLng}`;
    if (routeKey === lastRouteKey.current) return;
    lastRouteKey.current = routeKey;

    // Cache hit: reuse a recent route response instead of hitting Mapbox again.
    const cached = routeCacheRef.current.get(routeKey);
    let data: any | null = cached && (Date.now() - cached.at) < ROUTE_CACHE_TTL_MS ? cached.data : null;

    if (!data) {
      routeFetchRef.current?.abort();
      const ctrl = new AbortController();
      routeFetchRef.current = ctrl;
      try {
        // Use driving-traffic for live traffic-aware ETA + congestion annotations
        const url = `https://api.mapbox.com/directions/v5/mapbox/driving-traffic/${pos.lng},${pos.lat};${destLng},${destLat}?geometries=geojson&overview=full&steps=true&annotations=congestion,duration&access_token=${token}`;
        const res = await fetch(url, { signal: ctrl.signal });
        data = await res.json();
        routeCacheRef.current.set(routeKey, { at: Date.now(), data });
        // Trim cache to last 20 entries
        if (routeCacheRef.current.size > 20) {
          const firstKey = routeCacheRef.current.keys().next().value;
          if (firstKey) routeCacheRef.current.delete(firstKey);
        }
      } catch (e: any) {
        if (e.name !== 'AbortError') console.error('Route fetch error:', e);
        return;
      }
    }

    try {
      const route = data.routes?.[0];
      if (!route) return;

      const coords = route.geometry.coordinates;
      const congestion: string[] = route.legs?.[0]?.annotation?.congestion || [];

      routeCoordsRef.current = coords;

      if (map.getSource('route')) {
        (map.getSource('route') as mapboxgl.GeoJSONSource).setData({
          type: 'Feature',
          geometry: { type: 'LineString', coordinates: coords },
          properties: { congestion },
        });

        // Fetch real traffic-light signals around the route so the driver can
        // spot regulated intersections ahead during navigation.
        hasRouteRef.current = coords.length > 0;
        if (coords.length > 1) {
          const ckey = `${coords[0].join(',')}|${coords[coords.length - 1].join(',')}|${coords.length}`;
          if (ckey !== lastRouteCoordsKeyRef.current) {
            lastRouteCoordsKeyRef.current = ckey;
            const rb = new mapboxgl.LngLatBounds();
            coords.forEach((c: [number, number]) => { try { rb.extend(c); } catch { /* invalid coord */ } });
            rb.extend([pos.lng, pos.lat]);
            const exp = expandBounds(rb, 220);
            window.setTimeout(() => {
              refreshTrafficSignals(
                exp,
                `rt:${exp.getWest().toFixed(3)}:${exp.getSouth().toFixed(3)}:${exp.getEast().toFixed(3)}:${exp.getNorth().toFixed(3)}`,
              );
            }, 350);
          }
        } else {
          lastRouteCoordsKeyRef.current = '';
        }

        // Build a gradient along line-progress from congestion buckets
        if (congestion.length && coords.length > 1) {
          const colorFor = (c: string) => {
            switch (c) {
              case 'severe': return '#dc2626';
              case 'heavy': return '#f97316';
              case 'moderate': return '#facc15';
              case 'low': return '#22c55e';
              default: return '#22c55e';
            }
          };
          const stops: any[] = ['interpolate', ['linear'], ['line-progress']];
          const n = congestion.length;
          for (let i = 0; i < n; i++) {
            const t = i / n;
            stops.push(t, colorFor(congestion[i]));
          }
          stops.push(1, colorFor(congestion[n - 1]));
          try {
            map.setPaintProperty('route-line', 'line-gradient', stops as any);
          } catch {/* layer may not be ready */}
        }
      }

      // Fit route — skip while in followMode so we don't fight the follow camera
      if (!followModeRef.current) {
        const bounds = new mapboxgl.LngLatBounds();
        coords.forEach((c: [number, number]) => bounds.extend(c));
        bounds.extend([pos.lng, pos.lat]);
        map.fitBounds(bounds, { padding: getPadding(), maxZoom: 16, duration: 600 });
      }


      // Parse steps with maneuver detail for in-app turn-by-turn UI
      const steps: RouteStep[] = route.legs[0]?.steps?.map((s: any) => ({
        instruction: s.maneuver?.instruction || '',
        distance: s.distance,
        duration: s.duration,
        maneuverType: s.maneuver?.type,
        modifier: s.maneuver?.modifier,
        location: s.maneuver?.location as [number, number] | undefined,
        name: s.name || undefined,
      })) || [];

      onRouteUpdate?.({
        distance: route.distance,
        duration: route.duration,
        steps,
      });
    } catch (e: any) {
      if (e.name !== 'AbortError') console.error('Route fetch error:', e);
    }
  }, [pos, navigatingTo, storeLat, storeLng, customerLat, customerLng, token, onRouteUpdate, getPadding]);

  // Fetch route on change — fire fast on destination/nav change, then keep route fresh
  // without resetting the timer on every GPS tick (which used to delay routes indefinitely).
  const fetchRouteRef = useRef(fetchRoute);
  useEffect(() => { fetchRouteRef.current = fetchRoute; }, [fetchRoute]);

  // Immediate fetch when destination or navigation target changes
  useEffect(() => {
    const t = setTimeout(() => fetchRouteRef.current(), 150);
    return () => clearTimeout(t);
  }, [navigatingTo, storeLat, storeLng, customerLat, customerLng, token]);

  // Periodic refresh while navigating (every 8s) instead of on every GPS update
  useEffect(() => {
    if (!navigatingTo) return;
    // 20s keeps traffic ETA fresh without burning Mapbox Directions quota.
    const id = setInterval(() => fetchRouteRef.current(), 20_000);
    return () => clearInterval(id);
  }, [navigatingTo]);

  // Clear route when not navigating
  useEffect(() => {
    if (!navigatingTo) {
      const map = mapRef.current;
      routeCoordsRef.current = [];
      if (map?.getSource('route')) {
        (map.getSource('route') as mapboxgl.GeoJSONSource).setData({
          type: 'Feature', geometry: { type: 'LineString', coordinates: [] }, properties: {},
        });
      }
      onRouteUpdate?.(null);
      lastRouteKey.current = '';
      hasRouteRef.current = false;
      lastRouteCoordsKeyRef.current = '';
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

    userInteractingRef.current = false;
    if (pos) {
      const bounds = new mapboxgl.LngLatBounds();
      bounds.extend([pos.lng, pos.lat]);
      bounds.extend([lng, lat]);
      map.fitBounds(bounds, { padding: getPadding(), maxZoom: 16, duration: 800 });
    } else {
      map.flyTo({ center: [lng, lat], zoom: 15, duration: 800 });
    }
  }, [storeLat, storeLng, customerLat, customerLng, pos, getPadding]);

  const fitOverview = useCallback(() => {
    const map = mapRef.current;
    if (!map) return;
    userInteractingRef.current = false;
    // Drop follow pitch so the full area is readable
    map.easeTo({ pitch: 0, bearing: 0, duration: 200 });

    const bounds = new mapboxgl.LngLatBounds();
    let hasPoint = false;
    const add = (lng?: number | null, lat?: number | null) => {
      if (lng == null || lat == null || !Number.isFinite(lng) || !Number.isFinite(lat)) return;
      bounds.extend([lng, lat]);
      hasPoint = true;
    };
    if (pos) add(pos.lng, pos.lat);
    add(storeLng, storeLat);
    add(customerLng, customerLat);
    (nearbyStores ?? []).forEach((s) => add(s.longitude, s.latitude));

    // Include current route geometry if present
    const routeCoords = routeCoordsRef.current;
    if (routeCoords.length) {
      routeCoords.forEach((c) => {
        if (Array.isArray(c) && c.length >= 2) {
          bounds.extend([c[0], c[1]]);
          hasPoint = true;
        }
      });
    }

    if (!hasPoint) return;
    map.resize();
    requestAnimationFrame(() => {
      map.fitBounds(bounds, { padding: getPadding(), maxZoom: 15.5, duration: 800 });
    });
  }, [pos, storeLat, storeLng, customerLat, customerLng, nearbyStores, getPadding]);

  // When overlay padding changes (sheet expand/collapse), resize so tiles fill the viewport.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const t = setTimeout(() => {
      try { map.resize(); } catch { /* noop */ }
    }, 320);
    return () => clearTimeout(t);
  }, [overlayPadding?.top, overlayPadding?.bottom, overlayPadding?.left, overlayPadding?.right]);

  useImperativeHandle(ref, () => ({ recenter, focusOn, fitOverview }), [recenter, focusOn, fitOverview]);

  // Outer wrapper owns absolute/fixed fill. Mapbox sets `.mapboxgl-map { position: relative }`
  // on the container it mounts into — if that node also carries inset-0, the map collapses
  // to a thin strip and the driver shell background shows through.
  if (loading || !token) {
    return (
      <div className={`bg-muted/50 flex items-center justify-center ${className}`}>
        <div className="h-6 w-6 border-3 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className={className} data-driver-map-shell="">
      <div
        ref={mapContainer}
        className="driver-map-root"
        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', minHeight: '100%' }}
      />
    </div>
  );
});

export default DriverMapbox;
