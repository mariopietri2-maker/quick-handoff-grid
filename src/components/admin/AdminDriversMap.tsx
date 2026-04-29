import { useEffect, useRef, useState } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { useMapboxToken } from '@/hooks/useMapboxToken';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';

interface DriverLocation {
  driver_id: string;
  latitude: number;
  longitude: number;
  speed: number | null;
  heading: number | null;
  updated_at: string;
}

interface StoreMarker {
  id: string;
  name: string;
  address: string;
  latitude: number;
  longitude: number;
  is_active: boolean | null;
}

interface DriverInfo {
  driver_id: string;
  name: string;
  code: string | null;
}

export default function AdminDriversMap() {
  const mapContainer = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const markersRef = useRef<Map<string, mapboxgl.Marker>>(new Map());
  const storeMarkersRef = useRef<mapboxgl.Marker[]>([]);
  const { token, loading: tokenLoading } = useMapboxToken();

  const [locations, setLocations] = useState<DriverLocation[]>([]);
  const [driverInfos, setDriverInfos] = useState<Map<string, DriverInfo>>(new Map());
  const [stores, setStores] = useState<StoreMarker[]>([]);
  const [editStores, setEditStores] = useState(false);
  const editStoresRef = useRef(false);
  useEffect(() => { editStoresRef.current = editStores; }, [editStores]);

  // Load data
  useEffect(() => {
    async function load() {
      const [{ data: profiles }, { data: driverProfiles }, { data: storesData }] = await Promise.all([
        supabase.from('profiles').select('user_id, full_name').eq('role', 'driver' as any),
        supabase.from('driver_profiles').select('user_id, driver_code' as any),
        supabase.from('stores').select('id, name, address, latitude, longitude, is_active'),
      ]);

      const map = new Map<string, DriverInfo>();
      profiles?.forEach((p: any) => {
        map.set(p.user_id, { driver_id: p.user_id, name: p.full_name || p.user_id.slice(0, 8), code: null });
      });
      (driverProfiles as any[])?.forEach((dp: any) => {
        const existing = map.get(dp.user_id);
        if (existing) existing.code = dp.driver_code;
      });
      setDriverInfos(map);

      if (storesData) {
        // Show ALL active stores. If a store has no coords yet, place it at the
        // map's default center (Άρτα) so the admin can drag it into position.
        const DEFAULT_LAT = 39.1600;
        const DEFAULT_LNG = 20.9853;
        setStores(storesData.map(s => ({
          ...s,
          latitude: (s.latitude as number | null) ?? DEFAULT_LAT,
          longitude: (s.longitude as number | null) ?? DEFAULT_LNG,
        })) as StoreMarker[]);
      }
    }
    load();
  }, []);

  // Fetch + subscribe to driver locations
  useEffect(() => {
    supabase.from('driver_locations').select('*').then(({ data }) => {
      if (data) setLocations(data as DriverLocation[]);
    });

    const channel = supabase
      .channel('admin-driver-locations-mapbox')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'driver_locations' }, (payload) => {
        const loc = payload.new as DriverLocation;
        if (!loc?.driver_id) return;
        setLocations(prev => {
          const idx = prev.findIndex(l => l.driver_id === loc.driver_id);
          if (idx >= 0) { const u = [...prev]; u[idx] = loc; return u; }
          return [...prev, loc];
        });
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  // Init map
  useEffect(() => {
    if (!token || !mapContainer.current || mapRef.current) return;

    mapboxgl.accessToken = token;
    const map = new mapboxgl.Map({
      container: mapContainer.current,
      style: 'mapbox://styles/mapbox/dark-v11',
      center: [20.8537, 39.6650],
      zoom: 12,
      attributionControl: false,
    });

    map.addControl(new mapboxgl.NavigationControl(), 'top-right');
    mapRef.current = map;

    return () => { map.remove(); mapRef.current = null; };
  }, [token]);

  // Update markers
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    // Driver markers
    const activeIds = new Set(locations.map(l => l.driver_id));
    markersRef.current.forEach((marker, id) => {
      if (!activeIds.has(id)) { marker.remove(); markersRef.current.delete(id); }
    });

    locations.forEach(loc => {
      const info = driverInfos.get(loc.driver_id);
      const existing = markersRef.current.get(loc.driver_id);

      if (existing) {
        existing.setLngLat([loc.longitude, loc.latitude]);
      } else {
        const el = document.createElement('div');
        el.innerHTML = `<div style="width:36px;height:36px;background:#3b82f6;border-radius:50%;border:3px solid white;box-shadow:0 2px 12px rgba(59,130,246,0.5);display:flex;align-items:center;justify-content:center;font-size:16px;cursor:pointer;">🚗</div>`;
        
        const popup = new mapboxgl.Popup({ offset: 20 }).setHTML(`
          <div style="text-align:center;font-family:system-ui;padding:4px;">
            <strong>${info?.name || loc.driver_id.slice(0, 8)}</strong>
            ${info?.code ? `<br/><span style="font-size:11px;opacity:0.7;">${info.code}</span>` : ''}
            ${loc.speed != null && loc.speed > 0 ? `<br/><span style="font-size:11px;">${(loc.speed * 3.6).toFixed(0)} km/h</span>` : ''}
          </div>
        `);

        const marker = new mapboxgl.Marker({ element: el })
          .setLngLat([loc.longitude, loc.latitude])
          .setPopup(popup)
          .addTo(map);

        markersRef.current.set(loc.driver_id, marker);
      }
    });
  }, [locations, driverInfos]);

  // Store markers
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    storeMarkersRef.current.forEach(m => m.remove());
    storeMarkersRef.current = [];

    stores.forEach(store => {
      const el = document.createElement('div');
      el.innerHTML = `<div style="width:32px;height:32px;background:#f97316;border-radius:50%;border:3px solid white;box-shadow:0 2px 8px rgba(249,115,22,0.4);display:flex;align-items:center;justify-content:center;font-size:14px;cursor:${editStores ? 'grab' : 'pointer'};">🏪</div>`;

      const popup = new mapboxgl.Popup({ offset: 18 }).setHTML(`
        <div style="text-align:center;font-family:system-ui;padding:4px;">
          <strong>${store.name}</strong>
          <br/><span style="font-size:11px;opacity:0.7;">${store.address}</span>
          <br/><span style="font-size:11px;">${store.is_active ? '✅ Ενεργό' : '❌ Ανενεργό'}</span>
        </div>
      `);

      const marker = new mapboxgl.Marker({ element: el, draggable: editStores })
        .setLngLat([store.longitude, store.latitude])
        .setPopup(popup)
        .addTo(map);

      if (editStores) {
        marker.on('dragend', async () => {
          const { lng, lat } = marker.getLngLat();
          const { error } = await supabase
            .from('stores')
            .update({ latitude: lat, longitude: lng })
            .eq('id', store.id);
          if (error) {
            toast.error(`Failed to move ${store.name}`);
            marker.setLngLat([store.longitude, store.latitude]);
          } else {
            toast.success(`${store.name} moved`);
            setStores(prev => prev.map(s => s.id === store.id ? { ...s, latitude: lat, longitude: lng } : s));
          }
        });
      }

      storeMarkersRef.current.push(marker);
    });

    // Fit bounds
    const allPoints = [
      ...locations.map(l => [l.longitude, l.latitude] as [number, number]),
      ...stores.map(s => [s.longitude, s.latitude] as [number, number]),
    ];
    if (allPoints.length > 1) {
      const bounds = new mapboxgl.LngLatBounds();
      allPoints.forEach(p => bounds.extend(p));
      map.fitBounds(bounds, { padding: 60, maxZoom: 15 });
    }
  }, [stores, locations, editStores]);

  if (tokenLoading) {
    return (
      <Card>
        <CardContent className="h-[500px] flex items-center justify-center">
          <div className="h-8 w-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
        </CardContent>
      </Card>
    );
  }

  if (!token) {
    return (
      <Card>
        <CardContent className="h-[500px] flex items-center justify-center text-muted-foreground">
          Mapbox token not configured
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="font-heading font-bold text-xl">Live Χάρτης</h2>
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 rounded-md border border-border px-3 py-1.5">
            <Switch id="edit-stores" checked={editStores} onCheckedChange={setEditStores} />
            <Label htmlFor="edit-stores" className="text-xs cursor-pointer">
              Μετακίνηση καταστημάτων
            </Label>
          </div>
          <Badge variant="outline" className="gap-1.5">
            <span className="h-2 w-2 rounded-full bg-blue-500 animate-pulse" />
            {locations.length} οδηγοί
          </Badge>
          <Badge variant="outline" className="gap-1.5">
            🏪 {stores.length} καταστήματα
          </Badge>
        </div>
      </div>
      <Card className="overflow-hidden">
        <div ref={mapContainer} className="h-[500px] w-full" />
      </Card>
    </div>
  );
}
