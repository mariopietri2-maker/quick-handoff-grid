import { useState } from 'react';
import { Menu, ChevronRight, Wallet, BarChart3, Users, Settings, Headphones, Info, MapPin, ChevronLeft, ArrowRight } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useEarnings } from '@/hooks/useEarnings';
import { useDriverOrders } from '@/hooks/useOrders';
import { ActiveDelivery } from './ActiveDelivery';
import { EarningsDashboard } from './EarningsDashboard';
import { DriverWallet } from './DriverWallet';
import { DriverReferral } from './DriverReferral';
import { DriverSupportButton } from './DriverSupportButton';
import { OrderOfferCard } from './OrderOfferCard';
import DriverMapbox, { type RouteInfo } from './DriverMapbox';
import { NavigationPanel } from './NavigationPanel';
import AnnouncementsBanner from '@/components/AnnouncementsBanner';
import { useDriverLocation } from '@/hooks/useDriverLocation';
import { supabase } from '@/integrations/supabase/client';
import { useEffect } from 'react';

type ClassicView = 'home' | 'earnings' | 'wallet' | 'referrals' | 'support';

interface StoreInfo { name: string; address: string; phone: string | null; latitude: number | null; longitude: number | null; }
interface CustomerInfo { name: string; phone: string | null; }

