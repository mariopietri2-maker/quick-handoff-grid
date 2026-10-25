import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { PhoneCall, Store, Bike, RefreshCw, Search } from 'lucide-react';
import { toast } from 'sonner';

type CallRoleRow = {
  kind: 'store' | 'driver';
  id: string;
  label: string;
  sublabel: string;
  call_role: string;
};

export default function CallRolesPanel() {
  const { isAdmin } = useAuth();
  const [rows, setRows] = useState<CallRoleRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [q, setQ] = useState('');
  const [completed, setCompleted] = useState<Record<string, number>>({});
  const [ghostOrders, setGhostOrders] = useState<Record<string, { id: string; created_at: string; status: string; total_amount: number }[]>>({});
  const [openOrdersFor, setOpenOrdersFor] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase.rpc('admin_list_call_roles');
    if (error) {
      toast.error(`Φόρτωση ρόλων απέτυχε: ${error.message}`);
    } else {
      const list = (data ?? []) as unknown as CallRoleRow[];
      setRows(list);
      const ghostIds = list.filter((r) => r.kind === 'driver' && r.call_role === 'K').map((r) => r.id);
      if (ghostIds.length) {
        const { data: ords } = await supabase
          .from('orders')
          .select('id, driver_id, status, created_at, total_amount')
          .in('driver_id', ghostIds)
          .order('created_at', { ascending: false })
          .limit(200);
        const counts: Record<string, number> = {};
        const recent: Record<string, { id: string; created_at: string; status: string; total_amount: number }[]> = {};
        for (const o of (ords ?? []) as any[]) {
          if (o.status === 'delivered') counts[o.driver_id] = (counts[o.driver_id] ?? 0) + 1;
          const arr = recent[o.driver_id] ?? [];
          if (arr.length < 8) arr.push({ id: o.id, created_at: o.created_at, status: o.status, total_amount: Number(o.total_amount) || 0 });
          recent[o.driver_id] = arr;
        }
        setCompleted(counts);
        setGhostOrders(recent);
      } else {
        setCompleted({});
        setGhostOrders({});
      }
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    if (isAdmin) load();
    else setLoading(false);
  }, [isAdmin, load]);

  const setStoreRole = async (id: string, role: string) => {
    setBusyId(id);
    const { error } = await supabase.rpc('admin_set_store_call_role', { p_store_id: id, p_role: role });
    if (error) toast.error(error.message);
    else toast.success(role === 'N' ? 'Κατάστημα → Ghost Store' : 'Κατάστημα → standard');
    await load();
    setBusyId(null);
  };

  const removeGhostOrder = async (orderId: string) => {
    if (!confirm('Αφαίρεση αυτής της παραγγελίας από τον Ghost Rider;')) return;
    setBusyId(orderId);
    const { error } = await supabase.rpc('admin_delete_ghost_order', { p_order_id: orderId });
    if (error) toast.error(error.message);
    else toast.success('Η παραγγελία αφαιρέθηκε');
    await load();
    setBusyId(null);
  };

  const setDriverRole = async (id: string, role: string) => {
    setBusyId(id);
    const { error } = await supabase.rpc('admin_set_driver_call_role', { p_user_id: id, p_role: role });
    if (error) toast.error(error.message);
    else toast.success(role === 'K' ? 'Οδηγός → Ghost Rider' : 'Οδηγός → standard');
    await load();
    setBusyId(null);
  };

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return rows.filter(
      (r) =>
        !needle ||
        r.label.toLowerCase().includes(needle) ||
        r.sublabel.toLowerCase().includes(needle)
    );
  }, [rows, q]);

  const stores = filtered.filter((r) => r.kind === 'store');
  const drivers = filtered.filter((r) => r.kind === 'driver');

  return (
    <div className="space-y-4 p-4">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <PhoneCall className="h-4 w-4" /> Ghost roles
            <Badge variant="outline" className="ml-1 gap-1">
              <img src="/brand/ghost-store-64.png" alt="" className="h-3.5 w-3.5 rounded-sm" />
              Ghost Store
            </Badge>
            <Badge variant="outline" className="gap-1">
              <img src="/brand/ghost-rider-64.png" alt="" className="h-3.5 w-3.5 rounded-full" />
              Ghost Rider
            </Badge>
          </CardTitle>
          <p className="text-xs text-muted-foreground mt-1">
            Ghost Store: το κατάστημα βλέπει μόνο το κουμπί «Κλήση οδηγού».
            Ghost Rider: ο οδηγός λαμβάνει κλήσεις μόνο από Ghost Stores. Καμία πληρωμή πλατφόρμας· ιστορικό σβήνει σε 24h.
          </p>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2">
            <div className="relative flex-1 max-w-xs">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Αναζήτηση..." className="pl-8 h-9" />
            </div>
            <Button variant="outline" size="sm" onClick={load} disabled={loading} className="gap-1">
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} /> Ανανέωση
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <img src="/brand/ghost-store-64.png" alt="" className="h-5 w-5 rounded-md" />
              Ghost Stores ({stores.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="divide-y">
            {stores.map((r) => (
              <div key={r.id} className="flex items-center justify-between py-2 gap-2">
                <div className="min-w-0">
                  <div className="text-sm font-medium truncate">{r.label || '(χωρίς όνομα)'}</div>
                  <div className="text-xs text-muted-foreground truncate">{r.sublabel}</div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-xs text-muted-foreground">{r.call_role === 'N' ? 'Ghost Store' : 'standard'}</span>
                  <Switch
                    checked={r.call_role === 'N'}
                    disabled={!isAdmin || busyId === r.id || loading}
                    onCheckedChange={(v) => setStoreRole(r.id, v ? 'N' : 'standard')}
                  />
                </div>
              </div>
            ))}
            {!loading && stores.length === 0 && <div className="py-6 text-sm text-muted-foreground text-center">Κανένα αποτέλεσμα</div>}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <img src="/brand/ghost-rider-64.png" alt="" className="h-5 w-5 rounded-full" />
              Ghost Riders ({drivers.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="divide-y">
            {drivers.map((r) => (
              <div key={r.id} className="py-2">
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <div className="text-sm font-medium truncate">{r.label}</div>
                    <div className="text-xs text-muted-foreground truncate">{r.sublabel}</div>
                    {r.call_role === 'K' && (
                      <div className="text-xs font-semibold text-foreground mt-1">
                        Ολοκληρωμένες παραγγελίες: {completed[r.id] ?? 0}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {r.call_role === 'K' && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 text-[11px]"
                        onClick={() => setOpenOrdersFor(openOrdersFor === r.id ? null : r.id)}
                      >
                        Αφαίρεση παραγγελίας
                      </Button>
                    )}
                    <span className="text-xs text-muted-foreground">{r.call_role === 'K' ? 'Ghost Rider' : 'standard'}</span>
                    <Switch
                      checked={r.call_role === 'K'}
                      disabled={!isAdmin || busyId === r.id || loading}
                      onCheckedChange={(v) => setDriverRole(r.id, v ? 'K' : 'standard')}
                    />
                  </div>
                </div>
                {r.call_role === 'K' && openOrdersFor === r.id && (
                  <div className="mt-2 space-y-1 rounded-md border bg-muted/30 p-2">
                    {(ghostOrders[r.id] ?? []).length === 0 && (
                      <div className="text-xs text-muted-foreground">Δεν υπάρχουν παραγγελίες</div>
                    )}
                    {(ghostOrders[r.id] ?? []).map((o) => (
                      <div key={o.id} className="flex items-center justify-between gap-2 text-xs">
                        <span className="truncate">
                          {o.id.slice(0, 8)} · {o.status} · €{o.total_amount.toFixed(2)}
                        </span>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-6 px-2 text-destructive"
                          disabled={busyId === o.id}
                          onClick={() => removeGhostOrder(o.id)}
                        >
                          Αφαίρεση
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
            {!loading && drivers.length === 0 && <div className="py-6 text-sm text-muted-foreground text-center">Κανένα αποτέλεσμα</div>}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
