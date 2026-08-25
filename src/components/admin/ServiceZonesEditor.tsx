import { useEffect, useRef, useState, useCallback } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { useMapboxToken } from '@/hooks/useMapboxToken';
import { supabase } from '@/integrations/supabase/client';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Plus, Trash2, MapPin, Save, Locate, Pencil, Check, X, Maximize2, Undo2 } from 'lucide-react';
import { toast } from 'sonner';
import { geocodeAddress } from '@/lib/geocode';

type LngLat = [number, number];

interface ServiceZone {
  id: string;
  city: string;
  center_latitude: number;
  center_longitude: number;
  radius_km: number;
  is_active: boolean;
  /** Drawn delivery area — GeoJSON Polygon ([lng,lat] rings). Null = legacy circle zone. */
  area: GeoJSON.Polygon | null;
}

const DEFAULT_CENTER: [number, number] = [20.8537, 39.6650]; // Ιωάννινα
const CIRCLE_POINTS = 64;
const EMPTY_FC: GeoJSON.FeatureCollection = { type: 'FeatureCollection', features: [] };

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

/** Centroid (mean of vertices) of an unclosed vertex list. */
function centroidOf(pts: LngLat[]): { lng: number; lat: number } {
  let sx = 0;
  let sy = 0;
  for (const [lng, lat] of pts) {
    sx += lng;
    sy += lat;
  }
  return { lng: sx / pts.length, lat: sy / pts.length };
}

/** Legacy radius_km that best covers the drawn shape (DB CHECK: 0 < r <= 50). */
function coveringRadiusKm(pts: LngLat[]): number {
  const c = centroidOf(pts);
  let max = 0;
  for (const [lng, lat] of pts) max = Math.max(max, haversineKm(c.lng, c.lat, lng, lat));
  return Math.min(50, Math.max(1, Math.round(max * 2) / 2));
}

