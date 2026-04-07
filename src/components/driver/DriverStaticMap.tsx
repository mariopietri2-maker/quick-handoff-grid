import { useEffect, useState, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, Circle, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { openGoogleMapsNavigation } from '@/lib/navigation';

// Fix default marker icons for bundlers
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
});

const driverDot = new L.DivIcon({
  html: `<div style="width:22px;height:22px;background:hsl(217 91% 60%);border-radius:50%;border:3px solid white;box-shadow:0 0 0 2px hsl(217 91% 60% / 0.3), 0 2px 8px rgba(0,0,0,0.3);"></div>`,
  iconSize: [22, 22],
  iconAnchor: [11, 11],
  className: '',
});

const storeIcon = new L.DivIcon({
  html: `<div style="width:28px;height:28px;background:hsl(25 95% 53%);border-radius:50%;border:3px solid white;box-shadow:0 2px 8px rgba(0,0,0,0.3);display:flex;align-items:center;justify-content:center;font-size:14px;">🏪</div>`,
  iconSize: [28, 28],
  iconAnchor: [14, 14],
  className: '',
});

const customerIcon = new L.DivIcon({
  html: `<div style="width:28px;height:28px;background:hsl(142 71% 45%);border-radius:50%;border:3px solid white;box-shadow:0 2px 8px rgba(0,0,0,0.3);display:flex;align-items:center;justify-content:center;font-size:14px;">📍</div>`,
  iconSize: [28, 28],
  iconAnchor: [14, 14],
  className: '',
});

function LiveTracker({ lat, lng }: { lat: number; lng: number }) {
  const map = useMap();
  const isFirstRef = useRef(true);
  useEffect(() => {
    if (isFirstRef.current) {
      map.setView([lat, lng], 15, { animate: false });
      isFirstRef.current = false;
    }
  }, [lat, lng, map]);
  return null;
}

function FitBounds({ points }: { points: [number, number][] }) {
  const map = useMap();
  const fittedRef = useRef(false);
  useEffect(() => {
    if (points.length >= 2 && !fittedRef.current) {
      const bounds = L.latLngBounds(points.map(p => L.latLng(p[0], p[1])));
      map.fitBounds(bounds, { padding: [50, 50], maxZoom: 16 });
      fittedRef.current = true;
    }
  }, [points, map]);
  return null;
}





/** Fetch a driving route from OSRM (free, no API key) */
async function fetchRoute(waypoints: [number, number][]): Promise<[number, number][]> {
  if (waypoints.length < 2) return [];
  const coords = waypoints.map(([lat, lng]) => `${lng},${lat}`).join(';');
  try {
    const res = await fetch(
      `https://router.project-osrm.org/route/v1/driving/${coords}?overview=full&geometries=geojson`
    );
    const data = await res.json();
    if (data.code === 'Ok' && data.routes?.[0]) {
      return data.routes[0].geometry.coordinates.map(([lng, lat]: [number, number]) => [lat, lng] as [number, number]);
    }
  } catch {
    // Fallback: straight line
  }
  return waypoints;
}

function RouteLine({ waypoints, color }: { waypoints: [number, number][]; color: string }) {
  const [route, setRoute] = useState<[number, number][]>([]);
  const prevKey = useRef('');

  useEffect(() => {
    const key = waypoints.map(p => `${p[0].toFixed(4)},${p[1].toFixed(4)}`).join('|');
    if (key === prevKey.current || waypoints.length < 2) return;
    prevKey.current = key;
    fetchRoute(waypoints).then(setRoute);
  }, [waypoints]);

  if (route.length < 2) return null;
  return (
    <Polyline
      positions={route}
      pathOptions={{ color, weight: 5, opacity: 0.8, dashArray: undefined }}
    />
  );
}

function NavigationButtons({
  storeLat,
  storeLng,
  storeName,
  customerLat,
  customerLng,
  customerName,
  customerAddress,
}: {
  storeLat?: number | null; storeLng?: number | null; storeName?: string;
  customerLat?: number | null; customerLng?: number | null; customerName?: string;
  customerAddress?: string | null;
}) {
  const hasStore = storeLat != null && storeLng != null;
  const hasCustomer = customerAddress || (customerLat != null && customerLng != null);
  if (!hasStore && !hasCustomer) return null;

  return (
    <div className="absolute top-16 right-4 z-[1000] flex flex-col gap-2">
      {hasStore && (
        <button
          onClick={() => openGoogleMapsNavigation({ lat: storeLat, lng: storeLng })}
          className="bg-card/90 backdrop-blur-md border border-border shadow-lg rounded-xl p-2.5 flex items-center justify-center hover:bg-card transition-colors"
          title={`Πλοήγηση → ${storeName || 'Κατάστημα'}`}
        >
          <div className="h-8 w-8 rounded-full flex items-center justify-center text-base bg-secondary text-secondary-foreground">🏪</div>
        </button>
      )}

      {hasCustomer && (
        <button
          onClick={() => openGoogleMapsNavigation({
            lat: customerLat,
            lng: customerLng,
            address: customerAddress,
          })}
          className="bg-card/90 backdrop-blur-md border border-border shadow-lg rounded-xl p-2.5 flex items-center justify-center hover:bg-card transition-colors"
          title={`Πλοήγηση → ${customerName || 'Πελάτης'}`}
        >
          <div className="h-8 w-8 rounded-full flex items-center justify-center text-base bg-primary text-primary-foreground">📍</div>
        </button>
      )}
    </div>
  );
}

