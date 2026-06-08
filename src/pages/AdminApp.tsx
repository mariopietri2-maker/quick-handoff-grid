import { lazy, Suspense, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useAdminData } from '@/hooks/useAdminData';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Shield, Users, Store, ShoppingBag, LogOut, Search, Bell, Menu, TrendingUp, Bike, Wallet, Activity } from 'lucide-react';
import AdminSidebar, { findParentSection, getTabsForSection } from '@/components/admin/AdminSidebar';
import AdminCommandPalette from '@/components/admin/AdminCommandPalette';
import { cn } from '@/lib/utils';
// Eagerly load only the default landing tab — everything else is lazy.
import OpsHome from '@/components/admin/OpsHome';
const AdminOverview = lazy(() => import('@/components/admin/AdminOverview'));
const OrdersKanban  = lazy(() => import('@/components/admin/OrdersKanban'));

// Lazy-load every other admin panel so the admin shell stays small and fast.
// Each panel only loads when its tab is opened.
const PlatformAnalytics      = lazy(() => import('@/components/admin/PlatformAnalytics'));
const AnnouncementsManager   = lazy(() => import('@/components/admin/AnnouncementsManager'));
const SupportTicketsManager  = lazy(() => import('@/components/admin/SupportTicketsManager'));
const PricingSettings        = lazy(() => import('@/components/admin/PricingSettings'));
const SupportRoleManager     = lazy(() => import('@/components/admin/SupportRoleManager'));
const DriverMapSettings      = lazy(() => import('@/components/admin/DriverMapSettings'));
const DriverMapEditor        = lazy(() => import('@/components/admin/DriverMapEditor'));
const AdminLiveDriversMap    = lazy(() => import('@/components/admin/AdminLiveDriversMap'));
const ServiceZonesEditor     = lazy(() => import('@/components/admin/ServiceZonesEditor'));
const AdminAuditTab          = lazy(() => import('@/components/admin/AdminAuditTab'));
const FeatureFlagsManager    = lazy(() => import('@/components/admin/FeatureFlagsManager'));
const OperationalOverrides   = lazy(() => import('@/components/admin/OperationalOverrides'));
const RemoteUserActions      = lazy(() => import('@/components/admin/RemoteUserActions'));
const AdminPermissionsManager= lazy(() => import('@/components/admin/AdminPermissionsManager'));
const CannedRepliesManager   = lazy(() => import('@/components/admin/CannedRepliesManager'));
const ExternalOrderIngest    = lazy(() => import('@/components/admin/ExternalOrderIngest'));
const StoreBillingSettings   = lazy(() => import('@/components/admin/StoreBillingSettings'));
const StorePromotionsManager = lazy(() => import('@/components/admin/StorePromotionsManager'));
const SystemResetPanel       = lazy(() => import('@/components/admin/SystemResetPanel'));
const LiveOpsDashboard       = lazy(() => import('@/components/admin/LiveOpsDashboard'));
const DispatchDiagnostics    = lazy(() => import('@/components/admin/DispatchDiagnostics'));
const CustomerAppCustomization = lazy(() => import('@/components/admin/CustomerAppCustomization'));
const AadeCompliance = lazy(() => import('@/components/admin/AadeCompliance'));

const StorePayablesPanel     = lazy(() => import('@/components/admin/StorePayablesPanel'));
const DriverPayablesPanel    = lazy(() => import('@/components/admin/DriverPayablesPanel'));
const MoneyBagsPanel         = lazy(() => import('@/components/admin/LedgerPanel'));
const AssignmentSettings     = lazy(() => import('@/components/admin/AssignmentSettings'));
const SystemHealthPanel      = lazy(() => import('@/components/admin/SystemHealthPanel'));
const LedgerExplorer         = lazy(() => import('@/components/admin/LedgerExplorer'));
const BasketDashboard        = lazy(() => import('@/components/admin/BasketDashboard'));
const MoneyEnginePanel       = lazy(() => import('@/components/admin/MoneyEnginePanel'));
const BufferDistributor      = lazy(() => import('@/components/admin/BufferDistributor'));
const SystemDoctorPanel      = lazy(() => import('@/components/admin/SystemDoctorPanel'));
const MissionControl         = lazy(() => import('@/components/admin/MissionControl'));
const SurgeMap               = lazy(() => import('@/components/admin/SurgeMap'));
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { useQueryClient } from '@tanstack/react-query';
import { Star } from 'lucide-react';

