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
  /** Optional live driver GPS for parent (proximity alerts, etc.). */
  onDriverPos?: (pos: { lat: number; lng: number } | null) => void;
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

function asCoord(v: number | string | null | undefined): number | null {
  if (v == null || v === '') return null;
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : null;
}

/** Follow camera once the driver is heading to the customer. */
const FOLLOW_STATUSES = new Set(['accepted', 'preparing', 'arrived', 'ready', 'picked_up']);

function makeTinyScooterEl(): { wrap: HTMLDivElement; icon: HTMLDivElement } {
  const wrap = document.createElement('div');
  wrap.style.cssText =
    'position:relative;width:28px;height:28px;display:flex;align-items:center;justify-content:center;pointer-events:none;';

  const pulse = document.createElement('div');
  pulse.style.cssText =
    'position:absolute;inset:-4px;border-radius:50%;background:hsl(var(--c-accent) / 0.28);animation:scooterPulse 1.8s ease-out infinite;';

  const icon = document.createElement('div');
  icon.style.cssText =
    'position:relative;width:26px;height:26px;border-radius:50%;background:#fff;box-shadow:0 2px 8px rgba(0,0,0,.28),0 0 0 2px hsl(var(--c-accent));display:flex;align-items:center;justify-content:center;font-size:14px;line-height:1;transition:transform .7s ease-out;';
  icon.textContent = '🛵';
  icon.setAttribute('aria-label', 'Οδηγός');

  wrap.appendChild(pulse);
  wrap.appendChild(icon);

  if (!document.getElementById('scooter-pulse-kf')) {
    const st = document.createElement('style');
    st.id = 'scooter-pulse-kf';
    st.textContent =
      '@keyframes scooterPulse{0%{transform:scale(.75);opacity:.85}100%{transform:scale(1.9);opacity:0}}';
    document.head.appendChild(st);
  }

  return { wrap, icon };
}

