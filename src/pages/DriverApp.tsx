import { useState, useEffect, useRef } from 'react';
import { Car, Navigation, Wallet, Users, Zap, Radio, TrendingUp, MapPin, Crosshair } from 'lucide-react';
import { useDriverLocation } from '@/hooks/useDriverLocation';
import { useAuth } from '@/hooks/useAuth';
import { UserMenu } from '@/components/UserMenu';
import { Badge } from '@/components/ui/badge';
import { OrderOfferCard } from '@/components/driver/OrderOfferCard';
import { ActiveDelivery } from '@/components/driver/ActiveDelivery';
import { DriverWallet } from '@/components/driver/DriverWallet';
import { DriverReferral } from '@/components/driver/DriverReferral';
import { DriverSupportButton } from '@/components/driver/DriverSupportButton';
import { EarningsDashboard } from '@/components/driver/EarningsDashboard';
import { useDriverOrders } from '@/hooks/useOrders';
import { useEarnings } from '@/hooks/useEarnings';
import AnnouncementsBanner from '@/components/AnnouncementsBanner';
import { supabase } from '@/integrations/supabase/client';
import DriverMapbox, { type RouteInfo, type DriverMapboxHandle } from '@/components/driver/DriverMapbox';
import { NavigationPanel } from '@/components/driver/NavigationPanel';
import { SlideToggle } from '@/components/driver/SlideToggle';
import { DriverSoundSettings } from '@/components/driver/DriverSoundSettings';
import { useNearbyStoresForDriver } from '@/hooks/useNearbyStoresForDriver';


type DriverTab = 'home' | 'earnings' | 'wallet' | 'referral';