export default function ServiceZonesEditor() {
  const mapContainer = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
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

  // Drawing state — click points on the map to outline the delivery area.
  const [drawing, setDrawing] = useState(false);
  const [draftPts, setDraftPts] = useState<LngLat[]>([]);
  const drawingRef = useRef(drawing);
  drawingRef.current = drawing;

  // Flexible-editing UI state
  const [renameOpen, setRenameOpen] = useState(false);
  const [renameVal, setRenameVal] = useState('');
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
  const selected = zones.find(z => z.id === selectedId) ?? null;
  const isDirty = !!selected && !!selectedSaved && (
    selected.center_latitude !== selectedSaved.center_latitude ||
    selected.center_longitude !== selectedSaved.center_longitude ||
    Number(selected.radius_km) !== Number(selectedSaved.radius_km) ||
    selected.is_active !== selectedSaved.is_active ||
    selected.city !== selectedSaved.city ||
    JSON.stringify(selected.area ?? null) !== JSON.stringify(selectedSaved.area ?? null)
  );

  const zonesRef = useRef(zones);
  zonesRef.current = zones;

  const load = useCallback(async () => {
    const { data, error } = await supabase
      .from('service_zones')
      .select('*')
      .order('city');
    if (error) { toast.error('Αποτυχία φόρτωσης ζωνών'); return; }
    const list = ((data ?? []) as ServiceZone[]).map(z => ({ ...z, area: (z.area ?? null) as GeoJSON.Polygon | null }));
    setZones(list);
    markSaved(list);
    setSelectedId(prev => prev ?? (list[0]?.id ?? null));
  }, [markSaved]);

  useEffect(() => { load(); }, [load]);

  // Switching zones cancels any in-progress drawing.
  useEffect(() => {
    setDrawing(false);
    setDraftPts([]);
  }, [selectedId]);

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
      // Faint shapes for all the OTHER zones — clickable to switch selection.
      map.addSource('zones-others', { type: 'geojson', data: EMPTY_FC });
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
      map.addSource('zone-shape', { type: 'geojson', data: EMPTY_FC });
      map.addLayer({
        id: 'zone-fill',
        type: 'fill',
        source: 'zone-shape',
        paint: { 'fill-color': '#3b82f6', 'fill-opacity': 0.18 },
      });
      map.addLayer({
        id: 'zone-line',
        type: 'line',
        source: 'zone-shape',
        paint: { 'line-color': '#2563eb', 'line-width': 2 },
      });
      // In-progress drawn polygon.
      map.addSource('zone-draft', { type: 'geojson', data: EMPTY_FC });
      map.addLayer({
        id: 'draft-fill',
        type: 'fill',
        source: 'zone-draft',
        paint: { 'fill-color': '#10b981', 'fill-opacity': 0.15 },
      });
      map.addLayer({
        id: 'draft-line',
        type: 'line',
        source: 'zone-draft',
        paint: { 'line-color': '#059669', 'line-width': 2 },
      });
      setMapReady(true);
    });
    mapRef.current = map;
    return () => {
      map.remove();
      mapRef.current = null;
      setMapReady(false);
    };
  }, [token]);

  // While drawing: every map click drops a polygon vertex.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady || !drawing) return;
    const onClick = (e: mapboxgl.MapMouseEvent) => {
      setDraftPts(prev => [...prev, [e.lngLat.lng, e.lngLat.lat]]);
    };
    map.getCanvas().style.cursor = 'crosshair';
    map.doubleClickZoom?.disable();
    map.on('click', onClick);
    return () => {
      map.getCanvas().style.cursor = '';
      map.doubleClickZoom?.enable();
      map.off('click', onClick);
    };
  }, [drawing, mapReady]);

  // Render the in-progress outline/fill.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;
    const src = map.getSource('zone-draft') as mapboxgl.GeoJSONSource | undefined;
    if (!src) return;
    const features: GeoJSON.Feature[] = [];
    if (draftPts.length >= 2) {
      features.push({
        type: 'Feature',
        properties: {},
        geometry: { type: 'LineString', coordinates: draftPts },
      });
    }
    if (draftPts.length >= 3) {
      features.push({
        type: 'Feature',
        properties: {},
        geometry: { type: 'Polygon', coordinates: [[...draftPts, draftPts[0]]] },
      });
    }
    src.setData({ type: 'FeatureCollection', features });
  }, [draftPts, mapReady]);

  // Click a faint zone shape on the map to select that zone (disabled mid-draw).
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;
    const onClick = (e: mapboxgl.MapMouseEvent & { features?: mapboxgl.MapboxGeoJSONFeature[] }) => {
      if (drawingRef.current) return;
      const id = e.features?.[0]?.properties?.id as string | undefined;
      if (id) setSelectedId(id);
    };
    const onEnter = () => { if (!drawingRef.current) map.getCanvas().style.cursor = 'pointer'; };
    const onLeave = () => { if (!drawingRef.current) map.getCanvas().style.cursor = ''; };
    map.on('click', 'others-fill', onClick);
    map.on('mousemove', 'others-fill', onEnter);
    map.on('mouseleave', 'others-fill', onLeave);
    return () => {
      map.off('click', 'others-fill', onClick);
      map.off('mousemove', 'others-fill', onEnter);
      map.off('mouseleave', 'others-fill', onLeave);
    };
  }, [mapReady]);

  /** Geometry for a zone: drawn polygon when present, else its legacy circle. */
  const shapeFor = (z: ServiceZone): GeoJSON.Feature<GeoJSON.Polygon> =>
    z.area
      ? { type: 'Feature', properties: {}, geometry: z.area }
      : circlePolygon(Number(z.center_longitude), Number(z.center_latitude), Number(z.radius_km) || 1);

  // Sync zone shapes on the map.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;
    const sel = zonesRef.current.find(v => v.id === selectedId) ?? null;

    const othersSrc = map.getSource('zones-others') as mapboxgl.GeoJSONSource | undefined;
    if (othersSrc) {
      othersSrc.setData({
        type: 'FeatureCollection',
        features: zonesRef.current
          .filter(z => z.id !== selectedId)
          .map(z => ({ ...shapeFor(z), properties: { id: z.id, city: z.city } })),
      });
    }
    const src = map.getSource('zone-shape') as mapboxgl.GeoJSONSource | undefined;
    if (src) {
      src.setData(
        sel
          ? { type: 'FeatureCollection', features: [{ ...shapeFor(sel), properties: {} }] }
          : EMPTY_FC,
      );
    }

    if (!sel) return;
    const cLng = Number(sel.center_longitude);
    const cLat = Number(sel.center_latitude);
    if (!Number.isFinite(cLng) || !Number.isFinite(cLat)) return;

    if (prevSelectedIdRef.current !== selectedId && !drawingRef.current) {
      prevSelectedIdRef.current = selectedId;
      map.flyTo({ center: [cLng, cLat], zoom: 12 });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId, zones, mapReady]);

  const updateLocal = (patch: Partial<ServiceZone>) => {
    if (!selected) return;
    setZones(prev => prev.map(z => z.id === selected.id ? { ...z, ...patch } : z));
  };

  // ---------- Drawing actions ----------

  const startDrawing = () => {
    if (!selectedId) {
      toast.error('Επιλέξτε ή δημιουργήστε ζώνη πρώτα');
      return;
    }
    setDraftPts([]);
    setDrawing(true);
    toast('Κλικ στον χάρτη για να προσθέσετε σημεία της ζώνης');
  };

  const undoPoint = () => setDraftPts(prev => prev.slice(0, -1));

  const cancelDrawing = () => {
    setDrawing(false);
    setDraftPts([]);
  };

  /** Close the outline: store the polygon + derive legacy center/radius metadata. */
  const finishDrawing = () => {
    if (!selected || draftPts.length < 3) return;
    const ring: LngLat[] = [...draftPts, draftPts[0]];
    const c = centroidOf(draftPts);
    updateLocal({
      area: { type: 'Polygon', coordinates: [ring] },
      center_latitude: c.lat,
      center_longitude: c.lng,
      radius_km: coveringRadiusKm(draftPts),
    });
    cancelDrawing();
    toast.success('Το σχέδιο ολοκληρώθηκε — πατήστε Αποθήκευση');
  };

  /** Remove the drawn shape — the zone falls back to its circle definition. */
  const clearArea = () => {
    updateLocal({ area: null });
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
        area: selected.area,
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

  /** Search an address and fly there (also refreshes legacy center metadata). */
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

  /** Zoom so every zone shape is visible. */
  const fitAllZones = () => {
    const map = mapRef.current;
    if (!map || !mapReady || zones.length === 0) return;
    const b = new mapboxgl.LngLatBounds();
    let any = false;
    for (const z of zones) {
      const ring = z.area?.coordinates?.[0];
      if (ring && ring.length) {
        for (const [lng, lat] of ring) {
          if (Number.isFinite(lng) && Number.isFinite(lat)) { b.extend([lng, lat]); any = true; }
        }
        continue;
      }
      const lng = Number(z.center_longitude);
      const lat = Number(z.center_latitude);
      const km = Math.max(1, Number(z.radius_km) || 1);
      if (!Number.isFinite(lng) || !Number.isFinite(lat)) continue;
      const dLat = km / 111.32;
      const dLng = dLat / Math.max(0.1, Math.cos((lat * Math.PI) / 180));
      b.extend([lng, lat]);
      b.extend([lng, lat + dLat]);
      b.extend([lng, lat - dLat]);
      b.extend([lng + dLng, lat]);
      b.extend([lng - dLng, lat]);
      any = true;
    }
    if (any && !b.isEmpty()) map.fitBounds(b, { padding: 60, duration: 600 });
  };

  /** Revert local edits of the selected zone back to last-saved values. */
  const resetChanges = () => {
    if (!selectedId) return;
    const saved = savedRef.current[selectedId];
    if (!saved) return;
    setZones(prev => prev.map(z => z.id === selectedId ? { ...saved } : z));
    setDraftPts([]);
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
      .insert({ city, center_latitude: c.lat, center_longitude: c.lng, radius_km: 18, is_active: true, area: null })
      .select()
      .single();
    setCreating(false);
    if (error) { toast.error(error.message.includes('duplicate') ? 'Η πόλη υπάρχει ήδη' : 'Αποτυχία'); return; }
    setNewCity('');
    const created = { ...(data as ServiceZone), area: ((data as ServiceZone).area ?? null) as GeoJSON.Polygon | null };
    setZones(prev => [...prev, created].sort((a, b) => a.city.localeCompare(b.city)));
    markSaved([...zonesRef.current, created]);
    setSelectedId(created.id);
    toast.success(`Δημιουργήθηκε ζώνη: ${city} — σχεδιάστε την περιοχή της`);
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
            Μια ζώνη ανά πόλη. Σχεδιάστε την περιοχή στον χάρτη — διευθύνσεις εκτός ζώνης μπλοκάρονται αυτόματα στο checkout.
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
                  {z.area ? 'σχεδιασμένη ζώνη' : `ακτίνα ${Number(z.radius_km).toFixed(1)} km`}
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
                {selected.area
                  ? 'Σχεδιασμένη ζώνη — η περιοχή που ορίσατε ισχύει ως έχει.'
                  : 'Δεν έχει σχεδιαστεί ζώνη· ισχύει προσωρινά κύκλος ακτίνας.'}
              </p>
            </div>

            {/* Drawing controls */}
            <div className="space-y-2 rounded-lg border border-dashed border-primary/40 bg-primary/5 p-3">
              <Label className="text-xs font-semibold text-foreground">Σχέδιο ζώνης</Label>
              {!drawing ? (
                <>
                  <p className="text-[11px] text-muted-foreground">
                    Κλικ στον χάρτη για σημεία → κλείστε το σχήμα με «Ολοκλήρωση» (τουλάχιστον 3 σημεία).
                  </p>
                  <div className="grid grid-cols-2 gap-2">
                    <Button variant="outline" size="sm" onClick={startDrawing}>
                      <Pencil className="h-3.5 w-3.5 mr-1.5" />
                      {selected.area ? 'Ανασχεδίαση' : 'Ξεκίνα σχέδιο'}
                    </Button>
                    {selected.area && (
                      <Button variant="outline" size="sm" onClick={clearArea}>
                        <X className="h-3.5 w-3.5 mr-1.5" />
                        Αφαίρεση σχεδίου
                      </Button>
                    )}
                  </div>
                </>
              ) : (
                <>
                  <p className="text-[11px] text-muted-foreground">
                    Σημεία: {draftPts.length}{draftPts.length < 3 ? ' (χρειάζονται τουλάχιστον 3)' : ''} — κλικ για επόμενο.
                  </p>
                  <div className="grid grid-cols-3 gap-2">
                    <Button size="sm" onClick={finishDrawing} disabled={draftPts.length < 3}>
                      <Check className="h-3.5 w-3.5 mr-1" />
                      Ολοκλήρωση
                    </Button>
                    <Button variant="outline" size="sm" onClick={undoPoint} disabled={draftPts.length === 0}>
                      <Undo2 className="h-3.5 w-3.5 mr-1" />
                      Αναίρεση
                    </Button>
                    <Button variant="outline" size="sm" onClick={cancelDrawing}>
                      <X className="h-3.5 w-3.5 mr-1" />
                      Άκυρο
                    </Button>
                  </div>
                </>
              )}
            </div>

            {/* Address search — navigate the map (also updates legacy center) */}
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Πλοήγηση σε διεύθυνση</Label>
              <div className="flex gap-2">
                <Input
                  placeholder="π.χ. Πλατία Μαβίλη 5, Ιωάννινα"
                  value={searchQ}
                  onChange={e => setSearchQ(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && searchCenter()}
                />
                <Button onClick={searchCenter} disabled={!searchQ.trim() || searching} size="sm">
                  <Locate className="h-4 w-4" />
                </Button>
              </div>
            </div>

            <div className="flex items-center justify-between rounded-lg bg-muted/40 px-3 py-2">
              <Label className="text-sm">Ενεργή</Label>
              <Switch
                checked={selected.is_active}
                onCheckedChange={(v) => updateLocal({ is_active: v })}
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <Button variant="outline" size="sm" onClick={fitAllZones}>
                <Maximize2 className="h-3.5 w-3.5 mr-1.5" />
                Όλες οι ζώνες
              </Button>
              <Button variant="outline" size="sm" onClick={resetChanges} disabled={!isDirty}>
                <X className="h-3.5 w-3.5 mr-1.5" />
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
