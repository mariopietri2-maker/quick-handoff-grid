import { useState, useEffect, useRef } from 'react';
import {
  Store, ClipboardList, UtensilsCrossed, Settings, Plus, Bell, BarChart3, Tag,
  Package, Clock, Zap, PackagePlus, ArrowLeft, LayoutGrid,
} from 'lucide-react';
import { UserMenu } from '@/components/UserMenu';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { OrderQueue } from '@/components/store/OrderQueue';
import StoreDashboard from '@/components/store/StoreDashboard';
import { MenuControl } from '@/components/store/MenuControl';
import { StoreSettings } from '@/components/store/StoreSettings';
import { PrinterSettings } from '@/components/store/PrinterSettings';
import { StoreAnalyticsDashboard } from '@/components/store/StoreAnalyticsDashboard';
import { PromoManager } from '@/components/store/PromoManager';
import { InventoryControl } from '@/components/store/InventoryControl';
import { StoreHoursManager } from '@/components/store/StoreHoursManager';
import AutoAcceptRules from '@/components/store/AutoAcceptRules';
import StoreExternalOrderIngest from '@/components/store/StoreExternalOrderIngest';
import StoreWalletCard from '@/components/store/StoreWalletCard';
import { StoreSupportButton } from '@/components/store/StoreSupportButton';
import { OwnerStoresPortal } from '@/components/store/OwnerStoresPortal';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useStoreOrders } from '@/hooks/useOrders';
import { useStore } from '@/hooks/useStore';
import { requestNotificationPermission } from '@/lib/notifications';
import AnnouncementsBanner from '@/components/AnnouncementsBanner';
import { StorePwaInstallBanner } from '@/components/store/StorePwaInstallBanner';

type ViewMode = 'portal' | 'manage' | 'create';

