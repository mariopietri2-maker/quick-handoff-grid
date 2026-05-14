import { useEffect, useMemo, useRef, useState } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { useMapboxToken } from '@/hooks/useMapboxToken';
import { supabase } from '@/integrations/supabase/client';
import { escapeHtml } from '@/lib/escape-html';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Activity, Bike, Car, MapPin, Package, Store as StoreIcon, TrendingUp, Users, Zap } from 'lucide-react';
import { format } from 'date-fns';

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
  vehicle_type: string | null;
  is_active: boolean;
}
interface StoreMarker {
  id: string;
  name: string;
  address: string;
  latitude: number;
  longitude: number;
  is_active: boolean | null;
  busy_mode: boolean | null;
}
interface DriverStat {
  deliveries: number;
  earnings: number;
  km: number;
  active: boolean;
}

const DEFAULT_CENTER: [number, number] = [20.8537, 39.665];

export default function LiveOpsMap() {
  const mapContainer = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const driverMarkersRef = useRef<Map<string, mapboxgl.Marker>>(new Map());
  const storeMarkersRef = useRef<mapboxgl.Marker[]>([]);
  const { token, loading: tokenLoading } = useMapboxToken();

  const [locations, setLocations] = useState<DriverLocation[]>([]);
  const [driverInfos, setDriverInfos] = useState<Map<string, DriverInfo>>(new Map());
  const [stores, setStores] = useState<StoreMarker[]>([]);
  const [todayOrders, setTodayOrders] = useState<any[]>([]);
  const [todayEarnings, setTodayEarnings] = useState<any[]>([]);
  const [hoveredDriverId, setHoveredDriverId] = useState<string | null>(null);
  const [, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 60_000);
    return () => clearInterval(id);
  }, []);

  // Initial load
  useEffect(() => {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    async function load() {
      const [{ data: profiles }, { data: dProfiles }, { data: storesData }, { data: orders }, { data: earnings }] =
        await Promise.all([
          supabase.from('profiles').select('user_id, full_name').eq('role', 'driver' as any),
          supabase.from('driver_profiles').select('user_id, driver_code, vehicle_type, is_active' as any),
          supabase.from('stores').select('id, name, address, latitude, longitude, is_active, busy_mode'),
          supabase
            .from('orders')
            .select('id, driver_id, status, distance_km, total_amount, created_at')
            .gte('created_at', todayStart.toISOString()),
          supabase.from('earnings').select('driver_id, total, created_at').gte('created_at', todayStart.toISOString()),
        ]);

      const map = new Map<string, DriverInfo>();
      profiles?.forEach((p: any) => {
        map.set(p.user_id, {
          driver_id: p.user_id,
          name: p.full_name || p.user_id.slice(0, 8),
          code: null,
          vehicle_type: null,
          is_active: false,
        });
      });
      (dProfiles as any[])?.forEach((dp: any) => {
        const ex = map.get(dp.user_id);
        if (ex) {
          ex.code = dp.driver_code;
          ex.vehicle_type = dp.vehicle_type;
          ex.is_active = !!dp.is_active;
        }
      });
      setDriverInfos(map);

      if (storesData) {
        setStores(storesData.filter((s) => s.latitude != null && s.longitude != null) as StoreMarker[]);
      }
      setTodayOrders(orders ?? []);
      setTodayEarnings(earnings ?? []);
    }
    load();
  }, []);

  // Live driver locations
  useEffect(() => {
    supabase
      .from('driver_locations')
      .select('*')
      .then(({ data }) => {
        if (data) setLocations(data as DriverLocation[]);
      });

    const channel = supabase
      .channel('admin-liveops-locations')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'driver_locations' }, (payload) => {
        const loc = payload.new as DriverLocation;
        if (!loc?.driver_id) return;
        setLocations((prev) => {
          const idx = prev.findIndex((l) => l.driver_id === loc.driver_id);
          if (idx >= 0) {
            const u = [...prev];
            u[idx] = loc;
            return u;
          }
          return [...prev, loc];
        });
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, () => {
        // Refresh today's orders snapshot lightly
        const todayStart = new Date();
        todayStart.setHours(0, 0, 0, 0);
        supabase
          .from('orders')
          .select('id, driver_id, status, distance_km, total_amount, created_at')
          .gte('created_at', todayStart.toISOString())
          .then(({ data }) => data && setTodayOrders(data));
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  // Per-driver stats today
  const statsByDriver = useMemo(() => {
    const stats = new Map<string, DriverStat>();
    driverInfos.forEach((info, id) => {
      stats.set(id, { deliveries: 0, earnings: 0, km: 0, active: info.is_active });
    });
    todayOrders.forEach((o) => {
      if (!o.driver_id) return;
      const s = stats.get(o.driver_id) ?? { deliveries: 0, earnings: 0, km: 0, active: false };
      if (o.status === 'delivered') {
        s.deliveries += 1;
        s.km += Number(o.distance_km ?? 0);
      }
      stats.set(o.driver_id, s);
    });
    todayEarnings.forEach((e) => {
      if (!e.driver_id) return;
      const s = stats.get(e.driver_id) ?? { deliveries: 0, earnings: 0, km: 0, active: false };
      s.earnings += Number(e.total ?? 0);
      stats.set(e.driver_id, s);
    });
    return stats;
  }, [todayOrders, todayEarnings, driverInfos]);

  // Init map
  useEffect(() => {
    if (!token || !mapContainer.current || mapRef.current) return;
    mapboxgl.accessToken = token;
    const map = new mapboxgl.Map({
      container: mapContainer.current,
      style: 'mapbox://styles/mapbox/dark-v11',
      center: DEFAULT_CENTER,
      zoom: 12,
      attributionControl: false,
    });
    map.addControl(new mapboxgl.NavigationControl({ showCompass: false }), 'top-right');
    mapRef.current = map;
    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, [token]);

  // Driver markers
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const activeIds = new Set(locations.map((l) => l.driver_id));
    driverMarkersRef.current.forEach((marker, id) => {
      if (!activeIds.has(id)) {
        marker.remove();
        driverMarkersRef.current.delete(id);
      }
    });

    locations.forEach((loc) => {
      const info = driverInfos.get(loc.driver_id);
      const stat = statsByDriver.get(loc.driver_id);
      const existing = driverMarkersRef.current.get(loc.driver_id);

      const vehicleEmoji = info?.vehicle_type === 'car' ? '🚗' : info?.vehicle_type === 'bike' ? '🚲' : '🛵';
      const isMoving = (loc.speed ?? 0) > 1;
      const ageMs = Date.now() - new Date(loc.updated_at).getTime();
      const isGhosting = ageMs > 10 * 60 * 1000; // >10 min stale GPS
      const ringColor = isGhosting ? '#f97316' : isMoving ? '#22c55e' : '#3b82f6';

      const html = `
        <div style="position:relative;">
          <div style="position:absolute;inset:-8px;border-radius:50%;background:${ringColor};opacity:${isGhosting ? 0.45 : 0.25};animation:pulse 2s infinite;"></div>
          <div style="position:relative;width:40px;height:40px;background:hsl(222 47% 11%);border-radius:50%;border:3px solid ${ringColor};box-shadow:0 4px 16px rgba(0,0,0,0.4);display:flex;align-items:center;justify-content:center;font-size:18px;cursor:pointer;">
            ${vehicleEmoji}
          </div>
          ${isGhosting ? `<div style="position:absolute;-bottom:-4px;left:50%;transform:translateX(-50%);background:#f97316;color:white;font-size:9px;font-weight:700;border-radius:4px;padding:1px 4px;white-space:nowrap;border:1px solid hsl(222 47% 11%);">GHOST</div>` : ''}
          ${stat && stat.deliveries > 0 ? `<div style="position:absolute;top:-4px;right:-4px;background:hsl(var(--primary));color:white;font-size:10px;font-weight:700;border-radius:9999px;min-width:18px;height:18px;padding:0 5px;display:flex;align-items:center;justify-content:center;border:2px solid hsl(222 47% 11%);">${stat.deliveries}</div>` : ''}
        </div>
      `;

      const popupHTML = `
        <div style="font-family:system-ui;padding:6px 4px;min-width:180px;">
          <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;">
            <span style="font-size:18px;">${vehicleEmoji}</span>
            <div>
              <div style="font-weight:700;font-size:13px;">${escapeHtml(info?.name || loc.driver_id.slice(0, 8))}</div>
              ${info?.code ? `<div style="font-size:10px;opacity:0.6;">${escapeHtml(info.code)}</div>` : ''}
            </div>
          </div>
          <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:6px;font-size:11px;">
            <div style="text-align:center;padding:4px;background:rgba(34,197,94,0.1);border-radius:6px;">
              <div style="font-weight:700;color:#22c55e;">${stat?.deliveries ?? 0}</div>
              <div style="opacity:0.7;font-size:9px;">deliveries</div>
            </div>
            <div style="text-align:center;padding:4px;background:rgba(59,130,246,0.1);border-radius:6px;">
              <div style="font-weight:700;color:#3b82f6;">${(stat?.km ?? 0).toFixed(1)}</div>
              <div style="opacity:0.7;font-size:9px;">km</div>
            </div>
            <div style="text-align:center;padding:4px;background:rgba(168,85,247,0.1);border-radius:6px;">
              <div style="font-weight:700;color:#a855f7;">€${(stat?.earnings ?? 0).toFixed(0)}</div>
              <div style="opacity:0.7;font-size:9px;">earned</div>
            </div>
          </div>
          ${loc.speed != null && loc.speed > 0 ? `<div style="margin-top:6px;font-size:10px;text-align:center;opacity:0.7;">Speed: ${(loc.speed * 3.6).toFixed(0)} km/h</div>` : ''}
        </div>
      `;

      if (existing) {
        existing.setLngLat([loc.longitude, loc.latitude]);
        const el = existing.getElement();
        el.innerHTML = html;
        existing.getPopup()?.setHTML(popupHTML);
      } else {
        const el = document.createElement('div');
        el.innerHTML = html;
        const popup = new mapboxgl.Popup({ offset: 24, closeButton: false }).setHTML(popupHTML);
        const marker = new mapboxgl.Marker({ element: el }).setLngLat([loc.longitude, loc.latitude]).setPopup(popup).addTo(map);
        driverMarkersRef.current.set(loc.driver_id, marker);
      }
    });
  }, [locations, driverInfos, statsByDriver]);

  // Store markers
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    storeMarkersRef.current.forEach((m) => m.remove());
    storeMarkersRef.current = [];

    stores.forEach((store) => {
      const color = store.is_active ? (store.busy_mode ? '#f97316' : '#10b981') : '#6b7280';
      const el = document.createElement('div');
      el.innerHTML = `
        <div style="width:30px;height:30px;background:${color};border-radius:8px;border:2px solid white;box-shadow:0 2px 10px rgba(0,0,0,0.3);display:flex;align-items:center;justify-content:center;font-size:14px;cursor:pointer;transform:rotate(0deg);">
          🏪
        </div>
      `;
      const popup = new mapboxgl.Popup({ offset: 18, closeButton: false }).setHTML(`
        <div style="font-family:system-ui;padding:4px;min-width:160px;">
          <div style="font-weight:700;font-size:13px;margin-bottom:2px;">${store.name}</div>
          <div style="font-size:10px;opacity:0.7;margin-bottom:6px;">${store.address}</div>
          <div style="display:flex;gap:4px;flex-wrap:wrap;">
            <span style="font-size:10px;padding:2px 6px;background:${store.is_active ? 'rgba(16,185,129,0.15)' : 'rgba(107,114,128,0.15)'};color:${store.is_active ? '#10b981' : '#6b7280'};border-radius:4px;font-weight:600;">${store.is_active ? 'Active' : 'Inactive'}</span>
            ${store.busy_mode ? `<span style="font-size:10px;padding:2px 6px;background:rgba(249,115,22,0.15);color:#f97316;border-radius:4px;font-weight:600;">Busy</span>` : ''}
          </div>
        </div>
      `);
      const marker = new mapboxgl.Marker({ element: el }).setLngLat([store.longitude, store.latitude]).setPopup(popup).addTo(map);
      storeMarkersRef.current.push(marker);
    });

    // Fit bounds once on initial data
    const allPoints = [
      ...locations.map((l) => [l.longitude, l.latitude] as [number, number]),
      ...stores.map((s) => [s.longitude, s.latitude] as [number, number]),
    ];
    if (allPoints.length > 1) {
      const bounds = new mapboxgl.LngLatBounds();
      allPoints.forEach((p) => bounds.extend(p));
      map.fitBounds(bounds, { padding: 80, maxZoom: 14, duration: 800 });
    }
  }, [stores, locations]);

  // Fly to driver on hover
  useEffect(() => {
    if (!hoveredDriverId || !mapRef.current) return;
    const loc = locations.find((l) => l.driver_id === hoveredDriverId);
    if (loc) mapRef.current.flyTo({ center: [loc.longitude, loc.latitude], zoom: 15, duration: 600 });
  }, [hoveredDriverId, locations]);

  // Aggregate KPIs
  const kpis = useMemo(() => {
    const activeDrivers = locations.length;
    const onlineDrivers = Array.from(driverInfos.values()).filter((d) => d.is_active).length;
    const totalDeliveriesToday = todayOrders.filter((o) => o.status === 'delivered').length;
    const totalKmToday = todayOrders.reduce((s, o) => s + (o.status === 'delivered' ? Number(o.distance_km ?? 0) : 0), 0);
    const totalEarningsToday = todayEarnings.reduce((s, e) => s + Number(e.total ?? 0), 0);
    const inProgress = todayOrders.filter((o) => ['accepted', 'preparing', 'ready', 'picked_up'].includes(o.status)).length;
    return { activeDrivers, onlineDrivers, totalDeliveriesToday, totalKmToday, totalEarningsToday, inProgress };
  }, [locations, driverInfos, todayOrders, todayEarnings]);

  // Driver leaderboard for sidebar
  const leaderboard = useMemo(() => {
    return Array.from(statsByDriver.entries())
      .map(([id, s]) => ({ id, ...s, info: driverInfos.get(id), location: locations.find((l) => l.driver_id === id) }))
      .filter((d) => d.info)
      .sort((a, b) => b.deliveries - a.deliveries || b.earnings - a.earnings)
      .slice(0, 12);
  }, [statsByDriver, driverInfos, locations]);

  if (tokenLoading) {
    return (
      <Card className="h-[640px] flex items-center justify-center">
        <div className="h-8 w-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </Card>
    );
  }

  if (!token) {
    return (
      <Card className="h-[640px] flex items-center justify-center text-muted-foreground">
        Mapbox token not configured
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      {/* Header strip */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <div className="h-9 w-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
            <Activity className="h-4 w-4" />
          </div>
          <div>
            <h2 className="font-heading font-bold text-lg leading-tight">Live Operations</h2>
            <p className="text-xs text-muted-foreground">Real-time fleet & store activity</p>
          </div>
        </div>
        <Badge variant="outline" className="gap-1.5 px-2 py-1">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
          <span className="text-xs font-medium">Live</span>
        </Badge>
      </div>

      {/* KPI strip — compact */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2">
        <MiniKpi icon={MapPin} label="On map" value={kpis.activeDrivers} tone="emerald" />
        <MiniKpi icon={Users} label="Online" value={kpis.onlineDrivers} tone="blue" />
        <MiniKpi icon={Package} label="Delivered" value={kpis.totalDeliveriesToday} tone="violet" sub="today" />
        <MiniKpi icon={Zap} label="In progress" value={kpis.inProgress} tone="orange" />
        <MiniKpi icon={TrendingUp} label="Earnings" value={`€${kpis.totalEarningsToday.toFixed(0)}`} tone="primary" sub="today" />
        <MiniKpi icon={StoreIcon} label="Stores" value={stores.length} tone="slate" />
      </div>

      {/* Map + Leaderboard */}
      <div className="grid lg:grid-cols-[1fr_280px] gap-3">
        <Card className="overflow-hidden relative">
          <div ref={mapContainer} className="h-[520px] w-full" />
          {/* Floating legend */}
          <div className="absolute bottom-3 left-3 bg-card/90 backdrop-blur-md border rounded-lg px-3 py-2 shadow-lg">
            <div className="flex flex-col gap-1.5 text-[11px]">
              <LegendDot color="#22c55e" label="Driver moving" />
              <LegendDot color="#3b82f6" label="Driver idle" />
              <LegendDot color="#f97316" label="GPS stale (>10min)" />
              <LegendDot color="#10b981" label="Store active" square />
              <LegendDot color="#f97316" label="Store busy" square />
            </div>
          </div>
        </Card>

        {/* Leaderboard sidebar */}
        <Card className="overflow-hidden">
          <div className="p-3 border-b bg-muted/30">
            <div className="flex items-center justify-between">
              <h3 className="font-heading font-bold text-sm">Top Drivers Today</h3>
              <Badge variant="secondary" className="text-[10px]">
                {format(new Date(), 'dd MMM')}
              </Badge>
            </div>
          </div>
          <div className="max-h-[480px] overflow-y-auto divide-y">
            {leaderboard.length === 0 && (
              <p className="text-center text-xs text-muted-foreground py-8 px-4">No driver activity yet today</p>
            )}
            {leaderboard.map((d, i) => {
              const isOnMap = !!d.location;
              const ghosting = isOnMap && d.location && (Date.now() - new Date(d.location.updated_at).getTime()) > 10 * 60 * 1000;
              const VehicleIcon = d.info?.vehicle_type === 'car' ? Car : Bike;
              return (
                <button
                  key={d.id}
                  onMouseEnter={() => setHoveredDriverId(d.id)}
                  onClick={() => setHoveredDriverId(d.id)}
                  disabled={!isOnMap}
                  className={`w-full text-left p-3 hover:bg-muted/50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-3 ${ghosting ? 'bg-orange-500/10 border-l-4 border-l-orange-500' : ''}`}
                >
                  <div className="relative shrink-0">
                    <div className={`h-9 w-9 rounded-full flex items-center justify-center text-xs font-bold ${i === 0 ? 'bg-amber-500/20 text-amber-600' : i === 1 ? 'bg-slate-400/20 text-slate-600' : i === 2 ? 'bg-orange-700/20 text-orange-700' : 'bg-muted text-muted-foreground'}`}>
                      #{i + 1}
                    </div>
                    {isOnMap && (
                      <span className={`absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-card ${ghosting ? 'bg-orange-500 animate-pulse' : 'bg-emerald-500'}`} />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <VehicleIcon className="h-3 w-3 text-muted-foreground shrink-0" />
                      <p className="text-sm font-semibold truncate">{d.info?.name}</p>
                      {ghosting && <span className="text-[9px] font-bold text-orange-600 bg-orange-500/15 px-1.5 py-0.5 rounded">GHOST</span>}
                    </div>
                    <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                      <span>{d.deliveries} 📦</span>
                      <span>{d.km.toFixed(1)} km</span>
                      <span className="text-primary font-semibold">€{d.earnings.toFixed(0)}</span>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </Card>
      </div>
    </div>
  );
}

function MiniKpi({
  icon: Icon,
  label,
  value,
  sub,
  tone,
}: {
  icon: React.ElementType;
  label: string;
  value: string | number;
  sub?: string;
  tone: 'emerald' | 'blue' | 'violet' | 'orange' | 'primary' | 'slate';
}) {
  const toneMap: Record<string, string> = {
    emerald: 'bg-emerald-500/10 text-emerald-600',
    blue: 'bg-blue-500/10 text-blue-600',
    violet: 'bg-violet-500/10 text-violet-600',
    orange: 'bg-orange-500/10 text-orange-600',
    primary: 'bg-primary/10 text-primary',
    slate: 'bg-slate-500/10 text-slate-600',
  };
  return (
    <Card className="p-3">
      <div className="flex items-center gap-2.5">
        <div className={`h-8 w-8 rounded-lg flex items-center justify-center shrink-0 ${toneMap[tone]}`}>
          <Icon className="h-4 w-4" />
        </div>
        <div className="min-w-0">
          <p className="text-[10px] uppercase tracking-wide text-muted-foreground font-medium leading-tight">{label}</p>
          <p className="font-heading font-bold text-base leading-tight truncate">
            {value}
            {sub && <span className="text-[10px] font-normal text-muted-foreground ml-1">{sub}</span>}
          </p>
        </div>
      </div>
    </Card>
  );
}

function LegendDot({ color, label, square }: { color: string; label: string; square?: boolean }) {
  return (
    <div className="flex items-center gap-2">
      <span
        className="h-2.5 w-2.5 shrink-0"
        style={{ background: color, borderRadius: square ? 3 : '50%' }}
      />
      <span className="text-muted-foreground">{label}</span>
    </div>
  );
}
