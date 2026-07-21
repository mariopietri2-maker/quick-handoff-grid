import { useState, useEffect, useRef, useCallback } from 'react';
import { MapPin, Loader2, X, Navigation, Crosshair } from 'lucide-react';
import { toast } from 'sonner';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { useMapboxToken } from '@/hooks/useMapboxToken';
import { geocodeAddress } from '@/lib/geocode';
import {
  IOANNINA_GEOCODE_BBOX,
  IOANNINA_MAP_CENTER,
  OUT_OF_ZONE_MESSAGE,
  isWithinIoanninaServiceArea,
} from '@/lib/geo-defaults';

interface AddressResult {
  display_name: string;
  lat: number;
  lon: number;
}

interface AddressAutocompleteProps {
  value: string;
  onChange: (address: string, lat?: number, lon?: number) => void;
  placeholder?: string;
  maxLength?: number;
  /** Optional map center [lng, lat]. Defaults to Ioannina. */
  initialCenter?: [number, number];
  /** Notify parent (e.g. Sheet) so it can disable CSS transform while map is open. */
  onMapOpenChange?: (open: boolean) => void;
}

const DEFAULT_CENTER: [number, number] = IOANNINA_MAP_CENTER;
const MARKER_COLOR = '#2563eb';
const ZONE_TOAST = OUT_OF_ZONE_MESSAGE;

