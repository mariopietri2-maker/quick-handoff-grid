import { useState, useEffect } from 'react';
import { Car, Radio, Navigation, Wallet, Users, Zap } from 'lucide-react';
import { useDriverLocation } from '@/hooks/useDriverLocation';
import { useAuth } from '@/hooks/useAuth';
import { UserMenu } from '@/components/UserMenu';
import { Button } from '@/components/ui/button';
import { OrderOfferCard } from '@/components/driver/OrderOfferCard';
import { ActiveDelivery } from '@/components/driver/ActiveDelivery';
import { DriverWallet } from '@/components/driver/DriverWallet';
import { DriverReferral } from '@/components/driver/DriverReferral';
import { DriverSupportButton } from '@/components/driver/DriverSupportButton';
import { Badge } from '@/components/ui/badge';
import { useDriverOrders } from '@/hooks/useOrders';
import AnnouncementsBanner from '@/components/AnnouncementsBanner';
import { supabase } from '@/integrations/supabase/client';
import DriverStaticMap from '@/components/driver/DriverStaticMap';

type DriverTab = 'offers' | 'active' | 'wallet' | 'referral';

export default function DriverApp() {
  const { offers, activeDelivery, loading, acceptOrder, updateDeliveryStatus } = useDriverOrders();
  const [isOnline, setIsOnline] = useState(true);
  const [driverActive, setDriverActive] = useState<boolean | null>(null);
  const [activeTab, setActiveTab] = useState<DriverTab>('offers');
  const { user } = useAuth();

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

  if (driverActive === false) {
    return (
      <div className="min-h-screen bg-[hsl(225,25%,8%)] flex items-center justify-center p-4">
        <div className="text-center max-w-md space-y-4">
          <div className="h-20 w-20 rounded-2xl bg-warning/10 flex items-center justify-center mx-auto border border-warning/20">
            <Car className="h-10 w-10 text-warning" />
          </div>
          <h1 className="font-heading text-2xl font-bold text-[hsl(220,14%,96%)]">Αναμονή Έγκρισης</h1>
          <p className="text-[hsl(220,10%,55%)]">
            Ο λογαριασμός σας είναι σε αναμονή έγκρισης από τον διαχειριστή.
          </p>
          <Button variant="outline" onClick={() => window.location.reload()} className="border-[hsl(225,15%,25%)] text-[hsl(220,14%,96%)] hover:bg-[hsl(225,20%,16%)]">
            Έλεγχος κατάστασης
          </Button>
        </div>
      </div>
    );
  }

  if (driverActive === null && !loading) {
    return (
      <div className="min-h-screen bg-[hsl(225,25%,8%)] flex items-center justify-center">
        <div className="h-8 w-8 border-4 border-[hsl(145,65%,42%)] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const tabs: { key: DriverTab; icon: React.ElementType; label: string; badge?: number | boolean }[] = [
    { key: 'offers', icon: Radio, label: 'Προσφορές', badge: offers.length > 0 ? offers.length : undefined },
    { key: 'active', icon: Zap, label: 'Ενεργή', badge: !!activeDelivery },
    { key: 'wallet', icon: Wallet, label: 'Πορτοφόλι' },
    { key: 'referral', icon: Users, label: 'Πρόσκληση' },
  ];

  return (
    <div className="driver-shell h-screen flex flex-col relative overflow-hidden bg-[hsl(var(--driver-bg))]">
      {/* Full-screen map */}
      <DriverStaticMap
        className="absolute inset-0 z-0"
        liveMode={hasActiveDelivery}
        storeLat={storeInfo?.latitude}
        storeLng={storeInfo?.longitude}
        storeName={storeInfo?.name}
        customerLat={activeDelivery?.delivery_latitude}
        customerLng={activeDelivery?.delivery_longitude}
        customerName={customerInfo?.name}
        customerAddress={activeDelivery?.delivery_address}
      />

      {/* Premium glass header */}
      <header className="relative z-20 px-4 pt-3 pb-2 flex items-center">
        <div className="flex items-center">
          <UserMenu />
        </div>
        <div className="flex-1 flex justify-center">
          <button
            onClick={() => setIsOnline(!isOnline)}
            className={`driver-glass rounded-full px-5 py-2.5 flex items-center gap-2.5 transition-all duration-300 ${
              isOnline ? 'driver-glow-green' : ''
            }`}
          >
            <span className={`h-2.5 w-2.5 rounded-full transition-colors ${
              isOnline ? 'bg-[hsl(145,65%,42%)] animate-pulse' : 'bg-[hsl(220,10%,40%)]'
            }`} />
            <span className={`text-sm font-heading font-semibold ${
              isOnline ? 'text-[hsl(145,65%,70%)]' : 'text-[hsl(220,10%,55%)]'
            }`}>
              {isOnline ? 'Online' : 'Offline'}
            </span>
          </button>
        </div>
        <div className="w-10" /> {/* Spacer for centering */}
      </header>

      {/* Bottom sheet with premium dark glass */}
      <div className="relative z-10 mt-auto driver-gradient-surface rounded-t-[28px] border-t border-[hsl(225,15%,22%)] flex flex-col max-h-[65vh] overflow-hidden"
        style={{ boxShadow: '0 -8px 40px hsl(225 25% 5% / 0.5)' }}
      >
        {/* Drag handle */}
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-9 h-1 rounded-full bg-[hsl(225,15%,30%)]" />
        </div>

        {/* Tab bar */}
        <div className="flex px-3 pb-3 gap-1">
          {tabs.map(tab => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.key;
            return (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`flex-1 flex flex-col items-center gap-1 py-2.5 rounded-xl transition-all duration-200 relative ${
                  isActive
                    ? 'bg-[hsl(225,18%,18%)] text-[hsl(145,65%,60%)]'
                    : 'text-[hsl(220,10%,45%)] hover:text-[hsl(220,10%,65%)]'
                }`}
              >
                <div className="relative">
                  <Icon className="h-4 w-4" />
                  {typeof tab.badge === 'number' && tab.badge > 0 && (
                    <span className="absolute -top-1.5 -right-2.5 h-4 min-w-[16px] px-1 rounded-full bg-primary text-primary-foreground text-[9px] font-bold flex items-center justify-center">
                      {tab.badge}
                    </span>
                  )}
                  {tab.badge === true && (
                    <span className="absolute -top-0.5 -right-1 h-2 w-2 rounded-full bg-[hsl(145,65%,42%)]" />
                  )}
                </div>
                <span className="text-[10px] font-heading font-medium">{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Content area */}
        <div className="flex-1 overflow-y-auto px-4 pb-8">
          <AnnouncementsBanner audience="drivers" />

          {/* OFFERS TAB */}
          {activeTab === 'offers' && (
            <div className="space-y-4">
              {!isOnline ? (
                <div className="text-center py-16">
                  <div className="h-16 w-16 rounded-2xl bg-[hsl(225,18%,16%)] flex items-center justify-center mx-auto mb-4 border border-[hsl(225,15%,22%)]">
                    <Radio className="h-7 w-7 text-[hsl(220,10%,40%)]" />
                  </div>
                  <p className="font-heading font-semibold text-[hsl(220,14%,96%)]">Εκτός Σύνδεσης</p>
                  <p className="text-sm text-[hsl(220,10%,45%)] mt-1 max-w-[240px] mx-auto">
                    Ενεργοποιήστε τη σύνδεση για να λαμβάνετε παραγγελίες
                  </p>
                </div>
              ) : loading ? (
                <div className="text-center py-16">
                  <div className="h-10 w-10 border-3 border-[hsl(145,65%,42%)] border-t-transparent rounded-full animate-spin mx-auto mb-4" />
                  <p className="text-[hsl(220,10%,55%)] font-heading text-sm">Αναζήτηση προσφορών...</p>
                </div>
              ) : offers.length === 0 ? (
                <div className="text-center py-16">
                  <div className="h-20 w-20 rounded-full bg-[hsl(145,65%,42%)/0.08] flex items-center justify-center mx-auto mb-4 border border-[hsl(145,65%,42%)/0.15]">
                    <Zap className="h-8 w-8 text-[hsl(145,65%,50%)]" />
                  </div>
                  <h2 className="font-heading font-bold text-lg text-[hsl(220,14%,96%)]">Έτοιμος για Παραγγελίες</h2>
                  <p className="text-sm text-[hsl(220,10%,45%)] mt-1.5 max-w-[260px] mx-auto">
                    Θα ειδοποιηθείτε αμέσως μόλις εμφανιστεί νέα παραγγελία
                  </p>
                  <div className="mt-5 inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[hsl(145,65%,42%)/0.08] border border-[hsl(145,65%,42%)/0.15]">
                    <span className="h-2 w-2 rounded-full bg-[hsl(145,65%,42%)] animate-pulse" />
                    <span className="text-xs font-heading font-medium text-[hsl(145,65%,60%)]">Live • Ακρόαση</span>
                  </div>
                </div>
              ) : (
                offers.map(offer => (
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
                ))
              )}
            </div>
          )}

          {/* ACTIVE TAB */}
          {activeTab === 'active' && (
            <div>
              {activeDelivery ? (
                <>
                  {tracking && (
                    <div className="mb-3 flex items-center gap-2 p-2.5 rounded-xl bg-[hsl(145,65%,42%)/0.08] border border-[hsl(145,65%,42%)/0.15]">
                      <Navigation className="h-4 w-4 text-[hsl(145,65%,50%)] animate-pulse" />
                      <span className="text-xs font-heading font-medium text-[hsl(145,65%,60%)]">Ζωντανή τοποθεσία κοινοποιείται</span>
                    </div>
                  )}
                  {locError && (
                    <div className="mb-3 flex items-center gap-2 p-2.5 rounded-xl bg-warning/8 border border-warning/15">
                      <Navigation className="h-4 w-4 text-warning" />
                      <span className="text-xs font-heading text-warning">GPS: {locError}</span>
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
                      items: activeDelivery.order_items?.map(i => ({
                        name: i.name,
                        quantity: i.quantity,
                      })) ?? [],
                      estimatedPayout: Number(activeDelivery.delivery_fee ?? 0) + Number(activeDelivery.tip_amount ?? 0),
                      pickupChecklist: ['Όλα τα προϊόντα επιβεβαιωμένα', 'Ποτά συμπεριλαμβάνονται', 'Μαχαιροπίρουνα προστέθηκαν'],
                    }}
                    onStatusUpdate={(status) => updateDeliveryStatus(activeDelivery.id, status)}
                  />
                </>
              ) : (
                <div className="text-center py-16">
                  <div className="h-16 w-16 rounded-2xl bg-[hsl(225,18%,16%)] flex items-center justify-center mx-auto mb-4 border border-[hsl(225,15%,22%)]">
                    <Car className="h-7 w-7 text-[hsl(220,10%,40%)]" />
                  </div>
                  <p className="font-heading font-semibold text-[hsl(220,14%,96%)]">Καμία Ενεργή Παράδοση</p>
                  <p className="text-sm text-[hsl(220,10%,45%)] mt-1">Αποδεχτείτε μια παραγγελία για να ξεκινήσετε</p>
                </div>
              )}
            </div>
          )}

          {/* WALLET TAB */}
          {activeTab === 'wallet' && <DriverWallet />}

          {/* REFERRAL TAB */}
          {activeTab === 'referral' && <DriverReferral />}
        </div>
      </div>

      {/* Floating Support */}
      <DriverSupportButton orderId={activeDelivery?.id} />
    </div>
  );
}
