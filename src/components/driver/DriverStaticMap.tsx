import { useEffect, useState, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Fix default marker icons for bundlers
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
});

const driverDot = new L.DivIcon({
  html: `<div style="width:22px;height:22px;background:hsl(217 91% 60%);border-radius:50%;border:3px solid white;box-shadow:0 0 0 2px hsl(217 91% 60% / 0.3), 0 2px 8px rgba(0,0,0,0.3);"></div>`,
  iconSize: [22, 22],
  iconAnchor: [11, 11],
  className: '',
});

const storeIcon = new L.DivIcon({
  html: `<div style="width:28px;height:28px;background:hsl(25 95% 53%);border-radius:50%;border:3px solid white;box-shadow:0 2px 8px rgba(0,0,0,0.3);display:flex;align-items:center;justify-content:center;font-size:14px;">🏪</div>`,
  iconSize: [28, 28],
  iconAnchor: [14, 14],
  className: '',
});

const customerIcon = new L.DivIcon({
  html: `<div style="width:28px;height:28px;background:hsl(142 71% 45%);border-radius:50%;border:3px solid white;box-shadow:0 2px 8px rgba(0,0,0,0.3);display:flex;align-items:center;justify-content:center;font-size:14px;">📍</div>`,
  iconSize: [28, 28],
  iconAnchor: [14, 14],
  className: '',
});

function LiveTracker({ lat, lng }: { lat: number; lng: number }) {
  const map = useMap();
  const isFirstRef = useRef(true);
  useEffect(() => {
    if (isFirstRef.current) {
      map.setView([lat, lng], 15, { animate: false });
      isFirstRef.current = false;
    }
  }, [lat, lng, map]);
  return null;
}

function FitBounds({ points }: { points: [number, number][] }) {
  const map = useMap();
  const fittedRef = useRef(false);
  useEffect(() => {
    if (points.length >= 2 && !fittedRef.current) {
      const bounds = L.latLngBounds(points.map(p => L.latLng(p[0], p[1])));
      map.fitBounds(bounds, { padding: [50, 50], maxZoom: 16 });
      fittedRef.current = true;
    }
  }, [points, map]);
  return null;
}

interface DriverStaticMapProps {
  className?: string;
  liveMode?: boolean;
  storeLat?: number | null;
  storeLng?: number | null;
  storeName?: string;
  customerLat?: number | null;
  customerLng?: number | null;
  customerName?: string;
}

export default function DriverStaticMap({
  className,
  liveMode = false,
  storeLat,
  storeLng,
  storeName,
  customerLat,
  customerLng,
  customerName,
}: DriverStaticMapProps) {
  const [pos, setPos] = useState<{ lat: number; lng: number } | null>(null);
  const watchRef = useRef<number | null>(null);

  useEffect(() => {
    if (!('geolocation' in navigator)) return;

    if (liveMode) {
      // Live tracking with watchPosition
      watchRef.current = navigator.geolocation.watchPosition(
        (p) => setPos({ lat: p.coords.latitude, lng: p.coords.longitude }),
        () => setPos({ lat: 39.6650, lng: 20.8537 }), // fallback Ioannina
        { enableHighAccuracy: true, maximumAge: 3000, timeout: 15000 }
      );
      return () => {
        if (watchRef.current !== null) {
          navigator.geolocation.clearWatch(watchRef.current);
        }
      };
    } else {
      navigator.geolocation.getCurrentPosition(
        (p) => setPos({ lat: p.coords.latitude, lng: p.coords.longitude }),
        () => setPos({ lat: 39.6650, lng: 20.8537 }), // fallback Ioannina
        { enableHighAccuracy: false, timeout: 10000 }
      );
    }
  }, [liveMode]);

  const lat = pos?.lat ?? 39.6650;
  const lng = pos?.lng ?? 20.8537;

  // Collect points for fitting bounds
  const boundsPoints: [number, number][] = [];
  if (pos) boundsPoints.push([pos.lat, pos.lng]);
  if (storeLat && storeLng) boundsPoints.push([storeLat, storeLng]);
  if (customerLat && customerLng) boundsPoints.push([customerLat, customerLng]);

  return (
    <div className={className}>
      <MapContainer
        center={[lat, lng]}
        zoom={14}
        style={{ height: '100%', width: '100%' }}
        zoomControl={false}
        attributionControl={false}
        dragging={liveMode}
        scrollWheelZoom={liveMode}
        doubleClickZoom={liveMode}
        touchZoom={liveMode}
      >
        <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
        
        {pos && (
          <>
            <Marker position={[pos.lat, pos.lng]} icon={driverDot}>
              <Popup>Εσύ</Popup>
            </Marker>
            <LiveTracker lat={pos.lat} lng={pos.lng} />
          </>
        )}

        {/* Store marker */}
        {storeLat && storeLng && (
          <Marker position={[storeLat, storeLng]} icon={storeIcon}>
            <Popup>{storeName || 'Κατάστημα'}</Popup>
          </Marker>
        )}

        {/* Customer marker */}
        {customerLat && customerLng && (
          <Marker position={[customerLat, customerLng]} icon={customerIcon}>
            <Popup>{customerName || 'Πελάτης'}</Popup>
          </Marker>
        )}

        {/* Fit bounds when we have multiple points */}
        {liveMode && boundsPoints.length >= 2 && (
          <FitBounds points={boundsPoints} />
        )}
      </MapContainer>
    </div>
  );
}
