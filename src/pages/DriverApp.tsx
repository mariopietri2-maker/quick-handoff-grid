import { useState, useEffect } from 'react';
import { Car, DollarSign, Radio, Bell, Navigation, Menu } from 'lucide-react';
import { useDriverLocation } from '@/hooks/useDriverLocation';
import { useAuth } from '@/hooks/useAuth';
import { UserMenu } from '@/components/UserMenu';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { OrderOfferCard } from '@/components/driver/OrderOfferCard';
import { ActiveDelivery } from '@/components/driver/ActiveDelivery';
import { EarningsDashboard } from '@/components/driver/EarningsDashboard';
import { Badge } from '@/components/ui/badge';
import { useDriverOrders } from '@/hooks/useOrders';
import { requestNotificationPermission } from '@/lib/notifications';
import AnnouncementsBanner from '@/components/AnnouncementsBanner';
import { supabase } from '@/integrations/supabase/client';
import DriverStaticMap from '@/components/driver/DriverStaticMap';

export default function DriverApp() {
  const { offers, activeDelivery, loading, acceptOrder, updateDeliveryStatus } = useDriverOrders();
  const [isOnline, setIsOnline] = useState(true);
  const [driverActive, setDriverActive] = useState<boolean | null>(null);
  const { user } = useAuth();

  // Check if driver is approved (is_active)
  useEffect(() => {
    if (!user) return;
    supabase.from('driver_profiles').select('is_active').eq('user_id', user.id).maybeSingle()
      .then(({ data }) => {
        setDriverActive(data?.is_active ?? null);
      });
  }, [user]);
  const hasActiveDelivery = !!activeDelivery;
  const { tracking, error: locError } = useDriverLocation(isOnline && hasActiveDelivery);
  const [storeInfo, setStoreInfo] = useState<{ name: string; address: string; phone: string | null; latitude: number | null; longitude: number | null } | null>(null);
  const [customerInfo, setCustomerInfo] = useState<{ name: string; phone: string | null } | null>(null);
  const [notifPermission, setNotifPermission] = useState<NotificationPermission>(
    typeof window !== 'undefined' && 'Notification' in window ? Notification.permission : 'denied'
  );

  const handleEnableNotifications = async () => {
    const granted = await requestNotificationPermission();
    setNotifPermission(granted ? 'granted' : 'denied');
  };

  const handleDecline = (_id: string) => {};

  // Fetch store & customer info for active delivery
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

  return (
    <div className="h-screen flex flex-col relative overflow-hidden bg-background">
      {/* Full-screen map background */}
      <DriverStaticMap
        className="absolute inset-0 z-0"
        liveMode={hasActiveDelivery}
        storeLat={storeInfo?.latitude}
        storeLng={storeInfo?.longitude}
        storeName={storeInfo?.name}
        customerLat={activeDelivery?.delivery_latitude}
        customerLng={activeDelivery?.delivery_longitude}
        customerName={customerInfo?.name}
      />

      {/* Top bar overlay */}
      <header className="relative z-20 px-4 pt-3 pb-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <UserMenu />
        </div>
        <div className="bg-card/90 backdrop-blur-md rounded-full px-4 py-2 flex items-center gap-2 shadow-lg border border-border">
          <span className="text-xs text-muted-foreground font-heading">Κατάσταση</span>
          <button
            onClick={() => setIsOnline(!isOnline)}
            className={`px-3 py-1 rounded-full text-sm font-heading font-bold transition-all ${
              isOnline 
                ? 'bg-foreground text-background' 
                : 'bg-muted text-muted-foreground'
            }`}
          >
            {isOnline ? '● Σε σύνδεση' : '○ Εκτός σύνδεσης'}
          </button>
        </div>
        <div className="flex items-center gap-2">
          <button className="h-10 w-10 rounded-full bg-card/90 backdrop-blur-md border border-border shadow-lg flex items-center justify-center">
            <Bell className="h-5 w-5 text-foreground" />
          </button>
        </div>
      </header>

      {/* Bottom sheet */}
      <div className="relative z-10 mt-auto bg-card rounded-t-3xl shadow-[0_-4px_30px_rgba(0,0,0,0.12)] border-t border-border flex flex-col max-h-[65vh] overflow-hidden">
        {/* Drag handle */}
        <div className="flex justify-center pt-3 pb-2">
          <div className="w-10 h-1 rounded-full bg-muted-foreground/30" />
        </div>

        <div className="flex-1 overflow-y-auto px-4 pb-6">
          {notifPermission === 'default' && (
            <div className="mb-4 flex items-center gap-3 p-3 rounded-xl bg-info/10 border border-info/20">
              <Bell className="h-5 w-5 text-info flex-shrink-0" />
              <div className="flex-1">
                <p className="text-sm font-heading font-semibold text-foreground">Ενεργοποίηση ειδοποιήσεων</p>
                <p className="text-xs text-muted-foreground">Λάβετε ειδοποιήσεις όταν υπάρχουν νέες παραδόσεις</p>
              </div>
              <Button size="sm" onClick={handleEnableNotifications} className="gradient-primary text-primary-foreground font-heading">
                Ενεργοποίηση
              </Button>
            </div>
          )}

          <AnnouncementsBanner audience="drivers" />

          <Tabs defaultValue="offers">
            <TabsList className="w-full mb-4">
              <TabsTrigger value="offers" className="flex-1 font-heading relative">
                <Radio className="h-4 w-4 mr-1.5" />
                Προσφορές
                {offers.length > 0 && (
                  <Badge className="ml-1.5 h-5 w-5 p-0 flex items-center justify-center gradient-primary text-primary-foreground text-xs">
                    {offers.length}
                  </Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="active" className="flex-1 font-heading">
                <Car className="h-4 w-4 mr-1.5" />
                Ενεργή
                {activeDelivery && <span className="ml-1 h-2 w-2 rounded-full bg-success inline-block" />}
              </TabsTrigger>
              <TabsTrigger value="earnings" className="flex-1 font-heading">
                <DollarSign className="h-4 w-4 mr-1.5" />
                Κέρδη
              </TabsTrigger>
            </TabsList>

            <TabsContent value="offers" className="space-y-4">
              {!isOnline ? (
                <div className="text-center py-12">
                  <p className="text-muted-foreground font-heading">Είστε εκτός σύνδεσης</p>
                  <p className="text-sm text-muted-foreground mt-1">Συνδεθείτε για να λαμβάνετε προσφορές παράδοσης</p>
                </div>
              ) : loading ? (
                <div className="text-center py-12">
                  <div className="h-8 w-8 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-3" />
                  <p className="text-muted-foreground font-heading">Φόρτωση προσφορών...</p>
                </div>
              ) : offers.length === 0 ? (
                <div className="text-center py-12">
                  <h2 className="font-heading font-bold text-xl text-foreground mb-2">Είμαι Διαθέσιμος</h2>
                  <p className="text-sm text-muted-foreground">
                    Αναμονή για νέες προσφορές παράδοσης. Θα ειδοποιηθείτε όταν έρθει κάποια.
                  </p>
                  <div className="mt-4 flex items-center justify-center gap-2 text-sm text-success">
                    <span className="h-2 w-2 rounded-full bg-success animate-pulse" />
                    Ακρόαση...
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
                      totalDistance: 0,
                      estimatedTime: offer.estimated_prep_time ?? 20,
                      itemCount: offer.order_items?.length ?? 0,
                    }}
                    onAccept={acceptOrder}
                    onDecline={handleDecline}
                  />
                ))
              )}
            </TabsContent>

            <TabsContent value="active">
              {activeDelivery ? (
                <>
                  {tracking && (
                    <div className="mb-3 flex items-center gap-2 p-2.5 rounded-lg bg-success/10 border border-success/20">
                      <Navigation className="h-4 w-4 text-success animate-pulse" />
                      <span className="text-xs font-heading text-success">Κοινοποίηση ζωντανής τοποθεσίας στον πελάτη</span>
                    </div>
                  )}
                  {locError && (
                    <div className="mb-3 flex items-center gap-2 p-2.5 rounded-lg bg-warning/10 border border-warning/20">
                      <Navigation className="h-4 w-4 text-warning" />
                      <span className="text-xs font-heading text-warning">GPS μη διαθέσιμο: {locError}</span>
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
                <div className="text-center py-12">
                  <Car className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <p className="font-heading text-foreground">Καμία ενεργή παράδοση</p>
                  <p className="text-sm text-muted-foreground mt-1">Αποδεχτείτε μια προσφορά για να ξεκινήσετε</p>
                </div>
              )}
            </TabsContent>

            <TabsContent value="earnings">
              <EarningsDashboard />
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}
