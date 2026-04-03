import { useState } from 'react';
import { Car, DollarSign, Radio, Bell } from 'lucide-react';
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

export default function DriverApp() {
  const { offers, activeDelivery, loading, acceptOrder, updateDeliveryStatus } = useDriverOrders();
  const [isOnline, setIsOnline] = useState(true);
  const [notifPermission, setNotifPermission] = useState<NotificationPermission>(
    typeof window !== 'undefined' && 'Notification' in window ? Notification.permission : 'denied'
  );

  const handleEnableNotifications = async () => {
    const granted = await requestNotificationPermission();
    setNotifPermission(granted ? 'granted' : 'denied');
  };

  const handleDecline = (_id: string) => {
    // In production, this would mark the offer as declined for this driver
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="gradient-dark text-primary-foreground px-4 py-3 flex items-center justify-between sticky top-0 z-50">
        <div className="flex items-center gap-2">
          <Car className="h-6 w-6" />
          <h1 className="font-heading font-bold text-lg">DashDrive</h1>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsOnline(!isOnline)}
            className={`px-4 py-1.5 rounded-full text-sm font-heading font-semibold transition-all ${
              isOnline 
                ? 'gradient-success text-success-foreground' 
                : 'bg-muted/20 text-muted-foreground'
            }`}
          >
            {isOnline ? '● Online' : '○ Offline'}
          </button>
          <UserMenu />
        </div>
      </header>

      <div className="p-4 max-w-lg mx-auto">
        {notifPermission === 'default' && (
          <div className="mb-4 flex items-center gap-3 p-3 rounded-xl bg-info/10 border border-info/20">
            <Bell className="h-5 w-5 text-info flex-shrink-0" />
            <div className="flex-1">
              <p className="text-sm font-heading font-semibold text-foreground">Enable notifications</p>
              <p className="text-xs text-muted-foreground">Get alerts when new deliveries are available</p>
            </div>
            <Button size="sm" onClick={handleEnableNotifications} className="gradient-primary text-primary-foreground font-heading">
              Enable
            </Button>
          </div>
        )}
        <AnnouncementsBanner audience="drivers" />
        <Tabs defaultValue="offers">
          <TabsList className="w-full mb-4">
            <TabsTrigger value="offers" className="flex-1 font-heading relative">
              <Radio className="h-4 w-4 mr-1.5" />
              Offers
              {offers.length > 0 && (
                <Badge className="ml-1.5 h-5 w-5 p-0 flex items-center justify-center gradient-primary text-primary-foreground text-xs">
                  {offers.length}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="active" className="flex-1 font-heading">
              <Car className="h-4 w-4 mr-1.5" />
              Active
              {activeDelivery && <span className="ml-1 h-2 w-2 rounded-full bg-success inline-block" />}
            </TabsTrigger>
            <TabsTrigger value="earnings" className="flex-1 font-heading">
              <DollarSign className="h-4 w-4 mr-1.5" />
              Earnings
            </TabsTrigger>
          </TabsList>

          <TabsContent value="offers" className="space-y-4">
            {!isOnline ? (
              <div className="text-center py-16">
                <p className="text-muted-foreground font-heading">You're offline</p>
                <p className="text-sm text-muted-foreground mt-1">Go online to receive delivery offers</p>
              </div>
            ) : loading ? (
              <div className="text-center py-16">
                <div className="h-8 w-8 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-3" />
                <p className="text-muted-foreground font-heading">Loading offers...</p>
              </div>
            ) : offers.length === 0 ? (
              <div className="text-center py-16">
                <Radio className="h-12 w-12 text-muted-foreground mx-auto mb-4 animate-pulse" />
                <p className="font-heading text-foreground">Waiting for orders...</p>
                <p className="text-sm text-muted-foreground mt-1">New offers will appear here in real-time</p>
                <div className="mt-4 flex items-center justify-center gap-2 text-sm text-success">
                  <span className="h-2 w-2 rounded-full bg-success animate-pulse" />
                  Listening...
                </div>
              </div>
            ) : (
              offers.map(offer => (
                <OrderOfferCard
                  key={offer.id}
                  offer={{
                    id: offer.id,
                    storeName: 'Pickup',
                    storeAddress: offer.delivery_address || 'Store location',
                    deliveryAddress: offer.delivery_address || 'Customer location',
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
              <ActiveDelivery
                delivery={{
                  id: activeDelivery.id,
                  storeName: 'Pickup Location',
                  storeAddress: 'Store address',
                  deliveryAddress: activeDelivery.delivery_address || 'Customer address',
                  customerName: 'Customer',
                  status: activeDelivery.status ?? 'accepted',
                  items: activeDelivery.order_items?.map(i => ({
                    name: i.name,
                    quantity: i.quantity,
                  })) ?? [],
                  estimatedPayout: Number(activeDelivery.delivery_fee ?? 0) + Number(activeDelivery.tip_amount ?? 0),
                  pickupChecklist: ['All items verified', 'Drinks included', 'Utensils added'],
                }}
                onStatusUpdate={(status) => updateDeliveryStatus(activeDelivery.id, status)}
              />
            ) : (
              <div className="text-center py-16">
                <Car className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <p className="font-heading text-foreground">No active delivery</p>
                <p className="text-sm text-muted-foreground mt-1">Accept an offer to get started</p>
              </div>
            )}
          </TabsContent>

          <TabsContent value="earnings">
            <EarningsDashboard />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
