import { useEffect, useRef, useState, useCallback } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { useMapboxToken } from '@/hooks/useMapboxToken';
import { supabase } from '@/integrations/supabase/client';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Plus, Trash2, MapPin, Save, Locate, Search, Pencil, Check, X, RotateCcw, Maximize2 } from 'lucide-react';
import { toast } from 'sonner';
import { geocodeAddress } from '@/lib/geocode';

interface ServiceZone {
  id: string;
  city: string;
  center_latitude: number;
  center_longitude: number;
  radius_km: number;
  is_active: boolean;
}

const DEFAULT_CENTER: [number, number] = [20.8537, 39.6650]; // Ιωάννινα
const CIRCLE_POINTS = 64;

/** Generate a GeoJSON Polygon approximating a circle (radius in km) around [lng,lat]. */
function circlePolygon(lng: number, lat: number, radiusKm: number): GeoJSON.Feature<GeoJSON.Polygon> {
  const coords: [number, number][] = [];
  const earthRadius = 6371;
  const d = radiusKm / earthRadius;
  const latRad = (lat * Math.PI) / 180;
  const lngRad = (lng * Math.PI) / 180;
  for (let i = 0; i <= CIRCLE_POINTS; i++) {
    const bearing = (i / CIRCLE_POINTS) * 2 * Math.PI;
    const lat2 = Math.asin(Math.sin(latRad) * Math.cos(d) + Math.cos(latRad) * Math.sin(d) * Math.cos(bearing));
    const lng2 = lngRad + Math.atan2(
      Math.sin(bearing) * Math.sin(d) * Math.cos(latRad),
      Math.cos(d) - Math.sin(latRad) * Math.sin(lat2),
    );
    coords.push([(lng2 * 180) / Math.PI, (lat2 * 180) / Math.PI]);
  }
  return { type: 'Feature', properties: {}, geometry: { type: 'Polygon', coordinates: [coords] } };
}

/** Destination point given start [lng,lat], bearing (rad) and distance (km). */
function destination(lng: number, lat: number, bearingRad: number, distKm: number): [number, number] {
  const earthRadius = 6371;
  const d = distKm / earthRadius;
  const latRad = (lat * Math.PI) / 180;
  const lngRad = (lng * Math.PI) / 180;
  const lat2 = Math.asin(Math.sin(latRad) * Math.cos(d) + Math.cos(latRad) * Math.sin(d) * Math.cos(bearingRad));
  const lng2 = lngRad + Math.atan2(
    Math.sin(bearingRad) * Math.sin(d) * Math.cos(latRad),
    Math.cos(d) - Math.sin(latRad) * Math.sin(lat2),
  );
  return [(lng2 * 180) / Math.PI, (lat2 * 180) / Math.PI];
}

/** Great-circle distance in km between two [lng,lat] points. */
function haversineKm(lng1: number, lat1: number, lng2: number, lat2: number): number {
  const earthRadius = 6371;
  const toRad = Math.PI / 180;
  const dLat = (lat2 - lat1) * toRad;
  const dLng = (lng2 - lng1) * toRad;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * toRad) * Math.cos(lat2 * toRad) * Math.sin(dLng / 2) ** 2;
  return 2 * earthRadius * Math.asin(Math.min(1, Math.sqrt(a)));
}

const EDGE_BEARING_RAD = Math.PI / 2; // handle sits due east of the center

