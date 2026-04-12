import { useEffect, useRef, useState } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { useMapboxToken } from '@/hooks/useMapboxToken';

interface DriverMapboxProps {
  className?: string;
  storeLat?: number | null;
  storeLng?: number | null;
  storeName?: string;
  customerLat?: number | null;
  customerLng?: number | null;
  customerName?: string;
  customerAddress?: string | null;
}

export default function DriverMapbox({
  className,
  storeLat, storeLng, storeName,
  customerLat, customerLng, customerName, customerAddress,
}: DriverMapboxProps) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const driverMarkerRef = useRef<mapboxgl.Marker | null>(null);
  const storeMarkerRef = useRef<mapboxgl.Marker | null>(null);
  const customerMarkerRef = useRef<mapboxgl.Marker | null>(null);
  const { token, loading } = useMapboxToken();
  const [pos, setPos] = useState<{ lat: number; lng: number } | null>(null);
  const watchRef = useRef<number | null>(null);
  const initialFitDone = useRef(false);

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

    map.addControl(new mapboxgl.GeolocateControl({
      positionOptions: { enableHighAccuracy: true },
      trackUserLocation: true,
      showUserHeading: true,
    }), 'top-right');

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
          <div style="width:20px;height:20px;background:#3b82f6;border-radius:50%;border:3px solid white;box-shadow:0 0 0 4px rgba(59,130,246,0.3),0 2px 8px rgba(0,0,0,0.3);"></div>
          <div style="position:absolute;top:-2px;left:-2px;width:24px;height:24px;border-radius:50%;background:rgba(59,130,246,0.2);animation:pulse 2s infinite;"></div>
        </div>
      `;
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
      el.innerHTML = `<div style="width:36px;height:36px;background:#f97316;border-radius:12px;border:3px solid white;box-shadow:0 2px 12px rgba(249,115,22,0.4);display:flex;align-items:center;justify-content:center;font-size:18px;">🏪</div>`;
      storeMarkerRef.current = new mapboxgl.Marker({ element: el, anchor: 'center' })
        .setLngLat([storeLng, storeLat])
        .setPopup(new mapboxgl.Popup({ offset: 20 }).setHTML(`<strong>${storeName || 'Κατάστημα'}</strong>`))
        .addTo(map);
    }
  }, [storeLat, storeLng, storeName]);

  // Customer marker
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    customerMarkerRef.current?.remove();
    customerMarkerRef.current = null;

    if (customerLat != null && customerLng != null) {
      const el = document.createElement('div');
      el.innerHTML = `<div style="width:36px;height:36px;background:#22c55e;border-radius:12px;border:3px solid white;box-shadow:0 2px 12px rgba(34,197,94,0.4);display:flex;align-items:center;justify-content:center;font-size:18px;">📍</div>`;
      customerMarkerRef.current = new mapboxgl.Marker({ element: el, anchor: 'center' })
        .setLngLat([customerLng, customerLat])
        .setPopup(new mapboxgl.Popup({ offset: 20 }).setHTML(`<strong>${customerName || 'Παράδοση'}</strong><br/><span style="font-size:11px;">${customerAddress || ''}</span>`))
        .addTo(map);
    }
  }, [customerLat, customerLng, customerName, customerAddress]);

  // Fit bounds when we have multiple points
  useEffect(() => {
    const map = mapRef.current;
    if (!map || initialFitDone.current) return;

    const points: [number, number][] = [];
    if (pos) points.push([pos.lng, pos.lat]);
    if (storeLat != null && storeLng != null) points.push([storeLng, storeLat]);
    if (customerLat != null && customerLng != null) points.push([customerLng, customerLat]);

    if (points.length >= 2) {
      const bounds = new mapboxgl.LngLatBounds();
      points.forEach(p => bounds.extend(p));
      map.fitBounds(bounds, { padding: 60, maxZoom: 15 });
      initialFitDone.current = true;
    }
  }, [pos, storeLat, storeLng, customerLat, customerLng]);

  if (loading || !token) {
    return (
      <div className={`bg-muted/50 flex items-center justify-center ${className}`}>
        <div className="h-6 w-6 border-3 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return <div ref={mapContainer} className={className} style={{ minHeight: '200px' }} />;
}
