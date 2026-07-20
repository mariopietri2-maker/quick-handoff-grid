import { useEffect, useRef } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { MapPin, Plus, Store as StoreIcon, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useMapboxToken } from '@/hooks/useMapboxToken';
import type { Database } from '@/integrations/supabase/types';
import { cn } from '@/lib/utils';

type StoreRow = Database['public']['Tables']['stores']['Row'];

const IOANNINA: [number, number] = [20.8537, 39.665];

interface OwnerStoresPortalProps {
  stores: StoreRow[];
  onSelect: (storeId: string) => void;
  onCreateClick: () => void;
}

export function OwnerStoresPortal({ stores, onSelect, onCreateClick }: OwnerStoresPortalProps) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const markersRef = useRef<mapboxgl.Marker[]>([]);
  const { token, loading: tokenLoading } = useMapboxToken();

  useEffect(() => {
    if (!token || !mapContainer.current || mapRef.current) return;

    mapboxgl.accessToken = token;
    const map = new mapboxgl.Map({
      container: mapContainer.current,
      style: 'mapbox://styles/mapbox/streets-v12',
      center: IOANNINA,
      zoom: 12.4,
      attributionControl: false,
    });
    map.addControl(new mapboxgl.NavigationControl({ showCompass: false }), 'top-right');
    mapRef.current = map;

    return () => {
      markersRef.current.forEach((m) => m.remove());
      markersRef.current = [];
      map.remove();
      mapRef.current = null;
    };
  }, [token]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    markersRef.current.forEach((m) => m.remove());
    markersRef.current = [];

    const bounds = new mapboxgl.LngLatBounds();
    let hasPoint = false;

    stores.forEach((s) => {
      if (s.latitude == null || s.longitude == null) return;
      hasPoint = true;
      bounds.extend([s.longitude, s.latitude]);

      const el = document.createElement('button');
      el.type = 'button';
      el.className =
        'h-9 w-9 rounded-full border-2 border-white shadow-md flex items-center justify-center text-white text-xs font-bold cursor-pointer';
      el.style.background = s.is_active ? 'hsl(152 60% 36%)' : 'hsl(215 16% 47%)';
      el.title = s.name;
      el.innerHTML = '🏪';
      el.addEventListener('click', (e) => {
        e.stopPropagation();
        onSelect(s.id);
      });

      const marker = new mapboxgl.Marker({ element: el })
        .setLngLat([s.longitude, s.latitude])
        .setPopup(
          new mapboxgl.Popup({ offset: 18, closeButton: false }).setHTML(
            `<div style="font-family:system-ui;font-size:12px;padding:2px 4px"><strong>${escapeHtml(s.name)}</strong><br/><span style="opacity:.7">${escapeHtml(s.address || '')}</span></div>`,
          ),
        )
        .addTo(map);
      markersRef.current.push(marker);
    });

    if (hasPoint) {
      if (stores.filter((s) => s.latitude != null && s.longitude != null).length === 1) {
        const s = stores.find((x) => x.latitude != null)!;
        map.easeTo({ center: [s.longitude!, s.latitude!], zoom: 14 });
      } else {
        map.fitBounds(bounds, { padding: 56, maxZoom: 14, duration: 600 });
      }
    }
  }, [stores, onSelect, token]);

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
        <div>
          <p className="text-xs font-heading font-bold uppercase tracking-[0.12em] text-primary mb-1">
            Multi-store portal
          </p>
          <h2 className="font-heading font-extrabold text-2xl tracking-tight text-foreground">
            Τα καταστήματά σου
          </h2>
          <p className="text-sm text-muted-foreground mt-1 max-w-md">
            {stores.length} καταστήματα · διάλεξε ένα για διαχείριση ή δες τα όλα στον χάρτη Ιωαννίνων.
          </p>
        </div>
        <Button onClick={onCreateClick} className="font-heading gap-1.5 shrink-0">
          <Plus className="h-4 w-4" />
          Νέο κατάστημα
        </Button>
      </div>

      <div className="relative rounded-2xl overflow-hidden border border-border bg-muted/30 h-[260px] sm:h-[320px]">
        {tokenLoading || !token ? (
          <div className="absolute inset-0 flex items-center justify-center text-sm text-muted-foreground">
            Φόρτωση χάρτη…
          </div>
        ) : null}
        <div ref={mapContainer} className="absolute inset-0" />
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {stores.map((s) => (
          <button
            key={s.id}
            type="button"
            onClick={() => onSelect(s.id)}
            className={cn(
              'text-left rounded-2xl border border-border bg-card/80 p-4 transition-colors',
              'hover:border-primary/50 hover:bg-card focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40',
            )}
          >
            <div className="flex items-start gap-3">
              <div className="h-10 w-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
                <StoreIcon className="h-5 w-5" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="font-heading font-bold text-foreground truncate">{s.name}</h3>
                  <Badge
                    variant="outline"
                    className={cn(
                      'text-[10px]',
                      s.is_active ? 'text-success border-success/30' : 'text-muted-foreground',
                    )}
                  >
                    {s.is_active ? 'Ανοιχτό' : 'Κλειστό'}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground mt-1 flex items-start gap-1">
                  <MapPin className="h-3 w-3 mt-0.5 shrink-0" />
                  <span className="line-clamp-2">{s.address || 'Χωρίς διεύθυνση'}</span>
                </p>
              </div>
              <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0 mt-1" />
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

function escapeHtml(s: string) {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
