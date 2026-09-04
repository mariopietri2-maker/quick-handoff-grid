import { useState, useEffect, useRef, Suspense } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { Car, Zap, Radio, MapPin, ArrowLeft, ClipboardList, ShieldCheck, PackageCheck, Navigation, Crosshair, Power } from 'lucide-react';
import { useDriverLocation } from '@/hooks/useDriverLocation';
import { useDriverNotifications } from '@/hooks/useDriverNotifications';
import { startPushRegistration } from '@/lib/push-register';
import {
  clearDriverOnlineStatusNotification,
  showDriverOnlineStatusNotification,
} from '@/lib/driver-online-notification';
import { toast } from 'sonner';
import { Capacitor } from '@capacitor/core';
import { useAuth } from '@/hooks/useAuth';
import { UserMenu } from '@/components/UserMenu';
import { Badge } from '@/components/ui/badge';
import { ActiveDelivery } from '@/components/driver/ActiveDelivery';
import { OneAtATimeOfferCard } from '@/components/driver/OneAtATimeOfferCard';
import { ActiveOrdersList } from '@/components/driver/ActiveOrdersList';
import type { ActiveOrderItem } from '@/components/driver/ActiveOrdersList';
import { DriverSupportButton } from '@/components/driver/DriverSupportButton';

import { useDriverOrders } from '@/hooks/useOrders';
import { useDriverState } from '@/hooks/useDriverState';
import AnnouncementsBanner from '@/components/AnnouncementsBanner';
import SurgeStatusBadge from '@/components/driver/SurgeStatusBadge';
import { supabase } from '@/integrations/supabase/client';
import type { RouteInfo, DriverMapboxHandle } from '@/components/driver/DriverMapbox';
import { lazyWithRetry } from '@/lib/lazyWithRetry';
// Lazy-load the map: mapbox-gl is large (~800KB) and was blocking the driver app's initial paint.
const DriverMapbox = lazyWithRetry(() => import('@/components/driver/DriverMapbox'));
const DriverMoneyPanel = lazyWithRetry(() =>
  import('@/components/driver/DriverMoneyPanel').then((m) => ({ default: m.DriverMoneyPanel })),
);
const DriverInbox = lazyWithRetry(() => import('@/components/driver/DriverInbox'));
const DriverReferral = lazyWithRetry(() =>
  import('@/components/driver/DriverReferral').then((m) => ({ default: m.DriverReferral })),
);

import { TurnByTurnBanner } from '@/components/driver/TurnByTurnBanner';
import { NavBottomCard } from '@/components/driver/NavBottomCard';

import { useNearbyStoresForDriver } from '@/hooks/useNearbyStoresForDriver';
import { geocodeAddress, warmMapboxToken } from '@/lib/geocode';
import { useDriverAppPrefs } from '@/hooks/useDriverAppPrefs';
import { DriverPrefsApplier } from '@/components/driver/DriverPrefsApplier';
import { getDriverPayoutBreakdown } from '@/lib/driver-payout';
import { primeDriverAudio } from '@/lib/driver-sound-prefs';


type DriverTab = 'home' | 'money' | 'inbox' | 'referral';

