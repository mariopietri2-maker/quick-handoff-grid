import { useState } from 'react';
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
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Shield, Users, Store, ShoppingBag, LogOut, Search, Bell, Menu, AlertTriangle } from 'lucide-react';
import PlatformAnalytics from '@/components/admin/PlatformAnalytics';
import AnnouncementsManager from '@/components/admin/AnnouncementsManager';
import AssignmentSettings from '@/components/admin/AssignmentSettings';

import SupportTicketsManager from '@/components/admin/SupportTicketsManager';
import FinancialsManager from '@/components/admin/FinancialsManager';
import PricingSettings from '@/components/admin/PricingSettings';
import SupportRoleManager from '@/components/admin/SupportRoleManager';
import WalletAdjustDialog from '@/components/admin/WalletAdjustDialog';
import SuspendDialog from '@/components/admin/SuspendDialog';
import DemandZonesManager from '@/components/admin/DemandZonesManager';
import DriverMapSettings from '@/components/admin/DriverMapSettings';
import AdminSidebar from '@/components/admin/AdminSidebar';
import AdminOverview from '@/components/admin/AdminOverview';
import AdminActivityLog from '@/components/admin/AdminActivityLog';
import FeatureFlagsManager from '@/components/admin/FeatureFlagsManager';
import OperationalOverrides from '@/components/admin/OperationalOverrides';
import RemoteUserActions from '@/components/admin/RemoteUserActions';
import AdminPermissionsManager from '@/components/admin/AdminPermissionsManager';
import AdminAuditLog from '@/components/admin/AdminAuditLog';
import LiveOpsKPI from '@/components/admin/LiveOpsKPI';
import CannedRepliesManager from '@/components/admin/CannedRepliesManager';
import FraudSignalsPanel from '@/components/admin/FraudSignalsPanel';
import ExternalOrderIngest from '@/components/admin/ExternalOrderIngest';
import StoreBillingSettings from '@/components/admin/StoreBillingSettings';
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

  const [wiping, setWiping] = useState(false);
  const handleWipeAll = async () => {
    const confirm1 = confirm('⚠️ ΠΡΟΣΟΧΗ: Θα διαγραφούν ΟΛΑ τα δεδομένα (παραγγελίες, μενού, κριτικές, ανακοινώσεις, tickets, συναλλαγές κτλ) και θα μηδενιστούν όλα τα πορτοφόλια & πόντοι. Συνέχεια;');
    if (!confirm1) return;
    const typed = prompt('Πληκτρολόγησε "RESET" για επιβεβαίωση:');
    if (typed !== 'RESET') { toast.error('Ακυρώθηκε'); return; }
    setWiping(true);
    const { error } = await (supabase.rpc as any)('admin_wipe_all_data');
    setWiping(false);
    if (error) { toast.error(error.message || 'Αποτυχία'); return; }
    toast.success('Όλα τα δεδομένα διαγράφηκαν & μηδενίστηκαν');
    queryClient.invalidateQueries();
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
        return (
          <div className="space-y-6">
            <div className="flex items-center justify-between gap-3 rounded-lg border border-destructive/30 bg-destructive/5 p-3">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-destructive">Επαναφορά πλατφόρμας</p>
                <p className="text-[11px] text-muted-foreground">Διαγράφει όλες τις παραγγελίες, μενού, κριτικές, tickets και μηδενίζει πορτοφόλια & πόντους.</p>
              </div>
              <Button variant="destructive" size="sm" disabled={wiping} onClick={handleWipeAll}>
                {wiping ? 'Διαγραφή…' : 'Reset All Data'}
              </Button>
            </div>
            <LiveOpsKPI />
            <AdminOverview orders={orders.data ?? []} stores={stores.data ?? []} profiles={profiles.data ?? []} reviews={reviews.data ?? []} earnings={earnings.data ?? []} />
          </div>
        );
      case 'analytics':
        return <PlatformAnalytics orders={(orders.data ?? []) as any} profiles={(profiles.data ?? []) as any} />;
      case 'activity':
        return <AdminActivityLog />;
      case 'orders':
        return <OrdersSection orders={orders.data} drivers={allDrivers} statusColors={statusColors} statusLabels={statusLabelsEl} onUpdateStatus={handleUpdateOrderStatus} onAssignDriver={handleAssignDriver} />;
      case 'stores':
        return <StoresSection stores={filteredStores} allStores={allStores} filter={storeFilter} setFilter={setStoreFilter} onToggle={handleToggleStoreActive} />;
      case 'drivers':
        return <DriversSection drivers={drivers} allDrivers={allDrivers} driverProfiles={driverProfiles.data} driverStates={driverStates.data} driverWallets={driverWallets.data} filter={driverFilter} setFilter={setDriverFilter} onToggle={handleToggleDriverActive} onResetCash={handleResetDriverCash} onResetWallet={handleResetDriverWallet} />;
      case 'users':
        return <UsersSection profiles={profiles.data} adminUserIds={adminUserIds} driverCodeMap={driverCodeMap} onChangeRole={handleChangeRole} onToggleAdmin={handleToggleAdmin} />;
      case 'financials':
        return <FinancialsManager />;
      case 'pricing':
        return <PricingSettings />;
      case 'support_roles':
        return <SupportRoleManager />;
      case 'tickets':
        return <SupportTicketsManager />;
      case 'driver_map_settings':
        return <DriverMapSettings />;
      case 'demand':
        return <DemandZonesManager />;
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
      case 'audit_log':
        return <AdminAuditLog />;
      case 'canned_replies':
        return <CannedRepliesManager />;
      case 'fraud':
        return <FraudSignalsPanel />;
      case 'external_orders':
        return <ExternalOrderIngest />;
      case 'store_billing':
        return <StoreBillingSettings />;
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
        {/* Top Bar — slim, monospaced search, command-palette feel */}
        <header className="h-12 border-b border-border bg-card/80 backdrop-blur flex items-center justify-between px-3 lg:px-4 shrink-0 sticky top-0 z-20">
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" className="md:hidden h-8 w-8" onClick={() => setMobileMenuOpen(true)}>
              <Menu className="h-4 w-4" />
            </Button>
            <div className="relative hidden sm:block">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                placeholder="Αναζήτηση παντού…"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="pl-8 w-72 h-8 bg-muted/50 border-border/60 text-[12.5px] focus-visible:ring-1"
              />
              <kbd className="hidden lg:inline-flex absolute right-2 top-1/2 -translate-y-1/2 h-5 px-1.5 items-center text-[10px] font-mono text-muted-foreground bg-background border border-border/60 rounded">⌘K</kbd>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon" className="h-8 w-8 relative">
              <Bell className="h-3.5 w-3.5" />
            </Button>
            <div className="h-5 w-px bg-border mx-1" />
            <Button variant="ghost" size="sm" onClick={signOut} className="h-8 gap-1.5 text-[12px] text-muted-foreground hover:text-foreground">
              <LogOut className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Αποσύνδεση</span>
            </Button>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 p-3 lg:p-4 overflow-auto">
          {renderContent()}
        </main>
      </div>
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
