import { useState } from 'react';
import { Store, ClipboardList, UtensilsCrossed, Settings } from 'lucide-react';
import { UserMenu } from '@/components/UserMenu';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { OrderQueue } from '@/components/store/OrderQueue';
import { MenuControl } from '@/components/store/MenuControl';
import { StoreSettings } from '@/components/store/StoreSettings';
import { mockStoreOrders } from '@/lib/mock-data';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';

export default function StoreApp() {
  const [orders, setOrders] = useState(mockStoreOrders);

  const handleStatusUpdate = (orderId: string, newStatus: string) => {
    setOrders(prev => prev.map(order =>
      order.id === orderId
        ? { ...order, status: newStatus as any }
        : order
    ));
    toast.success(`Order #${orderId} → ${newStatus}`);
  };

  const newOrders = orders.filter(o => o.status === 'placed').length;

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="bg-card border-b border-border px-4 py-3 flex items-center justify-between sticky top-0 z-50 shadow-[var(--shadow-sm)]">
        <div className="flex items-center gap-2">
          <Store className="h-6 w-6 text-primary" />
          <h1 className="font-heading font-bold text-lg text-foreground">DashStore</h1>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="font-heading text-success border-success/30">
            ● Open
          </Badge>
          <UserMenu />
        </div>
      </header>

      <div className="p-4 max-w-2xl mx-auto">
        <Tabs defaultValue="orders">
          <TabsList className="w-full mb-4">
            <TabsTrigger value="orders" className="flex-1 font-heading relative">
              <ClipboardList className="h-4 w-4 mr-1.5" />
              Orders
              {newOrders > 0 && (
                <Badge className="ml-1.5 h-5 w-5 p-0 flex items-center justify-center gradient-primary text-primary-foreground text-xs">
                  {newOrders}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="menu" className="flex-1 font-heading">
              <UtensilsCrossed className="h-4 w-4 mr-1.5" />
              Menu
            </TabsTrigger>
            <TabsTrigger value="settings" className="flex-1 font-heading">
              <Settings className="h-4 w-4 mr-1.5" />
              Settings
            </TabsTrigger>
          </TabsList>

          <TabsContent value="orders">
            <OrderQueue orders={orders} onStatusUpdate={handleStatusUpdate} />
          </TabsContent>

          <TabsContent value="menu">
            <MenuControl />
          </TabsContent>

          <TabsContent value="settings">
            <StoreSettings />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