export default function DriverApp() {
  const { user, isAdmin: isAdminRole, isM } = useAuth();
  // Admins can toggle between "Admin Driver Ops" and the regular driver experience.
  // Role M delivers like a normal driver and opens /m for the live fleet map.
  const [adminAsDriver, setAdminAsDriver] = useState<boolean>(() => {
    try { return localStorage.getItem('admin_as_driver') === '1'; } catch { return false; }
  });
  const isAdmin = isAdminRole && !adminAsDriver;
  const showMonitorLink = isM;
  const toggleAdminView = () => {
    setAdminAsDriver(prev => {
      const next = !prev;
      try { localStorage.setItem('admin_as_driver', next ? '1' : '0'); } catch {}
      return next;
    });
  };
  const { offers, activeDelivery, activeDeliveries, recentCompleted, loading, acceptOrder, declineOrder, updateDeliveryStatus, offerExpiresAt, offerTimeoutSec } = useDriverOrders({ adminOverride: isAdmin });
  const { state: driverState, update: updateDriverState } = useDriverState();
  const onBreak = !!driverState?.on_break;
  const [maxCashCap, setMaxCashCap] = useState<number>(200);
  useEffect(() => { warmMapboxToken(); }, []);

  useEffect(() => {
    (supabase as any).rpc('get_platform_settings_public')
      .then(({ data }: any) => {
        const row = Array.isArray(data) ? data[0] : data;
        if (row?.max_cash_cap != null) setMaxCashCap(Number(row.max_cash_cap));
      });
  }, []);
  const cashCapped = Number(driverState?.shift_cash_balance ?? 0) >= maxCashCap;
  // Online preference persists locally, but server presence clears when the
  // app backgrounds/closes — admin must not show ghost "online" drivers.
  const [isOnline, setIsOnline] = useState<boolean>(() => {
    try { return localStorage.getItem('driver_is_online_v1') === '1'; } catch { return false; }
  });
  const [supportOpen, setSupportOpen] = useState(false);
  useEffect(() => {
    try { localStorage.setItem('driver_is_online_v1', isOnline ? '1' : '0'); } catch {}
    // Going online is a user gesture path — unlock WebView audio for offer alerts.
    if (isOnline) primeDriverAudio();
  }, [isOnline]);

  // Sticky "Διαθέσιμος" shade notification whenever online (native APK only).
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    if (isOnline) {
      void showDriverOnlineStatusNotification().then((ok) => {
        if (!ok) {
          toast.message('Ενεργοποίησε τις ειδοποιήσεις για να φαίνεται «Διαθέσιμος» στο παρασκήνιο');
        }
      });
    } else {
      void clearDriverOnlineStatusNotification();
    }
  }, [isOnline]);

  // Mirror online toggle to driver_state.shift_started_at so admin/dispatch
  // treat the driver as on-shift (does not reset cash balance).
  useEffect(() => {
    if (!user || !driverState) return;
    if (isOnline) {
      if (!driverState.shift_started_at) {
        void updateDriverState({ shift_started_at: new Date().toISOString() });
      }
    } else if (driverState.shift_started_at) {
      void updateDriverState({ shift_started_at: null, on_break: false, break_until: null });
    }
  }, [isOnline, user, driverState?.shift_started_at]);

  // Keep local online preference across backgrounding. Native background
  // geolocation continues GPS while online; only explicit offline / logout
  // clears server presence. Web (no BG geo) still clears on hide via useDriverLocation.
  useEffect(() => {
    if (!user) return;

    const restoreIfWantedOnline = () => {
      let want = false;
      try { want = localStorage.getItem('driver_is_online_v1') === '1'; } catch {}
      if (!want) return;
      setIsOnline(true);
      void (supabase as any)
        .from('driver_state')
        .update({
          shift_started_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('driver_id', user.id);
    };

    const onVis = () => {
      if (document.visibilityState !== 'hidden') restoreIfWantedOnline();
    };
    document.addEventListener('visibilitychange', onVis);

    let removeApp: (() => void) | undefined;
    void import('@capacitor/app').then(({ App }) => {
      App.addListener('appStateChange', ({ isActive }) => {
        if (isActive) restoreIfWantedOnline();
      }).then((h) => {
        removeApp = () => { void h.remove(); };
      }).catch(() => {});
    }).catch(() => {});

    return () => {
      document.removeEventListener('visibilitychange', onVis);
      removeApp?.();
    };
  }, [user]);
  const [driverActive, setDriverActive] = useState<boolean | null>(null);
  const [searchParams, setSearchParams] = useSearchParams();
  
  const tabParam = searchParams.get('tab');
  // Backward-compat: old earnings/wallet URLs → money
  const normalizedTab =
    tabParam === 'earnings' || tabParam === 'wallet' ? 'money'
    : tabParam === 'inbox' || tabParam === 'money' || tabParam === 'referral' ? tabParam
    : 'home';
  const activeTab: DriverTab = normalizedTab;
  const setActiveTab = (t: DriverTab) => {
    if (t === 'home') { searchParams.delete('tab'); setSearchParams(searchParams); }
    else { searchParams.set('tab', t); setSearchParams(searchParams); }
  };
  useDriverNotifications();
  // Remote + local push registration (offers when phone locked need FCM tokens).
  useEffect(() => {
    if (!user) return;
    void startPushRegistration(user.id);
  }, [user]);

  useEffect(() => {
    if (!user) return;
    supabase.from('driver_profiles').select('is_active').eq('user_id', user.id).maybeSingle()
      .then(({ data }) => setDriverActive(data ? data.is_active : true));

    // Realtime: if admin suspends driver, force offline immediately
    const channel = supabase
      .channel(`driver-active-${user.id}`)
      .on('postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'driver_profiles', filter: `user_id=eq.${user.id}` },
        (payload) => {
          const active = (payload.new as { is_active?: boolean }).is_active;
          setDriverActive(active ?? true);
          if (active === false) setIsOnline(false);
        }
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user]);

  // Force offline whenever driver becomes inactive
  useEffect(() => {
    if (driverActive === false && isOnline) setIsOnline(false);
  }, [driverActive, isOnline]);

  const { error: _locError, position: onlinePos } = useDriverLocation(isOnline);
  const { stores: nearbyStores } = useNearbyStoresForDriver();
  const driverPrefs = useDriverAppPrefs();
  const [storeInfo, setStoreInfo] = useState<{ name: string; address: string; phone: string | null; latitude: number | null; longitude: number | null } | null>(null);
  const [customerInfo, setCustomerInfo] = useState<{ name: string; phone: string | null } | null>(null);
  const handleDecline = (id: string) => { declineOrder(id); };
  const [busyStatusId, setBusyStatusId] = useState<string | null>(null);
  const handleStatusUpdate = async (id: string, status: string) => {
    setBusyStatusId(id);
    await updateDeliveryStatus(id, status);
    setBusyStatusId(null);
  };
  const [routeInfo, setRouteInfo] = useState<RouteInfo | null>(null);
  const [navMode, setNavMode] = useState(false);
  const [sheetCollapsed, setSheetCollapsed] = useState(true);
  // Offline / offers / active delivery: keep sheet expanded so controls aren't clipped
  useEffect(() => {
    if (!isOnline) setSheetCollapsed(false);
  }, [isOnline]);
  useEffect(() => {
    if (offers.length > 0 || activeDelivery) setSheetCollapsed(false);
  }, [offers.length, activeDelivery]);
  const sheetDragStartY = useRef<number | null>(null);
  const sheetDragMoved = useRef(false);
  // Offline: map owns GPS for the blue-dot. Online: useDriverLocation is the single watch.
  const [offlineMapPos, setOfflineMapPos] = useState<{ lat: number; lng: number; heading: number | null } | null>(null);
  const driverPos = isOnline ? onlinePos : offlineMapPos;
  const mapRef = useRef<DriverMapboxHandle>(null);

  const navigatingTo = activeDelivery
    ? (['accepted', 'preparing', 'ready', 'arrived'].includes(activeDelivery.status ?? '') ? 'store' as const : activeDelivery.status === 'picked_up' ? 'customer' as const : null)
    : null;

  // Auto-exit nav mode if delivery ends
  useEffect(() => { if (!activeDelivery) setNavMode(false); }, [activeDelivery]);
  const isNavActive = navMode && !!navigatingTo;

  // One-at-a-time auto-start: once EVERY remaining order is picked up, start
  // navigating to the oldest one (FIFO) without a tap.
  const autoStartedRef = useRef<string | null>(null);
  useEffect(() => {
    if (
      activeDeliveries.length > 0 &&
      activeDeliveries.every((o) => o.status === 'picked_up')
    ) {
      const first = activeDeliveries[0];
      if (first && autoStartedRef.current !== first.id) {
        autoStartedRef.current = first.id;
        setNavMode(true);
      }
    } else {
      autoStartedRef.current = null;
    }
  }, [activeDeliveries]);

  // Pick the upcoming maneuver step + live distance to it from the driver's GPS.
  // Mapbox steps include a maneuver location; we find the closest upcoming one
  // and project the remaining distance using the haversine formula.
  const navProgress = (() => {
    if (!routeInfo || !driverPos) return null;
    const steps = routeInfo.steps || [];
    if (!steps.length) return null;
    const toRad = (d: number) => (d * Math.PI) / 180;
    const haversineM = (a: { lat: number; lng: number }, b: { lat: number; lng: number }) => {
      const R = 6371000;
      const dLat = toRad(b.lat - a.lat);
      const dLng = toRad(b.lng - a.lng);
      const lat1 = toRad(a.lat);
      const lat2 = toRad(b.lat);
      const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
      return 2 * R * Math.asin(Math.sqrt(h));
    };
    let bestIdx = 0;
    let bestDist = Infinity;
    steps.forEach((s, i) => {
      if (!s.location) return;
      const d = haversineM(driverPos, { lat: s.location[1], lng: s.location[0] });
      if (d < bestDist) { bestDist = d; bestIdx = i; }
    });
    // Prefer the *upcoming* step: if we're past the closest one (very near it),
    // surface the next one as the active maneuver.
    let activeIdx = bestIdx;
    if (bestDist < 25 && bestIdx + 1 < steps.length) activeIdx = bestIdx + 1;
    const active = steps[activeIdx];
    let distanceToNext = 0;
    if (active?.location) {
      distanceToNext = haversineM(driverPos, { lat: active.location[1], lng: active.location[0] });
    }
    return { step: active, distanceToNext, nextStreet: steps[activeIdx + 1]?.name ?? active?.name ?? null };
  })();

  // Geocoded fallback for delivery destination if order has no coords
  const [deliveryCoords, setDeliveryCoords] = useState<{ lat: number; lng: number } | null>(null);

  useEffect(() => {
    if (!activeDelivery) { setStoreInfo(null); setCustomerInfo(null); setDeliveryCoords(null); return; }
    (supabase as any).rpc('get_store_contact', { _store_id: activeDelivery.store_id })
      .then(({ data }: any) => { if (data && data[0]) setStoreInfo(data[0]); });

    if (activeDelivery.customer_id) {
      supabase.from('profiles').select('full_name, phone').eq('user_id', activeDelivery.customer_id).single()
        .then(({ data }) => { if (data) setCustomerInfo({ name: data.full_name || 'Πελάτης', phone: data.phone }); });
    }

    // If order is missing delivery coords, geocode the address so the route can be drawn
    const hasCoords = activeDelivery.delivery_latitude != null && activeDelivery.delivery_longitude != null;
    if (!hasCoords && activeDelivery.delivery_address) {
      let cancelled = false;
      geocodeAddress(activeDelivery.delivery_address).then((res) => {
        if (!cancelled && res) setDeliveryCoords({ lat: res.latitude, lng: res.longitude });
      });
      return () => { cancelled = true; };
    } else {
      setDeliveryCoords(null);
    }
  }, [activeDelivery?.id, activeDelivery?.store_id, activeDelivery?.customer_id, activeDelivery?.delivery_address, activeDelivery?.delivery_latitude, activeDelivery?.delivery_longitude]);

  // Pending approval
  if (driverActive === false) {
    return (
      <div className="min-h-screen driver-shell bg-[hsl(var(--driver-bg))] flex items-center justify-center p-6">
        <div className="text-center max-w-sm space-y-4">
          <div className="h-20 w-20 rounded-2xl bg-destructive/10 flex items-center justify-center mx-auto border border-destructive/20">
            <Car className="h-10 w-10 text-destructive" />
          </div>
          <h1 className="font-heading text-2xl font-bold text-[hsl(var(--driver-text))]">Αναμονή Έγκρισης</h1>
          <p className="text-[hsl(var(--driver-text-muted))] text-sm">Ο λογαριασμός σας βρίσκεται σε αναμονή έγκρισης.</p>
          <button onClick={() => window.location.reload()} className="px-6 py-2.5 rounded-xl text-sm font-heading font-semibold border border-[hsl(var(--driver-border))] text-[hsl(var(--driver-text))] hover:bg-[hsl(var(--driver-surface))] transition-colors">
            Έλεγχος Κατάστασης
          </button>
        </div>
      </div>
    );
  }

  if (driverActive === null && !loading) {
    return (
      <div className="min-h-screen driver-shell bg-[hsl(var(--driver-bg))] flex items-center justify-center">
        <div className="h-8 w-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  void MapPin; // unused but kept for future

  if (isAdmin) {
    return (
      <div className="min-h-[100dvh] driver-shell bg-background text-foreground overflow-y-auto">
        <header className="sticky top-0 z-30 border-b border-border bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/80 safe-area-top">
          <div className="px-4 py-3 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <div className="h-10 w-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
                <ShieldCheck className="h-5 w-5 text-primary" />
              </div>
              <div className="min-w-0">
                <p className="text-[11px] font-heading font-bold uppercase tracking-wider text-muted-foreground">Admin Driver Ops</p>
                <h1 className="font-heading text-lg font-extrabold truncate">Έτοιμες Παραγγελίες</h1>
              </div>
            </div>
            <div className="shrink-0 flex items-center gap-2">
              <Badge className="bg-primary text-primary-foreground font-heading">{offers.length}</Badge>
              {isAdminRole && (
                <button
                  onClick={toggleAdminView}
                  className="h-8 px-2.5 rounded-lg text-[11px] font-heading font-bold border border-border bg-card hover:bg-muted transition-colors flex items-center gap-1.5"
                  title="Εναλλαγή σε προβολή κανονικού οδηγού"
                >
                  <Car className="h-3.5 w-3.5" />
                  Driver view
                </button>
              )}
              <UserMenu />
            </div>
          </div>
        </header>

        <main className="px-4 py-4 space-y-4 max-w-3xl mx-auto">
          {activeDelivery && (
            <section className="space-y-3">
              <div className="flex items-center gap-2 px-1">
                <PackageCheck className="h-4 w-4 text-primary" />
                <h2 className="font-heading font-bold text-sm">Παραγγελία που ανέλαβες</h2>
              </div>
              <ActiveDelivery
                delivery={{
                  id: activeDelivery.id,
                  storeName: storeInfo?.name || activeDelivery.store_name || 'Σημείο Παραλαβής',
                  storeAddress: storeInfo?.address || activeDelivery.store_address || 'Διεύθυνση',
                  storePhone: storeInfo?.phone || null,
                  storeLat: storeInfo?.latitude ?? null,
                  storeLng: storeInfo?.longitude ?? null,
                  deliveryAddress: activeDelivery.delivery_address || 'Πελάτης',
                  deliveryLat: activeDelivery.delivery_latitude ?? deliveryCoords?.lat ?? null,
                  deliveryLng: activeDelivery.delivery_longitude ?? deliveryCoords?.lng ?? null,
                  customerName: customerInfo?.name || 'Πελάτης',
                  customerPhone: customerInfo?.phone || null,
                  status: activeDelivery.status ?? 'accepted',
                  items: activeDelivery.order_items?.map(i => ({ name: i.name, quantity: i.quantity })) ?? [],
                  estimatedPayout: getDriverPayoutBreakdown(activeDelivery as any).total,
                  pickupChecklist: ['Όλα τα προϊόντα', 'Ποτά', 'Μαχαιροπίρουνα'],
                  predictedReadyAt: (activeDelivery as any).predicted_ready_at ?? null,
                  notes: (activeDelivery as any).notes ?? null,
                  paymentMethod: (activeDelivery as any).payment_method ?? null,
                  cashToCollect: (activeDelivery as any).payment_method === 'cash'
                    ? Number((activeDelivery as any).cash_received ?? 0) || (Number((activeDelivery as any).total_amount ?? 0) + Number((activeDelivery as any).delivery_fee ?? 0) + Number((activeDelivery as any).tip_amount ?? 0))
                    : null,
                }}
                onStatusUpdate={(status) => updateDeliveryStatus(activeDelivery.id, status)}
                
              />
            </section>
          )}

          <section className="rounded-xl border border-border bg-card shadow-[var(--shadow-sm)] overflow-hidden">
            <div className="px-4 py-3 border-b border-border flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 min-w-0">
                <ClipboardList className="h-4 w-4 text-primary shrink-0" />
                <div className="min-w-0">
                  <h2 className="font-heading font-bold text-sm truncate">Λίστα διαθέσιμων για ανάληψη</h2>
                  <p className="text-xs text-muted-foreground">Προσφορές dispatch και έτοιμες παραγγελίες</p>
                </div>
              </div>
              {loading && <div className="h-5 w-5 border-2 border-primary border-t-transparent rounded-full animate-spin shrink-0" />}
            </div>

            {!loading && offers.length === 0 ? (
              <div className="px-4 py-12 text-center">
                <Radio className="h-8 w-8 text-muted-foreground mx-auto mb-3" />
                <p className="font-heading font-bold text-sm">Δεν υπάρχουν έτοιμες παραγγελίες</p>
                <p className="text-xs text-muted-foreground mt-1">Μόλις γίνει dispatch σε οδηγό, η παραγγελία θα εμφανιστεί εδώ.</p>
              </div>
            ) : (
              <div className="divide-y divide-border">
                {offers.map((offer) => {
                  const isClaimed = !!offer.driver_id;
                  const isReady = offer.status === 'ready';
                  return (
                  <article key={offer.id} className="p-4 grid gap-3 sm:grid-cols-[1fr_auto] sm:items-center">
                    <div className="min-w-0 space-y-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge variant="outline" className="font-heading text-[10px] uppercase">{offer.source}</Badge>
                        <span className="text-xs font-heading font-bold text-primary">#{offer.id.slice(0, 8)}</span>
                        {isClaimed && (
                          <Badge variant="destructive" className="font-heading text-[10px] uppercase">
                            Σε οδηγό
                          </Badge>
                        )}
                        {!isReady && (
                          <Badge variant="secondary" className="font-heading text-[10px] uppercase">
                            Προετοιμασία
                          </Badge>
                        )}
                      </div>
                      <div>
                        <p className="font-heading font-bold text-base truncate">{offer.store_name || 'Κατάστημα'}</p>
                        <p className="text-xs text-muted-foreground truncate">Παραλαβή: {offer.store_address || 'Διεύθυνση καταστήματος'}</p>
                        <p className="text-xs text-muted-foreground truncate">Παράδοση: {offer.delivery_address || 'Πελάτης'}</p>
                      </div>
                      <div className="flex items-center gap-2 flex-wrap text-xs text-muted-foreground">
                        <span className="rounded-lg bg-muted px-2 py-1">{offer.order_items?.length ?? 0} τεμ.</span>
                        <span className="rounded-lg bg-muted px-2 py-1">€{Number(offer.delivery_fee ?? offer.driver_payout ?? 0).toFixed(2)} οδηγός</span>
                        {offer.distance_km != null && <span className="rounded-lg bg-muted px-2 py-1">{Number(offer.distance_km).toFixed(1)} χλμ</span>}
                      </div>
                    </div>
                    <button
                      onClick={() => acceptOrder(offer.id)}
                      className="h-11 px-5 rounded-xl bg-primary text-primary-foreground font-heading font-bold shadow-primary hover:opacity-90 active:scale-[0.98] transition-all disabled:opacity-50 disabled:active:scale-100"
                      disabled={!isReady}
                    >
                      {isReady ? (isClaimed ? 'Ανάκτηση' : 'Ανάληψη') : 'Αναμονή'}
                    </button>
                  </article>
                  );
                })}
              </div>
            )}
          </section>
        </main>
      </div>
    );
  }


  // Keep map fitBounds clear of top chrome + bottom sheet / nav card
  // Uber-style modes:
  // - idle → compact online/offline toggle (GO bar)
  // - offer / delivery / break / cash-cap → job UI only (no online toggle)
  // One-at-a-time modes:
  // - while ANY order is before pickup → no offers at all
  // - all remaining orders picked up → a second offer may arrive AND the list shows
  const PRE_PICKUP_STATUSES = ['accepted', 'preparing', 'ready', 'arrived'];
  const prePickupBusy = activeDeliveries.some((o) => PRE_PICKUP_STATUSES.includes(o.status ?? ''));
  const hasIncomingOffers = offers.length > 0 && !prePickupBusy;
  const showJobSheet = activeDeliveries.length > 0 || hasIncomingOffers || onBreak || cashCapped;

  // Homepage hub data — one row per active order, FIFO.
  const listItems: ActiveOrderItem[] = activeDeliveries.map((o) => {
    const bd = getDriverPayoutBreakdown(o as any);
    const pricedPayout = o.driver_payout != null ? Number(o.driver_payout) : bd.total;
    return {
      id: o.id,
      storeName: o.store_name || storeInfo?.name || 'Κατάστημα',
      storeAddress: o.store_address ?? storeInfo?.address ?? null,
      customerName: o.customer_name ?? customerInfo?.name ?? null,
      deliveryAddress: o.delivery_address || null,
      status: o.status ?? 'accepted',
      payoutEur: pricedPayout > 0 ? pricedPayout : bd.total,
      cashToCollect: (o as any).payment_method === 'cash'
        ? Number((o as any).cash_received ?? 0) || (Number((o as any).total_amount ?? 0) + Number((o as any).delivery_fee ?? 0) + Number((o as any).tip_amount ?? 0))
        : null,
      pickupCode: (o as any).pickup_code ?? null,
      itemCount: o.order_items?.length ?? 0,
    };
  });

  // Second-order offer context: only shown while carrying picked-up work under demand.
  const secondPhase = activeDeliveries.some((o) => o.status === 'picked_up');
  const topOffer = hasIncomingOffers && !loading ? offers[0] : null;
  const topOfferPrice = (() => {
    if (!topOffer) return 0;
    const priced = Number((topOffer as any).driver_payout ?? 0) || getDriverPayoutBreakdown(topOffer as any).total;
    return secondPhase ? Math.round(priced * 50) / 100 : priced;
  })();
  /** Uber-style: job sheets are fixed docks — only the idle GO bar can collapse. */
  const sheetLocked = showJobSheet;
  const showCompactOnlineDock =
    sheetCollapsed &&
    !showJobSheet;

  // Offer / trip sheets need more height than the idle GO bar (Uber-like)
  const mapOverlayPadding = (() => {
    if (isNavActive) {
      return { top: 140, bottom: 220, left: 48, right: 72 };
    }
    const vh = typeof window !== 'undefined' ? window.innerHeight : 800;
    // Keep offer sheets compact so the map stays mostly visible (Uber-like).
    const bottom = showCompactOnlineDock
      ? Math.max(120, Math.round(vh * 0.16) + 28)
      : hasIncomingOffers
        ? Math.max(220, Math.min(300, Math.round(vh * 0.34) + 16))
        : activeDelivery
          ? Math.max(320, Math.round(vh * 0.58) + 24)
          : Math.max(260, Math.round(vh * 0.48) + 24);
    return { top: 96, bottom, left: 40, right: 40 };
  })();

  return (
    <div className="h-[100dvh] w-screen max-w-full flex flex-col driver-shell native-scroll bg-[hsl(var(--driver-bg))] overflow-hidden overscroll-none">
      <DriverPrefsApplier
        isOnline={isOnline}
        onForceOffline={() => setIsOnline(false)}
        hasActiveDelivery={!!activeDelivery}
      />
      {/* Map stays mounted across tabs so Mapbox doesn't remount on Money/Inbox. */}
      <div
        className={
          activeTab === 'home'
            ? 'flex-1 relative min-h-0 w-full'
            : 'absolute inset-0 opacity-0 pointer-events-none z-0 overflow-hidden'
        }
        aria-hidden={activeTab !== 'home'}
      >
          <Suspense fallback={<div className="absolute inset-0 z-0 bg-muted/40" />}>
            <DriverMapbox
              ref={mapRef}
              className="absolute inset-0 z-0 w-full h-full min-h-0"
              storeLat={storeInfo?.latitude}
              storeLng={storeInfo?.longitude}
              storeName={storeInfo?.name}
              storeOrderStatus={activeDelivery?.status ?? null}
              storePredictedReadyAt={(activeDelivery as any)?.predicted_ready_at ?? null}
              storeEstimatedPrepMin={(activeDelivery as any)?.estimated_prep_time ?? null}
              customerLat={activeDelivery?.delivery_latitude ?? deliveryCoords?.lat ?? null}
              customerLng={activeDelivery?.delivery_longitude ?? deliveryCoords?.lng ?? null}
              customerName={customerInfo?.name}
              customerAddress={activeDelivery?.delivery_address}
              navigatingTo={navigatingTo}
              onRouteUpdate={setRouteInfo}
              onDriverPosUpdate={isOnline ? undefined : setOfflineMapPos}
              useExternalGps={isOnline}
              externalPos={isOnline ? onlinePos : null}
              visible={activeTab === 'home'}
              nearbyStores={activeDelivery || !driverPrefs.showStorePinsOnMap ? [] : nearbyStores}
              followMode={isNavActive}
              overlayPadding={mapOverlayPadding}
              interactionLocked={false}
            />
          </Suspense>


          {!isNavActive && (
            <div className="fixed top-0 left-0 right-0 z-20 safe-area-top animate-slide-down pointer-events-none">
              <div className="px-3 pt-3 pb-2 flex items-start gap-2">
                <div className="shrink-0 pointer-events-auto flex items-center gap-1.5">
                  <div className="flex flex-col items-center gap-2">
                    <UserMenu
                      blockSignOut={
                        activeDeliveries.length > 0
                          ? 'Σε ενεργή παραγγελία — η αποσύνδεση είναι απενεργοποιημένη'
                          : null
                      }
                    />
                    <button
                      type="button"
                      onClick={() => {
                        if (driverActive !== true) return;
                        if (isOnline && activeDeliveries.length > 0) {
                          toast.error('Σε ενεργή παραγγελία — δεν μπορείς να βγεις offline');
                          return;
                        }
                        if (!isOnline) primeDriverAudio();
                        setIsOnline(!isOnline);
                      }}
                      disabled={driverActive !== true}
                      className={`h-10 w-10 rounded-full flex items-center justify-center shadow-lg transition-all duration-200 active:scale-90 ${
                        isOnline
                          ? 'driver-gradient-earn text-white ring-4 ring-[hsl(var(--driver-accent))]/25'
                          : 'bg-[hsl(var(--driver-surface))] border border-[hsl(var(--driver-border))] text-[hsl(var(--driver-text-muted))]'
                      }`}
                      aria-label={isOnline ? 'Βγες εκτός υπηρεσίας' : 'Μπες σε υπηρεσία'}
                      title={isOnline ? 'Διαθέσιμος — πάτα για έξοδο' : 'Εκτός υπηρεσίας — πάτα για είσοδο'}
                    >
                      <Power className="h-5 w-5" strokeWidth={2.5} />
                    </button>
                  </div>
                  {showMonitorLink && (
                    <Link
                      to="/m"
                      className="h-9 px-2.5 rounded-full text-[10.5px] font-heading font-bold border border-border bg-card/95 backdrop-blur-md shadow-lg hover:bg-card transition-colors flex items-center gap-1 text-foreground"
                      title="Live χάρτης οδηγών"
                    >
                      <Radio className="h-3.5 w-3.5 text-primary" />
                      Live
                    </Link>
                  )}
                  {isAdminRole && adminAsDriver && (
                    <button
                      onClick={toggleAdminView}
                      className="h-9 px-2.5 rounded-full text-[10.5px] font-heading font-bold border border-border bg-card/95 backdrop-blur-md shadow-lg hover:bg-card transition-colors flex items-center gap-1 text-foreground"
                      title="Επιστροφή σε Admin Driver Ops"
                    >
                      <ShieldCheck className="h-3.5 w-3.5 text-primary" />
                      Ops
                    </button>
                  )}
                </div>
                <div className="flex-1" />
                <div className="shrink-0 pointer-events-auto flex items-center gap-2">
                  <DriverSupportButton orderId={activeDelivery?.id} open={supportOpen} onOpenChange={setSupportOpen} />
                </div>
              </div>
            </div>
          )}

          {/* In-app turn-by-turn: dark instruction banner pinned to the top */}
          {isNavActive && (
            <div className="fixed top-0 left-0 right-0 z-30 safe-area-top px-3 pt-3 animate-slide-down pointer-events-none">
              <div className="pointer-events-auto">
                {navProgress && navProgress.step ? (
                  <TurnByTurnBanner
                    distanceToNext={navProgress.distanceToNext}
                    step={navProgress.step}
                    nextStreet={navProgress.nextStreet}
                  />
                ) : (
                  <div className="rounded-2xl bg-[hsl(0,0%,12%)] text-white px-4 py-3 flex items-center gap-3 shadow-2xl">
                    <div className="h-5 w-5 border-2 border-white/70 border-t-transparent rounded-full animate-spin" />
                    <p className="text-sm font-heading">Υπολογισμός διαδρομής…</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Floating action stack — support + map controls during turn-by-turn */}
          {isNavActive && (
            <div className="fixed right-3 top-1/2 -translate-y-1/2 z-30 flex flex-col gap-3 pointer-events-auto animate-pop">
              <DriverSupportButton orderId={activeDelivery?.id} open={supportOpen} onOpenChange={setSupportOpen} />
              <button
                onClick={() => mapRef.current?.fitOverview()}
                className="h-12 w-12 rounded-full bg-card border border-border flex items-center justify-center shadow-lg hover:bg-accent active:scale-90 transition-all"
                aria-label="Προβολή ολόκληρης διαδρομής"
                title="Προβολή ολόκληρης διαδρομής"
              >
                <Navigation className="h-5 w-5 text-foreground" strokeWidth={2.5} />
              </button>
              <button
                onClick={() => mapRef.current?.recenter()}
                className="h-12 w-12 rounded-full bg-card border border-border flex items-center justify-center shadow-lg hover:bg-accent active:scale-90 transition-all"
                aria-label="Επανακέντρωμα στη θέση μου"
                title="Επανακέντρωμα στη θέση μου"
              >
                <Crosshair className="h-5 w-5 text-primary" strokeWidth={2.5} />
              </button>
            </div>
          )}

          {/* Bottom sheet for in-app turn-by-turn — outside the scrollable column so it's always pinned */}
          {isNavActive && (
            <div className="fixed bottom-0 left-0 right-0 z-30 pointer-events-auto safe-area-bottom">
              <NavBottomCard
                title={navigatingTo === 'store'
                  ? (storeInfo?.name || 'Κατάστημα')
                  : (customerInfo?.name || 'Πελάτης')}
                subtitle={navigatingTo === 'store'
                  ? (storeInfo?.address ?? null)
                  : (activeDelivery?.delivery_address ?? null)}
                durationSec={routeInfo?.duration ?? 0}
                distanceMeters={routeInfo?.distance ?? 0}
                phone={navigatingTo === 'store'
                  ? (storeInfo?.phone ?? null)
                  : (customerInfo?.phone ?? null)}
                destLat={navigatingTo === 'store'
                  ? (storeInfo?.latitude ?? null)
                  : (activeDelivery?.delivery_latitude ?? deliveryCoords?.lat ?? null)}
                destLng={navigatingTo === 'store'
                  ? (storeInfo?.longitude ?? null)
                  : (activeDelivery?.delivery_longitude ?? deliveryCoords?.lng ?? null)}
                onExit={() => setNavMode(false)}
              />
            </div>
          )}


          {/* Bottom dock — solid sheet (no clipped glass lip over the map) */}
          <div className={`fixed bottom-0 left-0 right-0 z-20 pointer-events-none ${isNavActive ? 'hidden' : ''}`}>

            <div
              className={`pointer-events-auto bg-[hsl(var(--driver-surface))] border-t border-[hsl(var(--driver-border))] rounded-t-[22px] shadow-[0_-8px_28px_-10px_hsl(220,18%,14%,0.16)] flex flex-col ${
                showCompactOnlineDock
                  ? 'overflow-hidden'
                  : sheetLocked
                    ? hasIncomingOffers
                      ? 'max-h-[min(420px,48vh)] overflow-hidden'
                      : 'max-h-[min(560px,62vh)] overflow-hidden'
                    : 'max-h-[48vh] overflow-hidden'
              }`}
            >
              {/* Handle — decorative when locked (Uber job card); drag only for idle GO bar */}
              <div
                className={`w-full flex items-center justify-center pt-2 pb-1.5 select-none shrink-0 ${
                  sheetLocked
                    ? 'cursor-default pointer-events-none'
                    : 'cursor-grab active:cursor-grabbing touch-none group'
                }`}
                role="button"
                tabIndex={sheetLocked ? -1 : 0}
                aria-label={
                  sheetLocked
                    ? 'Κάρτα εργασίας'
                    : sheetCollapsed ? 'Άνοιγμα πίνακα' : 'Σύμπτυξη πίνακα'
                }
                title={
                  sheetLocked
                    ? undefined
                    : sheetCollapsed ? 'Άνοιγμα — σύρε πάνω' : 'Σύμπτυξη — σύρε κάτω'
                }
                onClick={() => {
                  if (sheetLocked) return;
                  if (!sheetDragMoved.current) setSheetCollapsed(v => !v);
                }}
                onTouchStart={(e) => {
                  if (sheetLocked) return;
                  sheetDragStartY.current = e.touches[0].clientY;
                  sheetDragMoved.current = false;
                }}
                onTouchMove={(e) => {
                  if (sheetLocked || sheetDragStartY.current == null) return;
                  const dy = e.touches[0].clientY - sheetDragStartY.current;
                  if (Math.abs(dy) > 8) sheetDragMoved.current = true;
                  if (dy < -24 && sheetCollapsed) { setSheetCollapsed(false); sheetDragStartY.current = null; }
                  else if (dy > 24 && !sheetCollapsed) { setSheetCollapsed(true); sheetDragStartY.current = null; }
                }}
                onTouchEnd={() => { sheetDragStartY.current = null; }}
                onPointerDown={(e) => {
                  if (sheetLocked) return;
                  (e.currentTarget as HTMLDivElement).setPointerCapture(e.pointerId);
                  sheetDragStartY.current = e.clientY;
                  sheetDragMoved.current = false;
                }}
                onPointerMove={(e) => {
                  if (sheetLocked || sheetDragStartY.current == null) return;
                  const dy = e.clientY - sheetDragStartY.current;
                  if (Math.abs(dy) > 8) sheetDragMoved.current = true;
                  if (dy < -24 && sheetCollapsed) { setSheetCollapsed(false); sheetDragStartY.current = null; }
                  else if (dy > 24 && !sheetCollapsed) { setSheetCollapsed(true); sheetDragStartY.current = null; }
                }}
                onPointerUp={() => { sheetDragStartY.current = null; }}
                onPointerCancel={() => { sheetDragStartY.current = null; }}
              >
                <span className={`h-1 w-10 rounded-full ${
                  sheetLocked
                    ? 'bg-[hsl(var(--driver-text-muted))]/20'
                    : 'bg-[hsl(var(--driver-text-muted))]/45 group-active:bg-[hsl(var(--driver-text-muted))]/70'
                }`} />
              </div>

              <div
                className={`px-3 flex-1 min-h-0 ${
                  sheetLocked
                    ? 'overflow-y-auto overscroll-contain scrollbar-thin'
                    : showCompactOnlineDock
                      ? ''
                      : 'overflow-y-auto overscroll-contain scrollbar-thin'
                }`}
                style={{ paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom, 0px))' }}
              >
                <div className="space-y-2.5">
                  <>
                    {/* Idle expanded only — never compete with offers/trips */}
                    {!showJobSheet && (
                      <>
                        <AnnouncementsBanner audience="drivers" />
                        <SurgeStatusBadge />
                      </>
                    )}

                    {!hasIncomingOffers && activeDeliveries.length > 0 && (
                      <ActiveOrdersList
                        items={listItems}
                        completedItems={recentCompleted.map((o) => {
                          const earn = o.driver_payout != null
                            ? Number(o.driver_payout)
                            : getDriverPayoutBreakdown(o as any).total;
                          return {
                            id: o.id,
                            label: `${o.store_name || storeInfo?.name || 'Παραγγελία'} · #${o.id.slice(0, 6)}`,
                            earnEur: earn,
                          };
                        })}
                        onNavToStore={() => { setNavMode(true); }}
                        onConfirmPickup={(id) => handleStatusUpdate(id, 'picked_up')}
                        onComplete={(id) => handleStatusUpdate(id, 'delivered')}
                        busyId={busyStatusId}
                      />
                    )}

                    {!activeDelivery && isOnline && !onBreak && cashCapped && (
                      <div className="rounded-2xl border-2 border-destructive bg-destructive/10 p-4">
                        <p className="font-heading font-bold text-sm text-destructive mb-1">🚫 Όριο μετρητών συμπληρώθηκε</p>
                        <p className="text-xs text-foreground/80 leading-relaxed">
                          Έχεις €{Number(driverState?.shift_cash_balance ?? 0).toFixed(2)} σε μετρητά (όριο €{maxCashCap}).
                          Παρέδωσε τα χρήματα στον διαχειριστή για να ξεκινήσουν νέες παραγγελίες.
                        </p>
                      </div>
                    )}

                    {/* Offer mode — one card at a time; price is the only info */}
                    {topOffer && isOnline && !onBreak && !cashCapped && (
                      <div className="space-y-2 pb-1">
                        <OneAtATimeOfferCard
                          key={topOffer.id}
                          id={topOffer.id}
                          kicker={secondPhase ? 'Αυξημένη ζήτηση' : 'Νέα παραγγελία'}
                          priceEur={topOfferPrice}
                          expiresAt={offerExpiresAt[topOffer.id] ?? null}
                          timeoutSec={offerTimeoutSec}
                          onAccept={acceptOrder}
                          onDecline={handleDecline}
                        />
                      </div>
                    )}
                  </>
                </div>
              </div>
            </div>
          </div>
        </div>

      {activeTab !== 'home' && (
        /* ─── NON-MAP TABS ─── */
        <>
          <header className="relative z-30 px-4 py-3 flex items-center justify-between bg-[hsl(var(--driver-surface))]/95 backdrop-blur-xl border-b border-[hsl(var(--driver-border))] safe-area-top animate-slide-down">
            <button
              onClick={() => setActiveTab('home')}
              className="h-10 w-10 rounded-full bg-[hsl(var(--driver-surface))] border border-[hsl(var(--driver-border))] shadow-sm flex items-center justify-center hover:bg-[hsl(var(--driver-surface-muted))] transition-all duration-200 active:scale-90"
              aria-label="Πίσω"
            >
              <ArrowLeft className="h-5 w-5 text-[hsl(var(--driver-text))]" />
            </button>
            <div className="flex items-center gap-2 animate-fade-in">
              <div className="h-7 w-7 rounded-full driver-gradient-earn flex items-center justify-center">
                <Zap className="h-3.5 w-3.5 text-white" strokeWidth={2.5} />
              </div>
              <span className="font-heading font-extrabold text-[hsl(var(--driver-text))] text-[15px] tracking-tight">
                Fresh Meal
                {isAdmin && (
                  <span className="ml-2 px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-primary/15 text-primary border border-primary/30">
                    Ops
                  </span>
                )}
              </span>
            </div>
            <div className="w-10" />
          </header>
          <div key={activeTab} className="flex-1 overflow-y-auto pb-8 animate-fade-in relative z-10">
            <Suspense fallback={<div className="p-6 text-sm text-muted-foreground">Φόρτωση…</div>}>
              {activeTab === 'money' && (
                <div className="px-4 py-4">
                  <DriverMoneyPanel />
                </div>
              )}
              {activeTab === 'inbox' && <DriverInbox />}
              {activeTab === 'referral' && (
                <div className="px-4 py-4"><DriverReferral /></div>
              )}
            </Suspense>
          </div>
        </>
      )}
    </div>
  );
}
