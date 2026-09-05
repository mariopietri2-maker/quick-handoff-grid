import { useEffect, useMemo, useRef, useState } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { useMapboxToken } from '@/hooks/useMapboxToken';
import { supabase } from '@/integrations/supabase/client';
import { escapeHtml } from '@/lib/escape-html';
import { formatDriverCode } from '@/lib/driver-code';
import { isDriverPresenceOnline } from '@/lib/driver-presence';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Bike, MapPin, Search, LocateFixed, Radio, Crosshair, Satellite, Map as MapIcon } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { cn } from '@/lib/utils';

const CENTER: [number, number] = [20.8537, 39.6650];
const ONLINE_WINDOW_MS = 120_000;

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
  latitude: number;
  longitude: number;
  is_active: boolean | null;
}

interface DriverInfo {
  name: string;
  code: string | null;
  is_active: boolean;
  on_shift: boolean;
}

interface AnimState {
  start: number;
  dur: number;
  fromLng: number;
  fromLat: number;
  toLng: number;
  toLat: number;
  fromHeading: number;
  toHeading: number;
  rotEl: HTMLElement | null;
  barEl: HTMLElement | null;
}

function easeInOutQuad(t: number): number {
  return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
}

function bearingBetween(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const toDeg = (r: number) => (r * 180) / Math.PI;
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const y = Math.sin(dLng) * Math.cos(lat2);
  const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLng);
  return (toDeg(Math.atan2(y, x)) + 360) % 360;
}