const statusColors: Record<string, string> = {
  pending:   'bg-yellow-500/10 text-yellow-700 dark:text-yellow-400 border-yellow-500/30',
  placed:    'bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/30',
  accepted:  'bg-indigo-500/10 text-indigo-700 dark:text-indigo-400 border-indigo-500/30',
  preparing: 'bg-orange-500/10 text-orange-700 dark:text-orange-400 border-orange-500/30',
  ready:     'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/30',
  picked_up: 'bg-purple-500/10 text-purple-700 dark:text-purple-400 border-purple-500/30',
  delivered: 'bg-green-500/10 text-green-700 dark:text-green-400 border-green-500/30',
  cancelled: 'bg-red-500/10 text-red-700 dark:text-red-400 border-red-500/30',
};

const statusLabelsEl: Record<string, string> = {
  pending: 'Εκκρεμεί', placed: 'Υποβλήθηκε', accepted: 'Αποδεκτή',
  preparing: 'Ετοιμάζεται', ready: 'Έτοιμη', picked_up: 'Παραλήφθηκε',
  delivered: 'Παραδόθηκε', cancelled: 'Ακυρώθηκε',
};

const roleLabels: Record<string, string> = {
  customer: 'Πελάτης', driver: 'Οδηγός', store: 'Κατάστημα',
};