export default function ServiceZonesEditor() {
  const mapContainer = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const centerMarkerRef = useRef<mapboxgl.Marker | null>(null);
  const edgeMarkerRef = useRef<mapboxgl.Marker | null>(null);
  const draggingCenterRef = useRef(false);
  const draggingEdgeRef = useRef(false);
  const prevSelectedIdRef = useRef<string | null | undefined>(undefined);
  const { token } = useMapboxToken();

  const [zones, setZones] = useState<ServiceZone[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [newCity, setNewCity] = useState('');
  const [creating, setCreating] = useState(false);
  const [saving, setSaving] = useState(false);
  // Camera/marker calls on a half-initialized map throw
  // "Cannot read properties of undefined (reading 'lng')" in mapbox-gl v3.
  // Nothing below touches the map until mapReady flips true (on 'load').
  const [mapReady, setMapReady] = useState(false);

  // Flexible-editing UI state
  const [renameOpen, setRenameOpen] = useState(false);
  const [renameVal, setRenameVal] = useState('');
  const [latInput, setLatInput] = useState('');
  const [lngInput, setLngInput] = useState('');
  const [radiusInput, setRadiusInput] = useState('');
  const [searchQ, setSearchQ] = useState('');
  const [searching, setSearching] = useState(false);

  /** Snapshot of the last-saved DB state per zone id — powers dirty check + Reset. */
  const savedRef = useRef<Record<string, ServiceZone>>({});
  const markSaved = useCallback((list: ServiceZone[]) => {
    const map: Record<string, ServiceZone> = {};
    for (const z of list) map[z.id] = { ...z };
    savedRef.current = map;
  }, []);
  const selectedSaved = selectedId ? savedRef.current[selectedId] ?? null : null;
  const isDirty = !!selected && !!selectedSaved && (
    selected.center_latitude !== selectedSaved.center_latitude ||
    selected.center_longitude !== selectedSaved.center_longitude ||
    Number(selected.radius_km) !== Number(selectedSaved.radius_km) ||
    selected.is_active !== selectedSaved.is_active ||
    selected.city !== selectedSaved.city
  );

  const zonesRef = useRef(zones);
  zonesRef.current = zones;

  const selected = zones.find(z => z.id === selectedId) ?? null;

  const load = useCallback(async () => {
    const { data, error } = await supabase
      .from('service_zones')
      .select('*')
      .order('city');
    if (error) { toast.error('Αποτυχία φόρτωσης ζωνών'); return; }
    setZones((data ?? []) as ServiceZone[]);
    markSaved((data ?? []) as ServiceZone[]);
    if (data && data.length && !selectedId) setSelectedId(data[0].id);
  }, [selectedId, markSaved]);

  useEffect(() => { load(); }, [load]);

  // Init map
  useEffect(() => {
    if (!token || !mapContainer.current || mapRef.current) return;
    mapboxgl.accessToken = token;
    const map = new mapboxgl.Map({
      container: mapContainer.current,
      style: 'mapbox://styles/mapbox/streets-v12',
      center: DEFAULT_CENTER,
      zoom: 12,
      attributionControl: false,
    });
    map.addControl(new mapboxgl.NavigationControl(), 'top-right');
    map.on('load', () => {
      if (mapRef.current !== map) return;
      // Faint circles for all the OTHER zones — clickable to switch selection.
      map.addSource('zones-others', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
      map.addLayer({
        id: 'others-fill',
        type: 'fill',
        source: 'zones-others',
        paint: { 'fill-color': '#94a3b8', 'fill-opacity': 0.08 },
      });
      map.addLayer({
        id: 'others-line',
        type: 'line',
        source: 'zones-others',
        paint: { 'line-color': '#94a3b8', 'line-width': 1, 'line-dasharray': [2, 2] },
      });
      map.addSource('zone-circle', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
      map.addLayer({
        id: 'zone-fill',
        type: 'fill',
        source: 'zone-circle',
        paint: { 'fill-color': '#3b82f6', 'fill-opacity': 0.18 },
      });
      map.addLayer({
        id: 'zone-line',
        type: 'line',
        source: 'zone-circle',
        paint: { 'line-color': '#2563eb', 'line-width': 2 },
      });
      setMapReady(true);
    });
    mapRef.current = map;
    return () => {
      map.remove();
      mapRef.current = null;
      centerMarkerRef.current = null;
      edgeMarkerRef.current = null;
      setMapReady(false);
    };
  }, [token]);

  // Create markers for the selected zone (stable across drags)
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady || !selectedId) {
      centerMarkerRef.current?.remove();
      centerMarkerRef.current = null;
      edgeMarkerRef.current?.remove();
      edgeMarkerRef.current = null;
      return;
    }

    // Markers must always have a position before hitting the map — an
    // unpositioned marker crashes with "reading 'lng'" on first render.
    const zone = zonesRef.current.find(v => v.id === selectedId) ?? null;
    const zLng = Number(zone?.center_longitude);
    const zLat = Number(zone?.center_latitude);
    const startCenter: [number, number] =
      Number.isFinite(zLng) && Number.isFinite(zLat) ? [zLng, zLat] : [DEFAULT_CENTER[0], DEFAULT_CENTER[1]];
    const startEdge: [number, number] =
      zone && Number.isFinite(zLng) && Number.isFinite(zLat)
        ? destination(startCenter[0], startCenter[1], EDGE_BEARING_RAD, Math.max(1, Number(zone.radius_km) || 1))
        : [DEFAULT_CENTER[0], DEFAULT_CENTER[1]];

    const centerMarker = new mapboxgl.Marker({ color: '#2563eb', draggable: true })
      .setLngLat(startCenter)
      .addTo(map);
    centerMarker.on('dragstart', () => { draggingCenterRef.current = true; });
    centerMarker.on('drag', () => {
      if (!zonesRef.current.some(v => v.id === selectedId)) return;
      const { lng, lat } = centerMarker.getLngLat();
      setZones(prev => prev.map(v => v.id === selectedId ? { ...v, center_longitude: lng, center_latitude: lat } : v));
    });
    centerMarker.on('dragend', () => { draggingCenterRef.current = false; });

    const edgeMarker = new mapboxgl.Marker({ color: '#f59e0b', draggable: true, scale: 1.1 })
      .setLngLat(startEdge)
      .addTo(map);
    edgeMarker.getElement().title = 'Σύρε για αλλαγή ακτίνας';
    edgeMarker.on('dragstart', () => { draggingEdgeRef.current = true; });
    edgeMarker.on('drag', () => {
      const z = zonesRef.current.find(v => v.id === selectedId);
      if (!z) return;
      const { lng, lat } = edgeMarker.getLngLat();
      const km = Math.min(50, Math.max(1, Math.round(haversineKm(z.center_longitude, z.center_latitude, lng, lat) * 2) / 2));
      setZones(prev => prev.map(v => v.id === selectedId ? { ...v, radius_km: km } : v));
    });
    edgeMarker.on('dragend', () => { draggingEdgeRef.current = false; });

    centerMarkerRef.current = centerMarker;
    edgeMarkerRef.current = edgeMarker;

    return () => {
      centerMarker.remove();
      edgeMarker.remove();
      centerMarkerRef.current = null;
      edgeMarkerRef.current = null;
    };
  }, [selectedId, mapReady]);

  // Click a faint zone circle on the map to select that zone
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;
    const onClick = (e: mapboxgl.MapMouseEvent & { features?: mapboxgl.MapboxGeoJSONFeature[] }) => {
      const id = e.features?.[0]?.properties?.id as string | undefined;
      if (id) setSelectedId(id);
    };
    const onEnter = () => { map.getCanvas().style.cursor = 'pointer'; };
    const onLeave = () => { map.getCanvas().style.cursor = ''; };
    map.on('click', 'others-fill', onClick);
    map.on('mousemove', 'others-fill', onEnter);
    map.on('mouseleave', 'others-fill', onLeave);
    return () => {
      map.off('click', 'others-fill', onClick);
      map.off('mousemove', 'others-fill', onEnter);
      map.off('mouseleave', 'others-fill', onLeave);
    };
  }, [mapReady]);

  // Keep manual lat/lng/radius inputs in sync with the selected zone
  useEffect(() => {
    setLatInput(selected ? Number(selected.center_latitude).toFixed(5) : '');
    setLngInput(selected ? Number(selected.center_longitude).toFixed(5) : '');
    setRadiusInput(selected ? String(Number(selected.radius_km)) : '');
  }, [selected?.id, selected?.center_latitude, selected?.center_longitude, selected?.radius_km]);

  // Sync circle geometry + marker positions with the selected zone
  const selLat = selected?.center_latitude;
  const selLng = selected?.center_longitude;
  const selRadius = selected?.radius_km;

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;
    const selected = zonesRef.current.find(v => v.id === selectedId) ?? null;

    const draw = () => {
      // Faint circles for every other zone (clickable via others-fill layer)
      const othersSrc = map.getSource('zones-others') as mapboxgl.GeoJSONSource | undefined;
      if (othersSrc) {
        othersSrc.setData({
          type: 'FeatureCollection',
          features: zonesRef.current
            .filter(z => z.id !== selectedId)
            .map(z => {
              const poly = circlePolygon(Number(z.center_longitude), Number(z.center_latitude), Number(z.radius_km) || 1);
              return { ...poly, properties: { id: z.id, city: z.city } };
            }),
        });
      }
      const src = map.getSource('zone-circle') as mapboxgl.GeoJSONSource | undefined;
      if (!src) return;
      if (!selected) {
        src.setData({ type: 'FeatureCollection', features: [] });
        return;
      }
      src.setData({
        type: 'FeatureCollection',
        features: [circlePolygon(selected.center_longitude, selected.center_latitude, Number(selected.radius_km))],
      });
    };
    // Style is guaranteed loaded here (mapReady), so drawing is always safe.
    draw();

    if (!selected) return;

    const cLng = Number(selected.center_longitude);
    const cLat = Number(selected.center_latitude);
    if (!Number.isFinite(cLng) || !Number.isFinite(cLat)) return;

    const centerMarker = centerMarkerRef.current;
    const edgeMarker = edgeMarkerRef.current;
    if (centerMarker && !draggingCenterRef.current) {
      centerMarker.setLngLat([cLng, cLat]);
    }
    if (edgeMarker && !draggingEdgeRef.current) {
      const [elng, elat] = destination(cLng, cLat, EDGE_BEARING_RAD, Math.max(1, Number(selected.radius_km) || 1));
      edgeMarker.setLngLat([elng, elat]);
    }

    if (prevSelectedIdRef.current !== selectedId) {
      prevSelectedIdRef.current = selectedId;
      map.flyTo({ center: [cLng, cLat], zoom: 12 });
    }
  }, [selectedId, selLat, selLng, selRadius, mapReady]);

  const updateLocal = (patch: Partial<ServiceZone>) => {
    if (!selected) return;
    setZones(prev => prev.map(z => z.id === selected.id ? { ...z, ...patch } : z));
  };

  const persist = async () => {
    if (!selected) return;
    const city = selected.city.trim();
    if (!city) { toast.error('Η πόλη δεν μπορεί να είναι κενή'); return; }
    setSaving(true);
    const { error } = await supabase
      .from('service_zones')
      .update({
        city,
        center_latitude: selected.center_latitude,
        center_longitude: selected.center_longitude,
        radius_km: selected.radius_km,
        is_active: selected.is_active,
      })
      .eq('id', selected.id);
    setSaving(false);
    if (error) {
      toast.error(error.message.includes('duplicate') || error.message.includes('unique')
        ? 'Υπάρχει ήδη ζώνη με αυτή την πόλη'
        : 'Αποτυχία αποθήκευσης');
      return;
    }
    markSaved(Object.values({ ...savedRef.current, [selected.id]: { ...selected, city } }));
    toast.success('Η ζώνη αποθηκεύτηκε');
  };

  /** Commit an inline city rename locally (persisted with Αποθήκευση). */
  const commitRename = () => {
    const val = renameVal.trim();
    setRenameOpen(false);
    if (!val || !selected || val === selected.city) return;
    if (zones.some(z => z.id !== selected.id && z.city === val)) {
      toast.error('Υπάρχει ήδη ζώνη με αυτή την πόλη');
      return;
    }
    updateLocal({ city: val });
  };

  /** Commit manually typed center coordinates. */
  const commitCoords = () => {
    if (!selected) return;
    const lat = Number(latInput.replace(',', '.'));
    const lng = Number(lngInput.replace(',', '.'));
    if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 85 || Math.abs(lng) > 180) {
      toast.error('Μη έγκυρες συντεταγμένες');
      return;
    }
    updateLocal({ center_latitude: lat, center_longitude: lng });
  };

  /** Commit manually typed radius (1–50 km, matches DB CHECK). */
  const commitRadiusInput = () => {
    if (!selected) return;
    const km = Number(radiusInput.replace(',', '.'));
    if (!Number.isFinite(km) || km < 1 || km > 50) {
      toast.error('Η ακτίνα πρέπει να είναι 1–50 km');
      return;
    }
    updateLocal({ radius_km: Math.round(km * 2) / 2 });
  };

  /** Search an address and move the zone center there. */
  const searchCenter = async () => {
    const q = searchQ.trim();
    if (!q || !selected) return;
    setSearching(true);
    const hit = await geocodeAddress(q);
    setSearching(false);
    if (!hit || !Number.isFinite(hit.latitude) || !Number.isFinite(hit.longitude)) {
      toast.error('Δεν βρέθηκε η διεύθυνση');
      return;
    }
    updateLocal({ center_latitude: hit.latitude, center_longitude: hit.longitude });
    mapRef.current?.flyTo({ center: [hit.longitude, hit.latitude], zoom: 13 });
    toast.success(`Κέντρο: ${hit.formatted}`);
  };

  /** Zoom so every zone circle is visible. */
  const fitAllZones = () => {
    const map = mapRef.current;
    if (!map || !mapReady || zones.length === 0) return;
    const b = new mapboxgl.LngLatBounds();
    for (const z of zones) {
      const lng = Number(z.center_longitude);
      const lat = Number(z.center_latitude);
      const km = Math.max(1, Number(z.radius_km) || 1);
      if (!Number.isFinite(lng) || !Number.isFinite(lat)) continue;
      b.extend([lng, lat]);
      b.extend(destination(lng, lat, 0, km));
      b.extend(destination(lng, lat, Math.PI, km));
      b.extend(destination(lng, lat, EDGE_BEARING_RAD, km));
      b.extend(destination(lng, lat, -EDGE_BEARING_RAD, km));
    }
    if (!b.isEmpty()) map.fitBounds(b, { padding: 60, duration: 600 });
  };

  /** Revert local edits of the selected zone back to last-saved values. */
  const resetChanges = () => {
    if (!selectedId) return;
    const saved = savedRef.current[selectedId];
    if (!saved) return;
    setZones(prev => prev.map(z => z.id === selectedId ? { ...saved } : z));
  };

  const getMapCenter = useCallback((): { lat: number; lng: number } => {
    const map = mapRef.current;
    if (map && mapReady) {
      try {
        const c = map.getCenter();
        if (c && Number.isFinite(c.lat) && Number.isFinite(c.lng)) return { lat: c.lat, lng: c.lng };
      } catch {
        /* map tearing down */
      }
    }
    return { lat: DEFAULT_CENTER[1], lng: DEFAULT_CENTER[0] };
  }, [mapReady]);

  const createZone = async () => {
    const city = newCity.trim();
    if (!city) return;
    setCreating(true);
    const c = getMapCenter();
    const { data, error } = await supabase
      .from('service_zones')
      .insert({ city, center_latitude: c.lat, center_longitude: c.lng, radius_km: 18, is_active: true })
      .select()
      .single();
    setCreating(false);
    if (error) { toast.error(error.message.includes('duplicate') ? 'Η πόλη υπάρχει ήδη' : 'Αποτυχία'); return; }
    setNewCity('');
    const created = data as ServiceZone;
    setZones(prev => [...prev, created].sort((a, b) => a.city.localeCompare(b.city)));
    markSaved([...zonesRef.current, created]);
    setSelectedId(created.id);
    toast.success(`Δημιουργήθηκε ζώνη: ${city}`);
  };

  const removeZone = async (id: string) => {
    if (!confirm('Διαγραφή ζώνης; Παραγγελίες εκτός των υπόλοιπων ενεργών ζωνών δεν θα γίνονται δεκτές.')) return;
    const { error } = await supabase.from('service_zones').delete().eq('id', id);
    if (error) { toast.error('Αποτυχία διαγραφής'); return; }
    setZones(prev => prev.filter(z => z.id !== id));
    delete savedRef.current[id];
    if (selectedId === id) setSelectedId(null);
    toast.success('Η ζώνη διαγράφηκε');
  };

  const recenterOnMap = () => {
    if (!selected) return;
    const c = getMapCenter();
    updateLocal({ center_latitude: c.lat, center_longitude: c.lng });
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[340px_1fr] gap-4">
      {/* LEFT: zones list + editor */}
      <div className="space-y-3">
        <Card className="p-4 space-y-3">
          <div className="flex items-center gap-2">
            <MapPin className="h-4 w-4 text-primary" />
            <h2 className="font-heading font-semibold text-foreground">Ζώνες Παράδοσης</h2>
          </div>
          <p className="text-xs text-muted-foreground">
            Μια ζώνη ανά πόλη. Διευθύνσεις πελατών εκτός κύκλου μπλοκάρονται αυτόματα στο checkout.
          </p>
          <div className="flex gap-2">
            <Input
              placeholder="π.χ. Ιωάννινα"
              value={newCity}
              onChange={e => setNewCity(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && createZone()}
              maxLength={60}
            />
            <Button onClick={createZone} disabled={!newCity.trim() || creating} size="sm">
              <Plus className="h-4 w-4" />
            </Button>
          </div>
        </Card>

        <Card className="p-2 space-y-1 max-h-72 overflow-y-auto">
          {zones.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-6">Καμία ζώνη ακόμη.</p>
          )}
          {zones.map(z => (
            <button
              key={z.id}
              onClick={() => setSelectedId(z.id)}
              className={`w-full text-left p-2.5 rounded-lg flex items-center justify-between transition-colors ${
                z.id === selectedId ? 'bg-primary/10 border border-primary/30' : 'hover:bg-muted/60'
              }`}
            >
              <div className="min-w-0">
                <p className="text-sm font-medium text-foreground truncate">{z.city}</p>
                <p className="text-[11px] text-muted-foreground">
                  ακτίνα {Number(z.radius_km).toFixed(1)} km
                </p>
              </div>
              <Badge variant={z.is_active ? 'default' : 'outline'} className="text-[10px]">
                {z.is_active ? 'ενεργή' : 'ανενεργή'}
              </Badge>
            </button>
          ))}
        </Card>

        {selected && (
          <Card className="p-4 space-y-4">
            {/* City name + inline rename */}
            <div>
              {renameOpen ? (
                <div className="flex items-center gap-1.5">
                  <Input
                    autoFocus
                    value={renameVal}
                    onChange={e => setRenameVal(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter') commitRename();
                      if (e.key === 'Escape') setRenameOpen(false);
                    }}
                    maxLength={60}
                  />
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={commitRename}><Check className="h-4 w-4 text-primary" /></Button>
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setRenameOpen(false)}><X className="h-4 w-4" /></Button>
                </div>
              ) : (
                <div className="flex items-center gap-1.5">
                  <h3 className="font-heading font-semibold text-foreground truncate">{selected.city}</h3>
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => { setRenameVal(selected.city); setRenameOpen(true); }}>
                    <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
                  </Button>
                </div>
              )}
              <p className="text-[11px] text-muted-foreground mt-0.5">
                Σύρε τον μπλε δείκτη για κέντρο ή το πορτοκαλί για ακτίνα.
              </p>
            </div>

            {/* Address search → center */}
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Κέντρο από διεύθυνση</Label>
              <div className="flex gap-2">
                <Input
                  placeholder="π.χ. Πλατία Μαβίλη 5, Ιωάννινα"
                  value={searchQ}
                  onChange={e => setSearchQ(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && searchCenter()}
                />
                <Button onClick={searchCenter} disabled={!searchQ.trim() || searching} size="sm">
                  <Search className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {/* Manual coordinates */}
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Latitude</Label>
                <Input
                  inputMode="decimal"
                  value={latInput}
                  onChange={e => setLatInput(e.target.value)}
                  onBlur={commitCoords}
                  onKeyDown={e => e.key === 'Enter' && (e.currentTarget as HTMLInputElement).blur()}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Longitude</Label>
                <Input
                  inputMode="decimal"
                  value={lngInput}
                  onChange={e => setLngInput(e.target.value)}
                  onBlur={commitCoords}
                  onKeyDown={e => e.key === 'Enter' && (e.currentTarget as HTMLInputElement).blur()}
                />
              </div>
            </div>

            {/* Radius: slider + numeric input */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-xs text-muted-foreground">Ακτίνα κάλυψης</Label>
                <div className="flex items-center gap-1.5">
                  <Input
                    inputMode="decimal"
                    value={radiusInput}
                    onChange={e => setRadiusInput(e.target.value)}
                    onBlur={commitRadiusInput}
                    onKeyDown={e => e.key === 'Enter' && (e.currentTarget as HTMLInputElement).blur()}
                    className="w-16 h-7 text-xs text-right"
                  />
                  <span className="text-[11px] text-muted-foreground">km</span>
                </div>
              </div>
              <Slider
                value={[Number(selected.radius_km)]}
                min={1}
                max={50}
                step={0.5}
                onValueChange={([v]) => updateLocal({ radius_km: v })}
              />
            </div>

            <div className="flex items-center justify-between rounded-lg bg-muted/40 px-3 py-2">
              <Label className="text-sm">Ενεργή</Label>
              <Switch
                checked={selected.is_active}
                onCheckedChange={(v) => updateLocal({ is_active: v })}
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <Button variant="outline" size="sm" onClick={recenterOnMap}>
                <Locate className="h-3.5 w-3.5 mr-1.5" />
                Κέντρο = θέα
              </Button>
              <Button variant="outline" size="sm" onClick={fitAllZones}>
                <Maximize2 className="h-3.5 w-3.5 mr-1.5" />
                Όλες οι ζώνες
              </Button>
              <Button variant="outline" size="sm" onClick={resetChanges} disabled={!isDirty}>
                <RotateCcw className="h-3.5 w-3.5 mr-1.5" />
                Ακύρωση αλλαγών
              </Button>
              <Button variant="outline" size="sm" onClick={() => removeZone(selected.id)}>
                <Trash2 className="h-3.5 w-3.5 mr-1.5 text-destructive" />
                Διαγραφή
              </Button>
            </div>

            <Button onClick={persist} disabled={saving} className="w-full">
              <Save className="h-4 w-4 mr-2" />
              {isDirty ? 'Αποθήκευση αλλαγών' : 'Αποθήκευση Ζώνης'}
              {isDirty && <span className="ml-1.5 h-2 w-2 rounded-full bg-amber-400 inline-block" />}
            </Button>
          </Card>
        )}
      </div>

      {/* RIGHT: map */}
      <Card className="p-0 overflow-hidden h-[640px]">
        <div ref={mapContainer} className="w-full h-full" />
      </Card>
    </div>
  );
}