function haversineM(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const s = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

function lerpAngle(a: number, b: number, t: number): number {
  const diff = (((b - a) % 360) + 540) % 360 - 180;
  return a + diff * t;
}

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

export default function AdminIoanninaMap() {
  const mapContainer = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const markersRef = useRef<Map<string, mapboxgl.Marker>>(new Map());
  const popupsRef = useRef<Map<string, mapboxgl.Popup>>(new Map());
  const storeMarkersRef = useRef<mapboxgl.Marker[]>([]);
  const animRef = useRef<Map<string, AnimState>>(new Map());
  const targetsRef = useRef<Map<string, { lng: number; lat: number; heading: number | null }>>(new Map());
  const hasFittedRef = useRef(false);
  const [fitRequest, setFitRequest] = useState(0);
  const { token, loading: tokenLoading } = useMapboxToken();

  const [locations, setLocations] = useState<DriverLocation[]>([]);
  const [driverInfos, setDriverInfos] = useState<Map<string, DriverInfo>>(new Map());
  const [stores, setStores] = useState<StoreMarker[]>([]);
  const [query, setQuery] = useState('');
  const [followId, setFollowId] = useState<string | null>(null);
  const [satellite, setSatellite] = useState(false);
  const connectedRef = useRef(true);

  // Load drivers + stores, initial locations, then subscribe to live updates.
  useEffect(() => {
    let mounted = true;

    async function load() {
      const [{ data: profiles }, { data: driverProfiles }, { data: states }, { data: storesData }] = await Promise.all([
        supabase.from('profiles').select('user_id, full_name').in('role', ['driver', 'm'] as any),
        supabase.from('driver_profiles').select('user_id, driver_code, is_active' as any),
        supabase.from('driver_state').select('driver_id, shift_started_at'),
        supabase.from('stores').select('id, name, latitude, longitude, is_active'),
      ]);

      if (!mounted) return;

      const onShift = new Set(
        (states ?? [])
          .filter((s: any) => !!s.shift_started_at)
          .map((s: any) => s.driver_id as string),
      );
      const activeByProfile = new Map<string, boolean>();
      (driverProfiles as any[])?.forEach((dp: any) => {
        activeByProfile.set(dp.user_id, dp.is_active !== false);
      });

      const infoMap = new Map<string, DriverInfo>();
      profiles?.forEach((p: any) => {
        const isActive = activeByProfile.get(p.user_id) ?? true;
        infoMap.set(p.user_id, {
          name: p.full_name || p.user_id.slice(0, 8),
          code: null,
          is_active: isActive,
          on_shift: onShift.has(p.user_id),
        });
      });
      (driverProfiles as any[])?.forEach((dp: any) => {
        const existing = infoMap.get(dp.user_id);
        if (existing) {
          existing.code = dp.driver_code;
          existing.is_active = dp.is_active !== false;
        }
      });
      setDriverInfos(infoMap);

      const list = (storesData ?? []).map((s: any) => ({
        id: s.id,
        name: s.name,
        latitude: s.latitude ?? CENTER[1],
        longitude: s.longitude ?? CENTER[0],
        is_active: s.is_active,
      }));
      setStores(list);

      const eligible = new Set(
        [...infoMap.entries()]
          .filter(([, info]) => info.is_active && info.on_shift)
          .map(([id]) => id),
      );

      const locs = await supabase.from('driver_locations').select('*');
      if (mounted && locs.data) {
        const filtered = (locs.data as DriverLocation[]).filter(
          (l) =>
            eligible.has(l.driver_id) &&
            isDriverPresenceOnline(l.updated_at, Date.now(), ONLINE_WINDOW_MS),
        );
        setLocations(filtered);
      }
    }
    load();

    const channel = supabase
      .channel('admin-ioannina-map-driver-locations')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'driver_locations' }, (payload) => {
        connectedRef.current = true;
        const loc = payload.new as DriverLocation;
        if (!loc?.driver_id) return;
        // Re-check eligibility from latest driverInfos is async; filter on presence +
        // drop unknown/stale. Full eligibility is enforced on poll/load.
        if (!isDriverPresenceOnline(loc.updated_at, Date.now(), ONLINE_WINDOW_MS)) {
          setLocations((prev) => prev.filter((l) => l.driver_id !== loc.driver_id));
          return;
        }
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
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') connectedRef.current = true;
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') connectedRef.current = false;
      });

    // Polling fallback in case realtime drops.
    const poll = setInterval(async () => {
      const [{ data }, { data: states }, { data: dps }] = await Promise.all([
        supabase.from('driver_locations').select('*').limit(100).order('updated_at', { ascending: false }),
        supabase.from('driver_state').select('driver_id, shift_started_at'),
        supabase.from('driver_profiles').select('user_id, is_active' as any),
      ]);
      if (!mounted || !data) return;
      const onShift = new Set(
        (states ?? []).filter((s: any) => !!s.shift_started_at).map((s: any) => s.driver_id as string),
      );
      const inactive = new Set(
        (dps ?? []).filter((p: any) => p.is_active === false).map((p: any) => p.user_id as string),
      );
      const filtered = (data as DriverLocation[]).filter(
        (l) =>
          onShift.has(l.driver_id) &&
          !inactive.has(l.driver_id) &&
          isDriverPresenceOnline(l.updated_at, Date.now(), ONLINE_WINDOW_MS),
      );
      setLocations(filtered);
    }, 15000);

    return () => {
      mounted = false;
      connectedRef.current = false;
      supabase.removeChannel(channel);
      clearInterval(poll);
    };
  }, []);

  // Init map
  useEffect(() => {
    if (!token || !mapContainer.current || mapRef.current) return;

    mapboxgl.accessToken = token;
    const map = new mapboxgl.Map({
      container: mapContainer.current,
      style: 'mapbox://styles/mapbox/dark-v11',
      center: CENTER,
      zoom: 12,
      attributionControl: false,
    });

    map.addControl(new mapboxgl.NavigationControl({ visualizePitch: true }), 'top-right');
    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, [token]);

  // Animation loop: lerp markers towards their target, rotate by travel direction.
  useEffect(() => {
    let raf = 0;
    const loop = () => {
      raf = requestAnimationFrame(loop);
      const map = mapRef.current;
      if (!map) return;
      const now = performance.now();
      animRef.current.forEach((s, id) => {
        const marker = markersRef.current.get(id);
        if (!marker) return;
        const t = Math.min(1, (now - s.start) / s.dur);
        const e = easeInOutQuad(t);
        const lng = s.fromLng + (s.toLng - s.fromLng) * e;
        const lat = s.fromLat + (s.toLat - s.fromLat) * e;
        marker.setLngLat([lng, lat]);
        if (s.rotEl) {
          const heading = lerpAngle(s.fromHeading, s.toHeading, e);
          const bob = 1 + Math.sin(e * Math.PI) * 0.04;
          s.rotEl.style.transform = `rotate(${heading}deg) scale(${bob})`;
        }
        if (t >= 1) animRef.current.delete(id);
      });
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);

  // Render store markers.
  function renderStoreMarkers(map: mapboxgl.Map) {
    storeMarkersRef.current.forEach((m) => m.remove());
    storeMarkersRef.current = [];
    stores.forEach((store) => {
      const el = document.createElement('div');
      el.innerHTML = `
        <div style="position:relative;display:flex;flex-direction:column;align-items:center;cursor:pointer;">
          <div style="width:30px;height:30px;background:#f97316;border-radius:50% 50% 50% 0;border:3px solid white;transform:rotate(-45deg);box-shadow:0 2px 8px rgba(249,115,22,0.5);display:flex;align-items:center;justify-content:center;">
            <span style="transform:rotate(45deg);font-size:14px;">🏪</span>
          </div>
          ${`<div style="background:rgba(15,23,42,0.85);border:1px solid rgba(249,115,22,0.5);border-radius:6px;padding:1px 6px;font-size:10px;font-weight:700;color:#fff;margin-top:2px;white-space:nowrap;max-width:140px;overflow:hidden;text-overflow:ellipsis;">${escapeHtml(store.name)}</div>`}
        </div>`;

      const popup = new mapboxgl.Popup({ offset: 22 }).setHTML(`
        <div style="text-align:center;font-family:system-ui;padding:4px;">
          <strong>🏪 ${escapeHtml(store.name)}</strong>
          <br/><span style="font-size:11px;">${store.is_active ? '✅ Ενεργό' : '❌ Ανενεργό'}</span>
        </div>
      `);

      const marker = new mapboxgl.Marker({ element: el, anchor: 'bottom' })
        .setLngLat([store.longitude, store.latitude])
        .setPopup(popup)
        .addTo(map);

      storeMarkersRef.current.push(marker);
    });
  }

  // Render/update driver markers, kick off animation.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    // Remove markers for drivers that vanished.
    const activeIds = new Set(locations.map((l) => l.driver_id));
    markersRef.current.forEach((marker, id) => {
      if (activeIds.has(id)) return;
      marker.remove();
      markersRef.current.delete(id);
      popupsRef.current.delete(id);
      animRef.current.delete(id);
      targetsRef.current.delete(id);
    });

    const nowMs = Date.now();

    locations.forEach((loc) => {
      const info = driverInfos.get(loc.driver_id);
      const target = { lng: loc.longitude, lat: loc.latitude, heading: loc.heading };
      const prevTarget = targetsRef.current.get(loc.driver_id);
      targetsRef.current.set(loc.driver_id, target);

      let marker = markersRef.current.get(loc.driver_id);

      const stale = !isDriverPresenceOnline(loc.updated_at, nowMs, ONLINE_WINDOW_MS);
      const moving = (loc.speed ?? 0) > 0.5 || !!prevTarget && haversineM(prevTarget, target) > 8;

      if (!marker) {
        const code = info?.code ? formatDriverCode(info.code) : '—';
        const el = document.createElement('div');
        el.innerHTML = `
          <div style="position:relative;display:flex;flex-direction:column;align-items:center;cursor:pointer;">
            <div data-rot style="transition:opacity 400ms;transform:rotate(0deg);width:40px;height:40px;background:${stale ? '#64748b' : moving ? '#0ea5e9' : '#2b6cb0'};border-radius:50%;border:3px solid white;box-shadow:0 2px 14px rgba(14,165,233,0.55);display:flex;align-items:center;justify-content:center;font-size:21px;">🛵</div>
            <div data-bar style="display:flex;align-items:center;gap:3px;margin-top:2px;background:${stale ? 'rgba(100,116,139,0.9)' : 'rgba(2,6,23,0.9)'};border:1px solid ${stale ? 'rgba(148,163,184,0.5)' : 'rgba(14,165,233,0.6)'};border-radius:9999px;padding:1px 7px;font-size:10px;font-weight:800;color:#fff;white-space:nowrap;font-family:ui-monospace,monospace;">
              <span style="width:5px;height:5px;border-radius:50%;background:${moving && !stale ? '#22c55e' : stale ? '#94a3b8' : '#38bdf8'};display:inline-block;"></span>
              ${escapeHtml(code)}
            </div>
            ${moving && !stale ? `<div style="position:absolute;left:50%;top:-3px;transform:translateX(-50%);font-size:9px;color:#7dd3fc;font-weight:700;">${((loc.speed ?? 0) * 3.6).toFixed(0)} km/h</div>` : ''}
          </div>`;

        const popup = new mapboxgl.Popup({ offset: 26, closeButton: false }).setHTML(`
          <div style="text-align:center;font-family:system-ui;padding:4px;min-width:120px;">
            <strong style="font-size:13px;">🛵 ${escapeHtml(info?.name || loc.driver_id.slice(0, 8))}</strong>
            ${info?.code ? `<div style="font-size:11px;opacity:0.8;font-weight:700;margin-top:2px;">${escapeHtml(code)}</div>` : ''}
            <div style="font-size:11px;margin-top:3px;opacity:0.85;">${loc.speed != null && loc.speed > 0 ? `⚡ ${(loc.speed * 3.6).toFixed(0)} km/h` : '🚦 Σταθμευμένος'}</div>
            <div style="font-size:10px;opacity:0.6;margin-top:2px;">${stale ? 'Καθυστερημένη αναφορά θέσης' : `Ενημέρωση: ${formatDistanceToNow(new Date(loc.updated_at), { addSuffix: false })}(ν)`}</div>
          </div>
        `);

        marker = new mapboxgl.Marker({ element: el, anchor: 'bottom' })
          .setLngLat([target.lng, target.lat])
          .setPopup(popup)
          .addTo(map);

        markersRef.current.set(loc.driver_id, marker);
        popupsRef.current.set(loc.driver_id, popup);
      }

      // Animate towards the target.
      const currentPos = marker.getLngLat();
      const distM = haversineM({ lat: currentPos.lat, lng: currentPos.lng }, target);
      if (distM < 1) {
        marker.setLngLat([target.lng, target.lat]);
        animRef.current.delete(loc.driver_id);
        return;
      }
      const speedMs = (loc.speed ?? 0) > 0.5 ? loc.speed : Math.max(3, distM / 4);
      const dur = clamp((distM / speedMs) * 1000, 800, 6000);
      animRef.current.set(loc.driver_id, {
        start: performance.now(),
        dur,
        fromLng: currentPos.lng,
        fromLat: currentPos.lat,
        toLng: target.lng,
        toLat: target.lat,
        fromHeading: 0,
        toHeading: loc.heading ?? bearingBetween({ lat: currentPos.lat, lng: currentPos.lng }, target),
        rotEl: marker.getElement().querySelector<HTMLElement>('[data-rot]'),
        barEl: marker.getElement().querySelector<HTMLElement>('[data-bar]'),
      });

      // Mirror marker status styles without rebuilding.
      const rotEl = marker.getElement().querySelector<HTMLElement>('[data-rot]');
      const barEl = marker.getElement().querySelector<HTMLElement>('[data-bar]');
      if (rotEl && barEl) {
        const color = stale ? '#64748b' : moving ? '#0ea5e9' : '#2b6cb0';
        rotEl.style.background = color;
        barEl.style.background = stale ? 'rgba(100,116,139,0.9)' : 'rgba(2,6,23,0.9)';
        barEl.style.borderColor = stale ? 'rgba(148,163,184,0.5)' : 'rgba(14,165,233,0.6)';
      }
    });

    // Follow the selected driver when locations change.
    if (followId) {
      const followLoc = locations.find((l) => l.driver_id === followId);
      if (followLoc) {
        map.easeTo({ center: [followLoc.longitude, followLoc.latitude], duration: 1200 });
      }
    }
  }, [locations, driverInfos, followId]);

  // Fit all stores once (or refit on request), across Ioannina.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || stores.length === 0) return;
    const doFit = () => {
      const bounds = new mapboxgl.LngLatBounds();
      stores.forEach((s) => bounds.extend([s.longitude, s.latitude]));
      bounds.extend(CENTER);
      map.fitBounds(bounds, { padding: 70, maxZoom: 13.5, duration: 900 });
    };
    if (!hasFittedRef.current) {
      hasFittedRef.current = true;
      doFit();
    } else if (fitRequest > 0) {
      doFit();
    }
  }, [stores, fitRequest]);

  // Base style toggle.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    map.setStyle(satellite ? 'mapbox://styles/mapbox/satellite-streets-v12' : 'mapbox://styles/mapbox/dark-v11');
  }, [satellite, token]);

  // Store markers redraw (fires on stores load + after style reload).
  useEffect(() => {
    const map = mapRef.current;
    if (map) renderStoreMarkers(map);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stores]);

  const onlineCount = locations.filter((l) => isDriverPresenceOnline(l.updated_at, Date.now(), ONLINE_WINDOW_MS)).length;
  const movingCount = locations.filter((l) =>
    isDriverPresenceOnline(l.updated_at, Date.now(), ONLINE_WINDOW_MS) && (l.speed ?? 0) > 0.5,
  ).length;
  const activeStores = stores.filter((s) => s.is_active !== false).length;

  const filteredDrivers = useMemo(() => {
    const q = query.trim().toLowerCase();
    return locations
      .map((l) => {
        const info = driverInfos.get(l.driver_id);
        const target = targetsRef.current.get(l.driver_id);
        const moving = (l.speed ?? 0) > 0.5;
        const online = isDriverPresenceOnline(l.updated_at, Date.now(), ONLINE_WINDOW_MS);
        return {
          driver_id: l.driver_id,
          name: info?.name ?? l.driver_id.slice(0, 8),
          code: info?.code ?? null,
          online,
          moving,
          speed: l.speed,
          updated_at: l.updated_at,
          is_followed: followId === l.driver_id,
          heading: l.heading,
          lat: target?.lat ?? l.latitude,
          lng: target?.lng ?? l.longitude,
          active: info ? true : false,
        };
      })
      .filter((d) => {
        const info = driverInfos.get(d.driver_id);
        if (info && (!info.is_active || !info.on_shift)) return false;
        if (!d.online) return false;
        if (!q) return true;
        return d.name.toLowerCase().includes(q) || (d.code ?? '').toLowerCase().includes(q);
      })
      .sort((a, b) => {
        if (a.online !== b.online) return a.online ? -1 : 1;
        if (a.moving !== b.moving) return a.moving ? -1 : 1;
        return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
      });
  }, [locations, driverInfos, query, followId]);

  if (tokenLoading) {
    return (
      <Card>
        <CardContent className="h-[600px] flex items-center justify-center">
          <div className="h-8 w-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
        </CardContent>
      </Card>
    );
  }

  if (!token) {
    return (
      <Card>
        <CardContent className="h-[600px] flex items-center justify-center text-muted-foreground">
          Mapbox token not configured
        </CardContent>
      </Card>
    );
  }

  const focusDriver = (driver_id: string) => {
    const loc = locations.find((l) => l.driver_id === driver_id);
    if (!loc) return;
    const marker = markersRef.current.get(driver_id);
    mapRef.current?.flyTo({ center: [loc.longitude, loc.latitude], zoom: 14.5, duration: 1000 });
    setTimeout(() => {
      marker?.getPopup()?.addTo(mapRef.current!);
    }, 1100);
  };

  const toggleFollow = (driver_id: string) => {
    setFollowId((cur) => (cur === driver_id ? null : driver_id));
  };

  return (
    <div className="grid grid-cols-1 xl:grid-cols-[1fr_340px] gap-4">
      {/* Map */}
      <Card className="overflow-hidden flex flex-col">
        {/* Toolbar */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-3 py-2.5">
          <div className="flex items-center gap-2">
            <h2 className="font-heading font-bold text-[15px] flex items-center gap-2">
              <MapPin className="h-4 w-4 text-warning" /> Χάρτης Ιωαννίνων
            </h2>
            <span className={cn(
              'inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider',
              connectedRef.current ? 'text-success' : 'text-destructive',
            )}>
              <Radio className={cn('h-3 w-3', connectedRef.current ? 'animate-pulse' : '')} />
              {connectedRef.current ? 'Live' : 'Εκτός σύνδεσης'}
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            <Button
              size="sm"
              variant="outline"
              className="h-8 text-xs gap-1.5"
              onClick={() => setFitRequest((n) => n + 1)}
              title="Κεντράρισμα στα καταστήματα"
            >
              <Crosshair className="h-3.5 w-3.5" /> Κέντρο
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="h-8 text-xs gap-1.5"
              onClick={() => setSatellite((v) => !v)}
              title={satellite ? 'Street view' : 'Satellite view'}
            >
              {satellite ? <MapIcon className="h-3.5 w-3.5" /> : <Satellite className="h-3.5 w-3.5" />}
              {satellite ? 'Χάρτης' : 'Δορυφόρος'}
            </Button>
          </div>
        </div>

        <div ref={mapContainer} className="h-[600px] w-full" />

        {/* Legend */}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-border bg-muted/20 px-3 py-1.5 text-[11px] text-muted-foreground">
          <span className="inline-flex items-center gap-1.5">
            <span className="h-3 w-3 rounded-full bg-sky-500 border border-white shadow" /> Κινούμενος οδηγός
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-3 w-3 rounded-full bg-blue-700 border border-white shadow" /> Σταθμευμένος
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-3 w-3 rounded-full bg-slate-500 border border-white shadow" /> Ανενεργός
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-3 w-3 bg-orange-500 rounded-full" /> Κατάστημα
          </span>
        </div>
      </Card>

      {/* Driver list side panel */}
      <Card className="flex flex-col overflow-hidden">
        <div className="border-b border-border p-3 space-y-2.5">
          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="rounded-lg bg-muted/40 border border-border py-1.5">
              <div className="text-lg font-bold tabular-nums leading-none">{onlineCount}</div>
              <div className="text-[10px] text-muted-foreground mt-0.5">Online</div>
            </div>
            <div className="rounded-lg bg-muted/40 border border-border py-1.5">
              <div className="text-lg font-bold tabular-nums leading-none">{movingCount}</div>
              <div className="text-[10px] text-muted-foreground mt-0.5">Κινούνται</div>
            </div>
            <div className="rounded-lg bg-muted/40 border border-border py-1.5">
              <div className="text-lg font-bold tabular-nums leading-none">{activeStores}</div>
              <div className="text-[10px] text-muted-foreground mt-0.5">Καταστήματα</div>
            </div>
          </div>
          <div className="relative">
            <Search className="absolute left-2 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
            <Input className="pl-7 h-8 text-xs" placeholder="Αναζήτηση οδηγού…" value={query} onChange={(e) => setQuery(e.target.value)} />
          </div>
          <div className="flex items-center justify-between text-[11px] text-muted-foreground">
            <span className="inline-flex items-center gap-1"><Bike className="h-3 w-3" /> {filteredDrivers.length} οδηγοί</span>
            {followId && (
              <button onClick={() => setFollowId(null)} className="text-primary font-semibold hover:underline">
                ✕ Σταμάτα follow
              </button>
            )}
          </div>
        </div>

        <ScrollArea className="flex-1">
          <div className="divide-y divide-border">
            {filteredDrivers.length === 0 && (
              <div className="p-4 text-sm text-muted-foreground text-center">Κανένας οδηγός</div>
            )}
            {filteredDrivers.map((d) => (
              <button
                key={d.driver_id}
                onClick={() => focusDriver(d.driver_id)}
                className={cn(
                  'w-full text-left p-3 hover:bg-muted/50 transition-colors',
                  d.is_followed && 'bg-primary/5 border-l-2 border-primary',
                )}
              >
                <div className="flex items-center gap-2">
                  <span className={cn(
                    'h-2.5 w-2.5 rounded-full shrink-0',
                    d.online ? (d.moving ? 'bg-sky-500 animate-pulse' : 'bg-blue-700') : 'bg-slate-400',
                  )} />
                  <span className="font-medium text-sm truncate flex-1">{d.name}</span>
                  {d.code && <span className="text-[10px] text-muted-foreground font-mono">{formatDriverCode(d.code)}</span>}
                  {d.moving && d.speed != null && (
                    <span className="text-[10px] font-semibold tabular-nums text-sky-500">{(d.speed * 3.6).toFixed(0)} km/h</span>
                  )}
                </div>
                <div className="mt-1 flex items-center gap-2 text-[10.5px] text-muted-foreground">
                  <span>{d.online ? (d.moving ? '🛵 Κινείται' : '🟦 Βάρδια') : '⚪ Εκτός σύνδεσης'}</span>
                  <span>·</span>
                  <span>Ενημέρωση: {formatDistanceToNow(new Date(d.updated_at))}</span>
                  <span className="flex-1" />
                  <span
                    role="button"
                    tabIndex={0}
                    onClick={(e) => { e.stopPropagation(); toggleFollow(d.driver_id); }}
                    onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.stopPropagation(); toggleFollow(d.driver_id); } }}
                    className={cn(
                      'inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[10px] font-semibold',
                      d.is_followed
                        ? 'border-primary/40 text-primary bg-primary/10'
                        : 'border-border hover:border-primary/40 hover:text-primary',
                    )}
                  >
                    <LocateFixed className="h-3 w-3" /> {d.is_followed ? 'Γίνεται' : 'Follow'}
                  </span>
                </div>
              </button>
            ))}
          </div>
        </ScrollArea>
      </Card>
    </div>
  );
}