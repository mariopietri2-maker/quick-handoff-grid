import { useEffect, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { supabase } from '@/integrations/supabase/client';

// Fix default marker icons for bundlers
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
});

const driverIcon = new L.DivIcon({
  html: `<div style="background:hsl(var(--primary));width:36px;height:36px;border-radius:50%;display:flex;align-items:center;justify-content:center;border:3px solid white;box-shadow:0 2px 8px rgba(0,0,0,0.3);font-size:18px;">🚗</div>`,
  iconSize: [36, 36],
  iconAnchor: [18, 18],
  className: '',
});

const deliveryIcon = new L.DivIcon({
  html: `<div style="background:#22c55e;width:32px;height:32px;border-radius:50%;display:flex;align-items:center;justify-content:center;border:3px solid white;box-shadow:0 2px 8px rgba(0,0,0,0.3);font-size:16px;">📍</div>`,
  iconSize: [32, 32],
  iconAnchor: [16, 16],
  className: '',
});

function RecenterMap({ lat, lng }: { lat: number; lng: number }) {
  const map = useMap();
  useEffect(() => {
    map.setView([lat, lng], map.getZoom(), { animate: true });
  }, [lat, lng, map]);
  return null;
}

interface DriverLiveMapProps {
  driverId: string;
  deliveryLat?: number | null;
  deliveryLng?: number | null;
  deliveryAddress?: string | null;
}

function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

const AVG_SPEED_KMH = 30; // average city driving speed

export default function DriverLiveMap({ driverId, deliveryLat, deliveryLng, deliveryAddress }: DriverLiveMapProps) {
  const [driverLat, setDriverLat] = useState<number | null>(null);
  const [driverLng, setDriverLng] = useState<number | null>(null);

  useEffect(() => {
    supabase
      .from('driver_locations')
      .select('latitude, longitude')
      .eq('driver_id', driverId)
      .order('updated_at', { ascending: false })
      .limit(1)
      .single()
      .then(({ data }) => {
        if (data) {
          setDriverLat(data.latitude);
          setDriverLng(data.longitude);
        }
      });

    const channel = supabase
      .channel(`driver-loc-${driverId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'driver_locations',
        filter: `driver_id=eq.${driverId}`,
      }, (payload) => {
        const loc = payload.new as any;
        if (loc?.latitude && loc?.longitude) {
          setDriverLat(loc.latitude);
          setDriverLng(loc.longitude);
        }
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [driverId]);

  const centerLat = driverLat ?? deliveryLat;
  const centerLng = driverLng ?? deliveryLng;

  // Calculate ETA
  const eta = (driverLat != null && driverLng != null && deliveryLat != null && deliveryLng != null)
    ? (() => {
        const distKm = haversineKm(driverLat, driverLng, deliveryLat, deliveryLng);
        const minutes = Math.round((distKm / AVG_SPEED_KMH) * 60);
        return { distKm, minutes };
      })()
    : null;

  if (centerLat == null || centerLng == null) {
    return (
      <div className="h-[250px] rounded-xl bg-muted flex items-center justify-center">
        <p className="text-sm text-muted-foreground">Αναμονή τοποθεσίας οδηγού...</p>
      </div>
    );
  }

  return (
    <div className="rounded-xl overflow-hidden border border-border shadow-[var(--shadow-md)]">
      {eta && (
        <div className="bg-card px-4 py-2.5 flex items-center justify-between border-b border-border">
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-success animate-pulse" />
            <span className="text-sm font-heading text-foreground">ETA</span>
          </div>
          <div className="text-right">
            <span className="font-heading font-bold text-foreground">
              {eta.minutes < 1 ? '< 1' : eta.minutes} min
            </span>
            <span className="text-xs text-muted-foreground ml-2">
              ({eta.distKm < 1 ? `${Math.round(eta.distKm * 1000)}m` : `${eta.distKm.toFixed(1)}km`})
            </span>
          </div>
        </div>
      )}
      <MapContainer
        center={[centerLat, centerLng]}
        zoom={14}
        style={{ height: '250px', width: '100%' }}
        zoomControl={false}
        attributionControl={false}
      >
        <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
        {driverLat != null && driverLng != null && (
          <>
            <Marker position={[driverLat, driverLng]} icon={driverIcon}>
              <Popup>Driver is here</Popup>
            </Marker>
            <RecenterMap lat={driverLat} lng={driverLng} />
          </>
        )}
        {deliveryLat != null && deliveryLng != null && (
          <Marker position={[deliveryLat, deliveryLng]} icon={deliveryIcon}>
            <Popup>{deliveryAddress || 'Delivery location'}</Popup>
          </Marker>
        )}
      </MapContainer>
    </div>
  );
}