import { useState, useEffect } from 'react';
import { Store, ClipboardList, UtensilsCrossed, Settings, Plus, Bell, BarChart3, Tag } from 'lucide-react';
import { UserMenu } from '@/components/UserMenu';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { OrderQueue } from '@/components/store/OrderQueue';
import { MenuControl } from '@/components/store/MenuControl';
import { StoreSettings } from '@/components/store/StoreSettings';
import { StoreAnalyticsDashboard } from '@/components/store/StoreAnalyticsDashboard';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useStoreOrders } from '@/hooks/useOrders';
import { useStore } from '@/hooks/useStore';
import { requestNotificationPermission } from '@/lib/notifications';

export default function StoreApp() {
  const [notifPermission, setNotifPermission] = useState<NotificationPermission>(
    typeof window !== 'undefined' && 'Notification' in window ? Notification.permission : 'denied'
  );

  const handleEnableNotifications = async () => {
    const granted = await requestNotificationPermission();
    setNotifPermission(granted ? 'granted' : 'denied');
  };
  const { store, loading: storeLoading, createStore } = useStore();
  const { orders, loading: ordersLoading, updateOrderStatus } = useStoreOrders(store?.id ?? null);
  const [newStore, setNewStore] = useState({ name: '', address: '', phone: '' });
  const [creating, setCreating] = useState(false);

  const newOrders = orders.filter(o => o.status === 'placed').length;
  const loading = storeLoading || ordersLoading;

  const handleCreateStore = async () => {
    if (!newStore.name || !newStore.address) return;
    setCreating(true);
    await createStore(newStore);
    setCreating(false);
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="bg-card border-b border-border px-4 py-3 flex items-center justify-between sticky top-0 z-50 shadow-[var(--shadow-sm)]">
        <div className="flex items-center gap-2">
          <Store className="h-6 w-6 text-primary" />
          <h1 className="font-heading font-bold text-lg text-foreground">DashStore</h1>
        </div>
        <div className="flex items-center gap-2">
          {store && (
            <Badge variant="outline" className={`font-heading ${store.is_active ? 'text-success border-success/30' : 'text-muted-foreground border-border'}`}>
              {store.is_active ? '● Open' : '○ Closed'}
            </Badge>
          )}
          {newOrders > 0 && (
            <Badge className="gradient-primary text-primary-foreground font-heading">
              {newOrders} new
            </Badge>
          )}
          <UserMenu />
        </div>
      </header>

      <div className="p-4 max-w-2xl mx-auto">
        {storeLoading ? (
          <div className="text-center py-16">
            <div className="h-8 w-8 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-3" />
            <p className="text-muted-foreground font-heading">Loading...</p>
          </div>
        ) : !store ? (
          /* Store Creation Form */
          <div className="max-w-md mx-auto py-8">
            <Card className="shadow-[var(--shadow-lg)]">
              <CardContent className="p-6 space-y-4">
                <div className="text-center mb-4">
                  <div className="h-16 w-16 rounded-2xl gradient-primary shadow-primary flex items-center justify-center mx-auto mb-3">
                    <Plus className="h-8 w-8 text-primary-foreground" />
                  </div>
                  <h2 className="font-heading font-bold text-xl text-foreground">Set Up Your Store</h2>
                  <p className="text-sm text-muted-foreground mt-1">Create your restaurant profile to start receiving orders</p>
                </div>
                <div>
                  <Label className="font-heading">Store Name</Label>
                  <Input value={newStore.name} onChange={e => setNewStore(p => ({ ...p, name: e.target.value }))} placeholder="e.g. Mario's Pizza" maxLength={100} />
                </div>
                <div>
                  <Label className="font-heading">Address</Label>
                  <Input value={newStore.address} onChange={e => setNewStore(p => ({ ...p, address: e.target.value }))} placeholder="123 Main St, City" maxLength={200} />
                </div>
                <div>
                  <Label className="font-heading">Phone (optional)</Label>
                  <Input value={newStore.phone} onChange={e => setNewStore(p => ({ ...p, phone: e.target.value }))} placeholder="(555) 123-4567" maxLength={20} />
                </div>
                <Button
                  onClick={handleCreateStore}
                  className="w-full h-12 font-heading text-lg gradient-primary shadow-primary text-primary-foreground"
                  disabled={!newStore.name || !newStore.address || creating}
                >
                  {creating ? 'Creating...' : 'Create Store'}
                </Button>
              </CardContent>
            </Card>
          </div>
        ) : (
          <>
            {notifPermission === 'default' && (
              <div className="mb-4 flex items-center gap-3 p-3 rounded-xl bg-info/10 border border-info/20">
                <Bell className="h-5 w-5 text-info flex-shrink-0" />
                <div className="flex-1">
                  <p className="text-sm font-heading font-semibold text-foreground">Enable notifications</p>
                  <p className="text-xs text-muted-foreground">Get sound + browser alerts when new orders arrive</p>
                </div>
                <Button size="sm" onClick={handleEnableNotifications} className="gradient-primary text-primary-foreground font-heading">
                  Enable
                </Button>
              </div>
            )}
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
              <TabsTrigger value="analytics" className="flex-1 font-heading">
                <BarChart3 className="h-4 w-4 mr-1.5" />
                Analytics
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
              <MenuControl storeId={store.id} />
            </TabsContent>

            <TabsContent value="analytics">
              <StoreAnalyticsDashboard storeId={store.id} />
            </TabsContent>

            <TabsContent value="settings">
              <StoreSettings storeId={store.id} />
            </TabsContent>
          </Tabs>
          </>
        )}
      </div>
    </div>
  );
}
