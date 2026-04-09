import { useState, useEffect } from 'react';
import { Car, Navigation, MapPin, Wallet, Users, Zap, Radio, ChevronRight } from 'lucide-react';
import { useDriverLocation } from '@/hooks/useDriverLocation';
import { useAuth } from '@/hooks/useAuth';
import { UserMenu } from '@/components/UserMenu';
import { Button } from '@/components/ui/button';
import { OrderOfferCard } from '@/components/driver/OrderOfferCard';
import { ActiveDelivery } from '@/components/driver/ActiveDelivery';
import { DriverWallet } from '@/components/driver/DriverWallet';
import { DriverReferral } from '@/components/driver/DriverReferral';
import { DriverSupportButton } from '@/components/driver/DriverSupportButton';
import { useDriverOrders } from '@/hooks/useOrders';
import { useEarnings } from '@/hooks/useEarnings';
import AnnouncementsBanner from '@/components/AnnouncementsBanner';
import { supabase } from '@/integrations/supabase/client';
import DriverStaticMap from '@/components/driver/DriverStaticMap';

type DriverTab = 'dash' | 'wallet' | 'referral';

export default function DriverApp() {
  const { offers, activeDelivery, loading, acceptOrder, updateDeliveryStatus } = useDriverOrders();
  const [isOnline, setIsOnline] = useState(true);
  const [driverActive, setDriverActive] = useState<boolean | null>(null);
  const [activeTab, setActiveTab] = useState<DriverTab>('dash');
  const { user } = useAuth();
  const { today } = useEarnings();

  useEffect(() => {
    if (!user) return;
    supabase.from('driver_profiles').select('is_active').eq('user_id', user.id).maybeSingle()
      .then(({ data }) => {
        setDriverActive(data ? data.is_active : true);
      });
  }, [user]);

  const hasActiveDelivery = !!activeDelivery;
  const { tracking, error: locError } = useDriverLocation(isOnline);
  const [storeInfo, setStoreInfo] = useState<{ name: string; address: string; phone: string | null; latitude: number | null; longitude: number | null } | null>(null);
  const [customerInfo, setCustomerInfo] = useState<{ name: string; phone: string | null } | null>(null);
  const handleDecline = (_id: string) => {};

  useEffect(() => {
    if (!activeDelivery) {
      setStoreInfo(null);
      setCustomerInfo(null);
      return;
    }
    supabase.from('stores').select('name, address, phone, latitude, longitude').eq('id', activeDelivery.store_id).single()
      .then(({ data }) => {
        if (data) setStoreInfo({ name: data.name, address: data.address, phone: data.phone, latitude: data.latitude, longitude: data.longitude });
      });
    if (activeDelivery.customer_id) {
      supabase.from('profiles').select('full_name, phone').eq('user_id', activeDelivery.customer_id).single()
        .then(({ data }) => {
          if (data) setCustomerInfo({ name: data.full_name || 'Πελάτης', phone: data.phone });
        });
    }
  }, [activeDelivery?.id, activeDelivery?.store_id, activeDelivery?.customer_id]);

  // Pending approval state
  if (driverActive === false) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6">
        <div className="text-center max-w-sm space-y-4">
          <div className="h-20 w-20 rounded-full bg-destructive/10 flex items-center justify-center mx-auto">
            <Car className="h-10 w-10 text-destructive" />
          </div>
          <h1 className="font-heading text-2xl font-bold text-foreground">Αναμονή Έγκρισης</h1>
          <p className="text-muted-foreground text-sm">Ο λογαριασμός σας είναι σε αναμονή έγκρισης από τον διαχειριστή.</p>
          <Button variant="outline" onClick={() => window.location.reload()}>Έλεγχος κατάστασης</Button>
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
    { key: 'dash', icon: MapPin, label: 'Αρχική' },
    { key: 'wallet', icon: Wallet, label: 'Κέρδη' },
    { key: 'referral', icon: Users, label: 'Πρόσκληση' },
  ];

  return (
    <div className="dd-driver-app h-screen flex flex-col bg-background">
      {/* ─── TOP BAR (DoorDash-style) ─── */}
      <header className="bg-primary text-primary-foreground px-4 py-3 flex items-center justify-between safe-area-top z-30">
        <UserMenu />
        <div className="flex items-center gap-2">
          <span className="font-heading font-bold text-base">QuickGrid</span>
        </div>
        <button
          onClick={() => setIsOnline(!isOnline)}
          className={`px-4 py-1.5 rounded-full text-xs font-heading font-bold transition-all ${
            isOnline
              ? 'bg-primary-foreground text-primary'
              : 'bg-primary-foreground/20 text-primary-foreground/70'
          }`}
        >
          {isOnline ? 'Online' : 'Offline'}
        </button>
      </header>

      {/* ─── MAIN CONTENT ─── */}
      <div className="flex-1 overflow-y-auto pb-20">
        {activeTab === 'dash' && (
          <div>
            {/* Map section */}
            <div className="relative h-48">
              <DriverStaticMap
                className="absolute inset-0"
                liveMode={hasActiveDelivery}
                storeLat={storeInfo?.latitude}
                storeLng={storeInfo?.longitude}
                storeName={storeInfo?.name}
                customerLat={activeDelivery?.delivery_latitude}
                customerLng={activeDelivery?.delivery_longitude}
                customerName={customerInfo?.name}
                customerAddress={activeDelivery?.delivery_address}
              />
              {/* Earnings overlay on map */}
              <div className="absolute bottom-3 left-3 right-3 bg-card/95 backdrop-blur-sm rounded-2xl p-4 shadow-lg border border-border">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-muted-foreground font-heading uppercase tracking-wide">Σημερινά Κέρδη</p>
                    <p className="font-heading font-extrabold text-3xl text-foreground">{today.total.toFixed(2)}€</p>
                  </div>
                  <div className="flex gap-3">
                    <div className="text-center">
                      <p className="text-xs text-muted-foreground">Διαδρομές</p>
                      <p className="font-heading font-bold text-lg text-foreground">{today.trips}</p>
                    </div>
                    <div className="text-center">
                      <p className="text-xs text-muted-foreground">Tips</p>
                      <p className="font-heading font-bold text-lg text-primary">{today.tips.toFixed(2)}€</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <AnnouncementsBanner audience="drivers" />

            {/* Content below map */}
            <div className="px-4 py-3 space-y-3">
              {/* Active delivery — always on top if exists */}
              {activeDelivery && (
                <>
                  {tracking && (
                    <div className="flex items-center gap-2 p-3 rounded-xl bg-primary/5 border border-primary/15">
                      <Navigation className="h-4 w-4 text-primary animate-pulse" />
                      <span className="text-xs font-heading font-medium text-primary">Ζωντανή τοποθεσία κοινοποιείται</span>
                    </div>
                  )}
                  {locError && (
                    <div className="flex items-center gap-2 p-3 rounded-xl bg-destructive/5 border border-destructive/15">
                      <Navigation className="h-4 w-4 text-destructive" />
                      <span className="text-xs font-heading text-destructive">GPS: {locError}</span>
                    </div>
                  )}
                  <ActiveDelivery
                    delivery={{
                      id: activeDelivery.id,
                      storeName: storeInfo?.name || 'Σημείο Παραλαβής',
                      storeAddress: storeInfo?.address || 'Διεύθυνση καταστήματος',
                      storePhone: storeInfo?.phone || null,
                      storeLat: storeInfo?.latitude ?? null,
                      storeLng: storeInfo?.longitude ?? null,
                      deliveryAddress: activeDelivery.delivery_address || 'Διεύθυνση πελάτη',
                      deliveryLat: activeDelivery.delivery_latitude ?? null,
                      deliveryLng: activeDelivery.delivery_longitude ?? null,
                      customerName: customerInfo?.name || 'Πελάτης',
                      customerPhone: customerInfo?.phone || null,
                      status: activeDelivery.status ?? 'accepted',
                      items: activeDelivery.order_items?.map(i => ({ name: i.name, quantity: i.quantity })) ?? [],
                      estimatedPayout: Number(activeDelivery.delivery_fee ?? 0) + Number(activeDelivery.tip_amount ?? 0),
                      pickupChecklist: ['Όλα τα προϊόντα επιβεβαιωμένα', 'Ποτά συμπεριλαμβάνονται', 'Μαχαιροπίρουνα προστέθηκαν'],
                    }}
                    onStatusUpdate={(status) => updateDeliveryStatus(activeDelivery.id, status)}
                  />
                </>
              )}

              {/* Offers section */}
              {!activeDelivery && (
                <>
                  {!isOnline ? (
                    <div className="text-center py-12">
                      <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center mx-auto mb-4">
                        <Radio className="h-7 w-7 text-muted-foreground" />
                      </div>
                      <p className="font-heading font-bold text-foreground text-lg">Εκτός Σύνδεσης</p>
                      <p className="text-sm text-muted-foreground mt-1 max-w-[260px] mx-auto">
                        Πατήστε <strong>Online</strong> για να λαμβάνετε παραγγελίες
                      </p>
                    </div>
                  ) : loading ? (
                    <div className="text-center py-12">
                      <div className="h-10 w-10 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4" />
                      <p className="text-muted-foreground font-heading text-sm">Αναζήτηση παραγγελιών...</p>
                    </div>
                  ) : offers.length === 0 ? (
                    <div className="text-center py-12">
                      <div className="h-20 w-20 rounded-full bg-primary/5 flex items-center justify-center mx-auto mb-4 border-2 border-dashed border-primary/20">
                        <Zap className="h-9 w-9 text-primary" />
                      </div>
                      <h2 className="font-heading font-bold text-lg text-foreground">Αναμονή Παραγγελιών</h2>
                      <p className="text-sm text-muted-foreground mt-1.5 max-w-[260px] mx-auto">
                        Θα ειδοποιηθείτε αμέσως μόλις εμφανιστεί νέα παραγγελία
                      </p>
                      <div className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/5 border border-primary/10">
                        <span className="h-2 w-2 rounded-full bg-primary animate-pulse" />
                        <span className="text-xs font-heading font-medium text-primary">Live</span>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <h3 className="font-heading font-bold text-foreground">Διαθέσιμες Παραγγελίες</h3>
                        <span className="bg-primary text-primary-foreground text-xs font-bold px-2.5 py-1 rounded-full">{offers.length}</span>
                      </div>
                      {offers.map(offer => (
                        <OrderOfferCard
                          key={offer.id}
                          offer={{
                            id: offer.id,
                            storeName: 'Παραλαβή',
                            storeAddress: offer.delivery_address || 'Τοποθεσία καταστήματος',
                            deliveryAddress: offer.delivery_address || 'Τοποθεσία πελάτη',
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

      {/* ─── BOTTOM NAVIGATION (DoorDash-style) ─── */}
      <nav className="fixed bottom-0 inset-x-0 z-30 bg-card border-t border-border safe-area-bottom">
        <div className="flex">
          {bottomTabs.map(tab => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.key;
            return (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`flex-1 flex flex-col items-center gap-0.5 py-2.5 transition-colors relative ${
                  isActive ? 'text-primary' : 'text-muted-foreground'
                }`}
              >
                {isActive && <div className="absolute top-0 left-1/4 right-1/4 h-0.5 bg-primary rounded-full" />}
                <Icon className="h-5 w-5" />
                <span className="text-[10px] font-heading font-semibold">{tab.label}</span>
                {tab.key === 'dash' && offers.length > 0 && !activeDelivery && (
                  <span className="absolute top-1.5 right-1/4 h-2 w-2 rounded-full bg-primary" />
                )}
              </button>
            );
          })}
        </div>
      </nav>

      {/* Floating Support */}
      <DriverSupportButton orderId={activeDelivery?.id} />
    </div>
  );
}
