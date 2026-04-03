import { Store, ClipboardList, UtensilsCrossed, Settings } from 'lucide-react';
import { UserMenu } from '@/components/UserMenu';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { OrderQueue } from '@/components/store/OrderQueue';
import { MenuControl } from '@/components/store/MenuControl';
import { StoreSettings } from '@/components/store/StoreSettings';
import { Badge } from '@/components/ui/badge';
import { useStoreOrders, useUserStore } from '@/hooks/useOrders';

export default function StoreApp() {
  const { storeId, loading: storeLoading } = useUserStore();
  const { orders, loading: ordersLoading, updateOrderStatus } = useStoreOrders(storeId);

  const newOrders = orders.filter(o => o.status === 'placed').length;
  const loading = storeLoading || ordersLoading;

  return (
    <div className="min-h-screen bg-background">
      <header className="bg-card border-b border-border px-4 py-3 flex items-center justify-between sticky top-0 z-50 shadow-[var(--shadow-sm)]">
        <div className="flex items-center gap-2">
          <Store className="h-6 w-6 text-primary" />
          <h1 className="font-heading font-bold text-lg text-foreground">DashStore</h1>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="font-heading text-success border-success/30">
            ● Open
          </Badge>
          {newOrders > 0 && (
            <Badge className="gradient-primary text-primary-foreground font-heading">
              {newOrders} new
            </Badge>
          )}
          <UserMenu />
        </div>
      </header>

      <div className="p-4 max-w-2xl mx-auto">
        {!storeId && !storeLoading ? (
          <div className="text-center py-16">
            <Store className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <p className="font-heading text-foreground">No store found</p>
            <p className="text-sm text-muted-foreground mt-1">
              Create a store to start receiving orders
            </p>
          </div>
        ) : (
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
              {loading ? (
                <div className="text-center py-16">
                  <div className="h-8 w-8 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-3" />
                  <p className="text-muted-foreground font-heading">Loading orders...</p>
                </div>
              ) : orders.length === 0 ? (
                <div className="text-center py-16">
                  <ClipboardList className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <p className="font-heading text-foreground">No active orders</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    New orders will appear here in real-time
                  </p>
                  <div className="mt-4 flex items-center justify-center gap-2 text-sm text-success">
                    <span className="h-2 w-2 rounded-full bg-success animate-pulse" />
                    Listening for orders...
                  </div>
                </div>
              ) : (
                <OrderQueue orders={orders} onStatusUpdate={updateOrderStatus} />
              )}
            </TabsContent>

            <TabsContent value="menu">
              <MenuControl />
            </TabsContent>

            <TabsContent value="settings">
              <StoreSettings />
            </TabsContent>
          </Tabs>
        )}
      </div>
    </div>
  );
}
