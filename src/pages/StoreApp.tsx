import { useState, useEffect, useRef, useCallback } from 'react';
import {
  Store, ClipboardList, UtensilsCrossed, Settings, Plus, Bell, BarChart3, Tag,
  Package, Clock, Zap, PackagePlus, ArrowLeft, Power, ReceiptText,
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
import StoreOrderPnl from '@/components/store/StoreOrderPnl';
import MenuImportFromReceipt from '@/components/store/MenuImportFromReceipt';
import { StoreSupportButton } from '@/components/store/StoreSupportButton';
import { OwnerStoresPortal } from '@/components/store/OwnerStoresPortal';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { StoreCallPanel } from '@/components/store/StoreCallPanel';
import { StoreNewsPanel } from '@/components/store/StoreNewsPanel';
import { Switch } from '@/components/ui/switch';
import { useStoreOrders } from '@/hooks/useOrders';
import { useStore } from '@/hooks/useStore';
import { requestNotificationPermission, installAudioUnlock, unlockAudio } from '@/lib/notifications';
import { showOsNotification } from '@/lib/push-notifications';
import { toast } from 'sonner';
import AnnouncementsBanner from '@/components/AnnouncementsBanner';
import { StorePwaInstallBanner } from '@/components/store/StorePwaInstallBanner';

type ViewMode = 'portal' | 'manage' | 'create';

export default function StoreApp() {
  const [notifPermission, setNotifPermission] = useState<NotificationPermission>(
    typeof window !== 'undefined' && 'Notification' in window ? Notification.permission : 'denied',
  );

  /** Re-read the real OS/browser permission (native check included) — state goes stale otherwise. */
  const syncNotifPermission = useCallback(async () => {
    try {
      const { Capacitor } = await import('@capacitor/core');
      if (Capacitor.isNativePlatform()) {
        const { LocalNotifications } = await import('@capacitor/local-notifications');
        const cur = await LocalNotifications.checkPermissions().catch(() => null);
        if (cur) {
          setNotifPermission(cur.display === 'granted' ? 'granted' : cur.display === 'denied' ? 'denied' : 'default');
          return;
        }
      }
    } catch { /* web fallback below */ }
    if (typeof window !== 'undefined' && 'Notification' in window) {
      setNotifPermission(Notification.permission);
    }
  }, []);

  // Keep the bell in sync when the user grants/blocks from browser settings and comes back.
  useEffect(() => {
    void syncNotifPermission();
    const onVis = () => { if (document.visibilityState === 'visible') void syncNotifPermission(); };
    document.addEventListener('visibilitychange', onVis);
    window.addEventListener('focus', onVis);
    return () => {
      document.removeEventListener('visibilitychange', onVis);
      window.removeEventListener('focus', onVis);
    };
  }, [syncNotifPermission]);

  const handleEnableNotifications = async () => {
    // This tap is a user gesture — unlock alert audio at the same time.
    unlockAudio();
    const granted = await requestNotificationPermission();
    if (granted) {
      setNotifPermission('granted');
      toast.success('Ειδοποιήσεις ενεργές');
      // Proof it works — real OS notification, not just a toast.
      void showOsNotification({
        title: 'Ειδοποιήσεις ενεργές',
        body: 'Θα λαμβάνεις ήχο + ειδοποίηση για νέες κλήσεις / παραγγελίες.',
        tag: 'store-notif-test',
        vibrate: true,
      });
    } else {
      // Re-read so 'denied' (blocked in browser settings — tapping again
      // won't prompt) vs 'default' (dismissed — can tap again) stays accurate.
      await syncNotifPermission();
      toast.error('Μπλοκαρίστηκαν — επίτρεψέ τες από το λουκέτο στη γραμμή διεύθυνσης (Site settings → Notifications → Allow) και ξαναπάτα.');
    }
  };

  // Unlock alert audio on first interaction anywhere (autoplay policy).
  useEffect(() => {
    installAudioUnlock();
  }, []);

  const {
    store, stores, selectedStoreId, selectStore, loading: storeLoading, createStore, updateStore,
  } = useStore();
  // N stores are call-only: they never render orders, so skip the orders
  // fetch + realtime subscription entirely (faster load, less battery/data).
  const isNStore = store?.store_role === 'N';
  const { orders, loading: ordersLoading, updateStatus, pendingIds } = useStoreOrders(
    isNStore ? null : (store?.id ?? null),
    { suppressSound: isNStore },
  );
  const [newStore, setNewStore] = useState({ name: '', address: '', phone: '' });
  const [creating, setCreating] = useState(false);
  const [view, setView] = useState<ViewMode>('portal');
  const [activeTab, setActiveTab] = useState(() => {
    try {
      const t = new URLSearchParams(window.location.search).get('tab');
      if (
        t &&
        ['orders', 'external', 'menu', 'inventory', 'hours', 'analytics', 'promos', 'automation', 'settings', 'pnl'].includes(t)
      ) {
        return t;
      }
    } catch {}
    return 'orders';
  });

  useEffect(() => {
    if (storeLoading) return;
    if (selectedStoreId && stores.some((s) => s.id === selectedStoreId)) {
      setView('manage');
    } else if (stores.length === 0) {
      setView('create');
    } else {
      setView('portal');
    }
  }, [storeLoading, stores, selectedStoreId]);

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

  const openStore = (id: string) => {
    selectStore(id);
    setView('manage');
  };

  const backToPortal = () => {
    setView('portal');
  };

  const loading = storeLoading || ordersLoading;
  const placedCount = orders.filter((o) => o.status === 'placed').length;
  const tabsListRef = useRef<HTMLDivElement>(null);

  /** Bell doubles as the new-orders indicator: tap jumps to orders.
   *  If OS notifications aren't enabled yet, the same tap enables them. */
  const handleBellTap = async () => {
    if (notifPermission !== 'granted') {
      await handleEnableNotifications();
      return;
    }
    if (!isNStore) {
      setActiveTab('orders');
      try { window.scrollTo({ top: 0, behavior: 'smooth' }); } catch {}
    }
  };

  if (storeLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="h-8 w-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-40 glass-strong border-b border-border/40">
        <div className="container max-w-5xl mx-auto px-4 h-14 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2.5 min-w-0">
            {view === 'manage' && stores.length > 1 && (
              <Button size="icon" variant="ghost" className="shrink-0" onClick={backToPortal}>
                <ArrowLeft className="h-4 w-4" />
              </Button>
            )}
            {isNStore ? (
              <>
                <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                  <Store className="h-4 w-4 text-primary" />
                </div>
                <div className="min-w-0 leading-tight">
                  <h1 className="font-heading font-bold text-foreground truncate leading-tight">
                    {view === 'portal'
                      ? 'Τα καταστήματά μου'
                      : view === 'create'
                        ? 'Νέο κατάστημα'
                        : store?.name ?? 'Κατάστημα'}
                  </h1>
                </div>
              </>
            ) : (
              <>
                <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0 overflow-hidden">
                  <img src="/favicon.svg" alt="EpirusEats" className="h-6 w-6" />
                </div>
                <div className="min-w-0 leading-tight">
                  <p className="font-heading font-bold text-foreground truncate leading-tight">
                    EpirusEats
                  </p>
                  <p className="text-[11px] text-muted-foreground truncate leading-tight">
                    {view === 'portal'
                      ? 'Τα καταστήματά μου'
                      : view === 'create'
                        ? 'Νέο κατάστημα'
                        : store?.name ?? 'Κατάστημα'}
                    {view === 'manage' && placedCount > 0 && ` · ${placedCount} νέες`}
                  </p>
                </div>
              </>
            )}
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            {view === 'manage' && (
              <Button
                size="icon"
                variant="outline"
                className="relative shrink-0"
                onClick={handleBellTap}
                title={notifPermission !== 'granted' ? 'Πάτα για ενεργοποίηση ειδοποιήσεων' : placedCount > 0 ? `${placedCount} νέες παραγγελίες — πάτα για προβολή` : 'Ειδοποιήσεις'}
                aria-label="Ειδοποιήσεις"
              >
                <Bell className="h-4 w-4" />
                {placedCount > 0 && (
                  <span className="absolute -top-1.5 -right-1.5 h-5 min-w-5 px-1 rounded-full bg-primary text-primary-foreground text-[10px] font-bold flex items-center justify-center">
                    {placedCount > 99 ? '99+' : placedCount}
                  </span>
                )}
                {notifPermission !== 'granted' && (
                  <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-amber-500 border-2 border-background" />
                )}
              </Button>
            )}
            {view === 'manage' && store && <StoreSupportButton storeId={store.id} />}
            {view === 'portal' && (
              <Button size="sm" variant="outline" className="font-heading gap-1.5" onClick={() => setView('create')}>
                <Plus className="h-4 w-4" /> Νέο
              </Button>
            )}
            <UserMenu />
          </div>
        </div>
      </header>

      <div className="container max-w-5xl mx-auto px-4 py-4">
        <StorePwaInstallBanner />

        {view === 'create' ? (
          <div className="max-w-lg mx-auto py-4">
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
                <Button
                  className="w-full font-heading"
                  onClick={handleCreate}
                  disabled={creating || !newStore.name.trim()}
                >
                  {creating ? 'Δημιουργία...' : 'Δημιουργία Καταστήματος'}
                </Button>
                {stores.length > 0 && (
                  <Button variant="ghost" className="w-full font-heading" onClick={backToPortal}>
                    Πίσω
                  </Button>
                )}
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
          <div className="lg:grid lg:grid-cols-[270px_minmax(0,1fr)] lg:gap-5 lg:items-start space-y-4 lg:space-y-0">
            <aside className="order-2 lg:order-1 min-w-0 lg:sticky lg:top-16">
              <StoreNewsPanel />
            </aside>
            <div className="order-1 lg:order-2 min-w-0">
              {store.store_role === 'N' ? (
                <div className="py-6 max-w-lg mx-auto space-y-4">
            <AnnouncementsBanner audience="store_owners" />
            <div className="flex items-center justify-between rounded-2xl border border-border bg-card px-4 py-3 shadow-sm">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className={`h-9 w-9 rounded-xl flex items-center justify-center shrink-0 ${store.is_active ? 'bg-emerald-500/10' : 'bg-muted'}`}>
                  <Power className={`h-5 w-5 ${store.is_active ? 'text-emerald-600' : 'text-muted-foreground'}`} />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-heading font-semibold text-foreground">
                    {store.is_active ? 'Ανοιχτό — δέχεται κλήσεις' : 'Κλειστό'}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {store.is_active ? 'Το κουμπί κλήσης οδηγού είναι ενεργό' : 'Άνοιξε για να καλέσεις οδηγό'}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <Badge variant={store.is_active ? 'default' : 'secondary'}>
                  {store.is_active ? 'OPEN' : 'CLOSED'}
                </Badge>
                <Switch
                  checked={!!store.is_active}
                  onCheckedChange={(checked) => updateStore({ is_active: checked }, store.id)}
                  aria-label="Ανοιχτό / Κλειστό καταστήματος"
                />
              </div>
            </div>
            {notifPermission !== 'granted' && (
              <div className="flex items-center gap-3 p-4 rounded-2xl bg-info/10 border border-info/25">
                <Bell className="h-6 w-6 text-info shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-heading font-semibold text-foreground">Ειδοποιήσεις κλήσης</p>
                  <p className="text-xs text-muted-foreground">
                    Ενεργοποίησε για ήχο όταν ο οδηγός αποδεχτεί
                  </p>
                </div>
                <Button size="sm" onClick={handleEnableNotifications} className="gradient-primary text-primary-foreground font-heading shrink-0">
                  Ενεργοποίηση
                </Button>
              </div>
            )}
            <StoreCallPanel storeId={store.id} storeName={store.name} disabled={!store.is_active} />
            <p className="text-center text-xs text-muted-foreground px-4">
              Κράτα την οθόνη ανοιχτή ή εγκατέστησε την εφαρμογή για πιο αξιόπιστες ειδοποιήσεις.
            </p>
                </div>
              ) : (
                <>
            {notifPermission !== 'granted' && (
              <div className="mb-4 flex items-center gap-3 p-3 rounded-xl bg-info/10 border border-info/20">
                <Bell className="h-5 w-5 text-info shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-heading font-semibold text-foreground">Ειδοποιήσεις</p>
                  <p className="text-xs text-muted-foreground">Ενεργοποίησε για νέες παραγγελίες</p>
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
                <TabsTrigger value="pnl" className="flex-1 min-w-[90px] font-heading rounded-lg">
                  <ReceiptText className="h-4 w-4 mr-1.5" />
                  Κέρδη
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
                <MenuImportFromReceipt storeId={store.id} />
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
              <TabsContent value="pnl">
                <StoreOrderPnl storeId={store.id} />
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
        )}
      </div>
    </div>
  );
}
