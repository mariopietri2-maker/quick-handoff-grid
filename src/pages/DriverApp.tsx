import { useState, useEffect } from 'react';
import { Car, Navigation, MapPin, Wallet, Users, Zap, Radio, ChevronRight, TrendingUp, Clock, Package } from 'lucide-react';
import { useDriverLocation } from '@/hooks/useDriverLocation';
import { useAuth } from '@/hooks/useAuth';
import { UserMenu } from '@/components/UserMenu';
import { Button } from '@/components/ui/button';
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
import DriverMapbox, { type RouteInfo } from '@/components/driver/DriverMapbox';
import { NavigationPanel } from '@/components/driver/NavigationPanel';

type DriverTab = 'home' | 'earnings' | 'wallet' | 'referral';

export default function DriverApp() {
  const { offers, activeDelivery, loading, acceptOrder, updateDeliveryStatus } = useDriverOrders();
  const [isOnline, setIsOnline] = useState(true);
  const [driverActive, setDriverActive] = useState<boolean | null>(null);
  const [activeTab, setActiveTab] = useState<DriverTab>('home');
  const { user } = useAuth();
  const { today } = useEarnings();

  useEffect(() => {
    if (!user) return;
    supabase.from('driver_profiles').select('is_active').eq('user_id', user.id).maybeSingle()
      .then(({ data }) => setDriverActive(data ? data.is_active : true));
  }, [user]);

  const hasActiveDelivery = !!activeDelivery;
  const { tracking, error: locError } = useDriverLocation(isOnline);
  const [storeInfo, setStoreInfo] = useState<{ name: string; address: string; phone: string | null; latitude: number | null; longitude: number | null } | null>(null);
  const [customerInfo, setCustomerInfo] = useState<{ name: string; phone: string | null } | null>(null);
  const handleDecline = (_id: string) => {};
  const [routeInfo, setRouteInfo] = useState<RouteInfo | null>(null);

  // Determine navigation target based on delivery status
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
      <div className="min-h-screen bg-background flex items-center justify-center p-6">
        <div className="text-center max-w-sm space-y-4">
          <div className="h-20 w-20 rounded-full bg-destructive/10 flex items-center justify-center mx-auto">
            <Car className="h-10 w-10 text-destructive" />
          </div>
          <h1 className="font-heading text-2xl font-bold">Αναμονή Έγκρισης</h1>
          <p className="text-muted-foreground text-sm">Ο λογαριασμός σας είναι σε αναμονή.</p>
          <Button variant="outline" onClick={() => window.location.reload()}>Έλεγχος</Button>
        </div>
      </div>
    );
  }

  if (driverActive === null && !loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="h-8 w-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const bottomTabs: { key: DriverTab; icon: React.ElementType; label: string }[] = [
    { key: 'home', icon: MapPin, label: 'Αρχική' },
    { key: 'earnings', icon: TrendingUp, label: 'Στατιστικά' },
    { key: 'wallet', icon: Wallet, label: 'Κέρδη' },
    { key: 'referral', icon: Users, label: 'Πρόσκληση' },
  ];

  return (
    <div className="h-screen flex flex-col bg-[#0a0a0f]">
      {/* ─── HEADER ─── */}
      <header className="relative z-30 px-4 py-3 flex items-center justify-between bg-[#0a0a0f]/95 backdrop-blur-lg border-b border-white/5">
        <UserMenu />
        <div className="flex items-center gap-2">
          <span className="font-heading font-bold text-white text-base tracking-tight">QuickGrid</span>
        </div>
        <button
          onClick={() => setIsOnline(!isOnline)}
          className={`relative px-5 py-1.5 rounded-full text-xs font-heading font-bold transition-all duration-300 ${
            isOnline
              ? 'bg-emerald-500 text-white shadow-[0_0_20px_rgba(34,197,94,0.4)]'
              : 'bg-white/10 text-white/50'
          }`}
        >
          {isOnline && <span className="absolute left-2 top-1/2 -translate-y-1/2 h-1.5 w-1.5 rounded-full bg-white animate-pulse" />}
          {isOnline ? 'Online' : 'Offline'}
        </button>
      </header>

      {/* ─── MAIN ─── */}
      <div className="flex-1 overflow-y-auto pb-20">
        {activeTab === 'home' && (
          <div>
            {/* Mapbox Map */}
            <div className="relative h-[280px]">
              <DriverMapbox
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
              />
              {/* Gradient overlay at bottom */}
              <div className="absolute bottom-0 left-0 right-0 h-24 bg-gradient-to-t from-[#0a0a0f] to-transparent pointer-events-none" />

              {/* Earnings floating card */}
              <div className="absolute bottom-3 left-3 right-3 bg-white/[0.08] backdrop-blur-xl rounded-2xl p-4 border border-white/10">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-[10px] text-white/40 font-heading uppercase tracking-widest">Σημερινά Κέρδη</p>
                    <p className="font-heading font-extrabold text-3xl text-white">{today.total.toFixed(2)}€</p>
                  </div>
                  <div className="flex gap-4">
                    <div className="text-center">
                      <p className="text-[10px] text-white/40">Διαδρομές</p>
                      <p className="font-heading font-bold text-lg text-white">{today.trips}</p>
                    </div>
                    <div className="text-center">
                      <p className="text-[10px] text-white/40">Tips</p>
                      <p className="font-heading font-bold text-lg text-emerald-400">{today.tips.toFixed(2)}€</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <AnnouncementsBanner audience="drivers" />

            {/* Navigation Panel */}
            {routeInfo && navigatingTo && (
              <div className="px-4 pt-3">
                <NavigationPanel
                  route={routeInfo}
                  destination={navigatingTo === 'store' ? (storeInfo?.name || 'Κατάστημα') : (customerInfo?.name || 'Πελάτης')}
                  destinationType={navigatingTo}
                />
              </div>
            )}

            {/* Content */}
            <div className="px-4 py-3 space-y-3">
              {/* Active delivery */}
              {activeDelivery && (
                <>
                  {tracking && (
                    <div className="flex items-center gap-2 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
                      <Navigation className="h-4 w-4 text-emerald-400 animate-pulse" />
                      <span className="text-xs font-heading font-medium text-emerald-400">Ζωντανή τοποθεσία κοινοποιείται</span>
                    </div>
                  )}
                  {locError && (
                    <div className="flex items-center gap-2 p-3 rounded-xl bg-red-500/10 border border-red-500/20">
                      <Navigation className="h-4 w-4 text-red-400" />
                      <span className="text-xs font-heading text-red-400">GPS: {locError}</span>
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

              {/* Offers */}
              {!activeDelivery && (
                <>
                  {!isOnline ? (
                    <div className="text-center py-16">
                      <div className="h-16 w-16 rounded-2xl bg-white/5 flex items-center justify-center mx-auto mb-4 border border-white/10">
                        <Radio className="h-7 w-7 text-white/30" />
                      </div>
                      <p className="font-heading font-bold text-white text-lg">Εκτός Σύνδεσης</p>
                      <p className="text-sm text-white/40 mt-1">Πατήστε <strong className="text-white/70">Online</strong> για παραγγελίες</p>
                    </div>
                  ) : loading ? (
                    <div className="text-center py-16">
                      <div className="h-10 w-10 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4" />
                      <p className="text-white/50 font-heading text-sm">Αναζήτηση...</p>
                    </div>
                  ) : offers.length === 0 ? (
                    <div className="text-center py-16">
                      <div className="h-20 w-20 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4 border border-primary/20">
                        <Zap className="h-9 w-9 text-primary" />
                      </div>
                      <h2 className="font-heading font-bold text-lg text-white">Αναμονή Παραγγελιών</h2>
                      <p className="text-sm text-white/40 mt-1.5 max-w-[260px] mx-auto">
                        Θα ειδοποιηθείτε μόλις εμφανιστεί νέα παραγγελία
                      </p>
                      <div className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 border border-primary/15">
                        <span className="h-2 w-2 rounded-full bg-primary animate-pulse" />
                        <span className="text-xs font-heading font-medium text-primary">Ζωντανή Αναζήτηση</span>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <h3 className="font-heading font-bold text-white">Διαθέσιμες Παραγγελίες</h3>
                        <Badge className="bg-primary text-primary-foreground">{offers.length}</Badge>
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
                </>
              )}
            </div>
          </div>
        )}

        {activeTab === 'earnings' && (
          <div className="px-4 py-4">
            <EarningsDashboard />
          </div>
        )}

        {activeTab === 'wallet' && (
          <div className="px-4 py-4">
            <DriverWallet />
          </div>
        )}

        {activeTab === 'referral' && (
          <div className="px-4 py-4">
            <DriverReferral />
          </div>
        )}
      </div>

      {/* ─── BOTTOM NAV ─── */}
      <nav className="fixed bottom-0 inset-x-0 z-30 bg-[#0a0a0f]/95 backdrop-blur-xl border-t border-white/5 safe-area-bottom">
        <div className="flex">
          {bottomTabs.map(tab => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.key;
            return (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`flex-1 flex flex-col items-center gap-0.5 py-2.5 transition-all duration-200 relative ${
                  isActive ? 'text-primary' : 'text-white/30'
                }`}
              >
                {isActive && <div className="absolute top-0 left-1/4 right-1/4 h-0.5 bg-primary rounded-full shadow-[0_0_8px_hsl(var(--primary))]" />}
                <Icon className="h-5 w-5" />
                <span className="text-[10px] font-heading font-semibold">{tab.label}</span>
                {tab.key === 'home' && offers.length > 0 && !activeDelivery && (
                  <span className="absolute top-1.5 right-1/4 h-2.5 w-2.5 rounded-full bg-primary shadow-[0_0_6px_hsl(var(--primary))]" />
                )}
              </button>
            );
          })}
        </div>
      </nav>

      <DriverSupportButton orderId={activeDelivery?.id} />
    </div>
  );
}