export function AddressAutocomplete({
  value,
  onChange,
  placeholder = 'Εισάγετε τη διεύθυνση παράδοσης',
  maxLength = 200,
  initialCenter,
  onMapOpenChange,
}: AddressAutocompleteProps) {
  const { token, loading: tokenLoading } = useMapboxToken();
  const [query, setQuery] = useState(value);
  const [results, setResults] = useState<AddressResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [showMap, setShowMap] = useState(false);
  const [mapPin, setMapPin] = useState<{ lat: number; lon: number } | null>(null);
  const [reverseLoading, setReverseLoading] = useState(false);
  const [noResults, setNoResults] = useState(false);
  const [gpsLoading, setGpsLoading] = useState(false);
  const [mapError, setMapError] = useState<string | null>(null);
  const [mapRetry, setMapRetry] = useState(0);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();
  const containerRef = useRef<HTMLDivElement>(null);

  const mapContainer = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const markerRef = useRef<mapboxgl.Marker | null>(null);
  const mapPinRef = useRef(mapPin);
  const onChangeRef = useRef(onChange);
  const tokenRef = useRef(token);
  const centerRef = useRef<[number, number]>(initialCenter ?? DEFAULT_CENTER);

  useEffect(() => { setQuery(value); }, [value]);
  useEffect(() => { mapPinRef.current = mapPin; }, [mapPin]);
  useEffect(() => { onChangeRef.current = onChange; }, [onChange]);
  useEffect(() => { tokenRef.current = token; }, [token]);
  useEffect(() => {
    centerRef.current = initialCenter ?? DEFAULT_CENTER;
  }, [initialCenter]);

  useEffect(() => {
    onMapOpenChange?.(showMap);
    try {
      if (showMap) document.documentElement.dataset.addressMapOpen = '1';
      else delete document.documentElement.dataset.addressMapOpen;
    } catch { /* noop */ }
    return () => {
      try { delete document.documentElement.dataset.addressMapOpen; } catch { /* noop */ }
    };
  }, [showMap, onMapOpenChange]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const search = useCallback(async (q: string) => {
    if (q.length < 3 || !token) {
      setResults([]);
      setNoResults(false);
      return;
    }
    setLoading(true);
    setNoResults(false);
    try {
      const numMatch = q.match(/\b(\d{1,4}[A-Za-zΑ-Ωα-ω]?)\b/);
      const typedNumber = numMatch ? numMatch[1] : null;
      const [proxLng, proxLat] = centerRef.current;

      const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(q)}.json?access_token=${token}&country=gr&language=el&limit=8&bbox=${IOANNINA_GEOCODE_BBOX}&proximity=${proxLng},${proxLat}&types=address,poi,place,locality,neighborhood&autocomplete=true`;
      const res = await fetch(url);
      const data = await res.json();
      const features = (data.features ?? []) as Array<{
        place_name: string;
        center: [number, number];
        address?: string;
        place_type?: string[];
        text?: string;
      }>;

      const withNumber = typedNumber
        ? features.filter(f => f.address && String(f.address) === typedNumber)
        : features;

      const chosen = withNumber.length > 0 ? withNumber : features;

      const mapped: AddressResult[] = chosen
        .map(f => {
          let label = f.place_name;
          if (typedNumber && !f.address && f.place_type?.includes('address') && f.text) {
            label = label.replace(f.text, `${f.text} ${typedNumber}`);
          }
          return {
            display_name: label,
            lon: f.center[0],
            lat: f.center[1],
          };
        })
        .filter(r => isWithinIoanninaServiceArea(r.lat, r.lon));
      setResults(mapped);
      setOpen(mapped.length > 0);
      setNoResults(mapped.length === 0 && q.length >= 3);
    } catch {
      setResults([]);
      setNoResults(true);
    } finally {
      setLoading(false);
    }
  }, [token]);

  const hasCoordsRef = useRef(false);

  const handleInput = (val: string) => {
    setQuery(val);
    onChange(val);
    hasCoordsRef.current = false;
    setNoResults(false);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => search(val), 200);
  };

  const handleBlur = async () => {
    if (hasCoordsRef.current) return;
    const q = query.trim();
    if (q.length < 5) return;
    const res = await geocodeAddress(q);
    if (res) {
      if (!isWithinIoanninaServiceArea(res.latitude, res.longitude)) {
        toast.error(ZONE_TOAST);
        return;
      }
      hasCoordsRef.current = true;
      onChange(res.formatted || q, res.latitude, res.longitude);
      setQuery(res.formatted || q);
    }
  };

  const selectResult = (r: AddressResult) => {
    if (!isWithinIoanninaServiceArea(r.lat, r.lon)) {
      toast.error(ZONE_TOAST);
      return;
    }
    setQuery(r.display_name);
    onChange(r.display_name, r.lat, r.lon);
    hasCoordsRef.current = true;
    setOpen(false);
    setResults([]);
    setNoResults(false);
    setShowMap(false);
  };

  const clear = () => {
    setQuery('');
    onChange('');
    setResults([]);
    setOpen(false);
    setNoResults(false);
    setShowMap(false);
    setMapPin(null);
  };

  const reverseGeocode = useCallback(async (lat: number, lon: number) => {
    if (!isWithinIoanninaServiceArea(lat, lon)) {
      toast.error(ZONE_TOAST);
      return;
    }
    setReverseLoading(true);
    try {
      const t = tokenRef.current;
      if (!t) throw new Error('no token');
      const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${lon},${lat}.json?access_token=${t}&language=el&limit=1`;
      const res = await fetch(url);
      const data = await res.json();
      const name = data.features?.[0]?.place_name as string | undefined;
      if (name) {
        setQuery(name);
        onChangeRef.current(name, lat, lon);
      } else {
        const fallback = `${lat.toFixed(5)}, ${lon.toFixed(5)}`;
        setQuery(fallback);
        onChangeRef.current(fallback, lat, lon);
      }
      hasCoordsRef.current = true;
    } catch {
      const fallback = `${lat.toFixed(5)}, ${lon.toFixed(5)}`;
      setQuery(fallback);
      onChangeRef.current(fallback, lat, lon);
      hasCoordsRef.current = true;
    } finally {
      setReverseLoading(false);
    }
  }, []);

  const handleMapClick = useCallback((lat: number, lon: number) => {
    if (!isWithinIoanninaServiceArea(lat, lon)) {
      toast.error(ZONE_TOAST);
      return;
    }
    setMapPin({ lat, lon });
    reverseGeocode(lat, lon);
  }, [reverseGeocode]);

  const confirmMapPin = () => {
    setShowMap(false);
    setNoResults(false);
  };

  const locateGPS = () => {
    if (!navigator.geolocation) {
      toast.error('Η τοποθεσία GPS δεν υποστηρίζεται στη συσκευή σας');
      return;
    }
    setGpsLoading(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = pos.coords.latitude;
        const lon = pos.coords.longitude;
        if (!isWithinIoanninaServiceArea(lat, lon)) {
          setGpsLoading(false);
          toast.error(ZONE_TOAST);
          return;
        }
        setMapPin({ lat, lon });
        setShowMap(true);
        reverseGeocode(lat, lon);
        setGpsLoading(false);
      },
      (err) => {
        setGpsLoading(false);
        if (err.code === 1) {
          toast.error('Η πρόσβαση στην τοποθεσία απορρίφθηκε. Ενεργοποιήστε την τοποθεσία στις ρυθμίσεις.');
        } else if (err.code === 2) {
          toast.error('Δεν ήταν δυνατή η εύρεση τοποθεσίας. Δοκιμάστε ξανά.');
        } else {
          toast.error('Λήξη χρόνου τοποθεσίας. Δοκιμάστε ξανά.');
        }
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    );
  };

  // Inline map — same Mapbox path as the working driver map. Parent Sheet
  // must drop CSS transform while open (see CustomerApp + index.css).
  useEffect(() => {
    if (!showMap || !token) return;

    let cancelled = false;
    let ro: ResizeObserver | null = null;
    const timers: number[] = [];
    let raf = 0;

    const destroy = () => {
      if (ro) {
        try { ro.disconnect(); } catch { /* noop */ }
        ro = null;
      }
      timers.forEach((id) => window.clearTimeout(id));
      timers.length = 0;
      if (raf) cancelAnimationFrame(raf);
      if (mapRef.current) {
        try { mapRef.current.remove(); } catch { /* noop */ }
        mapRef.current = null;
      }
      markerRef.current = null;
    };

    const tryInit = (): boolean => {
      if (cancelled || mapRef.current || !mapContainer.current) return false;

      const el = mapContainer.current;
      if (el.clientWidth < 2 || el.clientHeight < 2) return false;

      mapboxgl.accessToken = token;
      setMapError(null);

      const pin = mapPinRef.current;
      const center: [number, number] = pin
        ? [pin.lon, pin.lat]
        : centerRef.current;

      let map: mapboxgl.Map;
      try {
        map = new mapboxgl.Map({
          container: el,
          style: 'mapbox://styles/mapbox/streets-v12',
          center,
          zoom: pin ? 16 : 14,
          attributionControl: false,
          failIfMajorPerformanceCaveat: false,
        });
      } catch (err: any) {
        setMapError(err?.message || 'Ο χάρτης δεν φόρτωσε');
        return false;
      }

      map.addControl(new mapboxgl.NavigationControl({ showCompass: false }), 'top-right');
      map.on('click', (e) => {
        handleMapClick(e.lngLat.lat, e.lngLat.lng);
      });
      map.on('error', (e) => {
        const msg = e?.error?.message || 'Ο χάρτης δεν φόρτωσε';
        // Ignore benign tile abort noise; keep real style/token failures.
        if (/abort|cancel/i.test(msg)) return;
        setMapError(msg);
      });

      const resize = () => {
        try { map.resize(); } catch { /* noop */ }
      };
      map.on('load', () => {
        setMapError(null);
        resize();
        requestAnimationFrame(resize);
      });

      window.addEventListener('resize', resize);
      const shell = el.parentElement ?? el;
      if (typeof ResizeObserver !== 'undefined') {
        ro = new ResizeObserver(() => resize());
        ro.observe(shell);
      }
      [50, 150, 300, 500, 800, 1200].forEach((ms) => {
        timers.push(window.setTimeout(resize, ms));
      });

      const prevRemove = map.remove.bind(map);
      map.remove = () => {
        window.removeEventListener('resize', resize);
        prevRemove();
      };

      mapRef.current = map;

      if (pin) {
        markerRef.current = new mapboxgl.Marker({ color: MARKER_COLOR })
          .setLngLat([pin.lon, pin.lat])
          .addTo(map);
      }
      return true;
    };

    const schedule = () => {
      if (cancelled || mapRef.current) return;
      if (tryInit()) return;
      raf = requestAnimationFrame(() => {
        if (cancelled || mapRef.current) return;
        if (tryInit()) return;
        timers.push(window.setTimeout(schedule, 60));
      });
    };

    schedule();
    timers.push(window.setTimeout(schedule, 100));
    timers.push(window.setTimeout(schedule, 300));
    timers.push(window.setTimeout(schedule, 600));
    timers.push(window.setTimeout(schedule, 1000));

    return () => {
      cancelled = true;
      destroy();
    };
  }, [showMap, token, handleMapClick, mapRetry]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapPin) return;
    if (markerRef.current) {
      markerRef.current.setLngLat([mapPin.lon, mapPin.lat]);
    } else {
      markerRef.current = new mapboxgl.Marker({ color: MARKER_COLOR })
        .setLngLat([mapPin.lon, mapPin.lat])
        .addTo(map);
    }
    map.easeTo({ center: [mapPin.lon, mapPin.lat], zoom: Math.max(map.getZoom(), 16), duration: 800 });
  }, [mapPin]);

  const openMapPicker = (e?: React.MouseEvent) => {
    e?.preventDefault();
    e?.stopPropagation();
    setMapError(null);
    setShowMap(true);
  };

  return (
    <div ref={containerRef} className="relative space-y-2">
      <div className="relative">
        <Input
          value={query}
          onChange={e => handleInput(e.target.value)}
          onFocus={() => results.length > 0 && setOpen(true)}
          onBlur={handleBlur}
          placeholder={placeholder}
          maxLength={maxLength}
          className="pr-16"
        />
        <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
          {(loading || tokenLoading) && <Loader2 className="h-4 w-4 text-muted-foreground animate-spin" />}
          {query && !loading && (
            <button type="button" onClick={clear} className="h-6 w-6 rounded-full bg-muted flex items-center justify-center">
              <X className="h-3 w-3 text-muted-foreground" />
            </button>
          )}
        </div>
      </div>

      {open && results.length > 0 && (
        <div className="absolute z-50 w-full mt-1 bg-card border border-border rounded-lg shadow-[var(--shadow-lg)] max-h-52 overflow-y-auto">
          {results.map((r, i) => (
            <button
              key={i}
              type="button"
              onClick={() => selectResult(r)}
              className="w-full text-left px-3 py-2.5 text-sm hover:bg-accent transition-colors flex items-start gap-2 border-b border-border last:border-0"
            >
              <MapPin className="h-4 w-4 text-primary flex-shrink-0 mt-0.5" />
              <span className="text-foreground line-clamp-2">{r.display_name}</span>
            </button>
          ))}
        </div>
      )}

      {noResults && !showMap && (
        <div className="bg-muted/50 rounded-lg p-3 text-center space-y-2">
          <p className="text-sm text-muted-foreground">Δεν βρέθηκε η διεύθυνση</p>
          <div className="flex justify-center gap-2">
            <Button variant="outline" size="sm" type="button" onClick={openMapPicker} className="gap-2">
              <Navigation className="h-4 w-4" />
              Σημειώστε στον χάρτη
            </Button>
            <Button variant="outline" size="sm" type="button" onClick={locateGPS} disabled={gpsLoading} className="gap-2">
              {gpsLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Crosshair className="h-4 w-4" />}
              Τοποθεσία GPS
            </Button>
          </div>
        </div>
      )}

      {!showMap && !noResults && (
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={openMapPicker}
            className="flex items-center gap-1.5 text-xs text-primary hover:underline underline-offset-2"
          >
            <Navigation className="h-3.5 w-3.5" />
            Σημειώστε στον χάρτη
          </button>
          <button
            type="button"
            onClick={locateGPS}
            disabled={gpsLoading}
            className="flex items-center gap-1.5 text-xs text-primary hover:underline underline-offset-2 disabled:opacity-50"
          >
            {gpsLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Crosshair className="h-3.5 w-3.5" />}
            Τοποθεσία GPS
          </button>
        </div>
      )}

      {showMap && (
        <div className="rounded-xl overflow-hidden border border-border bg-card">
          <div className="flex items-center gap-2 px-3 py-2 border-b border-border">
            <p className="text-xs text-muted-foreground flex-1 min-w-0 truncate">
              {mapPin
                ? 'Πατήστε ξανά για αλλαγή τοποθεσίας'
                : 'Πατήστε στον χάρτη (Ιωάννινα & γύρω περιοχή)'}
            </p>
            <Button size="sm" type="button" disabled={!mapPin} onClick={confirmMapPin} className="gap-1.5 h-8 shrink-0">
              <MapPin className="h-3.5 w-3.5" />
              Επιβεβαίωση
            </Button>
            <Button size="sm" type="button" variant="ghost" onClick={() => setShowMap(false)} className="h-8 shrink-0">
              Ακύρωση
            </Button>
          </div>

          {/* Half of previous h-64 (~16rem) → h-32 (8rem), with a slightly taller min for usability */}
          <div className="relative h-40 min-h-[10rem] w-full bg-muted">
            <div
              ref={mapContainer}
              className="absolute inset-0"
              style={{ width: '100%', height: '100%' }}
            />

            {(tokenLoading || !token) && (
              <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-2 px-4 text-center bg-muted">
                {tokenLoading ? (
                  <Loader2 className="h-6 w-6 animate-spin text-primary" />
                ) : (
                  <>
                    <p className="text-sm text-muted-foreground">Ο χάρτης δεν φορτώθηκε.</p>
                    <Button
                      variant="outline"
                      size="sm"
                      type="button"
                      onClick={() => setMapRetry((n) => n + 1)}
                    >
                      Δοκιμή ξανά
                    </Button>
                  </>
                )}
              </div>
            )}

            {mapError && token && (
              <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-2 px-4 text-center bg-muted/95">
                <p className="text-sm text-muted-foreground">Ο χάρτης δεν φόρτωσε. Δοκιμάστε ξανά.</p>
                <Button
                  variant="outline"
                  size="sm"
                  type="button"
                  onClick={() => {
                    setMapError(null);
                    setMapRetry((n) => n + 1);
                  }}
                >
                  Δοκιμή ξανά
                </Button>
              </div>
            )}

            <button
              type="button"
              onClick={locateGPS}
              disabled={gpsLoading}
              className="absolute bottom-3 right-3 z-10 h-10 w-10 bg-card rounded-full shadow-md flex items-center justify-center border border-border hover:bg-accent transition-colors disabled:opacity-50"
              title="Η τοποθεσία μου"
            >
              {gpsLoading ? <Loader2 className="h-5 w-5 animate-spin text-primary" /> : <Crosshair className="h-5 w-5 text-primary" />}
            </button>

            {reverseLoading && (
              <div className="absolute top-2 right-2 z-10 bg-card/90 rounded-full p-1.5 shadow">
                <Loader2 className="h-4 w-4 animate-spin text-primary" />
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