export default function DriverClassicLayout() {
  const { user } = useAuth();
  const { today } = useEarnings();
  const { offers, activeDelivery, loading, acceptOrder, updateDeliveryStatus } = useDriverOrders();
  const [isOnline, setIsOnline] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [currentView, setCurrentView] = useState<ClassicView>('home');
  const { tracking, error: locError } = useDriverLocation(isOnline);
  const [storeInfo, setStoreInfo] = useState<StoreInfo | null>(null);
  const [customerInfo, setCustomerInfo] = useState<CustomerInfo | null>(null);
  const [routeInfo, setRouteInfo] = useState<RouteInfo | null>(null);
  const handleDecline = (_id: string) => {};

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

  const navigate = (view: ClassicView) => {
    setCurrentView(view);
    setSidebarOpen(false);
  };

  const menuItems = [
    { key: 'earnings' as const, icon: BarChart3, label: 'Αριθμοδείκτες' },
    { key: 'wallet' as const, icon: Wallet, label: 'Οικονομικά' },
    { key: 'referrals' as const, icon: Users, label: 'Συστάσεις' },
    { key: 'support' as const, icon: Headphones, label: 'Υποστήριξη' },
  ];

  // Subview with back button
  if (currentView !== 'home') {
    return (
      <div className="min-h-screen bg-white">
        <header className="sticky top-0 z-30 bg-white border-b border-gray-100 px-4 py-3">
          <button onClick={() => setCurrentView('home')} className="flex items-center gap-2 text-gray-800">
            <ChevronLeft className="h-5 w-5" />
          </button>
        </header>
        <div className="p-4">
          {currentView === 'earnings' && (
            <div>
              <h1 className="font-heading font-extrabold text-2xl text-gray-900 mb-6">Τα στατιστικά σου</h1>
              <EarningsDashboard />
            </div>
          )}
          {currentView === 'wallet' && (
            <div>
              <h1 className="font-heading font-extrabold text-2xl text-gray-900 mb-6">Οικονομικά</h1>
              <DriverWallet />
            </div>
          )}
          {currentView === 'referrals' && (
            <div>
              <h1 className="font-heading font-extrabold text-2xl text-gray-900 mb-6">Συστάσεις</h1>
              <DriverReferral />
            </div>
          )}
          {currentView === 'support' && (
            <div>
              <h1 className="font-heading font-extrabold text-2xl text-gray-900 mb-6">Υποστήριξη</h1>
              <p className="text-gray-500">Γεια σου 👋</p>
              <p className="font-heading font-bold text-xl text-gray-900 mt-1">Πως μπορούμε να σε βοηθήσουμε? 🙏</p>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-white relative">
      {/* Sidebar overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-50">
          <div className="absolute inset-0 bg-black/30" onClick={() => setSidebarOpen(false)} />
          <div className="relative w-[280px] h-full bg-white shadow-xl z-10 flex flex-col">
            {/* User info */}
            <div className="px-5 pt-8 pb-4 border-b border-gray-100">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-gray-200 flex items-center justify-center">
                  <span className="text-sm font-bold text-gray-600">{user?.email?.[0]?.toUpperCase() ?? 'D'}</span>
                </div>
                <div>
                  <p className="font-heading font-bold text-gray-900 text-sm">{user?.email?.split('@')[0] ?? 'Driver'}</p>
                  <p className="text-xs text-gray-400">{isOnline ? 'Συνδεδεμένος' : 'Αποσυνδεδεμένος'}</p>
                </div>
              </div>
            </div>

            {/* Menu items */}
            <nav className="flex-1 py-3">
              {menuItems.map(item => (
                <button
                  key={item.key}
                  onClick={() => navigate(item.key)}
                  className="w-full flex items-center gap-3 px-5 py-3.5 text-left hover:bg-gray-50 transition-colors"
                >
                  <item.icon className="h-5 w-5 text-gray-500" />
                  <span className="font-heading font-medium text-gray-800 text-[15px]">{item.label}</span>
                </button>
              ))}
            </nav>

            {/* Version */}
            <div className="px-5 py-4 border-t border-gray-100">
              <p className="text-[11px] text-gray-300">QuickGrid v1.0.0</p>
            </div>
          </div>
        </div>
      )}

      {/* Map area */}
      <div className="relative flex-1">
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

        {/* Top controls */}
        <div className="absolute top-4 left-4 right-4 z-20 flex items-center justify-between">
          <button
            onClick={() => setSidebarOpen(true)}
            className="h-11 w-11 rounded-full bg-white shadow-md flex items-center justify-center"
          >
            <Menu className="h-5 w-5 text-gray-700" />
          </button>

          <div className="flex items-center gap-2">
            <button className="h-11 w-11 rounded-full bg-white shadow-md flex items-center justify-center">
              <MapPin className="h-5 w-5 text-gray-700" />
            </button>
          </div>
        </div>
      </div>

      {/* Bottom sheet */}
      <div className="bg-white rounded-t-3xl shadow-[0_-4px_20px_rgba(0,0,0,0.08)] relative z-20 -mt-6">
        <div className="w-10 h-1 rounded-full bg-gray-200 mx-auto mt-3 mb-4" />

        <div className="px-5 pb-6">
          {/* City name & status */}
          <h2 className="font-heading font-extrabold text-2xl text-gray-900">QuickGrid</h2>

          <div className="flex items-center gap-2 mt-2">
            <span className="text-sm text-gray-500">Όγκος εργασίας</span>
            <div className="flex gap-0.5">
              <div className={`w-1 h-3 rounded-full ${isOnline ? 'bg-teal-500' : 'bg-gray-300'}`} />
              <div className={`w-1 h-3 rounded-full ${isOnline ? 'bg-teal-500' : 'bg-gray-300'}`} />
              <div className="w-1 h-3 rounded-full bg-gray-300" />
            </div>
            <span className="text-sm text-gray-500">{offers.length > 0 ? 'Υψηλός' : 'Χαμηλός'}</span>
          </div>

          {/* Today's earnings summary */}
          <div className="flex items-center gap-3 mt-4 p-3 bg-gray-50 rounded-2xl">
            <div className="h-10 w-10 rounded-full bg-teal-50 flex items-center justify-center">
              <Wallet className="h-5 w-5 text-teal-600" />
            </div>
            <div className="flex-1">
              <p className="text-xs text-gray-500">Σημερινά Κέρδη</p>
              <p className="font-heading font-bold text-lg text-gray-900">{today.total.toFixed(2)}€</p>
            </div>
            <div className="text-right">
              <p className="text-xs text-gray-400">{today.trips} διαδρομές</p>
              <p className="text-xs text-teal-600 font-medium">+{today.tips.toFixed(2)}€ tips</p>
            </div>
          </div>

          <AnnouncementsBanner audience="drivers" />

          {/* Navigation Panel */}
          {routeInfo && navigatingTo && (
            <div className="mt-3">
              <NavigationPanel
                route={routeInfo}
                destination={navigatingTo === 'store' ? (storeInfo?.name || 'Κατάστημα') : (customerInfo?.name || 'Πελάτης')}
                destinationType={navigatingTo}
              />
            </div>
          )}

          {/* Active delivery */}
          {activeDelivery && (
            <div className="mt-4">
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
            </div>
          )}

          {/* Offers or empty state */}
          {!activeDelivery && (
            <div className="mt-4">
              {!isOnline ? (
                <div className="text-center py-8">
                  <p className="font-heading font-bold text-gray-900">Εκτός σύνδεσης</p>
                  <p className="text-sm text-gray-400 mt-1">Πάτησε "Συνδέσου" για να λαμβάνεις παραγγελίες</p>
                </div>
              ) : offers.length === 0 ? (
                <div className="text-center py-6">
                  <p className="text-sm text-gray-400">Μέγιστες αποδοχές αυτήν την ώρα</p>
                </div>
              ) : (
                <div className="space-y-3">
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
            </div>
          )}

          {/* Connect button */}
          <button
            onClick={() => setIsOnline(!isOnline)}
            className={`w-full mt-5 py-4 rounded-full font-heading font-bold text-base transition-all ${
              isOnline
                ? 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                : 'bg-teal-500 text-white hover:bg-teal-600 shadow-lg'
            }`}
          >
            <span className="flex items-center justify-center gap-2">
              {isOnline ? (
                <>Αποσυνδέσου</>
              ) : (
                <>
                  <ArrowRight className="h-5 w-5" />
                  Συνδέσου
                </>
              )}
            </span>
          </button>
        </div>
      </div>

      <DriverSupportButton orderId={activeDelivery?.id} />
    </div>
  );
}