interface DriverStaticMapProps {
  className?: string;
  liveMode?: boolean;
  storeLat?: number | null;
  storeLng?: number | null;
  storeName?: string;
  customerLat?: number | null;
  customerLng?: number | null;
  customerName?: string;
  customerAddress?: string | null;
}

export default function DriverStaticMap({
  className,
  liveMode = false,
  storeLat,
  storeLng,
  storeName,
  customerLat,
  customerLng,
  customerName,
  customerAddress,
}: DriverStaticMapProps) {
  const [pos, setPos] = useState<{ lat: number; lng: number; accuracy: number | null } | null>(null);
  const watchRef = useRef<number | null>(null);

  useEffect(() => {
    if (!('geolocation' in navigator)) return;

    watchRef.current = navigator.geolocation.watchPosition(
      (p) => setPos({ lat: p.coords.latitude, lng: p.coords.longitude, accuracy: p.coords.accuracy }),
      () => setPos({ lat: 39.6650, lng: 20.8537, accuracy: null }),
      { enableHighAccuracy: true, maximumAge: 1000, timeout: 20000 }
    );
    return () => {
      if (watchRef.current !== null) {
        navigator.geolocation.clearWatch(watchRef.current);
      }
    };
  }, []);

  const lat = pos?.lat ?? 39.6650;
  const lng = pos?.lng ?? 20.8537;

  const boundsPoints: [number, number][] = [];
  if (pos) boundsPoints.push([pos.lat, pos.lng]);
  if (storeLat != null && storeLng != null) boundsPoints.push([storeLat, storeLng]);
  if (customerLat != null && customerLng != null) boundsPoints.push([customerLat, customerLng]);

  const driverToStoreWaypoints: [number, number][] = [];
  const storeToCustomerWaypoints: [number, number][] = [];
  if (pos && storeLat != null && storeLng != null) {
    driverToStoreWaypoints.push([pos.lat, pos.lng], [storeLat, storeLng]);
  }
  if (storeLat != null && storeLng != null && customerLat != null && customerLng != null) {
    storeToCustomerWaypoints.push([storeLat, storeLng], [customerLat, customerLng]);
  }

  return (
    <div className={className}>
      <NavigationButtons
        storeLat={storeLat}
        storeLng={storeLng}
        storeName={storeName}
        customerLat={customerLat}
        customerLng={customerLng}
        customerName={customerName}
        customerAddress={customerAddress}
      />
      <MapContainer
        center={[lat, lng]}
        zoom={14}
        style={{ height: '100%', width: '100%' }}
        zoomControl={false}
        attributionControl={false}
        dragging={true}
        scrollWheelZoom={true}
        doubleClickZoom={true}
        touchZoom={true}
      >
        <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
        
        
        {pos && (
          <>
            {/* Accuracy circle */}
            {pos.accuracy && pos.accuracy < 500 && (
              <Circle
                center={[pos.lat, pos.lng]}
                radius={pos.accuracy}
                pathOptions={{ color: 'hsl(217, 91%, 60%)', fillColor: 'hsl(217, 91%, 60%)', fillOpacity: 0.1, weight: 1 }}
              />
            )}
            <Marker position={[pos.lat, pos.lng]} icon={driverDot}>
              <Popup>
                <div className="text-center">
                  <strong>Η τοποθεσία σου</strong>
                  <br />
                  <span className="text-xs">
                    {pos.lat.toFixed(5)}, {pos.lng.toFixed(5)}
                  </span>
                  {pos.accuracy && (
                    <>
                      <br />
                      <span className="text-xs">Ακρίβεια: ±{Math.round(pos.accuracy)}μ</span>
                    </>
                  )}
                </div>
              </Popup>
            </Marker>
            <LiveTracker lat={pos.lat} lng={pos.lng} />
          </>
        )}

        {/* Store marker */}
        {storeLat && storeLng && (
          <Marker position={[storeLat, storeLng]} icon={storeIcon}>
            <Popup>{storeName || 'Κατάστημα'}</Popup>
          </Marker>
        )}

        {/* Customer marker */}
        {customerLat && customerLng && (
          <Marker position={[customerLat, customerLng]} icon={customerIcon}>
            <Popup>{customerName || 'Πελάτης'}</Popup>
          </Marker>
        )}

        {/* Route lines */}
        {driverToStoreWaypoints.length >= 2 && (
          <RouteLine waypoints={driverToStoreWaypoints} color="hsl(217, 91%, 60%)" />
        )}
        {storeToCustomerWaypoints.length >= 2 && (
          <RouteLine waypoints={storeToCustomerWaypoints} color="hsl(142, 71%, 45%)" />
        )}

        {/* Fit bounds when we have multiple points */}
        {boundsPoints.length >= 2 && (
          <FitBounds points={boundsPoints} />
        )}
      </MapContainer>
    </div>
  );
}