export default function StoreApp() {
  const [notifPermission, setNotifPermission] = useState<NotificationPermission>(
    typeof window !== 'undefined' && 'Notification' in window ? Notification.permission : 'denied',
  );

  const handleEnableNotifications = async () => {
    const granted = await requestNotificationPermission();
    setNotifPermission(granted ? 'granted' : 'denied');
  };

  const {
    store, stores, selectedStoreId, selectStore, loading: storeLoading, createStore,
  } = useStore();
  const { orders, loading: ordersLoading, updateStatus, pendingIds } = useStoreOrders(store?.id ?? null);
  const [newStore, setNewStore] = useState({ name: '', address: '', phone: '' });
  const [creating, setCreating] = useState(false);
  const [view, setView] = useState<ViewMode>('portal');
  const [activeTab, setActiveTab] = useState(() => {
    try {
      const t = new URLSearchParams(window.location.search).get('tab');
      if (
        t &&
        ['orders', 'external', 'menu', 'inventory', 'hours', 'analytics', 'promos', 'automation', 'settings'].includes(t)
      ) {
        return t;
      }
    } catch {}
    return 'orders';
  });

  // Auto-enter manage mode when a store is already selected
  useEffect(() => {
    if (store && view === 'portal') {
      // keep portal if multiple stores so owner can switch; auto-manage if only one
      if (stores.length <= 1) setView('manage');
    }
  }, [store, stores.length, view]);

  const handleCreate = async () => {
    if (!newStore.name.trim()) return;
    setCreating(true);
    const created = await createStore(newStore);
    setCreating(false);
    if (created) {
      setNewStore({ name: '', address: '', phone: '' });
      setView('manage');
    }
  };

  const loading = storeLoading || ordersLoading;
  const placedCount = orders.filter((o) => o.status === 'placed').length;

  if (storeLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="h-8 w-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  // Multi-store portal
  if (view === 'portal' && stores.length > 0) {
    return (
      <div className="min-h-screen bg-background">
        <header className="sticky top-0 z-40 glass-strong border-b border-border/40">
          <div className="container max-w-5xl mx-auto px-4 h-14 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
                <LayoutGrid className="h-4 w-4 text-primary" />
              </div>
              <h1 className="font-heading font-bold text-foreground">Τα καταστήματά μου</h1>
            </div>
            <div className="flex items-center gap-2">
              <Button size="sm" variant="outline" className="font-heading gap-1.5" onClick={() => setView('create')}>
                <Plus className="h-4 w-4" /> Νέο
              </Button>
              <UserMenu />
            </div>
          </div>
        </header>
        <div className="container max-w-5xl mx-auto px-4 py-6">
          <OwnerStoresPortal
            stores={stores}
            selectedStoreId={selectedStoreId}
            onSelect={(id) => {
              selectStore(id);
              setView('manage');
            }}
          />
        </div>
      </div>
    );
  }

  // Create store form
  if (view === 'create' || (!store && stores.length === 0)) {
    return (
      <div className="min-h-screen bg-background">
        <header className="sticky top-0 z-40 glass-strong border-b border-border/40">
          <div className="container max-w-lg mx-auto px-4 h-14 flex items-center justify-between">
            <div className="flex items-center gap-2">
              {stores.length > 0 && (
                <Button size="icon" variant="ghost" onClick={() => setView('portal')}>
                  <ArrowLeft className="h-4 w-4" />
                </Button>
              )}
              <h1 className="font-heading font-bold">Νέο κατάστημα</h1>
            </div>
            <UserMenu />
          </div>
        </header>
        <div className="container max-w-lg mx-auto px-4 py-8">
          <Card>
            <CardContent className="p-6 space-y-4">
              <div className="space-y-2">
                <Label className="font-heading">Όνομα</Label>
                <Input
                  value={newStore.name}
                  onChange={(e) => setNewStore((s) => ({ ...s, name: e.target.value }))}
                  placeholder="π.χ. Pizza Napoli"
                  className="font-heading"
                />
              </div>
              <div className="space-y-2">
                <Label className="font-heading">Διεύθυνση</Label>
                <Input
                  value={newStore.address}
                  onChange={(e) => setNewStore((s) => ({ ...s, address: e.target.value }))}
                  placeholder="Οδός, αριθμός, πόλη"
                  className="font-heading"
                />
              </div>
              <div className="space-y-2">
                <Label className="font-heading">Τηλέφωνο</Label>
                <Input
                  value={newStore.phone}
                  onChange={(e) => setNewStore((s) => ({ ...s, phone: e.target.value }))}
                  placeholder="69xxxxxxxx"
                  className="font-heading"
                />
              </div>
              <Button className="w-full font-heading" onClick={handleCreate} disabled={creating || !newStore.name.trim()}>
                {creating ? 'Δημιουργία…' : 'Δημιουργία καταστήματος'}
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  if (!store) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <p className="text-muted-foreground font-heading">Δεν βρέθηκε κατάστημα.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-40 glass-strong border-b border-border/40">
        <div className="container max-w-5xl mx-auto px-4 h-14 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2.5 min-w-0">
            {stores.length > 1 && (
              <Button size="icon" variant="ghost" className="shrink-0" onClick={() => setView('portal')}>
                <ArrowLeft className="h-4 w-4" />
              </Button>
            )}
            <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
              <Store className="h-4 w-4 text-primary" />
            </div>
            <div className="min-w-0">
              <h1 className="font-heading font-bold text-foreground truncate leading-tight">{store.name}</h1>
              {placedCount > 0 && (
                <p className="text-[11px] text-primary font-heading font-semibold">{placedCount} νέες</p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            {notifPermission !== 'granted' && (
              <Button size="sm" variant="outline" className="font-heading gap-1 hidden sm:flex" onClick={handleEnableNotifications}>
                <Bell className="h-3.5 w-3.5" /> Ειδοποιήσεις
              </Button>
            )}
            <StoreSupportButton storeId={store.id} />
            <UserMenu />
          </div>
        </div>
      </header>

      <div className="container max-w-5xl mx-auto px-4 py-4 space-y-4">
        <StorePwaInstallBanner />
        <AnnouncementsBanner audience="store" />

        {store && (
          <>
            <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
              <TabsList className="w-full h-auto flex flex-wrap gap-1 p-1 bg-muted/50 rounded-xl">
                <TabsTrigger value="orders" className="flex-1 min-w-[90px] font-heading rounded-lg relative">
                  <ClipboardList className="h-4 w-4 mr-1.5" />
                  Παραγγελίες
                  {placedCount > 0 && (
                    <Badge className="ml-1.5 h-5 min-w-5 px-1 text-[10px]">{placedCount}</Badge>
                  )}
                </TabsTrigger>
                <TabsTrigger value="external" className="flex-1 min-w-[90px] font-heading rounded-lg">
                  <PackagePlus className="h-4 w-4 mr-1.5" />
                  External
                </TabsTrigger>
                <TabsTrigger value="menu" className="flex-1 min-w-[90px] font-heading rounded-lg">
                  <UtensilsCrossed className="h-4 w-4 mr-1.5" />
                  Μενού
                </TabsTrigger>
                <TabsTrigger value="inventory" className="flex-1 min-w-[90px] font-heading rounded-lg">
                  <Package className="h-4 w-4 mr-1.5" />
                  Απόθεμα
                </TabsTrigger>
                <TabsTrigger value="hours" className="flex-1 min-w-[90px] font-heading rounded-lg">
                  <Clock className="h-4 w-4 mr-1.5" />
                  Ώρες
                </TabsTrigger>
                <TabsTrigger value="analytics" className="flex-1 min-w-[90px] font-heading rounded-lg">
                  <BarChart3 className="h-4 w-4 mr-1.5" />
                  Stats
                </TabsTrigger>
                <TabsTrigger value="promos" className="flex-1 min-w-[90px] font-heading rounded-lg">
                  <Tag className="h-4 w-4 mr-1.5" />
                  Προσφορές
                </TabsTrigger>
                <TabsTrigger value="automation" className="flex-1 min-w-[90px] font-heading rounded-lg">
                  <Zap className="h-4 w-4 mr-1.5" />
                  Auto
                </TabsTrigger>
                <TabsTrigger value="settings" className="flex-1 min-w-[90px] font-heading rounded-lg">
                  <Settings className="h-4 w-4 mr-1.5" />
                  Ρυθμίσεις
                </TabsTrigger>
              </TabsList>

              <TabsContent value="orders">
                {loading ? (
                  <div className="text-center py-16">
                    <div className="h-8 w-8 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-3" />
                    <p className="text-muted-foreground font-heading">Φόρτωση παραγγελιών...</p>
                  </div>
                ) : (
                  <StoreDashboard
                    storeId={store.id}
                    storeName={store.name}
                    orders={orders}
                    onStatusUpdate={updateStatus}
                    pendingIds={pendingIds}
                  />
                )}
              </TabsContent>

              <TabsContent value="external">
                <StoreExternalOrderIngest storeId={store.id} />
              </TabsContent>
              <TabsContent value="menu">
                <MenuControl storeId={store.id} />
              </TabsContent>
              <TabsContent value="inventory">
                <InventoryControl storeId={store.id} />
              </TabsContent>
              <TabsContent value="hours">
                <StoreHoursManager storeId={store.id} />
              </TabsContent>
              <TabsContent value="analytics">
                <StoreAnalyticsDashboard storeId={store.id} />
              </TabsContent>
              <TabsContent value="promos">
                <PromoManager storeId={store.id} />
              </TabsContent>
              <TabsContent value="automation">
                <AutoAcceptRules storeId={store.id} />
              </TabsContent>
              <TabsContent value="settings" className="space-y-4">
                <StoreWalletCard storeId={store.id} />
                <StoreSettings storeId={store.id} />
                <PrinterSettings storeName={store.name} />
              </TabsContent>
            </Tabs>
          </>
        )}
      </div>
    </div>
  );
}
