import { useEffect, useRef, useState } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { useMapboxToken } from '@/hooks/useMapboxToken';
import { supabase } from '@/integrations/supabase/client';
import { IOANNINA_MAP_CENTER } from '@/lib/geo-defaults';
import { Loader2 } from 'lucide-react';

interface Props {
  driverId?: string | null;
  storeLat?: number | null;
  storeLng?: number | null;
  deliveryLat?: number | null;
  deliveryLng?: number | null;
  status: string;
}

function bearing(a: [number, number], b: [number, number]) {
  const [lng1, lat1] = a.map((x) => (x * Math.PI) / 180) as [number, number];
  const [lng2, lat2] = b.map((x) => (x * Math.PI) / 180) as [number, number];
  const y = Math.sin(lng2 - lng1) * Math.cos(lat2);
  const x =
    Math.cos(lat1) * Math.sin(lat2) -
    Math.sin(lat1) * Math.cos(lat2) * Math.cos(lng2 - lng1);
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
}

/** After pickup, route focus is driver → customer. `arrived` = at store. */
const EN_ROUTE_TO_CUSTOMER = new Set(['picked_up']);

export default function LiveTrackingMap({
  driverId,
  storeLat,
  storeLng,
  deliveryLat,
  deliveryLng,
  status,
}: Props) {
  const container = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const driverMarker = useRef<mapboxgl.Marker | null>(null);
  const driverIcon = useRef<HTMLDivElement | null>(null);
  const lastPos = useRef<[number, number] | null>(null);
  const { token, loading: tokenLoading } = useMapboxToken();
  const [driverPos, setDriverPos] = useState<[number, number] | null>(null);
  const [mapReady, setMapReady] = useState(false);

  // ── driver location subscription ──────────────────
  useEffect(() => {
    if (!driverId) {
      setDriverPos(null);
      return;
    }
    let cancelled = false;

    const apply = (lat: number, lng: number) => {
      if (!cancelled) setDriverPos([lng, lat]);
    };

    supabase
      .from('driver_locations')
      .select('latitude, longitude, updated_at')
      .eq('driver_id', driverId)
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle()
      .then(({ data }) => {
        if (data?.latitude != null && data?.longitude != null) {
          apply(Number(data.latitude), Number(data.longitude));
        }
      });

    const ch = supabase
      .channel(`live-track-${driverId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'driver_locations', filter: `driver_id=eq.${driverId}` },
        (p) => {
          const r = p.new as any;
          if (r?.latitude != null && r?.longitude != null) {
            apply(Number(r.latitude), Number(r.longitude));
          }
        },
      )
      .subscribe();

    // Poll as backup when realtime is slow / missed
    const poll = window.setInterval(() => {
      supabase
        .from('driver_locations')
        .select('latitude, longitude')
        .eq('driver_id', driverId)
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle()
        .then(({ data }) => {
          if (data?.latitude != null && data?.longitude != null) {
            apply(Number(data.latitude), Number(data.longitude));
          }
        });
    }, 8000);

    return () => {
      cancelled = true;
      window.clearInterval(poll);
      supabase.removeChannel(ch);
    };
  }, [driverId]);

  // ── init map (always with a center — never silent blank) ──
  useEffect(() => {
    if (!token || !container.current || mapRef.current) return;

    let cancelled = false;
    const timers: number[] = [];
    let ro: ResizeObserver | null = null;

    const resolveCenter = (): [number, number] => {
      if (driverPos) return driverPos;
      if (deliveryLat != null && deliveryLng != null) return [deliveryLng, deliveryLat];
      if (storeLat != null && storeLng != null) return [storeLng, storeLat];
      return IOANNINA_MAP_CENTER;
    };

    const tryInit = (): boolean => {
      if (cancelled || mapRef.current || !container.current) return false;
      const el = container.current;
      if (el.clientWidth < 2 || el.clientHeight < 2) return false;

      mapboxgl.accessToken = token;
      const map = new mapboxgl.Map({
        container: el,
        style: 'mapbox://styles/mapbox/streets-v12',
        center: resolveCenter(),
        zoom: 13.5,
        attributionControl: false,
        pitch: 30,
      });
      mapRef.current = map;

      const resize = () => {
        try { map.resize(); } catch { /* noop */ }
      };

      map.on('load', () => {
        resize();
        requestAnimationFrame(resize);

        if (storeLat != null && storeLng != null) {
          const elStore = document.createElement('div');
          elStore.innerHTML = `<div style="width:38px;height:38px;border-radius:50%;background:#2563eb;border:3px solid white;box-shadow:0 4px 16px rgba(0,0,0,.25);display:flex;align-items:center;justify-content:center;font-size:18px">🏪</div>`;
          new mapboxgl.Marker({ element: elStore, anchor: 'center' })
            .setLngLat([storeLng, storeLat])
            .addTo(map);
        }
        if (deliveryLat != null && deliveryLng != null) {
          const elHome = document.createElement('div');
          elHome.innerHTML = `<div style="width:38px;height:38px;border-radius:50% 50% 50% 0;transform:rotate(-45deg);background:#f97316;border:3px solid white;box-shadow:0 4px 16px rgba(0,0,0,.25);display:flex;align-items:center;justify-content:center"><span style="transform:rotate(45deg);font-size:16px">🏠</span></div>`;
          new mapboxgl.Marker({ element: elHome, anchor: 'bottom' })
            .setLngLat([deliveryLng, deliveryLat])
            .addTo(map);
        }

        if (!map.getSource('route')) {
          map.addSource('route', {
            type: 'geojson',
            data: { type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: [] } },
          });
          map.addLayer({
            id: 'route-shadow',
            type: 'line',
            source: 'route',
            layout: { 'line-cap': 'round', 'line-join': 'round' },
            paint: { 'line-color': '#000', 'line-opacity': 0.08, 'line-width': 9 },
          });
          map.addLayer({
            id: 'route-line',
            type: 'line',
            source: 'route',
            layout: { 'line-cap': 'round', 'line-join': 'round' },
            paint: { 'line-color': '#2563eb', 'line-width': 5 },
          });
        }
        setMapReady(true);
      });

      window.addEventListener('resize', resize);
      const shell = el.parentElement ?? el;
      if (typeof ResizeObserver !== 'undefined') {
        ro = new ResizeObserver(() => resize());
        ro.observe(shell);
      }
      [50, 200, 500].forEach((ms) => timers.push(window.setTimeout(resize, ms)));

      const prevRemove = map.remove.bind(map);
      map.remove = () => {
        window.removeEventListener('resize', resize);
        prevRemove();
      };
      return true;
    };

    const schedule = () => {
      if (tryInit()) return;
      timers.push(window.setTimeout(schedule, 80));
    };
    schedule();
    timers.push(window.setTimeout(schedule, 300));

    return () => {
      cancelled = true;
      timers.forEach((id) => window.clearTimeout(id));
      if (ro) try { ro.disconnect(); } catch { /* noop */ }
      if (mapRef.current) {
        try { mapRef.current.remove(); } catch { /* noop */ }
        mapRef.current = null;
      }
      driverMarker.current = null;
      setMapReady(false);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- init once per token/coords identity
  }, [token, storeLat, storeLng, deliveryLat, deliveryLng]);

  // ── route store → customer ────────────────────────
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !token || !mapReady) return;
    const a = storeLat != null && storeLng != null ? ([storeLng, storeLat] as [number, number]) : null;
    const b = deliveryLat != null && deliveryLng != null ? ([deliveryLng, deliveryLat] as [number, number]) : null;
    if (!a || !b) return;

    const url = `https://api.mapbox.com/directions/v5/mapbox/cycling/${a[0]},${a[1]};${b[0]},${b[1]}?geometries=geojson&overview=full&access_token=${token}`;
    let cancelled = false;
    fetch(url)
      .then((r) => r.json())
      .then((d) => {
        if (cancelled) return;
        const coords = d?.routes?.[0]?.geometry?.coordinates;
        if (!coords) return;
        const apply = () => {
          const src = map.getSource('route') as mapboxgl.GeoJSONSource | undefined;
          if (!src) return;
          src.setData({ type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: coords } });
          const bounds = new mapboxgl.LngLatBounds();
          coords.forEach((c: number[]) => bounds.extend(c as [number, number]));
          if (driverPos) bounds.extend(driverPos);
          map.fitBounds(bounds, {
            padding: { top: 80, bottom: 360, left: 60, right: 60 },
            duration: 800,
            maxZoom: 16,
          });
        };
        if (map.isStyleLoaded()) apply();
        else map.once('load', apply);
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [token, mapReady, storeLat, storeLng, deliveryLat, deliveryLng, driverPos, status]);

  // ── animate driver marker ─────────────────────────
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !driverPos || !mapReady) return;

    const ensureMarker = () => {
      if (driverMarker.current) return;
      const wrap = document.createElement('div');
      wrap.style.cssText = 'position:relative;width:52px;height:52px;display:flex;align-items:center;justify-content:center;';
      const pulse = document.createElement('div');
      pulse.style.cssText =
        'position:absolute;inset:0;border-radius:50%;background:rgba(37,99,235,.35);animation:driverPulse 1.6s ease-out infinite;';
      const inner = document.createElement('div');
      inner.style.cssText =
        'position:relative;width:46px;height:46px;border-radius:50%;background:white;box-shadow:0 6px 20px rgba(0,0,0,.35),0 0 0 4px #2563eb;display:flex;align-items:center;justify-content:center;font-size:24px;transition:transform .8s ease-out;';
      inner.textContent = '🛵';
      wrap.appendChild(pulse);
      wrap.appendChild(inner);
      driverIcon.current = inner;
      driverMarker.current = new mapboxgl.Marker({ element: wrap, anchor: 'center' })
        .setLngLat(driverPos)
        .addTo(map);
      if (!document.getElementById('driver-pulse-kf')) {
        const st = document.createElement('style');
        st.id = 'driver-pulse-kf';
        st.textContent = '@keyframes driverPulse{0%{transform:scale(.6);opacity:.9}100%{transform:scale(2.2);opacity:0}}';
        document.head.appendChild(st);
      }
    };

    ensureMarker();
    if (!driverMarker.current) return;
    const prev = lastPos.current;
    driverMarker.current.setLngLat(driverPos);
    if (prev && driverIcon.current) {
      const b = bearing(prev, driverPos);
      driverIcon.current.style.transform = `rotate(${b - 90}deg)`;
    }
    lastPos.current = driverPos;

    if (EN_ROUTE_TO_CUSTOMER.has(status)) {
      const cam = map.getCenter();
      const dist = Math.hypot(cam.lng - driverPos[0], cam.lat - driverPos[1]);
      if (dist > 0.008) map.easeTo({ center: driverPos, duration: 1000 });
    }
  }, [driverPos, mapReady, status]);

  return (
    <div className="absolute inset-0 bg-muted">
      <div ref={container} className="absolute inset-0" />
      {(tokenLoading) && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-muted/90">
          <Loader2 className="h-7 w-7 animate-spin text-primary" />
        </div>
      )}
      {!tokenLoading && !token && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-muted/90 text-sm text-muted-foreground px-6 text-center">
          Ο χάρτης δεν είναι διαθέσιμος αυτή τη στιγμή
        </div>
      )}
      {token && mapReady && driverId && !driverPos && (
        <div className="absolute top-3 left-1/2 -translate-x-1/2 z-10 rounded-full bg-card/95 border border-border shadow px-3 py-1.5 text-[11px] font-heading font-semibold text-muted-foreground">
          Αναμονή τοποθεσίας οδηγού…
        </div>
      )}
      {token && mapReady && !driverId && (
        <div className="absolute top-3 left-1/2 -translate-x-1/2 z-10 rounded-full bg-card/95 border border-border shadow px-3 py-1.5 text-[11px] font-heading font-semibold text-muted-foreground">
          Αναζητούμε οδηγό…
        </div>
      )}
    </div>
  );
}