export default function DriverApp() {
  const { offers, activeDelivery, loading, acceptOrder, updateDeliveryStatus } = useDriverOrders();
  // Drivers always start OFFLINE — must opt-in each session
  const [isOnline, setIsOnline] = useState(false);
  const [driverActive, setDriverActive] = useState<boolean | null>(null);
  const [activeTab, setActiveTab] = useState<DriverTab>('home');
  const { user } = useAuth();
  useEarnings();

  // ─── 30-minute auto-offline inactivity timer ───
  const inactivityTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastActivity = useRef<number>(Date.now());

  useEffect(() => {
    if (!isOnline) {
      if (inactivityTimer.current) clearTimeout(inactivityTimer.current);
      return;
    }
    const INACTIVITY_MS = 30 * 60 * 1000; // 30 minutes
    const resetTimer = () => {
      lastActivity.current = Date.now();
      if (inactivityTimer.current) clearTimeout(inactivityTimer.current);
      inactivityTimer.current = setTimeout(() => {
        setIsOnline(false);
      }, INACTIVITY_MS);
    };
    const events: (keyof WindowEventMap)[] = ['pointerdown', 'touchstart', 'keydown', 'scroll'];
    events.forEach(e => window.addEventListener(e, resetTimer, { passive: true }));
    resetTimer();
    return () => {
      events.forEach(e => window.removeEventListener(e, resetTimer));
      if (inactivityTimer.current) clearTimeout(inactivityTimer.current);
    };
  }, [isOnline]);

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

  const { tracking, error: locError } = useDriverLocation(isOnline);
  const { stores: nearbyStores } = useNearbyStoresForDriver();
  const [storeInfo, setStoreInfo] = useState<{ name: string; address: string; phone: string | null; latitude: number | null; longitude: number | null } | null>(null);
  const [customerInfo, setCustomerInfo] = useState<{ name: string; phone: string | null } | null>(null);
  const handleDecline = (_id: string) => {};
  const [routeInfo, setRouteInfo] = useState<RouteInfo | null>(null);
  const mapRef = useRef<DriverMapboxHandle>(null);

  const navigatingTo = activeDelivery
    ? (['accepted', 'preparing', 'ready', 'arrived'].includes(activeDelivery.status ?? '') ? 'store' as const : activeDelivery.status === 'picked_up' ? 'customer' as const : null)
    : null;

  useEffect(() => {
    if (!activeDelivery) { setStoreInfo(null); setCustomerInfo(null); return; }
    supabase.from('stores').select('name, address, phone, latitude, longitude').eq('id', activeDelivery.store_id).single()
      .then(({ data }) => { if (data) setStoreInfo(data); });
    if (activeDelivery.customer_id) {
      supabase.from('profiles').select('full_name, phone').eq('user_id', activeDelivery.customer_id).single()
        .then(({ data }) => { if (data) setCustomerInfo({ name: data.full_name || 'Πελάτης', phone: data.phone }); });
    }
  }, [activeDelivery?.id, activeDelivery?.store_id, activeDelivery?.customer_id]);

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

  const bottomTabs: { key: DriverTab; icon: React.ElementType; label: string }[] = [
    { key: 'home', icon: MapPin, label: 'Αρχική' },
    { key: 'earnings', icon: TrendingUp, label: 'Κέρδη' },
    { key: 'wallet', icon: Wallet, label: 'Πορτοφόλι' },
    { key: 'referral', icon: Users, label: 'Πρόσκληση' },
  ];

  

  return (
    <div className="h-screen flex flex-col driver-shell bg-[hsl(var(--driver-bg))]">
      {activeTab === 'home' ? (
        <div className="flex-1 relative">
          {/* Fullscreen Map */}
          <DriverMapbox
            ref={mapRef}
            className="absolute inset-0"
            storeLat={storeInfo?.latitude}
            storeLng={storeInfo?.longitude}
            storeName={storeInfo?.name}
            customerLat={activeDelivery?.delivery_latitude}
            customerLng={activeDelivery?.delivery_longitude}
            customerName={customerInfo?.name}
            customerAddress={activeDelivery?.delivery_address}
            navigatingTo={navigatingTo}
            onRouteUpdate={setRouteInfo}
            nearbyStores={nearbyStores}
          />

          {/* ─── TOP BAR (floating over map) ─── */}
          <div className="absolute top-0 left-0 right-0 z-20 safe-area-top">
            <div className="px-4 pt-3 pb-2 flex items-center justify-between gap-3">
              <div className="driver-glass rounded-full p-1.5 shrink-0">
                <UserMenu />
              </div>
              <div className="driver-glass rounded-full px-4 py-2 flex items-center gap-2 shrink-0">
                <div className="h-5 w-5 rounded-md gradient-primary flex items-center justify-center">
                  <Zap className="h-3 w-3 text-white" />
                </div>
                <span className="font-heading font-bold text-[hsl(var(--driver-text))] text-sm">QuickGrid</span>
              </div>
              <div className="driver-glass rounded-full p-1.5 shrink-0">
                <DriverSupportButton orderId={activeDelivery?.id} />
              </div>
            </div>
          </div>

          {/* ─── BOTTOM OVERLAY CARDS (over map) ─── */}
          <div className="absolute bottom-[72px] left-0 right-0 z-20 max-h-[60vh] overflow-y-auto px-4 pb-3 space-y-3 pointer-events-none scrollbar-thin">
            <div className="pointer-events-auto space-y-3">
              {/* Recenter button */}
              <div className="flex justify-end">
                <button
                  onClick={() => mapRef.current?.recenter()}
                  className="h-10 w-10 rounded-full driver-glass border border-[hsl(var(--driver-border))] flex items-center justify-center shadow-lg hover:bg-[hsl(var(--driver-surface))] transition-colors active:scale-95"
                >
                  <Crosshair className="h-5 w-5 text-[hsl(var(--driver-text))]" />
                </button>
              </div>
              <AnnouncementsBanner audience="drivers" />

              {/* Navigation Panel */}
              {routeInfo && navigatingTo && (
                <NavigationPanel
                  route={routeInfo}
                  destination={navigatingTo === 'store' ? (storeInfo?.name || 'Κατάστημα') : (customerInfo?.name || 'Πελάτης')}
                  destinationType={navigatingTo}
                />
              )}

              {/* Active delivery card */}
              {activeDelivery && (
                <>
                  {tracking && (
                    <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-[hsl(var(--driver-accent))]/10 border border-[hsl(var(--driver-accent))]/20 driver-glass">
                      <Navigation className="h-3.5 w-3.5 text-[hsl(var(--driver-accent))] animate-pulse" />
                      <span className="text-xs font-heading font-medium text-[hsl(var(--driver-accent))]">Ζωντανή τοποθεσία</span>
                    </div>
                  )}
                  {locError && (
                    <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-destructive/10 border border-destructive/20 driver-glass">
                      <Navigation className="h-3.5 w-3.5 text-destructive" />
                      <span className="text-xs font-heading text-destructive">GPS: {locError}</span>
                    </div>
                  )}
                  <ActiveDelivery
                    delivery={{
                      id: activeDelivery.id,
                      storeName: storeInfo?.name || 'Σημείο Παραλαβής',
                      storeAddress: storeInfo?.address || 'Διεύθυνση',
                      storePhone: storeInfo?.phone || null,
                      storeLat: storeInfo?.latitude ?? null,
                      storeLng: storeInfo?.longitude ?? null,
                      deliveryAddress: activeDelivery.delivery_address || 'Πελάτης',
                      deliveryLat: activeDelivery.delivery_latitude ?? null,
                      deliveryLng: activeDelivery.delivery_longitude ?? null,
                      customerName: customerInfo?.name || 'Πελάτης',
                      customerPhone: customerInfo?.phone || null,
                      status: activeDelivery.status ?? 'accepted',
                      items: activeDelivery.order_items?.map(i => ({ name: i.name, quantity: i.quantity })) ?? [],
                      estimatedPayout: Number(activeDelivery.delivery_fee ?? 0) + Number(activeDelivery.tip_amount ?? 0),
                      pickupChecklist: ['Όλα τα προϊόντα', 'Ποτά', 'Μαχαιροπίρουνα'],
                    }}
                    onStatusUpdate={(status) => updateDeliveryStatus(activeDelivery.id, status)}
                  />
                </>
              )}

              {/* Order offer cards */}
              {!activeDelivery && isOnline && !loading && offers.length > 0 && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between px-1">
                    <h3 className="font-heading font-bold text-sm text-[hsl(var(--driver-text))]">Νέες Παραγγελίες</h3>
                    <Badge className="bg-primary text-primary-foreground font-heading text-[10px] px-2 py-0.5">{offers.length}</Badge>
                  </div>
                  {offers.map(offer => (
                    <OrderOfferCard
                      key={offer.id}
                      offer={{
                        id: offer.id,
                        storeName: 'Παραλαβή',
                        storeAddress: offer.delivery_address || 'Κατάστημα',
                        deliveryAddress: offer.delivery_address || 'Πελάτης',
                        estimatedPayout: Number(offer.delivery_fee ?? 0) + Number(offer.tip_amount ?? 0),
                        basePay: Number(offer.delivery_fee ?? 0),
                        tipAmount: Number(offer.tip_amount ?? 0),
                        perKmRate: 0.50,
                        totalDistance: 0,
                        estimatedTime: offer.estimated_prep_time ?? 20,
                        itemCount: offer.order_items?.length ?? 0,
                      }}
                      onAccept={acceptOrder}
                      onDecline={handleDecline}
                    />
                  ))}
                </div>
              )}

              {/* Combined Online/Offline + Waiting state */}
              {!activeDelivery && (
                <div className="driver-glass rounded-2xl overflow-hidden transition-all duration-500 ease-out">
                  {/* Waiting for orders (online, no offers) */}
                  {isOnline && !loading && offers.length === 0 && (
                    <div className="p-5 text-center animate-fade-in">
                      <div className="relative h-12 w-12 mx-auto mb-3">
                        <div className="absolute inset-0 rounded-xl bg-primary/15 animate-ping opacity-30" />
                        <div className="relative h-12 w-12 rounded-xl bg-[hsl(var(--driver-surface))] flex items-center justify-center border border-primary/20">
                          <Zap className="h-6 w-6 text-primary" />
                        </div>
                      </div>
                      <p className="font-heading font-bold text-sm text-[hsl(var(--driver-text))]">Αναμονή Παραγγελιών</p>
                      <div className="mt-2 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[hsl(var(--driver-accent))]/10 border border-[hsl(var(--driver-accent))]/15">
                        <span className="h-1.5 w-1.5 rounded-full bg-[hsl(var(--driver-accent))] animate-pulse" />
                        <span className="text-[10px] font-heading font-medium text-[hsl(var(--driver-accent))]">Ζωντανή Αναζήτηση</span>
                      </div>
                    </div>
                  )}

                  {/* Loading */}
                  {isOnline && loading && (
                    <div className="p-5 text-center animate-fade-in">
                      <div className="h-8 w-8 border-3 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-3" />
                      <p className="text-[hsl(var(--driver-text-muted))] font-heading text-xs">Αναζήτηση...</p>
                    </div>
                  )}

                  {/* Offline message */}
                  {!isOnline && (
                    <div className="p-5 text-center animate-fade-in">
                      <Radio className="h-7 w-7 text-[hsl(var(--driver-text-muted))] mx-auto mb-2" />
                      <p className="font-heading font-bold text-[hsl(var(--driver-text))] text-sm">Εκτός Σύνδεσης</p>
                      <p className="text-xs text-[hsl(var(--driver-text-muted))] mt-1">Σύρετε για να συνδεθείτε</p>
                    </div>
                  )}

                  {/* Slide to go Online/Offline */}
                  <div className="px-4 pb-4 pt-1">
                    <SlideToggle
                      isOn={isOnline}
                      onToggle={setIsOnline}
                      onLabel="Είσαι Online"
                      offLabel="Σύρε για να συνδεθείς"
                      disabled={driverActive !== true}
                    />
                  </div>
                </div>
              )}

            </div>
          </div>
        </div>
      ) : (
        /* ─── NON-MAP TABS ─── */
        <>
          <header className="relative z-30 px-4 py-3 flex items-center justify-between driver-glass safe-area-top">
            <UserMenu />
            <div className="flex items-center gap-2">
              <div className="h-7 w-7 rounded-lg gradient-primary flex items-center justify-center">
                <Zap className="h-3.5 w-3.5 text-white" />
              </div>
              <span className="font-heading font-bold text-[hsl(var(--driver-text))] text-base tracking-tight">QuickGrid</span>
            </div>
            <div className="w-10" />
          </header>
          <div className="flex-1 overflow-y-auto pb-24">
            {activeTab === 'earnings' && (
              <div className="px-4 py-4"><EarningsDashboard /></div>
            )}
            {activeTab === 'wallet' && (
              <div className="px-4 py-4"><DriverWallet /></div>
            )}
            {activeTab === 'referral' && (
              <div className="px-4 py-4"><DriverReferral /></div>
            )}
          </div>
        </>
      )}

      {/* ─── BOTTOM NAV ─── */}
      <nav className="fixed bottom-0 inset-x-0 z-30 driver-glass border-t border-[hsl(var(--driver-border))]">
        <div className="flex safe-area-bottom">
          {bottomTabs.map(tab => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.key;
            return (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`flex-1 flex flex-col items-center gap-1 py-3 transition-all duration-200 relative ${
                  isActive ? 'text-[hsl(var(--driver-accent))]' : 'text-[hsl(var(--driver-text-muted))]'
                }`}
              >
                {isActive && <div className="absolute top-0 left-1/4 right-1/4 h-0.5 bg-[hsl(var(--driver-accent))] rounded-full" style={{ boxShadow: 'var(--driver-accent-glow)' }} />}
                <Icon className="h-5 w-5" />
                <span className="text-[10px] font-heading font-semibold leading-none">{tab.label}</span>
                {tab.key === 'home' && offers.length > 0 && !activeDelivery && (
                  <span className="absolute top-2 left-1/2 ml-2 h-2 w-2 rounded-full bg-primary driver-glow-red" />
                )}
              </button>
            );
          })}
        </div>
      </nav>

    </div>
  );
}
