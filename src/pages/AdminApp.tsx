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
import { Shield, Users, Store, ShoppingBag, LogOut, Search, Bell, Menu } from 'lucide-react';
import PlatformAnalytics from '@/components/admin/PlatformAnalytics';
import AnnouncementsManager from '@/components/admin/AnnouncementsManager';
import AssignmentSettings from '@/components/admin/AssignmentSettings';
import AdminDriversMap from '@/components/admin/AdminDriversMap';
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
  pending: 'bg-yellow-500/10 text-yellow-600 border-yellow-500/20',
  placed: 'bg-blue-500/10 text-blue-600 border-blue-500/20',
  accepted: 'bg-indigo-500/10 text-indigo-600 border-indigo-500/20',
  preparing: 'bg-orange-500/10 text-orange-600 border-orange-500/20',
  ready: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20',
  picked_up: 'bg-purple-500/10 text-purple-600 border-purple-500/20',
  delivered: 'bg-green-500/10 text-green-600 border-green-500/20',
  cancelled: 'bg-red-500/10 text-red-600 border-red-500/20',
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
  const { orders, stores, profiles, earnings, reviews, userRoles, driverProfiles } = useAdminData();
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
        return <DriversSection drivers={drivers} allDrivers={allDrivers} driverProfiles={driverProfiles.data} filter={driverFilter} setFilter={setDriverFilter} onToggle={handleToggleDriverActive} />;
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
      case 'map':
        return <AdminDriversMap />;
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
    <div className="min-h-screen bg-background flex">
      {/* Desktop Sidebar */}
      <div className="hidden md:block">
        <AdminSidebar activeSection={activeSection} onSectionChange={setActiveSection} />
      </div>

      {/* Mobile sidebar overlay */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-40 md:hidden">
          <div className="absolute inset-0 bg-black/50" onClick={() => setMobileMenuOpen(false)} />
          <div className="relative z-50">
            <AdminSidebar activeSection={activeSection} onSectionChange={(s) => { setActiveSection(s); setMobileMenuOpen(false); }} />
          </div>
        </div>
      )}

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Bar */}
        <header className="h-16 border-b border-border bg-card flex items-center justify-between px-4 lg:px-6 shrink-0 sticky top-0 z-20">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" className="md:hidden" onClick={() => setMobileMenuOpen(true)}>
              <Menu className="h-5 w-5" />
            </Button>
            <div className="relative hidden sm:block">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Αναζήτηση..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="pl-9 w-64 h-9 bg-muted/50 border-0"
              />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" className="relative">
              <Bell className="h-4 w-4" />
            </Button>
            <div className="h-6 w-px bg-border mx-1" />
            <Button variant="ghost" size="sm" onClick={signOut} className="gap-2 text-muted-foreground hover:text-foreground">
              <LogOut className="h-4 w-4" />
              <span className="hidden sm:inline">Αποσύνδεση</span>
            </Button>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 p-4 lg:p-6 overflow-auto">
          {renderContent()}
        </main>
      </div>
    </div>
  );
}

/* ── Sub-sections extracted as components ── */

