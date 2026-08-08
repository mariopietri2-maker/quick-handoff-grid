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
  const { orders, loading: ordersLoading, updateOrderStatus, pendingIds } = useStoreOrders(store?.id ?? null);
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
      if (t === 'wallet') return 'settings';
    } catch { /* noop */ }
    return 'orders';
  });
  const tabsListRef = useRef<HTMLDivElement>(null);

  // Decide initial view once stores load
  useEffect(() => {
    if (storeLoading) return;
    if (stores.length === 0) {
      setView('create');
      return;
    }
    if (selectedStoreId && stores.some((s) => s.id === selectedStoreId)) {
      setView('manage');
    } else {
      setView('portal');
    }
  }, [storeLoading, stores, selectedStoreId]);

  useEffect(() => {
    const url = new URL(window.location.href);
    if (url.searchParams.get('tab') === activeTab) return;
    url.searchParams.set('tab', activeTab);
    window.history.replaceState({}, '', url.toString());
  }, [activeTab]);

  useEffect(() => {
    const list = tabsListRef.current;
    if (!list) return;
    const active = list.querySelector<HTMLElement>(`[data-state="active"]`);
    if (active) {
      active.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
    }
  }, [activeTab]);

  const newOrders = orders.filter((o) => o.status === 'placed').length;
  const kitchenOrders = orders.filter((o) => o.status === 'accepted' || o.status === 'preparing').length;
  const readyOrders = orders.filter((o) => o.status === 'ready').length;
  const loading = storeLoading || (view === 'manage' && ordersLoading);

  const prevNewRef = useRef(0);
  useEffect(() => {
    if (view !== 'manage') return;
    if (newOrders > prevNewRef.current && activeTab !== 'orders') {
      setActiveTab('orders');
    }
    prevNewRef.current = newOrders;
  }, [newOrders, activeTab, view]);

  const handleCreateStore = async () => {
    if (!newStore.name || !newStore.address) return;
    setCreating(true);
    const created = await createStore(newStore);
    setCreating(false);
    if (created) {
      setNewStore({ name: '', address: '', phone: '' });
      setView('manage');
    }
  };

  const openStore = (id: string) => {
    selectStore(id);
    setView('manage');
    setActiveTab('orders');
  };

  const backToPortal = () => {
    selectStore(null);
    setView('portal');
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="bg-card/90 backdrop-blur-md border-b border-border px-4 py-3 flex items-center justify-between sticky top-0 z-50 shadow-[0_1px_0_0_hsl(var(--border)/0.6)]">
        <div className="flex items-center gap-2.5 min-w-0">
          {view === 'manage' && stores.length > 1 ? (
            <Button variant="ghost" size="sm" className="h-8 gap-1.5 shrink-0" onClick={backToPortal}>
              <ArrowLeft className="h-4 w-4" />
              <span className="hidden sm:inline">Όλα</span>
            </Button>
          ) : (
            <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center shrink-0 shadow-primary/40">
              <Store className="h-4.5 w-4.5 text-primary-foreground" />
            </div>
          )}
          <div className="min-w-0">
            <h1 className="font-heading font-bold text-lg text-foreground truncate">
              {view === 'manage' && store ? store.name : 'DashStore'}
            </h1>
            {view === 'manage' && stores.length > 1 && (
              <p className="text-[11px] text-muted-foreground truncate">Portal · {stores.length} καταστήματα</p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Badge variant="outline" className="hidden md:inline-flex gap-1.5 text-[10px] font-bold uppercase tracking-wider text-success border-success/30">
            <span className="relative flex h-1.5 w-1.5">
              <span className="absolute inline-flex h-full w-full rounded-full bg-success animate-ping opacity-60" />
              <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-success" />
            </span>
            Live
          </Badge>
          {view === 'manage' && stores.length > 1 && (
            <Button variant="outline" size="sm" className="h-8 gap-1.5 hidden sm:inline-flex" onClick={backToPortal}>
              <LayoutGrid className="h-3.5 w-3.5" />
              Portal
            </Button>
          )}
          {store && view === 'manage' && (
            <Badge
              variant="outline"
              className={`font-heading ${store.is_active ? 'text-success border-success/30' : 'text-muted-foreground border-border'}`}
            >
              {store.is_active ? '● Ανοιχτό' : '○ Κλειστό'}
            </Badge>
          )}
          {view === 'manage' && newOrders > 0 && (
            <Badge className="gradient-primary text-primary-foreground font-heading">{newOrders} νέες</Badge>
          )}
          {store && view === 'manage' && <StoreSupportButton />}
          <UserMenu />
        </div>
      </header>

      <div
        className={`mx-auto p-3 sm:p-4 ${
          view === 'manage' && activeTab === 'orders' ? 'max-w-[1680px]' : 'max-w-3xl p-4'
        }`}
      >
        <div className="mb-3">
          <StorePwaInstallBanner />
        </div>
        {storeLoading ? (
          <div className="text-center py-16">
            <div className="h-8 w-8 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-3" />
            <p className="text-muted-foreground font-heading">Φόρτωση...</p>
          </div>
        ) : view === 'create' || (view === 'portal' && stores.length === 0) ? (
          <div className="max-w-md mx-auto py-8">
            {stores.length > 0 && (
              <Button variant="ghost" size="sm" className="mb-3 gap-1.5" onClick={() => setView('portal')}>
                <ArrowLeft className="h-4 w-4" /> Πίσω στο portal
              </Button>
            )}
            <Card className="shadow-[var(--shadow-lg)]">
              <CardContent className="p-6 space-y-4">
                <div className="text-center mb-4">
                  <div className="h-16 w-16 rounded-2xl gradient-primary shadow-primary flex items-center justify-center mx-auto mb-3">
                    <Plus className="h-8 w-8 text-primary-foreground" />
                  </div>
                  <h2 className="font-heading font-bold text-xl text-foreground">
                    {stores.length ? 'Νέο κατάστημα' : 'Ρύθμιση Καταστήματος'}
                  </h2>
                  <p className="text-sm text-muted-foreground mt-1">
                    Δημιούργησε προφίλ εστιατορίου για παραγγελίες στην πλατφόρμα
                  </p>
                </div>
                <div>
                  <Label className="font-heading">Όνομα Καταστήματος</Label>
                  <Input
                    value={newStore.name}
                    onChange={(e) => setNewStore((p) => ({ ...p, name: e.target.value }))}
                    placeholder="π.χ. Πιτσαρία Μάριος"
                    maxLength={100}
                  />
                </div>
                <div>
                  <Label className="font-heading">Διεύθυνση</Label>
                  <Input
                    value={newStore.address}
                    onChange={(e) => setNewStore((p) => ({ ...p, address: e.target.value }))}
                    placeholder="Οδός 123, Ιωάννινα"
                    maxLength={200}
                  />
                </div>
                <div>
                  <Label className="font-heading">Τηλέφωνο (προαιρετικό)</Label>
                  <Input
                    value={newStore.phone}
                    onChange={(e) => setNewStore((p) => ({ ...p, phone: e.target.value }))}
                    placeholder="26510 123456"
                    maxLength={20}
                  />
                </div>
                <Button
                  onClick={handleCreateStore}
                  className="w-full h-12 font-heading text-lg gradient-primary shadow-primary text-primary-foreground"
                  disabled={!newStore.name || !newStore.address || creating}
                >
                  {creating ? 'Δημιουργία...' : 'Δημιουργία Καταστήματος'}
                </Button>
              </CardContent>
            </Card>
          </div>
        ) : view === 'portal' ? (
          <OwnerStoresPortal
            stores={stores}
            onSelect={openStore}
            onCreateClick={() => setView('create')}
          />
        ) : !store ? (
          <div className="text-center py-16">
            <p className="text-muted-foreground font-heading mb-3">Δεν βρέθηκε κατάστημα</p>
            <Button onClick={backToPortal}>Πίσω στο portal</Button>
          </div>
        ) : (
          <>
            {notifPermission === 'default' && (
              <div className="mb-4 flex items-center gap-3 p-3 rounded-xl bg-info/10 border border-info/20">
                <Bell className="h-5 w-5 text-info flex-shrink-0" />
                <div className="flex-1">
                  <p className="text-sm font-heading font-semibold text-foreground">Ενεργοποίηση ειδοποιήσεων</p>
                  <p className="text-xs text-muted-foreground">Ηχητικές ειδοποιήσεις για νέες παραγγελίες</p>
                </div>
                <Button size="sm" onClick={handleEnableNotifications} className="gradient-primary text-primary-foreground font-heading">
                  Ενεργοποίηση
                </Button>
              </div>
            )}
            <AnnouncementsBanner audience="store_owners" />
            <Button
              onClick={() => setActiveTab('external')}
              className="w-full mb-4 h-12 gradient-primary text-primary-foreground font-heading gap-2 sm:hidden"
            >
              <PackagePlus className="h-4 w-4" />
              Νέα Custom Order (eFood / Wolt / Box)
            </Button>
            <Tabs value={activeTab} onValueChange={setActiveTab}>
<TabsList ref={tabsListRef} className={`w-full h-auto gap-1 flex overflow-x-auto sm:flex-wrap scrollbar-thin rounded-xl border border-border bg-muted/40 p-1 ${activeTab === 'orders' ? 'mb-2' : 'mb-4'}`}>
                <TabsTrigger value="orders" className="flex-1 min-w-[90px] font-heading rounded-lg data-[state=active]:rounded-lg data-[state=active]:bg-card data-[state=active]:shadow-sm">
                  <ClipboardList className="h-4 w-4 mr-1.5" />
                  Παραγγελίες
                  {newOrders + kitchenOrders + readyOrders > 0 && (
                    <Badge className="ml-1.5 h-5 min-w-5 px-1 flex items-center justify-center gradient-primary text-primary-foreground text-xs">
                      {newOrders > 0 ? newOrders : newOrders + kitchenOrders + readyOrders}
                    </Badge>
                  )}
                </TabsTrigger>
                <TabsTrigger value="external" className="flex-1 min-w-[110px] font-heading rounded-lg">
                  <PackagePlus className="h-4 w-4 mr-1.5" />
                  Custom Order
                </TabsTrigger>
                <TabsTrigger value="menu" className="flex-1 min-w-[80px] font-heading rounded-lg">
                  <UtensilsCrossed className="h-4 w-4 mr-1.5" />
                  Μενού
                </TabsTrigger>
                <TabsTrigger value="inventory" className="flex-1 min-w-[90px] font-heading rounded-lg">
                  <Package className="h-4 w-4 mr-1.5" />
                  Απόθεμα
                </TabsTrigger>
                <TabsTrigger value="hours" className="flex-1 min-w-[80px] font-heading rounded-lg">
                  <Clock className="h-4 w-4 mr-1.5" />
                  Ωράριο
                </TabsTrigger>
                <TabsTrigger value="analytics" className="flex-1 min-w-[90px] font-heading rounded-lg">
                  <BarChart3 className="h-4 w-4 mr-1.5" />
                  Στατιστικά
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
                    onStatusUpdate={updateOrderStatus}
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