export default function AdminApp() {
  const { signOut } = useAuth();
  const { orders, stores, profiles, earnings, reviews, userRoles, driverProfiles, driverStates, driverWallets } = useAdminData();
  const queryClient = useQueryClient();
  const [activeSection, setActiveSection] = useState('overview');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [paletteOpen, setPaletteOpen] = useState(false);

  const driverCodeMap = new Map((driverProfiles.data ?? []).map(d => [d.user_id, d.driver_code]));
  const adminUserIds = new Set(userRoles.data?.filter(r => r.role === 'admin').map(r => r.user_id) ?? []);

  const allDrivers = profiles.data?.filter(p => p.role === 'driver') ?? [];
  const [driverFilter, setDriverFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const drivers = allDrivers.filter(d => {
    if (driverFilter === 'all') return true;
    const dp = driverProfiles.data?.find(dp => dp.user_id === d.user_id);
    return driverFilter === 'active' ? dp?.is_active !== false : dp?.is_active === false;
  });

  const [storeFilter, setStoreFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const allStores = stores.data ?? [];
  const filteredStores = allStores.filter(s => {
    if (storeFilter === 'all') return true;
    return storeFilter === 'active' ? s.is_active !== false : s.is_active === false;
  });

  // Actions
  const handleUpdateOrderStatus = async (orderId: string, status: string) => {
    const { error } = await supabase.from('orders').update({ status: status as any }).eq('id', orderId);
    if (error) toast.error('Αποτυχία ενημέρωσης');
    else { toast.success('Ενημερώθηκε'); queryClient.invalidateQueries({ queryKey: ['admin-orders'] }); }
  };

  const handleAssignDriver = async (orderId: string, driverId: string) => {
    const { error } = await supabase.from('orders').update({ driver_id: driverId === 'unassign' ? null : driverId }).eq('id', orderId);
    if (error) toast.error('Αποτυχία ανάθεσης');
    else { toast.success('Ανατέθηκε'); queryClient.invalidateQueries({ queryKey: ['admin-orders'] }); }
  };

  const handleToggleStoreActive = async (storeId: string, currentActive: boolean | null) => {
    const { error } = await supabase.from('stores').update({ is_active: !currentActive }).eq('id', storeId);
    if (error) toast.error('Αποτυχία');
    else { toast.success(currentActive ? 'Απενεργοποιήθηκε' : 'Ενεργοποιήθηκε'); queryClient.invalidateQueries({ queryKey: ['admin-stores'] }); }
  };

  const handleToggleDriverActive = async (userId: string, currentActive: boolean) => {
    const { error } = await supabase.from('driver_profiles').update({ is_active: !currentActive } as any).eq('user_id', userId);
    if (error) toast.error('Αποτυχία');
    else { toast.success(currentActive ? 'Απενεργοποιήθηκε' : 'Ενεργοποιήθηκε'); queryClient.invalidateQueries({ queryKey: ['admin-driver-profiles'] }); }
  };

  const handleResetDriverCash = async (userId: string, driverName: string) => {
    if (!confirm(`Μηδενισμός ταμείου βάρδιας για ${driverName};`)) return;
    const { error } = await (supabase.rpc as any)('admin_reset_driver_cash', { p_driver_id: userId });
    if (error) toast.error(error.message || 'Αποτυχία');
    else { toast.success('Ταμείο μηδενίστηκε'); queryClient.invalidateQueries({ queryKey: ['admin-driver-states'] }); }
  };

  const handleResetDriverWallet = async (userId: string, driverName: string) => {
    if (!confirm(`Μηδενισμός πορτοφολιού για ${driverName}; (διαθέσιμο + εκκρεμές → 0)`)) return;
    const { error } = await (supabase.rpc as any)('admin_reset_driver_wallet', { p_driver_id: userId });
    if (error) toast.error(error.message || 'Αποτυχία');
    else { toast.success('Πορτοφόλι μηδενίστηκε'); queryClient.invalidateQueries({ queryKey: ['admin-driver-wallets'] }); }
  };

  const handleForceEndShift = async (userId: string, driverName: string) => {
    if (!confirm(`Τερματισμός βάρδιας για ${driverName};`)) return;
    const { error } = await (supabase.rpc as any)('admin_force_end_driver_shift', { p_driver_id: userId });
    if (error) toast.error(error.message || 'Αποτυχία');
    else { toast.success('Βάρδια τερματίστηκε'); queryClient.invalidateQueries({ queryKey: ['admin-driver-states'] }); }
  };

  const handleGrantBonus = async (userId: string, driverName: string) => {
    const raw = prompt(`Bonus € για ${driverName}:`, '5');
    if (!raw) return;
    const amount = Number(raw.replace(',', '.'));
    if (!Number.isFinite(amount) || amount <= 0) { toast.error('Μη έγκυρο ποσό'); return; }
    const note = prompt('Σημείωση (προαιρετικό):', 'Admin bonus') || 'Admin bonus';
    const { error } = await (supabase.rpc as any)('admin_grant_driver_bonus', { p_driver_id: userId, p_amount: amount, p_note: note });
    if (error) toast.error(error.message || 'Αποτυχία');
    else { toast.success(`+€${amount.toFixed(2)} στο πορτοφόλι`); queryClient.invalidateQueries({ queryKey: ['admin-driver-wallets'] }); }
  };






  const handleChangeRole = async (userId: string, newRole: string) => {
    const { error } = await supabase.from('profiles').update({ role: newRole as any }).eq('user_id', userId);
    if (error) toast.error('Αποτυχία');
    else { toast.success('Ρόλος ενημερώθηκε'); queryClient.invalidateQueries({ queryKey: ['admin-profiles'] }); }
  };

  const handleToggleAdmin = async (userId: string, isCurrentlyAdmin: boolean) => {
    if (isCurrentlyAdmin) {
      const { error } = await supabase.from('user_roles').delete().eq('user_id', userId).eq('role', 'admin');
      if (error) toast.error('Αποτυχία');
      else { toast.success('Admin αφαιρέθηκε'); queryClient.invalidateQueries({ queryKey: ['admin-user-roles'] }); }
    } else {
      const { error } = await supabase.from('user_roles').insert({ user_id: userId, role: 'admin' as any });
      if (error) toast.error('Αποτυχία');
      else { toast.success('Admin εκχωρήθηκε'); queryClient.invalidateQueries({ queryKey: ['admin-user-roles'] }); }
    }
  };

  const renderContent = () => {
    switch (activeSection) {
      case 'overview':
        return <OpsHome />;
      case 'overview_legacy':
        return (
          <AdminOverview orders={orders.data ?? []} stores={stores.data ?? []} profiles={profiles.data ?? []} reviews={reviews.data ?? []} earnings={earnings.data ?? []} />
        );
      case 'live_ops':
        return <LiveOpsDashboard />;
      case 'system_health':
        return <SystemHealthPanel />;
      case 'analytics':
        return <PlatformAnalytics orders={(orders.data ?? []) as any} profiles={(profiles.data ?? []) as any} />;
      case 'audit':
        return <AdminAuditTab />;
      case 'orders':
        return <OrdersKanban />;
      case 'orders_table':
        return <OrdersSection orders={orders.data} drivers={allDrivers} statusColors={statusColors} statusLabels={statusLabelsEl} onUpdateStatus={handleUpdateOrderStatus} onAssignDriver={handleAssignDriver} />;
      case 'stores':
        return <StoresSection stores={filteredStores} allStores={allStores} filter={storeFilter} setFilter={setStoreFilter} onToggle={handleToggleStoreActive} />;
      case 'drivers':
        return <DriversSection drivers={drivers} allDrivers={allDrivers} driverProfiles={driverProfiles.data} driverStates={driverStates.data} driverWallets={driverWallets.data} filter={driverFilter} setFilter={setDriverFilter} onToggle={handleToggleDriverActive} onResetCash={handleResetDriverCash} onResetWallet={handleResetDriverWallet} />;
      case 'users':
        return <UsersSection profiles={profiles.data} adminUserIds={adminUserIds} driverCodeMap={driverCodeMap} onChangeRole={handleChangeRole} onToggleAdmin={handleToggleAdmin} />;
      case 'financials':
        // Legacy id — merged into Money Bags
        return <MoneyBagsPanel />;
      case 'store_payables':
        return <StorePayablesPanel />;
      case 'driver_payables':
        return <DriverPayablesPanel />;
      case 'buffer':
        return <BufferDistributor />;
      case 'system_doctor':
        return <SystemDoctorPanel />;
      case 'mission_control':
        return <MissionControl />;
      case 'surge':
        return <SurgeMap />;
      case 'pricing':
        return <PricingSettings />;
      case 'support_roles':
        return <SupportRoleManager />;
      case 'tickets':
        return <SupportTicketsManager />;
      case 'driver_map_settings':
        return <DriverMapSettings />;
      case 'driver_map_editor':
        return <DriverMapEditor />;
      case 'drivers_live_map':
        return <AdminLiveDriversMap />;
      case 'service_zones':
        return <ServiceZonesEditor />;
      case 'reviews':
        return <ReviewsSection reviews={reviews.data} />;
      case 'announcements':
        return <AnnouncementsManager />;
      case 'feature_flags':
        return <FeatureFlagsManager />;
      case 'overrides':
        return <OperationalOverrides />;
      case 'remote_actions':
        return <RemoteUserActions />;
      case 'admin_perms':
        return <AdminPermissionsManager />;
      case 'canned_replies':
        return <CannedRepliesManager />;
      case 'external_orders':
        return <ExternalOrderIngest />;
      case 'dispatch_debug':
        return <DispatchDiagnostics />;
      case 'store_billing':
        return <StoreBillingSettings />;
      case 'promotions':
        return <StorePromotionsManager />;
      case 'system_reset':
        return <SystemResetPanel />;
      case 'customer_app_config':
        return <CustomerAppCustomization />;
      case 'aade_compliance':
        return <AadeCompliance />;
      default:
        return null;
    }
  };

  return (
    <div className="admin-shell min-h-screen bg-muted/30 flex">
      {/* Desktop Sidebar */}
      <div className="hidden md:block">
        <AdminSidebar activeSection={activeSection} onSectionChange={setActiveSection} />
      </div>

      {/* Mobile Sidebar (Sheet drawer) */}
      <div className="md:hidden">
        <AdminSidebar
          activeSection={activeSection}
          onSectionChange={setActiveSection}
          mobileOpen={mobileMenuOpen}
          onMobileOpenChange={setMobileMenuOpen}
        />
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Bar */}
        <header className="border-b border-border bg-card/90 backdrop-blur-md shrink-0 sticky top-0 z-20 shadow-[0_1px_0_0_hsl(var(--border)/0.6)]">
          <div className="h-12 flex items-center justify-between px-3 lg:px-4">
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="icon" className="md:hidden h-8 w-8" onClick={() => setMobileMenuOpen(true)}>
                <Menu className="h-4 w-4" />
              </Button>
              <button
                onClick={() => setPaletteOpen(true)}
                className="relative hidden sm:flex items-center gap-2 pl-2.5 pr-2 h-8 w-72 rounded-md bg-muted/40 border border-border/60 text-[12.5px] text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
              >
                <Search className="h-3.5 w-3.5" />
                <span className="flex-1 text-left">Αναζήτηση & μετάβαση…</span>
                <kbd className="hidden md:inline-flex h-5 px-1.5 items-center rounded border border-border bg-background text-[10px] font-mono text-muted-foreground">⌘K</kbd>
              </button>
              <Button variant="ghost" size="icon" className="sm:hidden h-8 w-8" onClick={() => setPaletteOpen(true)}>
                <Search className="h-4 w-4" />
              </Button>
            </div>
            <div className="flex items-center gap-2">
              {/* Environment + system status chip */}
              <div className="hidden md:flex items-center gap-1.5 h-7 pl-1.5 pr-2.5 rounded-md border border-border/70 bg-muted/30">
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full rounded-full bg-success/60 animate-ping opacity-50" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-success" />
                </span>
                <span className="text-[10.5px] font-bold uppercase tracking-wider text-muted-foreground">Production</span>
                <span className="h-3 w-px bg-border mx-0.5" />
                <span className="text-[10.5px] font-medium tabular-nums text-foreground/80">v2.4</span>
              </div>
              <Button variant="ghost" size="icon" className="h-8 w-8 relative">
                <Bell className="h-3.5 w-3.5" />
              </Button>
              <div className="h-5 w-px bg-border mx-0.5" />
              <Button variant="ghost" size="sm" onClick={signOut} className="h-8 gap-1.5 text-[12px] text-muted-foreground hover:text-foreground">
                <LogOut className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Αποσύνδεση</span>
              </Button>
            </div>
          </div>

          {/* Live KPI strip — premium tiles with delta */}
          {(() => {
            const today = new Date(); today.setHours(0,0,0,0);
            const yesterday = new Date(today); yesterday.setDate(yesterday.getDate() - 1);
            const todays = (orders.data ?? []).filter((o: any) => new Date(o.created_at) >= today);
            const yesterdays = (orders.data ?? []).filter((o: any) => {
              const d = new Date(o.created_at); return d >= yesterday && d < today;
            });
            const revenueToday = todays.reduce((s: number, o: any) => s + Number(o.total_amount || 0), 0);
            const revenueYesterday = yesterdays.reduce((s: number, o: any) => s + Number(o.total_amount || 0), 0);
            const adminToday = todays.reduce((s: number, o: any) => s + Number(o.platform_profit || 0), 0);
            const activeDrivers = (driverStates.data ?? []).filter((d: any) => !!d.shift_started_at && !d.on_break).length;
            const live = todays.filter((o: any) => !['delivered', 'cancelled'].includes(o.status)).length;
            const orderDelta = yesterdays.length > 0 ? ((todays.length - yesterdays.length) / yesterdays.length) * 100 : null;
            const revDelta = revenueYesterday > 0 ? ((revenueToday - revenueYesterday) / revenueYesterday) * 100 : null;
            return (
              <div className="px-3 lg:px-4 py-2 border-t border-border/40 bg-gradient-to-b from-muted/10 to-transparent overflow-x-auto">
                <div className="flex gap-2 min-w-max">
                  <KpiTile icon={Activity} label="Live παραγγελίες" value={String(live)} accent="primary" pulse={live > 0} />
                  <KpiTile icon={ShoppingBag} label="Σήμερα" value={String(todays.length)} accent="info" delta={orderDelta} />
                  <KpiTile icon={TrendingUp} label="Τζίρος σήμερα" value={`€${revenueToday.toFixed(0)}`} accent="foreground" delta={revDelta} />
                  <KpiTile icon={Wallet} label="Admin κερδίζει" value={`€${adminToday.toFixed(2)}`} accent="success" />
                  <KpiTile icon={Bike} label="Ενεργοί οδηγοί" value={String(activeDrivers)} accent="warning" />
                </div>
              </div>
            );
          })()}

          {/* Sub-tab strip — underline style */}
          {(() => {
            const tabs = getTabsForSection(findParentSection(activeSection));
            if (tabs.length <= 1) return null;
            return (
              <div className="px-3 lg:px-4 border-t border-border/50 overflow-x-auto bg-card">
                <div className="flex gap-0 min-w-max">
                  {tabs.map(t => {
                    const isActive = t.id === activeSection;
                    return (
                      <button
                        key={t.id}
                        onClick={() => setActiveSection(t.id)}
                        className={cn(
                          'relative px-3 h-9 text-[12px] font-medium transition-colors whitespace-nowrap',
                          isActive
                            ? 'text-foreground'
                            : 'text-muted-foreground hover:text-foreground',
                        )}
                      >
                        {t.label}
                        {isActive && (
                          <span className="absolute left-2 right-2 -bottom-px h-[2px] rounded-t bg-primary" />
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })()}
        </header>

        {/* Page Content */}
        <main className="flex-1 p-2.5 lg:p-3.5 overflow-auto">
          <div className="max-w-[1400px] mx-auto">
            <Suspense fallback={
              <div className="flex items-center justify-center py-16">
                <div className="h-6 w-6 rounded-full border-2 border-primary border-t-transparent animate-spin" />
              </div>
            }>
              {renderContent()}
            </Suspense>
          </div>
        </main>
      </div>

      <AdminCommandPalette
        open={paletteOpen}
        onOpenChange={setPaletteOpen}
        onJump={(id) => setActiveSection(id)}
      />
    </div>
  );
}

/* ── Sub-sections extracted as components ── */

function SectionHeader({ title, sub, count, children }: { title: string; sub?: string; count?: number; children?: React.ReactNode }) {
  return (
    <div className="admin-section-header">
      <div className="flex items-baseline gap-2 min-w-0">
        <h2 className="admin-section-title truncate">{title}</h2>
        {typeof count === 'number' && (
          <span className="text-[11px] tabular-nums text-muted-foreground bg-muted px-1.5 py-0.5 rounded">{count}</span>
        )}
        {sub && <span className="admin-section-sub truncate">· {sub}</span>}
      </div>
      <div className="flex items-center gap-1.5">{children}</div>
    </div>
  );
}

function OrdersSection({ orders, drivers, statusColors, statusLabels, onUpdateStatus, onAssignDriver }: any) {
  return (
    <div className="space-y-3">
      <SectionHeader title="Παραγγελίες" count={orders?.length ?? 0} sub="ζωντανή ροή & ανάθεση" />
      <AssignmentSettings />
      <div className="admin-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="admin-table">
            <thead>
              <tr>
                <th>ID</th><th>Κατάσταση</th><th>Οδηγός</th>
                <th className="text-right">Σύνολο</th><th>Ημερομηνία</th><th>Ενέργειες</th>
              </tr>
            </thead>
            <tbody>
              {orders?.map((order: any) => (
                <tr key={order.id}>
                  <td className="font-mono text-[11.5px] text-muted-foreground">#{order.id.slice(0, 8)}</td>
                  <td>
                    <span className={`admin-pill ${statusColors[order.status] ?? ''}`}>
                      {statusLabels[order.status] ?? order.status}
                    </span>
                  </td>
                  <td>
                    <Select value={order.driver_id || 'unassigned'} onValueChange={val => onAssignDriver(order.id, val)}>
                      <SelectTrigger className="w-36 h-7 text-[11.5px]"><SelectValue placeholder="Χωρίς οδηγό" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="unassigned" disabled>Χωρίς οδηγό</SelectItem>
                        <SelectItem value="unassign">✕ Αφαίρεση</SelectItem>
                        {drivers.map((d: any) => <SelectItem key={d.user_id} value={d.user_id}>{d.full_name || d.user_id.slice(0, 8)}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </td>
                  <td className="font-semibold tabular-nums text-right">€{Number(order.total_amount).toFixed(2)}</td>
                  <td className="text-[11.5px] text-muted-foreground tabular-nums">{format(new Date(order.created_at), 'dd MMM, HH:mm')}</td>
                  <td>
                    <Select value={order.status} onValueChange={val => onUpdateStatus(order.id, val)}>
                      <SelectTrigger className="w-32 h-7 text-[11.5px]"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {['pending','placed','accepted','preparing','ready','picked_up','delivered','cancelled'].map(s => (
                          <SelectItem key={s} value={s}>{statusLabels[s] ?? s}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </td>
                </tr>
              ))}
              {!orders?.length && <tr><td colSpan={6} className="text-center text-muted-foreground py-10">Δεν υπάρχουν παραγγελίες</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function StoresSection({ stores, allStores, filter, setFilter, onToggle }: any) {
  return (
    <div className="space-y-3">
      <SectionHeader title="Καταστήματα" count={allStores.length}>
        <div className="flex gap-1 p-0.5 bg-muted rounded-md">
          {(['all', 'active', 'inactive'] as const).map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-2.5 h-6 text-[11px] font-medium rounded transition-colors ${filter === f ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
            >
              {f === 'all' ? `Όλα ${allStores.length}` : f === 'active' ? `Ενεργά ${allStores.filter((s: any) => s.is_active !== false).length}` : `Ανενεργά ${allStores.filter((s: any) => s.is_active === false).length}`}
            </button>
          ))}
        </div>
      </SectionHeader>
      <div className="admin-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="admin-table">
            <thead><tr><th>Όνομα</th><th>Διεύθυνση</th><th className="w-20">Ενεργό</th><th>Κατάσταση</th><th>Δημιουργία</th></tr></thead>
            <tbody>
              {stores.map((store: any) => (
                <tr key={store.id}>
                  <td className="font-medium">{store.name}</td>
                  <td className="text-muted-foreground">{store.address}</td>
                  <td><Switch checked={!!store.is_active} onCheckedChange={() => onToggle(store.id, store.is_active)} /></td>
                  <td>
                    <span className={`admin-pill ${store.busy_mode ? 'bg-red-500/10 text-red-700 dark:text-red-400 border-red-500/30' : 'bg-muted text-muted-foreground border-border'}`}>
                      {store.busy_mode ? 'Πολυάσχολο' : 'Κανονικό'}
                    </span>
                  </td>
                  <td className="text-[11.5px] text-muted-foreground tabular-nums">{format(new Date(store.created_at), 'dd MMM yyyy')}</td>
                </tr>
              ))}
              {!stores.length && <tr><td colSpan={5} className="text-center text-muted-foreground py-10">Κανένα κατάστημα</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function DriversSection({ drivers, allDrivers, driverProfiles, driverStates, driverWallets, filter, setFilter, onToggle, onResetCash, onResetWallet }: any) {
  return (
    <div className="space-y-3">
      <SectionHeader title="Οδηγοί" count={allDrivers.length}>
        <div className="flex gap-1 p-0.5 bg-muted rounded-md">
          {(['all', 'active', 'inactive'] as const).map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-2.5 h-6 text-[11px] font-medium rounded transition-colors ${filter === f ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
            >
              {f === 'all' ? `Όλοι ${allDrivers.length}` : f === 'active' ? 'Ενεργοί' : 'Ανενεργοί'}
            </button>
          ))}
        </div>
      </SectionHeader>
      <div className="admin-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="admin-table">
            <thead><tr><th>Κωδικός</th><th>Όνομα</th><th>Τηλέφωνο</th><th className="w-20">Ενεργός</th><th>Ταμείο Βάρδιας</th><th>Πορτοφόλι</th><th>Εγγραφή</th></tr></thead>
            <tbody>
              {drivers.map((driver: any) => {
                const dp = driverProfiles?.find((d: any) => d.user_id === driver.user_id);
                const ds = driverStates?.find((s: any) => s.driver_id === driver.user_id);
                const dw = driverWallets?.find((w: any) => w.driver_id === driver.user_id);
                const cash = Number(ds?.shift_cash_balance ?? 0);
                const walletAvail = Number(dw?.available_balance ?? 0);
                const walletPending = Number(dw?.pending_balance ?? 0);
                const walletTotal = walletAvail + walletPending;
                return (
                  <tr key={driver.id}>
                    <td><span className="font-mono text-[11px] text-muted-foreground">{dp?.driver_code || '—'}</span></td>
                    <td className="font-medium">{driver.full_name || '—'}</td>
                    <td className="text-muted-foreground tabular-nums">{driver.phone || '—'}</td>
                    <td><Switch checked={dp?.is_active ?? true} onCheckedChange={() => dp && onToggle(driver.user_id, dp.is_active)} /></td>
                    <td>
                      <div className="flex items-center gap-1.5">
                        <span className={`tabular-nums font-medium ${cash > 0 ? 'text-foreground' : 'text-muted-foreground'}`}>
                          €{cash.toFixed(2)}
                        </span>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-6 px-1.5 text-[10px] text-muted-foreground hover:text-destructive"
                          disabled={cash <= 0}
                          onClick={() => onResetCash(driver.user_id, driver.full_name || 'οδηγό')}
                          title="Μηδενισμός ταμείου"
                        >
                          Μηδενισμός
                        </Button>
                      </div>
                    </td>
                    <td>
                      <div className="flex items-center gap-1.5">
                        <span className={`tabular-nums font-medium ${walletTotal > 0 ? 'text-foreground' : 'text-muted-foreground'}`} title={`Διαθέσιμο €${walletAvail.toFixed(2)} • Εκκρεμές €${walletPending.toFixed(2)}`}>
                          €{walletTotal.toFixed(2)}
                        </span>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-6 px-1.5 text-[10px] text-muted-foreground hover:text-destructive"
                          disabled={walletTotal <= 0}
                          onClick={() => onResetWallet(driver.user_id, driver.full_name || 'οδηγό')}
                          title="Μηδενισμός πορτοφολιού"
                        >
                          Μηδενισμός
                        </Button>
                      </div>
                    </td>
                    <td className="text-[11.5px] text-muted-foreground tabular-nums">{format(new Date(driver.created_at), 'dd MMM yyyy')}</td>
                  </tr>
                );
              })}
              {!drivers.length && <tr><td colSpan={7} className="text-center text-muted-foreground py-10">Κανένας οδηγός</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function UsersSection({ profiles, adminUserIds, driverCodeMap, onChangeRole, onToggleAdmin }: any) {
  return (
    <div className="space-y-3">
      <SectionHeader title="Χρήστες & Δικαιώματα" count={profiles?.length ?? 0} />
      <div className="admin-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="admin-table">
            <thead><tr><th>Όνομα</th><th>Κωδικός</th><th>Ρόλος</th><th>Admin</th><th>Τηλέφωνο</th><th>Εγγραφή</th></tr></thead>
            <tbody>
              {profiles?.map((profile: any) => (
                <tr key={profile.id}>
                  <td className="font-medium">{profile.full_name || '—'}</td>
                  <td>{driverCodeMap.get(profile.user_id) ? <span className="font-mono text-[11px] text-muted-foreground">{driverCodeMap.get(profile.user_id)}</span> : '—'}</td>
                  <td>
                    <Select value={profile.role} onValueChange={val => onChangeRole(profile.user_id, val)}>
                      <SelectTrigger className="w-28 h-7 text-[11.5px]"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {['customer','driver','store'].map(r => <SelectItem key={r} value={r}>{{ customer: 'Πελάτης', driver: 'Οδηγός', store: 'Κατάστημα' }[r]}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </td>
                  <td>
                    <div className="flex items-center gap-1.5">
                      <Switch checked={adminUserIds.has(profile.user_id)} onCheckedChange={() => onToggleAdmin(profile.user_id, adminUserIds.has(profile.user_id))} />
                      {adminUserIds.has(profile.user_id) && (
                        <span className="admin-pill bg-primary/10 text-primary border-primary/30"><Shield className="h-2.5 w-2.5" />Admin</span>
                      )}
                    </div>
                  </td>
                  <td className="text-muted-foreground tabular-nums">{profile.phone || '—'}</td>
                  <td className="text-[11.5px] text-muted-foreground tabular-nums">{format(new Date(profile.created_at), 'dd MMM yyyy')}</td>
                </tr>
              ))}
              {!profiles?.length && <tr><td colSpan={6} className="text-center text-muted-foreground py-10">Κανένας χρήστης</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function ReviewsSection({ reviews }: { reviews: any[] | undefined }) {
  return (
    <div className="space-y-3">
      <SectionHeader title="Κριτικές" count={reviews?.length ?? 0} />
      <div className="admin-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="admin-table">
            <thead><tr><th>Βαθμολογία</th><th>Σχόλιο</th><th>Παραγγελία</th><th>Ημερομηνία</th></tr></thead>
            <tbody>
              {reviews?.map((review: any) => (
                <tr key={review.id}>
                  <td>
                    <div className="flex gap-0.5">
                      {Array.from({ length: 5 }, (_, i) => (
                        <Star key={i} className={`h-3 w-3 ${i < review.rating ? 'text-yellow-500 fill-yellow-500' : 'text-muted-foreground/30'}`} />
                      ))}
                    </div>
                  </td>
                  <td className="max-w-md truncate text-muted-foreground">{review.comment || '—'}</td>
                  <td className="font-mono text-[11px] text-muted-foreground">#{review.order_id.slice(0, 8)}</td>
                  <td className="text-[11.5px] text-muted-foreground tabular-nums">{format(new Date(review.created_at), 'dd MMM yyyy')}</td>
                </tr>
              ))}
              {!reviews?.length && <tr><td colSpan={4} className="text-center text-muted-foreground py-10">Καμία κριτική</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function KpiTile({
  icon: Icon, label, value, accent, pulse, delta,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  accent: 'primary' | 'success' | 'info' | 'warning' | 'foreground';
  pulse?: boolean;
  delta?: number | null;
}) {
  const accentMap = {
    primary:    { text: 'text-primary',    bg: 'bg-primary/10',    bar: 'bg-primary' },
    success:    { text: 'text-success',    bg: 'bg-success/10',    bar: 'bg-success' },
    info:       { text: 'text-info',       bg: 'bg-info/10',       bar: 'bg-info' },
    warning:    { text: 'text-warning',    bg: 'bg-warning/10',    bar: 'bg-warning' },
    foreground: { text: 'text-foreground', bg: 'bg-muted',         bar: 'bg-foreground/40' },
  } as const;
  const a = accentMap[accent];
  const showDelta = typeof delta === 'number' && isFinite(delta);
  const deltaUp = showDelta && delta! >= 0;
  return (
    <div className="relative flex items-center gap-2.5 pl-3 pr-3.5 h-11 rounded-lg bg-card border border-border/70 shadow-[0_1px_0_0_hsl(var(--border)/0.5)] hover:border-border transition-colors shrink-0 overflow-hidden">
      <span className={cn('absolute left-0 top-0 bottom-0 w-[2px]', a.bar)} />
      <span className={cn('relative flex items-center justify-center h-6 w-6 rounded-md', a.bg, a.text)}>
        <Icon className="h-3.5 w-3.5" />
        {pulse && <span className="absolute -top-0.5 -right-0.5 h-1.5 w-1.5 rounded-full bg-primary animate-pulse ring-2 ring-card" />}
      </span>
      <div className="flex flex-col leading-tight">
        <span className="text-[9.5px] uppercase tracking-[0.1em] text-muted-foreground font-semibold">{label}</span>
        <div className="flex items-baseline gap-1.5">
          <span className={cn('text-[14px] font-bold tabular-nums', a.text)}>{value}</span>
          {showDelta && (
            <span className={cn(
              'text-[10px] font-semibold tabular-nums',
              deltaUp ? 'text-success' : 'text-destructive',
            )}>
              {deltaUp ? '▲' : '▼'} {Math.abs(delta!).toFixed(0)}%
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
