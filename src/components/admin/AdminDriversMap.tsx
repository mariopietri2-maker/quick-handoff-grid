import { useEffect, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

// Fix default marker icons
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
});

const driverIcon = new L.DivIcon({
  html: `<div style="background:hsl(217,91%,60%);width:32px;height:32px;border-radius:50%;display:flex;align-items:center;justify-content:center;border:3px solid white;box-shadow:0 2px 8px rgba(0,0,0,0.3);font-size:16px;">🚗</div>`,
  iconSize: [32, 32],
  iconAnchor: [16, 16],
  className: '',
});

interface DriverLocation {
  driver_id: string;
  latitude: number;
  longitude: number;
  speed: number | null;
  heading: number | null;
  updated_at: string;
}

interface DriverInfo {
  driver_id: string;
  name: string;
  code: string | null;
}

function FitAllMarkers({ positions }: { positions: [number, number][] }) {
  const map = useMap();
  useEffect(() => {
    if (positions.length === 0) return;
    if (positions.length === 1) {
      map.setView(positions[0], 14);
      return;
    }
    const bounds = L.latLngBounds(positions.map(p => L.latLng(p[0], p[1])));
    map.fitBounds(bounds, { padding: [40, 40], maxZoom: 16 });
  }, [positions.length]); // only fit on count change
  return null;
}

export default function AdminDriversMap() {
  const [locations, setLocations] = useState<DriverLocation[]>([]);
  const [driverInfos, setDriverInfos] = useState<Map<string, DriverInfo>>(new Map());

  // Fetch driver names
  useEffect(() => {
    async function load() {
      const [{ data: profiles }, { data: driverProfiles }] = await Promise.all([
        supabase.from('profiles').select('user_id, full_name').eq('role', 'driver' as any),
        supabase.from('driver_profiles').select('user_id, driver_code' as any),
      ]);

      const map = new Map<string, DriverInfo>();
      profiles?.forEach((p: any) => {
        map.set(p.user_id, {
          driver_id: p.user_id,
          name: p.full_name || p.user_id.slice(0, 8),
          code: null,
        });
      });
      (driverProfiles as any[])?.forEach((dp: any) => {
        const existing = map.get(dp.user_id);
        if (existing) existing.code = dp.driver_code;
      });
      setDriverInfos(map);
    }
    load();
  }, []);

  // Fetch initial locations + subscribe to realtime
  useEffect(() => {
    supabase
      .from('driver_locations')
      .select('*')
      .then(({ data }) => {
        if (data) setLocations(data as DriverLocation[]);
      });

    const channel = supabase
      .channel('admin-driver-locations')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'driver_locations',
      }, (payload) => {
        const loc = payload.new as DriverLocation;
        if (!loc?.driver_id) return;
        setLocations(prev => {
          const idx = prev.findIndex(l => l.driver_id === loc.driver_id);
          if (idx >= 0) {
            const updated = [...prev];
            updated[idx] = loc;
            return updated;
          }
          return [...prev, loc];
        });
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  const positions: [number, number][] = locations.map(l => [l.latitude, l.longitude]);
  const centerLat = positions.length ? positions.reduce((s, p) => s + p[0], 0) / positions.length : 39.6650;
  const centerLng = positions.length ? positions.reduce((s, p) => s + p[1], 0) / positions.length : 20.8537;

  const timeSince = (isoDate: string) => {
    const diffSec = Math.round((Date.now() - new Date(isoDate).getTime()) / 1000);
    if (diffSec < 60) return `${diffSec}δ πριν`;
    if (diffSec < 3600) return `${Math.round(diffSec / 60)}λ πριν`;
    return `${Math.round(diffSec / 3600)}ω πριν`;
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="font-heading">Χάρτης Οδηγών (Live)</CardTitle>
        <Badge variant="outline" className="gap-1.5">
          <span className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
          {locations.length} online
        </Badge>
      </CardHeader>
      <CardContent>
        <div className="rounded-xl overflow-hidden border border-border" style={{ height: '450px' }}>
          <MapContainer
            center={[centerLat, centerLng]}
            zoom={13}
            style={{ height: '100%', width: '100%' }}
            zoomControl={true}
            attributionControl={false}
          >
            <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
            {locations.map(loc => {
              const info = driverInfos.get(loc.driver_id);
              return (
                <Marker key={loc.driver_id} position={[loc.latitude, loc.longitude]} icon={driverIcon}>
                  <Popup>
                    <div className="text-center space-y-1">
                      <strong>{info?.name || loc.driver_id.slice(0, 8)}</strong>
                      {info?.code && <div className="text-xs opacity-70">{info.code}</div>}
                      <div className="text-xs">
                        {loc.speed != null && loc.speed > 0 && <span>{(loc.speed * 3.6).toFixed(0)} km/h · </span>}
                        {timeSince(loc.updated_at)}
                      </div>
                    </div>
                  </Popup>
                </Marker>
              );
            })}
            {positions.length > 0 && <FitAllMarkers positions={positions} />}
          </MapContainer>
        </div>
      </CardContent>
    </Card>
  );
}
