import { useState, useEffect, useRef, useCallback } from 'react';
import { MapPin, Loader2, X, Navigation, Crosshair } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { MapContainer, TileLayer, Marker, useMapEvents, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Fix default marker icon
const defaultIcon = L.icon({
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
});

interface AddressResult {
  display_name: string;
  lat: string;
  lon: string;
}

interface AddressAutocompleteProps {
  value: string;
  onChange: (address: string, lat?: number, lon?: number) => void;
  placeholder?: string;
  maxLength?: number;
}

function MapClickHandler({ onMapClick }: { onMapClick: (lat: number, lon: number) => void }) {
  useMapEvents({
    click(e) {
      onMapClick(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
}

function FlyToPoint({ lat, lon }: { lat: number; lon: number }) {
  const map = useMap();
  useEffect(() => {
    map.flyTo([lat, lon], 17, { duration: 1 });
  }, [lat, lon, map]);
  return null;
}

export function AddressAutocomplete({
  value,
  onChange,
  placeholder = 'Εισάγετε τη διεύθυνση παράδοσης',
  maxLength = 200,
}: AddressAutocompleteProps) {
  const [query, setQuery] = useState(value);
  const [results, setResults] = useState<AddressResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [showMap, setShowMap] = useState(false);
  const [mapPin, setMapPin] = useState<{ lat: number; lon: number } | null>(null);
  const [reverseLoading, setReverseLoading] = useState(false);
  const [noResults, setNoResults] = useState(false);
  const [gpsLoading, setGpsLoading] = useState(false);
  const [flyTo, setFlyTo] = useState<{ lat: number; lon: number } | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => { setQuery(value); }, [value]);

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
    if (q.length < 3) {
      setResults([]);
      setNoResults(false);
      return;
    }
    setLoading(true);
    setNoResults(false);
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(q)}&limit=5&addressdetails=1&viewbox=20.7,39.55,20.95,39.75&bounded=1&countrycodes=gr`,
        { headers: { 'Accept-Language': 'el' } }
      );
      const data: AddressResult[] = await res.json();
      setResults(data);
      setOpen(data.length > 0);
      setNoResults(data.length === 0 && q.length >= 3);
    } catch {
      setResults([]);
      setNoResults(true);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleInput = (val: string) => {
    setQuery(val);
    onChange(val);
    setNoResults(false);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => search(val), 400);
  };

  const selectResult = (r: AddressResult) => {
    setQuery(r.display_name);
    onChange(r.display_name, parseFloat(r.lat), parseFloat(r.lon));
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

  const handleMapClick = async (lat: number, lon: number) => {
    setMapPin({ lat, lon });
    setReverseLoading(true);
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}&zoom=18&addressdetails=1`,
        { headers: { 'Accept-Language': 'el' } }
      );
      const data = await res.json();
      if (data.display_name) {
        setQuery(data.display_name);
        onChange(data.display_name, lat, lon);
      } else {
        const fallback = `${lat.toFixed(5)}, ${lon.toFixed(5)}`;
        setQuery(fallback);
        onChange(fallback, lat, lon);
      }
    } catch {
      const fallback = `${lat.toFixed(5)}, ${lon.toFixed(5)}`;
      setQuery(fallback);
      onChange(fallback, lat, lon);
    } finally {
      setReverseLoading(false);
    }
  };

  const confirmMapPin = () => {
    setShowMap(false);
    setNoResults(false);
  };

  const locateGPS = () => {
    if (!navigator.geolocation) {
      return;
    }
    setGpsLoading(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = pos.coords.latitude;
        const lon = pos.coords.longitude;
        setMapPin({ lat, lon });
        setFlyTo({ lat, lon });
        setShowMap(true);
        handleMapClick(lat, lon);
        setGpsLoading(false);
      },
      () => {
        setGpsLoading(false);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  // Ioannina center
  const ioannina: [number, number] = [39.6650, 20.8537];

  return (
    <div ref={containerRef} className="relative space-y-2">
      <div className="relative">
        <Input
          value={query}
          onChange={e => handleInput(e.target.value)}
          onFocus={() => results.length > 0 && setOpen(true)}
          placeholder={placeholder}
          maxLength={maxLength}
          className="pr-16"
        />
        <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
          {loading && <Loader2 className="h-4 w-4 text-muted-foreground animate-spin" />}
          {query && !loading && (
            <button onClick={clear} className="h-6 w-6 rounded-full bg-muted flex items-center justify-center">
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
              onClick={() => selectResult(r)}
              className="w-full text-left px-3 py-2.5 text-sm hover:bg-accent transition-colors flex items-start gap-2 border-b border-border last:border-0"
            >
              <MapPin className="h-4 w-4 text-primary flex-shrink-0 mt-0.5" />
              <span className="text-foreground line-clamp-2">{r.display_name}</span>
            </button>
          ))}
        </div>
      )}

      {/* No results - show map option */}
      {noResults && !showMap && (
        <div className="bg-muted/50 rounded-lg p-3 text-center space-y-2">
          <p className="text-sm text-muted-foreground">Δεν βρέθηκε η διεύθυνση</p>
          <div className="flex justify-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowMap(true)}
              className="gap-2"
            >
              <Navigation className="h-4 w-4" />
              Σημειώστε στον χάρτη
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={locateGPS}
              disabled={gpsLoading}
              className="gap-2"
            >
              {gpsLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Crosshair className="h-4 w-4" />}
              Τοποθεσία GPS
            </Button>
          </div>
        </div>
      )}

      {/* Always show "pin on map" and GPS buttons */}
      {!showMap && !noResults && (
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setShowMap(true)}
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

      {/* Map picker */}
      {showMap && (
        <div className="rounded-xl overflow-hidden border border-border space-y-2">
          <div className="relative h-64">
            <MapContainer
              center={mapPin ? [mapPin.lat, mapPin.lon] : ioannina}
              zoom={14}
              className="h-full w-full z-0"
              scrollWheelZoom={true}
            >
              <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a>'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />
              <MapClickHandler onMapClick={handleMapClick} />
              {mapPin && (
                <Marker position={[mapPin.lat, mapPin.lon]} icon={defaultIcon} />
              )}
            </MapContainer>
            {reverseLoading && (
              <div className="absolute top-2 right-2 bg-card/90 rounded-full p-1.5 shadow">
                <Loader2 className="h-4 w-4 animate-spin text-primary" />
              </div>
            )}
          </div>
          <div className="px-3 pb-3 flex items-center gap-2">
            <p className="text-xs text-muted-foreground flex-1">
              {mapPin ? 'Πατήστε ξανά για αλλαγή τοποθεσίας' : 'Πατήστε στον χάρτη για να ορίσετε τοποθεσία'}
            </p>
            <Button
              size="sm"
              disabled={!mapPin}
              onClick={confirmMapPin}
              className="gap-1.5"
            >
              <MapPin className="h-3.5 w-3.5" />
              Επιβεβαίωση
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setShowMap(false)}
            >
              Ακύρωση
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