export default function LiveTrackingMap({
  driverId,
  storeLat: storeLatProp,
  storeLng: storeLngProp,
  deliveryLat: deliveryLatProp,
  deliveryLng: deliveryLngProp,
  status,
  onDriverPos,
}: Props) {
  const storeLat = asCoord(storeLatProp);
  const storeLng = asCoord(storeLngProp);
  const deliveryLat = asCoord(deliveryLatProp);
  const deliveryLng = asCoord(deliveryLngProp);

  const shellRef = useRef<HTMLDivElement>(null);
  const container = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const storeMarker = useRef<mapboxgl.Marker | null>(null);
  const homeMarker = useRef<mapboxgl.Marker | null>(null);
  const driverMarker = useRef<mapboxgl.Marker | null>(null);
  const driverIcon = useRef<HTMLDivElement | null>(null);
  const lastPos = useRef<[number, number] | null>(null);
  const { token, loading: tokenLoading } = useMapboxToken();
  const [driverPos, setDriverPos] = useState<[number, number] | null>(null);
  const [mapReady, setMapReady] = useState(false);
  const [mapError, setMapError] = useState<string | null>(null);
  const [mapRetry, setMapRetry] = useState(0);
  const onDriverPosRef = useRef(onDriverPos);
  useEffect(() => {
    onDriverPosRef.current = onDriverPos;
  }, [onDriverPos]);

  const coordsRef = useRef({ storeLat, storeLng, deliveryLat, deliveryLng, driverPos });
  useEffect(() => {
    coordsRef.current = { storeLat, storeLng, deliveryLat, deliveryLng, driverPos };
  }, [storeLat, storeLng, deliveryLat, deliveryLng, driverPos]);

  const showLiveDriver = Boolean(driverId);

  // ── driver location subscription (once assigned to the order) ──
  useEffect(() => {
    if (!driverId) {
      setDriverPos(null);
      onDriverPosRef.current?.(null);
      return;
    }
    let cancelled = false;

    const apply = (lat: number, lng: number) => {
      if (!cancelled) {
        setDriverPos([lng, lat]);
        onDriverPosRef.current?.({ lat, lng });
      }
    };

    const fetchLoc = () => {
      supabase
        .from('driver_locations')
        .select('latitude, longitude')
        .eq('driver_id', driverId)
        .maybeSingle()
        .then(({ data }) => {
          if (data?.latitude != null && data?.longitude != null) {
            apply(Number(data.latitude), Number(data.longitude));
          }
        });
    };

    fetchLoc();

    const ch = supabase
      .channel(`live-track-${driverId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'driver_locations', filter: `driver_id=eq.${driverId}` },
        (p) => {
          // Keep last-known pin on DELETE — heartbeat may briefly clear/recreate.
          if (p.eventType === 'DELETE') return;
          const r = p.new as any;
          if (r?.latitude != null && r?.longitude != null) {
            apply(Number(r.latitude), Number(r.longitude));
          }
        },
      )
      .subscribe();

    const poll = window.setInterval(fetchLoc, 2500);

    return () => {
      cancelled = true;
      window.clearInterval(poll);
      supabase.removeChannel(ch);
    };
  }, [driverId]);

  // ── init map ──
  useEffect(() => {
    if (!token || !container.current || mapRef.current) return;

    let cancelled = false;
    const timers: number[] = [];
    let ro: ResizeObserver | null = null;

    const resolveCenter = (): [number, number] => {
      const c = coordsRef.current;
      if (c.driverPos) return c.driverPos;
      if (c.deliveryLat != null && c.deliveryLng != null) return [c.deliveryLng, c.deliveryLat];
      if (c.storeLat != null && c.storeLng != null) return [c.storeLng, c.storeLat];
      return IOANNINA_MAP_CENTER;
    };

    const tryInit = (): boolean => {
      if (cancelled || mapRef.current || !container.current) return false;
      const el = container.current;
      const shell = shellRef.current ?? el;
      const w = Math.max(el.clientWidth, shell.clientWidth);
      const h = Math.max(el.clientHeight, shell.clientHeight);
      if (w < 2 || h < 2) return false;

      mapboxgl.accessToken = token;
      setMapError(null);

      let map: mapboxgl.Map;
      try {
        map = new mapboxgl.Map({
          container: el,
          style: 'mapbox://styles/mapbox/streets-v12',
          center: resolveCenter(),
          zoom: 14,
          attributionControl: false,
          pitch: 0,
          failIfMajorPerformanceCaveat: false,
        });
      } catch (err: any) {
        setMapError(err?.message || 'Ο χάρτης δεν φόρτωσε');
        return false;
      }

      mapRef.current = map;

      const resize = () => {
        try {
          map.resize();
        } catch {
          /* noop */
        }
      };

      map.on('error', (e) => {
        const msg = e?.error?.message || '';
        if (/abort|cancel/i.test(msg)) return;
        if (msg) setMapError(msg);
      });

      map.on('load', () => {
        resize();
        requestAnimationFrame(resize);
        setMapReady(true);
      });

      window.addEventListener('resize', resize);
      if (typeof ResizeObserver !== 'undefined') {
        ro = new ResizeObserver(() => resize());
        ro.observe(shell);
      }
      [50, 150, 300, 600, 1000].forEach((ms) => timers.push(window.setTimeout(resize, ms)));

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
    timers.push(window.setTimeout(schedule, 250));
    timers.push(window.setTimeout(schedule, 600));

    return () => {
      cancelled = true;
      timers.forEach((id) => window.clearTimeout(id));
      if (ro)
        try {
          ro.disconnect();
        } catch {
          /* noop */
        }
      storeMarker.current?.remove();
      homeMarker.current?.remove();
      driverMarker.current?.remove();
      storeMarker.current = null;
      homeMarker.current = null;
      driverMarker.current = null;
      driverIcon.current = null;
      lastPos.current = null;
      if (mapRef.current) {
        try {
          mapRef.current.remove();
        } catch {
          /* noop */
        }
        mapRef.current = null;
      }
      setMapReady(false);
    };
  }, [token, mapRetry]);

  // ── store + delivery pins (always when coords exist) ──
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;

    if (storeLat != null && storeLng != null) {
      if (storeMarker.current) {
        storeMarker.current.setLngLat([storeLng, storeLat]);
      } else {
        const elStore = document.createElement('div');
        elStore.innerHTML = `<div style="width:32px;height:32px;border-radius:50%;background:hsl(var(--c-accent));border:2px solid white;box-shadow:0 2px 10px rgba(0,0,0,.28);display:flex;align-items:center;justify-content:center;font-size:15px">🏪</div>`;
        storeMarker.current = new mapboxgl.Marker({ element: elStore, anchor: 'center' })
          .setLngLat([storeLng, storeLat])
          .addTo(map);
      }
    }

    if (deliveryLat != null && deliveryLng != null) {
      if (homeMarker.current) {
        homeMarker.current.setLngLat([deliveryLng, deliveryLat]);
      } else {
        const elHome = document.createElement('div');
        elHome.innerHTML = `<div style="width:28px;height:28px;border-radius:50% 50% 50% 0;transform:rotate(-45deg);background:hsl(var(--c-text));border:2px solid white;box-shadow:0 2px 10px rgba(0,0,0,.28);display:flex;align-items:center;justify-content:center"><span style="transform:rotate(45deg);font-size:12px">🏠</span></div>`;
        homeMarker.current = new mapboxgl.Marker({ element: elHome, anchor: 'bottom' })
          .setLngLat([deliveryLng, deliveryLat])
          .addTo(map);
      }
    }
  }, [mapReady, storeLat, storeLng, deliveryLat, deliveryLng]);

  // ── camera: store + home (+ scooter when assigned) ──
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;

    const bounds = new mapboxgl.LngLatBounds();
    let n = 0;
    if (storeLat != null && storeLng != null) {
      bounds.extend([storeLng, storeLat]);
      n++;
    }
    if (deliveryLat != null && deliveryLng != null) {
      bounds.extend([deliveryLng, deliveryLat]);
      n++;
    }
    if (showLiveDriver && driverPos) {
      bounds.extend(driverPos);
      n++;
    }
    if (n === 0) return;

    if (n === 1) {
      map.easeTo({ center: bounds.getCenter(), zoom: 14.5, duration: 500 });
    } else {
      map.fitBounds(bounds, {
        padding: { top: 90, bottom: 340, left: 56, right: 56 },
        duration: 700,
        maxZoom: 15.5,
      });
    }
  }, [mapReady, storeLat, storeLng, deliveryLat, deliveryLng, driverPos, showLiveDriver, status]);

  // Keep scooter in view while en route
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady || !driverPos || !showLiveDriver) return;
    if (!FOLLOW_STATUSES.has(status)) return;
    try {
      const cam = map.getCenter();
      const dist = Math.hypot(cam.lng - driverPos[0], cam.lat - driverPos[1]);
      if (dist > 0.01) map.easeTo({ center: driverPos, duration: 900 });
    } catch {
      /* mid-style */
    }
  }, [driverPos, mapReady, showLiveDriver, status]);

  // ── tiny scooter marker (always after accept when GPS known) ──
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;

    if (!showLiveDriver || !driverPos) {
      driverMarker.current?.remove();
      driverMarker.current = null;
      driverIcon.current = null;
      lastPos.current = null;
      return;
    }

    if (!driverMarker.current) {
      const { wrap, icon } = makeTinyScooterEl();
      driverIcon.current = icon;
      driverMarker.current = new mapboxgl.Marker({ element: wrap, anchor: 'center' })
        .setLngLat(driverPos)
        .addTo(map);
    }

    const prev = lastPos.current;
    driverMarker.current.setLngLat(driverPos);
    if (prev && driverIcon.current) {
      const moved = Math.hypot(prev[0] - driverPos[0], prev[1] - driverPos[1]);
      if (moved > 0.00001) {
        const b = bearing(prev, driverPos);
        driverIcon.current.style.transform = `rotate(${b - 90}deg)`;
      }
    }
    lastPos.current = driverPos;
  }, [driverPos, mapReady, showLiveDriver]);

  return (
    <div ref={shellRef} className="absolute inset-0" data-tracking-map-shell="">
      <div ref={container} className="h-full w-full" />
      {tokenLoading && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-muted/90">
          <Loader2 className="h-7 w-7 animate-spin c-accent" />
        </div>
      )}
      {!tokenLoading && !token && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-muted/90 text-sm text-muted-foreground px-6 text-center">
          Ο χάρτης δεν είναι διαθέσιμος αυτή τη στιγμή
        </div>
      )}
      {mapError && token && (
        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-2 bg-muted/95 text-sm text-muted-foreground px-6 text-center">
          <p>Ο χάρτης δεν φόρτωσε</p>
          <button
            type="button"
            className="c-accent font-semibold underline underline-offset-2"
            onClick={() => {
              setMapError(null);
              setMapRetry((n) => n + 1);
            }}
          >
            Δοκιμή ξανά
          </button>
        </div>
      )}
      {token && mapReady && !driverId && (
        <div className="absolute top-3 left-1/2 -translate-x-1/2 z-10 rounded-full bg-card/95 border border-border shadow px-3 py-1.5 text-[11px] font-heading font-semibold text-muted-foreground">
          Αναζητούμε οδηγό…
        </div>
      )}
      {token && mapReady && driverId && !driverPos && (
        <div className="absolute top-3 left-1/2 -translate-x-1/2 z-10 rounded-full bg-card/95 border border-border shadow px-3 py-1.5 text-[11px] font-heading font-semibold text-muted-foreground">
          Ζωντανή παρακολούθηση — αναμονή θέσης…
        </div>
      )}
      {token && mapReady && driverId && driverPos && (
        <div className="absolute top-3 left-1/2 -translate-x-1/2 z-10 rounded-full bg-card/95 border border-border shadow px-3 py-1.5 text-[11px] font-heading font-semibold text-foreground flex items-center gap-1.5">
          <span className="text-sm leading-none" aria-hidden>
            🛵
          </span>
          Ζωντανή παρακολούθηση
        </div>
      )}
    </div>
  );
}
