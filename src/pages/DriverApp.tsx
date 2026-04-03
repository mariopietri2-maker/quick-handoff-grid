import { useState } from 'react';
import { Car, DollarSign, Radio } from 'lucide-react';
import { UserMenu } from '@/components/UserMenu';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { OrderOfferCard } from '@/components/driver/OrderOfferCard';
import { ActiveDelivery } from '@/components/driver/ActiveDelivery';
import { EarningsDashboard } from '@/components/driver/EarningsDashboard';
import { mockOrderOffers, mockActiveDelivery } from '@/lib/mock-data';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';

export default function DriverApp() {
  const [offers, setOffers] = useState(mockOrderOffers);
  const [activeDelivery, setActiveDelivery] = useState<typeof mockActiveDelivery | null>(null);
  const [isOnline, setIsOnline] = useState(true);

  const handleAccept = (id: string) => {
    const offer = offers.find(o => o.id === id);
    if (offer) {
      setActiveDelivery({
        ...mockActiveDelivery,
        id: offer.id,
        storeName: offer.storeName,
        storeAddress: offer.storeAddress,
        deliveryAddress: offer.deliveryAddress,
        estimatedPayout: offer.estimatedPayout,
        status: 'accepted',
      });
      setOffers(prev => prev.filter(o => o.id !== id));
      toast.success('Order accepted!');
    }
  };

  const handleDecline = (id: string) => {
    setOffers(prev => prev.filter(o => o.id !== id));
    toast('Order declined');
  };

  const handleStatusUpdate = (status: string) => {
    if (status === 'delivered') {
      toast.success('Delivery completed! 🎉');
      setActiveDelivery(null);
    } else if (activeDelivery) {
      setActiveDelivery({ ...activeDelivery, status: status as any });
      toast.success(`Status updated: ${status.replace('_', ' ')}`);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="gradient-dark text-primary-foreground px-4 py-3 flex items-center justify-between sticky top-0 z-50">
        <div className="flex items-center gap-2">
          <Car className="h-6 w-6" />
          <h1 className="font-heading font-bold text-lg">DashDrive</h1>
        </div>
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
      </header>

      <div className="p-4 max-w-lg mx-auto">
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
            ) : offers.length === 0 ? (
              <div className="text-center py-16">
                <Radio className="h-12 w-12 text-muted-foreground mx-auto mb-4 animate-pulse" />
                <p className="font-heading text-foreground">Waiting for orders...</p>
                <p className="text-sm text-muted-foreground mt-1">New offers will appear here</p>
              </div>
            ) : (
              offers.map(offer => (
                <OrderOfferCard
                  key={offer.id}
                  offer={offer}
                  onAccept={handleAccept}
                  onDecline={handleDecline}
                />
              ))
            )}
          </TabsContent>

          <TabsContent value="active">
            {activeDelivery ? (
              <ActiveDelivery
                delivery={activeDelivery}
                onStatusUpdate={handleStatusUpdate}
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