function OrdersSection({ orders, drivers, statusColors, statusLabels, onUpdateStatus, onAssignDriver }: any) {
  return (
    <div className="space-y-4">
      <h2 className="font-heading font-bold text-xl">Παραγγελίες</h2>
      <AssignmentSettings />
      <Card>
        <CardContent className="overflow-x-auto p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>ID</TableHead><TableHead>Κατάσταση</TableHead><TableHead>Οδηγός</TableHead>
                <TableHead>Σύνολο</TableHead><TableHead>Ημερομηνία</TableHead><TableHead>Ενέργειες</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {orders?.map((order: any) => (
                <TableRow key={order.id}>
                  <TableCell className="font-mono text-xs">{order.id.slice(0, 8)}…</TableCell>
                  <TableCell><Badge variant="outline" className={statusColors[order.status] ?? ''}>{statusLabels[order.status] ?? order.status}</Badge></TableCell>
                  <TableCell>
                    <Select value={order.driver_id || 'unassigned'} onValueChange={val => onAssignDriver(order.id, val)}>
                      <SelectTrigger className="w-36 h-8 text-xs"><SelectValue placeholder="Χωρίς οδηγό" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="unassigned" disabled>Χωρίς οδηγό</SelectItem>
                        <SelectItem value="unassign">✕ Αφαίρεση</SelectItem>
                        {drivers.map((d: any) => <SelectItem key={d.user_id} value={d.user_id}>{d.full_name || d.user_id.slice(0, 8)}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell className="font-semibold">€{Number(order.total_amount).toFixed(2)}</TableCell>
                  <TableCell className="text-xs">{format(new Date(order.created_at), 'dd MMM, HH:mm')}</TableCell>
                  <TableCell>
                    <Select value={order.status} onValueChange={val => onUpdateStatus(order.id, val)}>
                      <SelectTrigger className="w-32 h-8 text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {['pending','placed','accepted','preparing','ready','picked_up','delivered','cancelled'].map(s => (
                          <SelectItem key={s} value={s}>{statusLabels[s] ?? s}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </TableCell>
                </TableRow>
              ))}
              {!orders?.length && <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">Δεν υπάρχουν παραγγελίες</TableCell></TableRow>}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

function StoresSection({ stores, allStores, filter, setFilter, onToggle }: any) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h2 className="font-heading font-bold text-xl">Καταστήματα</h2>
        <div className="flex gap-2">
          {(['all', 'active', 'inactive'] as const).map(f => (
            <Button key={f} size="sm" variant={filter === f ? 'default' : 'outline'} onClick={() => setFilter(f)}>
              {f === 'all' ? `Όλα (${allStores.length})` : f === 'active' ? `Ενεργά (${allStores.filter((s: any) => s.is_active !== false).length})` : `Ανενεργά (${allStores.filter((s: any) => s.is_active === false).length})`}
            </Button>
          ))}
        </div>
      </div>
      <Card>
        <CardContent className="overflow-x-auto p-0">
          <Table>
            <TableHeader><TableRow><TableHead>Όνομα</TableHead><TableHead>Διεύθυνση</TableHead><TableHead>Ενεργό</TableHead><TableHead>Κατάσταση</TableHead><TableHead>Δημιουργία</TableHead></TableRow></TableHeader>
            <TableBody>
              {stores.map((store: any) => (
                <TableRow key={store.id}>
                  <TableCell className="font-semibold">{store.name}</TableCell>
                  <TableCell className="text-sm">{store.address}</TableCell>
                  <TableCell><Switch checked={!!store.is_active} onCheckedChange={() => onToggle(store.id, store.is_active)} /></TableCell>
                  <TableCell><Badge variant={store.busy_mode ? 'destructive' : 'outline'}>{store.busy_mode ? 'Πολυάσχολο' : 'Κανονικό'}</Badge></TableCell>
                  <TableCell className="text-xs">{format(new Date(store.created_at), 'dd MMM yyyy')}</TableCell>
                </TableRow>
              ))}
              {!stores.length && <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">Κανένα κατάστημα</TableCell></TableRow>}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

function DriversSection({ drivers, allDrivers, driverProfiles, filter, setFilter, onToggle }: any) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h2 className="font-heading font-bold text-xl">Οδηγοί</h2>
        <div className="flex gap-2">
          {(['all', 'active', 'inactive'] as const).map(f => (
            <Button key={f} size="sm" variant={filter === f ? 'default' : 'outline'} onClick={() => setFilter(f)}>
              {f === 'all' ? `Όλοι (${allDrivers.length})` : f === 'active' ? `Ενεργοί` : `Ανενεργοί`}
            </Button>
          ))}
        </div>
      </div>
      <Card>
        <CardContent className="overflow-x-auto p-0">
          <Table>
            <TableHeader><TableRow><TableHead>Κωδικός</TableHead><TableHead>Όνομα</TableHead><TableHead>Τηλέφωνο</TableHead><TableHead>Ενεργός</TableHead><TableHead>Εγγραφή</TableHead></TableRow></TableHeader>
            <TableBody>
              {drivers.map((driver: any) => {
                const dp = driverProfiles?.find((d: any) => d.user_id === driver.user_id);
                return (
                  <TableRow key={driver.id}>
                    <TableCell><Badge variant="outline" className="font-mono text-xs">{dp?.driver_code || '—'}</Badge></TableCell>
                    <TableCell className="font-semibold">{driver.full_name || '—'}</TableCell>
                    <TableCell className="text-sm">{driver.phone || '—'}</TableCell>
                    <TableCell><Switch checked={dp?.is_active ?? true} onCheckedChange={() => dp && onToggle(driver.user_id, dp.is_active)} /></TableCell>
                    <TableCell className="text-xs">{format(new Date(driver.created_at), 'dd MMM yyyy')}</TableCell>
                  </TableRow>
                );
              })}
              {!drivers.length && <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">Κανένας οδηγός</TableCell></TableRow>}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

function UsersSection({ profiles, adminUserIds, driverCodeMap, onChangeRole, onToggleAdmin }: any) {
  return (
    <div className="space-y-4">
      <h2 className="font-heading font-bold text-xl">Χρήστες & Δικαιώματα</h2>
      <Card>
        <CardContent className="overflow-x-auto p-0">
          <Table>
            <TableHeader><TableRow><TableHead>Όνομα</TableHead><TableHead>Κωδικός</TableHead><TableHead>Ρόλος</TableHead><TableHead>Admin</TableHead><TableHead>Τηλέφωνο</TableHead><TableHead>Εγγραφή</TableHead></TableRow></TableHeader>
            <TableBody>
              {profiles?.map((profile: any) => (
                <TableRow key={profile.id}>
                  <TableCell className="font-semibold">{profile.full_name || '—'}</TableCell>
                  <TableCell>{driverCodeMap.get(profile.user_id) ? <Badge variant="outline" className="font-mono text-xs">{driverCodeMap.get(profile.user_id)}</Badge> : '—'}</TableCell>
                  <TableCell>
                    <Select value={profile.role} onValueChange={val => onChangeRole(profile.user_id, val)}>
                      <SelectTrigger className="w-28 h-8 text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {['customer','driver','store'].map(r => <SelectItem key={r} value={r}>{{ customer: 'Πελάτης', driver: 'Οδηγός', store: 'Κατάστημα' }[r]}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Switch checked={adminUserIds.has(profile.user_id)} onCheckedChange={() => onToggleAdmin(profile.user_id, adminUserIds.has(profile.user_id))} />
                      {adminUserIds.has(profile.user_id) && <Badge className="bg-primary/10 text-primary border-primary/20" variant="outline"><Shield className="h-3 w-3 mr-1" />Admin</Badge>}
                    </div>
                  </TableCell>
                  <TableCell className="text-sm">{profile.phone || '—'}</TableCell>
                  <TableCell className="text-xs">{format(new Date(profile.created_at), 'dd MMM yyyy')}</TableCell>
                </TableRow>
              ))}
              {!profiles?.length && <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">Κανένας χρήστης</TableCell></TableRow>}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

function ReviewsSection({ reviews }: { reviews: any[] | undefined }) {
  return (
    <div className="space-y-4">
      <h2 className="font-heading font-bold text-xl">Κριτικές</h2>
      <Card>
        <CardContent className="overflow-x-auto p-0">
          <Table>
            <TableHeader><TableRow><TableHead>Βαθμολογία</TableHead><TableHead>Σχόλιο</TableHead><TableHead>Παραγγελία</TableHead><TableHead>Ημερομηνία</TableHead></TableRow></TableHeader>
            <TableBody>
              {reviews?.map((review: any) => (
                <TableRow key={review.id}>
                  <TableCell>
                    <div className="flex gap-0.5">
                      {Array.from({ length: 5 }, (_, i) => (
                        <Star key={i} className={`h-4 w-4 ${i < review.rating ? 'text-yellow-500 fill-yellow-500' : 'text-muted-foreground/30'}`} />
                      ))}
                    </div>
                  </TableCell>
                  <TableCell className="text-sm max-w-xs truncate">{review.comment || '—'}</TableCell>
                  <TableCell className="font-mono text-xs">{review.order_id.slice(0, 8)}…</TableCell>
                  <TableCell className="text-xs">{format(new Date(review.created_at), 'dd MMM yyyy')}</TableCell>
                </TableRow>
              ))}
              {!reviews?.length && <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-8">Καμία κριτική</TableCell></TableRow>}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
