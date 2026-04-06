import { useEffect, useState } from 'react';
import { MapContainer, TileLayer, Marker, useMap } from 'react-leaflet';
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
  html: `<div style="width:20px;height:20px;background:hsl(217 91% 60%);border-radius:50%;border:3px solid white;box-shadow:0 0 0 2px hsl(217 91% 60% / 0.3), 0 2px 8px rgba(0,0,0,0.3);"></div>`,
  iconSize: [20, 20],
  iconAnchor: [10, 10],
  className: '',
});

function RecenterOnce({ lat, lng }: { lat: number; lng: number }) {
  const map = useMap();
  useEffect(() => {
    map.setView([lat, lng], 14, { animate: true });
  }, [lat, lng, map]);
  return null;
}

interface DriverStaticMapProps {
  className?: string;
}

export default function DriverStaticMap({ className }: DriverStaticMapProps) {
  const [pos, setPos] = useState<{ lat: number; lng: number } | null>(null);

  useEffect(() => {
    if (!('geolocation' in navigator)) return;
    navigator.geolocation.getCurrentPosition(
      (p) => setPos({ lat: p.coords.latitude, lng: p.coords.longitude }),
      () => setPos({ lat: 37.7749, lng: -122.4194 }), // fallback SF
      { enableHighAccuracy: false, timeout: 10000 }
    );
  }, []);

  const lat = pos?.lat ?? 37.7749;
  const lng = pos?.lng ?? -122.4194;

  return (
    <div className={className}>
      <MapContainer
        center={[lat, lng]}
        zoom={14}
        style={{ height: '100%', width: '100%' }}
        zoomControl={false}
        attributionControl={false}
        dragging={false}
        scrollWheelZoom={false}
        doubleClickZoom={false}
        touchZoom={false}
      >
        <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
        {pos && (
          <>
            <Marker position={[pos.lat, pos.lng]} icon={driverDot} />
            <RecenterOnce lat={pos.lat} lng={pos.lng} />
          </>
        )}
      </MapContainer>
    </div>
  );
}
