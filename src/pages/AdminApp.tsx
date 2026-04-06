import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useAdminData } from '@/hooks/useAdminData';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Shield, Users, Store, ShoppingBag, DollarSign, Star, ArrowLeft, BarChart3, Megaphone } from 'lucide-react';
import PlatformAnalytics from '@/components/admin/PlatformAnalytics';
import AnnouncementsManager from '@/components/admin/AnnouncementsManager';
import AssignmentSettings from '@/components/admin/AssignmentSettings';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { useQueryClient } from '@tanstack/react-query';

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
  pending: 'Εκκρεμεί',
  placed: 'Υποβλήθηκε',
  accepted: 'Αποδεκτή',
  preparing: 'Ετοιμάζεται',
  ready: 'Έτοιμη',
  picked_up: 'Παραλήφθηκε',
  delivered: 'Παραδόθηκε',
  cancelled: 'Ακυρώθηκε',
};

export default function AdminApp() {
  const { signOut } = useAuth();
  const { orders, stores, profiles, earnings, reviews, userRoles, driverProfiles } = useAdminData();
  const queryClient = useQueryClient();
  const driverCodeMap = new Map((driverProfiles.data ?? []).map(d => [d.user_id, d.driver_code]));

  const totalRevenue = orders.data?.reduce((sum, o) => sum + Number(o.total_amount), 0) ?? 0;
  const avgRating = reviews.data?.length
    ? (reviews.data.reduce((sum, r) => sum + r.rating, 0) / reviews.data.length).toFixed(1)
    : '—';

  const handleUpdateOrderStatus = async (orderId: string, status: string) => {
    const { error } = await supabase
      .from('orders')
      .update({ status: status as any })
      .eq('id', orderId);
    if (error) toast.error('Αποτυχία ενημέρωσης παραγγελίας');
    else {
      toast.success('Η κατάσταση ενημερώθηκε');
      queryClient.invalidateQueries({ queryKey: ['admin-orders'] });
    }
  };

  const drivers = profiles.data?.filter(p => p.role === 'driver') ?? [];

  const handleAssignDriver = async (orderId: string, driverId: string) => {
    const { error } = await supabase
      .from('orders')
      .update({ driver_id: driverId === 'unassign' ? null : driverId })
      .eq('id', orderId);
    if (error) toast.error('Αποτυχία ανάθεσης οδηγού');
    else {
      toast.success('Ο οδηγός ανατέθηκε');
      queryClient.invalidateQueries({ queryKey: ['admin-orders'] });
    }
  };

  const getDriverName = (driverId: string | null) => {
    if (!driverId) return null;
    const driver = profiles.data?.find(p => p.user_id === driverId);
    return driver?.full_name || driverId.slice(0, 8);
  };

  const handleToggleStoreActive = async (storeId: string, currentActive: boolean | null) => {
    const { error } = await supabase
      .from('stores')
      .update({ is_active: !currentActive })
      .eq('id', storeId);
    if (error) toast.error('Αποτυχία ενημέρωσης καταστήματος');
    else {
      toast.success(`Κατάστημα ${currentActive ? 'απενεργοποιήθηκε' : 'ενεργοποιήθηκε'}`);
      queryClient.invalidateQueries({ queryKey: ['admin-stores'] });
    }
  };

  const handleToggleDriverActive = async (userId: string, currentActive: boolean) => {
    const { error } = await supabase
      .from('driver_profiles')
      .update({ is_active: !currentActive } as any)
      .eq('user_id', userId);
    if (error) toast.error('Αποτυχία ενημέρωσης οδηγού');
    else {
      toast.success(`Οδηγός ${currentActive ? 'απενεργοποιήθηκε' : 'ενεργοποιήθηκε'}`);
      queryClient.invalidateQueries({ queryKey: ['admin-driver-profiles'] });
    }
  };

  const handleChangeRole = async (userId: string, newRole: string) => {
    const { error } = await supabase
      .from('profiles')
      .update({ role: newRole as any })
      .eq('user_id', userId);
    if (error) toast.error('Αποτυχία αλλαγής ρόλου');
    else {
      toast.success('Ο ρόλος ενημερώθηκε');
      queryClient.invalidateQueries({ queryKey: ['admin-profiles'] });
    }
  };

  const handleToggleAdmin = async (userId: string, isCurrentlyAdmin: boolean) => {
    if (isCurrentlyAdmin) {
      const { error } = await supabase
        .from('user_roles')
        .delete()
        .eq('user_id', userId)
        .eq('role', 'admin');
      if (error) toast.error('Αποτυχία αφαίρεσης admin');
      else {
        toast.success('Ο ρόλος admin αφαιρέθηκε');
        queryClient.invalidateQueries({ queryKey: ['admin-user-roles'] });
      }
    } else {
      const { error } = await supabase
        .from('user_roles')
        .insert({ user_id: userId, role: 'admin' as any });
      if (error) toast.error('Αποτυχία εκχώρησης admin');
      else {
        toast.success('Ο ρόλος admin εκχωρήθηκε');
        queryClient.invalidateQueries({ queryKey: ['admin-user-roles'] });
      }
    }
  };

  const adminUserIds = new Set(
    userRoles.data?.filter((r) => r.role === 'admin').map((r) => r.user_id) ?? []
  );

  const roleLabels: Record<string, string> = {
    customer: 'Πελάτης',
    driver: 'Οδηγός',
    store: 'Κατάστημα',
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="gradient-dark text-primary-foreground px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link to="/"><ArrowLeft className="h-5 w-5 text-primary-foreground/70 hover:text-primary-foreground" /></Link>
          <Shield className="h-5 w-5" />
          <h1 className="font-heading font-bold text-lg">Πίνακας Διαχείρισης</h1>
        </div>
        <Button variant="ghost" size="sm" onClick={signOut} className="text-primary-foreground/70 hover:text-primary-foreground">Αποσύνδεση</Button>
      </header>

      <div className="max-w-6xl mx-auto p-4 space-y-6">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <StatCard icon={ShoppingBag} label="Παραγγελίες" value={orders.data?.length ?? 0} />
          <StatCard icon={DollarSign} label="Έσοδα" value={`€${totalRevenue.toFixed(2)}`} />
          <StatCard icon={Store} label="Καταστήματα" value={stores.data?.length ?? 0} />
          <StatCard icon={Users} label="Χρήστες" value={profiles.data?.length ?? 0} />
          <StatCard icon={Star} label="Μέση Βαθμ." value={avgRating} />
        </div>

        <Tabs defaultValue="analytics">
          <TabsList className="w-full grid grid-cols-6">
            <TabsTrigger value="analytics" className="font-heading">Αναλυτικά</TabsTrigger>
            <TabsTrigger value="orders" className="font-heading">Παραγγελίες</TabsTrigger>
            <TabsTrigger value="stores" className="font-heading">Καταστήματα</TabsTrigger>
            <TabsTrigger value="users" className="font-heading">Χρήστες</TabsTrigger>
            <TabsTrigger value="reviews" className="font-heading">Κριτικές</TabsTrigger>
            <TabsTrigger value="announcements" className="font-heading">Ανακοινώσεις</TabsTrigger>
          </TabsList>

          <TabsContent value="analytics" className="mt-4">
            <PlatformAnalytics
              orders={(orders.data ?? []) as any}
              profiles={(profiles.data ?? []) as any}
            />
          </TabsContent>

          <TabsContent value="announcements" className="mt-4">
            <AnnouncementsManager />
          </TabsContent>

          <TabsContent value="orders" className="mt-4 space-y-4">
            <AssignmentSettings />
            <Card>
              <CardHeader><CardTitle className="font-heading">Όλες οι Παραγγελίες</CardTitle></CardHeader>
              <CardContent className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>ID</TableHead>
                      <TableHead>Κατάσταση</TableHead>
                      <TableHead>Οδηγός</TableHead>
                      <TableHead>Σύνολο</TableHead>
                      <TableHead>Ημερομηνία</TableHead>
                      <TableHead>Ενέργειες</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {orders.data?.map((order) => (
                      <TableRow key={order.id}>
                        <TableCell className="font-mono text-xs">{order.id.slice(0, 8)}…</TableCell>
                        <TableCell><Badge variant="outline" className={statusColors[order.status] ?? ''}>{statusLabelsEl[order.status] ?? order.status}</Badge></TableCell>
                        <TableCell>
                          <Select value={order.driver_id || 'unassigned'} onValueChange={(val) => handleAssignDriver(order.id, val)}>
                            <SelectTrigger className="w-36 h-8 text-xs">
                              <SelectValue placeholder="Χωρίς οδηγό" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="unassigned" disabled>Χωρίς οδηγό</SelectItem>
                              <SelectItem value="unassign">✕ Αφαίρεση οδηγού</SelectItem>
                              {drivers.map((d) => (
                                <SelectItem key={d.user_id} value={d.user_id}>
                                  {d.full_name || d.user_id.slice(0, 8)}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell>€{Number(order.total_amount).toFixed(2)}</TableCell>
                        <TableCell className="text-xs">{format(new Date(order.created_at), 'dd MMM, HH:mm')}</TableCell>
                        <TableCell>
                          <Select value={order.status} onValueChange={(val) => handleUpdateOrderStatus(order.id, val)}>
                            <SelectTrigger className="w-32 h-8 text-xs"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              {['pending', 'placed', 'accepted', 'preparing', 'ready', 'picked_up', 'delivered', 'cancelled'].map((s) => (
                                <SelectItem key={s} value={s}>{statusLabelsEl[s] ?? s}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </TableCell>
                      </TableRow>
                    ))}
                    {!orders.data?.length && (
                      <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">Δεν υπάρχουν παραγγελίες</TableCell></TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="stores" className="mt-4">
            <Card>
              <CardHeader><CardTitle className="font-heading">Όλα τα Καταστήματα</CardTitle></CardHeader>
              <CardContent className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Όνομα</TableHead>
                      <TableHead>Διεύθυνση</TableHead>
                      <TableHead>Ενεργό</TableHead>
                      <TableHead>Πολυάσχολο</TableHead>
                      <TableHead>Δημιουργία</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {stores.data?.map((store) => (
                      <TableRow key={store.id}>
                        <TableCell className="font-semibold">{store.name}</TableCell>
                        <TableCell className="text-sm">{store.address}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Switch
                              checked={!!store.is_active}
                              onCheckedChange={() => handleToggleStoreActive(store.id, store.is_active)}
                            />
                            <span className="text-xs text-muted-foreground">{store.is_active ? 'Ενεργό' : 'Ανενεργό'}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant={store.busy_mode ? 'destructive' : 'outline'}>{store.busy_mode ? 'Πολυάσχολο' : 'Κανονικό'}</Badge>
                        </TableCell>
                        <TableCell className="text-xs">{format(new Date(store.created_at), 'dd MMM yyyy')}</TableCell>
                      </TableRow>
                    ))}
                    {!stores.data?.length && (
                      <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">Δεν υπάρχουν καταστήματα</TableCell></TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="users" className="mt-4">
            <Card>
              <CardHeader><CardTitle className="font-heading">Όλοι οι Χρήστες</CardTitle></CardHeader>
              <CardContent className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Όνομα</TableHead>
                      <TableHead>Κωδικός</TableHead>
                      <TableHead>Ρόλος</TableHead>
                      <TableHead>Διαχειριστής</TableHead>
                      <TableHead>Τηλέφωνο</TableHead>
                      <TableHead>Εγγραφή</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {profiles.data?.map((profile) => (
                      <TableRow key={profile.id}>
                        <TableCell className="font-semibold">{profile.full_name || '—'}</TableCell>
                        <TableCell>
                          {driverCodeMap.get(profile.user_id) ? (
                            <Badge variant="outline" className="font-mono text-xs">{driverCodeMap.get(profile.user_id)}</Badge>
                          ) : '—'}
                        </TableCell>
                        <TableCell>
                          <Select value={profile.role} onValueChange={(val) => handleChangeRole(profile.user_id, val)}>
                            <SelectTrigger className="w-28 h-8 text-xs"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              {['customer', 'driver', 'store'].map((r) => (
                                <SelectItem key={r} value={r}>{roleLabels[r] ?? r}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Switch
                              checked={adminUserIds.has(profile.user_id)}
                              onCheckedChange={() => handleToggleAdmin(profile.user_id, adminUserIds.has(profile.user_id))}
                            />
                            {adminUserIds.has(profile.user_id) && (
                              <Badge className="bg-primary/10 text-primary border-primary/20" variant="outline">
                                <Shield className="h-3 w-3 mr-1" />Admin
                              </Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-sm">{profile.phone || '—'}</TableCell>
                        <TableCell className="text-xs">{format(new Date(profile.created_at), 'dd MMM yyyy')}</TableCell>
                      </TableRow>
                    ))}
                    {!profiles.data?.length && (
                      <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">Δεν υπάρχουν χρήστες</TableCell></TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="reviews" className="mt-4">
            <Card>
              <CardHeader><CardTitle className="font-heading">Όλες οι Κριτικές</CardTitle></CardHeader>
              <CardContent className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Βαθμολογία</TableHead>
                      <TableHead>Σχόλιο</TableHead>
                      <TableHead>Παραγγελία</TableHead>
                      <TableHead>Ημερομηνία</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {reviews.data?.map((review) => (
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
                    {!reviews.data?.length && (
                      <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-8">Δεν υπάρχουν κριτικές</TableCell></TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

function StatCard({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value: string | number }) {
  return (
    <Card className="shadow-[var(--shadow-md)]">
      <CardContent className="p-4 flex items-center gap-3">
        <div className="h-10 w-10 rounded-lg gradient-primary shadow-primary flex items-center justify-center shrink-0">
          <Icon className="h-5 w-5 text-primary-foreground" />
        </div>
        <div>
          <p className="text-xs text-muted-foreground font-heading">{label}</p>
          <p className="font-heading font-bold text-lg">{value}</p>
        </div>
      </CardContent>
    </Card>
  );
}
