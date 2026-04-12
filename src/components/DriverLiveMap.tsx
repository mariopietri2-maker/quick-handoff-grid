import { useEffect, useRef, useState } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { useMapboxToken } from '@/hooks/useMapboxToken';
import { supabase } from '@/integrations/supabase/client';

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
  const a = Math.sin(dLat / 2) ** 2 + Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export default function DriverLiveMap({ driverId, deliveryLat, deliveryLng, deliveryAddress }: DriverLiveMapProps) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const driverMarkerRef = useRef<mapboxgl.Marker | null>(null);
  const deliveryMarkerRef = useRef<mapboxgl.Marker | null>(null);
  const { token, loading } = useMapboxToken();

  const [driverLat, setDriverLat] = useState<number | null>(null);
  const [driverLng, setDriverLng] = useState<number | null>(null);

  // Subscribe to driver location
  useEffect(() => {
    supabase.from('driver_locations').select('latitude, longitude').eq('driver_id', driverId)
      .order('updated_at', { ascending: false }).limit(1).single()
      .then(({ data }) => { if (data) { setDriverLat(data.latitude); setDriverLng(data.longitude); } });

    const channel = supabase
      .channel(`driver-loc-${driverId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'driver_locations', filter: `driver_id=eq.${driverId}` },
        (payload) => { const loc = payload.new as any; if (loc?.latitude) { setDriverLat(loc.latitude); setDriverLng(loc.longitude); } })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [driverId]);

  const centerLat = driverLat ?? deliveryLat;
  const centerLng = driverLng ?? deliveryLng;

  const eta = (driverLat != null && driverLng != null && deliveryLat != null && deliveryLng != null)
    ? (() => { const d = haversineKm(driverLat, driverLng, deliveryLat, deliveryLng); return { distKm: d, minutes: Math.round((d / 30) * 60) }; })()
    : null;

  // Init map
  useEffect(() => {
    if (!token || !mapContainer.current || mapRef.current || centerLat == null || centerLng == null) return;
    mapboxgl.accessToken = token;

    const map = new mapboxgl.Map({
      container: mapContainer.current,
      style: 'mapbox://styles/mapbox/streets-v12',
      center: [centerLng, centerLat],
      zoom: 14,
      attributionControl: false,
    });

    mapRef.current = map;
    return () => { map.remove(); mapRef.current = null; };
  }, [token, centerLat != null]);

  // Driver marker
  useEffect(() => {
    const map = mapRef.current;
    if (!map || driverLat == null || driverLng == null) return;

    if (driverMarkerRef.current) {
      driverMarkerRef.current.setLngLat([driverLng, driverLat]);
    } else {
      const el = document.createElement('div');
      el.innerHTML = `<div style="width:40px;height:40px;background:#3b82f6;border-radius:50%;border:3px solid white;box-shadow:0 0 0 4px rgba(59,130,246,0.3),0 2px 12px rgba(0,0,0,0.3);display:flex;align-items:center;justify-content:center;font-size:20px;">🚗</div>`;
      driverMarkerRef.current = new mapboxgl.Marker({ element: el })
        .setLngLat([driverLng, driverLat])
        .setPopup(new mapboxgl.Popup({ offset: 22 }).setText('Ο οδηγός σας'))
        .addTo(map);
    }

    map.easeTo({ center: [driverLng, driverLat], duration: 1000 });
  }, [driverLat, driverLng]);

  // Delivery marker
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    deliveryMarkerRef.current?.remove();
    deliveryMarkerRef.current = null;

    if (deliveryLat != null && deliveryLng != null) {
      const el = document.createElement('div');
      el.innerHTML = `<div style="width:36px;height:36px;background:#22c55e;border-radius:50%;border:3px solid white;box-shadow:0 2px 12px rgba(34,197,94,0.4);display:flex;align-items:center;justify-content:center;font-size:18px;">📍</div>`;
      deliveryMarkerRef.current = new mapboxgl.Marker({ element: el })
        .setLngLat([deliveryLng, deliveryLat])
        .setPopup(new mapboxgl.Popup({ offset: 20 }).setHTML(`<strong>${deliveryAddress || 'Παράδοση'}</strong>`))
        .addTo(map);
    }
  }, [deliveryLat, deliveryLng, deliveryAddress]);

  if (loading) {
    return <div className="h-[250px] rounded-xl bg-muted flex items-center justify-center"><div className="h-6 w-6 border-3 border-primary border-t-transparent rounded-full animate-spin" /></div>;
  }

  if (centerLat == null || centerLng == null) {
    return <div className="h-[250px] rounded-xl bg-muted flex items-center justify-center"><p className="text-sm text-muted-foreground">Αναμονή τοποθεσίας οδηγού...</p></div>;
  }

  return (
    <div className="rounded-xl overflow-hidden border border-border shadow-[var(--shadow-md)]">
      {eta && (
        <div className="bg-card px-4 py-2.5 flex items-center justify-between border-b border-border">
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-sm font-heading">Εκτ. Άφιξη</span>
          </div>
          <div className="text-right">
            <span className="font-heading font-bold">{eta.minutes < 1 ? '< 1' : eta.minutes} λεπ.</span>
            <span className="text-xs text-muted-foreground ml-2">({eta.distKm < 1 ? `${Math.round(eta.distKm * 1000)}μ` : `${eta.distKm.toFixed(1)}χλμ`})</span>
          </div>
        </div>
      )}
      <div ref={mapContainer} style={{ height: '250px', width: '100%' }} />
    </div>
  );
}
