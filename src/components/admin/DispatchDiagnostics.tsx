import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { toast } from 'sonner';
import { Loader2, RefreshCw, Zap, UserPlus, Copy } from 'lucide-react';
import { format } from 'date-fns';

interface OrderRow {
  id: string;
  status: string;
  store_id: string;
  driver_id: string | null;
  total_amount: number;
  delivery_latitude: number | null;
  delivery_longitude: number | null;
  predicted_ready_at: string | null;
  dispatch_at: string | null;
  created_at: string;
  store: { name: string | null; latitude: number | null; longitude: number | null } | null;
  pending_offers: { id: string; status: string; driver_id: string; expires_at: string }[];
}

interface OnlineDriver {
  driver_id: string;
  full_name: string | null;
  is_active: boolean;
  on_break: boolean;
  last_seen: string | null;
  lat: number | null;
  lng: number | null;
}

function diagnose(o: OrderRow, online: OnlineDriver[]): { reason: string; tone: 'ok' | 'warn' | 'err' } {
  if (o.driver_id) return { reason: 'Έχει ήδη οδηγό', tone: 'ok' };
  const live = o.pending_offers?.filter(p => p.status === 'pending') ?? [];
  if (live.length > 0) return { reason: `${live.length} ζωντανές προσφορές`, tone: 'ok' };
  const hasAnchor = (o.store?.latitude != null) || (o.delivery_latitude != null);
  if (!hasAnchor) return { reason: 'Δεν υπάρχει συντεταγμένη (store + delivery missing)', tone: 'err' };
  if (o.dispatch_at && new Date(o.dispatch_at) > new Date()) {
    return { reason: `Προγραμματισμένη: ${format(new Date(o.dispatch_at), 'HH:mm:ss')}`, tone: 'warn' };
  }
  const eligible = online.filter(d => d.is_active && !d.on_break);
  if (eligible.length === 0) return { reason: 'Κανένας online & ενεργός οδηγός', tone: 'err' };
  return { reason: 'Έτοιμη — δεν έχει τρέξει ακόμα ο cron', tone: 'warn' };
}

export default function DispatchDiagnostics() {
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [online, setOnline] = useState<OnlineDriver[]>([]);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [creds, setCreds] = useState<{ email: string; password: string; role: string } | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const [ordersRes, locsRes, profilesRes, statesRes] = await Promise.all([
        supabase
          .from('orders')
          .select(`
            id, status, store_id, driver_id, total_amount,
            delivery_latitude, delivery_longitude,
            predicted_ready_at, dispatch_at, created_at,
            store:stores ( name, latitude, longitude ),
            pending_offers ( id, status, driver_id, expires_at )
          `)
          .is('driver_id', null)
          .in('status', ['placed', 'accepted', 'preparing', 'ready'])
          .order('created_at', { ascending: false })
          .limit(50),
        supabase
          .from('driver_locations')
          .select('driver_id, latitude, longitude, updated_at')
          .gt('updated_at', new Date(Date.now() - 5 * 60_000).toISOString()),
        supabase.from('driver_profiles').select('user_id, is_active, suspended_at'),
        supabase.from('driver_state').select('driver_id, on_break'),
      ]);

      setOrders((ordersRes.data ?? []) as any);

      const stateMap = new Map((statesRes.data ?? []).map((s: any) => [s.driver_id, s.on_break]));
      const profMap = new Map(
        (profilesRes.data ?? []).map((p: any) => [
          p.user_id,
          { is_active: p.is_active && !p.suspended_at },
        ]),
      );

      const driverIds = (locsRes.data ?? []).map((l: any) => l.driver_id);
      const { data: names } = driverIds.length
        ? await supabase.from('profiles').select('user_id, full_name').in('user_id', driverIds)
        : { data: [] as any[] };
      const nameMap = new Map((names ?? []).map((n: any) => [n.user_id, n.full_name]));

      setOnline(
        (locsRes.data ?? []).map((l: any) => ({
          driver_id: l.driver_id,
          full_name: nameMap.get(l.driver_id) ?? null,
          is_active: profMap.get(l.driver_id)?.is_active ?? false,
          on_break: stateMap.get(l.driver_id) ?? false,
          last_seen: l.updated_at,
          lat: l.latitude,
          lng: l.longitude,
        })),
      );
    } catch (e: any) {
      toast.error(e?.message ?? 'Failed to load');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, []);

  const forceDispatch = async () => {
    setBusy('dispatch');
    try {
      const { data, error } = await supabase.functions.invoke('auto-dispatch', { body: {} });
      if (error) throw error;
      toast.success(`Dispatch τρέξε: ${data?.dispatched ?? 0} νέες προσφορές`);
      await load();
    } catch (e: any) {
      toast.error(e?.message ?? 'Dispatch failed');
    } finally {
      setBusy(null);
    }
  };

  const createTestAccount = async (role: 'customer' | 'driver') => {
    setBusy(`acct-${role}`);
    try {
      const { data, error } = await supabase.functions.invoke('admin-create-test-account', { body: { role } });
      if (error) throw error;
      setCreds({ email: data.email, password: data.password, role: data.role });
      toast.success(`Test ${role} δημιουργήθηκε`);
    } catch (e: any) {
      toast.error(e?.message ?? 'Create failed');
    } finally {
      setBusy(null);
    }
  };

  const copy = (v: string) => { navigator.clipboard.writeText(v); toast.success('Copied'); };

  const eligible = online.filter(d => d.is_active && !d.on_break);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-3">
          <div>
            <CardTitle className="text-base">Dispatch διάγνωση</CardTitle>
            <p className="text-xs text-muted-foreground mt-1">
              Δείχνει γιατί παραγγελίες δεν προσφέρονται σε οδηγούς και επιτρέπει χειροκίνητο dispatch.
            </p>
          </div>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={load} disabled={loading}>
              <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${loading ? 'animate-spin' : ''}`} /> Ανανέωση
            </Button>
            <Button size="sm" onClick={forceDispatch} disabled={busy === 'dispatch'}>
              {busy === 'dispatch' ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <Zap className="h-3.5 w-3.5 mr-1.5" />}
              Force dispatch τώρα
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
            <Stat label="Undispatched orders" value={orders.length} />
            <Stat label="Online (5min)" value={online.length} />
            <Stat label="Eligible drivers" value={eligible.length} tone={eligible.length === 0 ? 'err' : 'ok'} />
            <Stat label="On break" value={online.filter(d => d.on_break).length} />
          </div>

          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Order</TableHead>
                  <TableHead>Store</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Δημιουργήθηκε</TableHead>
                  <TableHead>Διάγνωση</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {orders.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-muted-foreground py-6">
                      Καμία αναμενόμενη παραγγελία.
                    </TableCell>
                  </TableRow>
                )}
                {orders.map(o => {
                  const d = diagnose(o, online);
                  return (
                    <TableRow key={o.id}>
                      <TableCell className="font-mono text-[11px]">{o.id.slice(0, 8)}</TableCell>
                      <TableCell className="text-sm">{o.store?.name ?? '—'}</TableCell>
                      <TableCell><Badge variant="outline">{o.status}</Badge></TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {format(new Date(o.created_at), 'HH:mm:ss')}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={d.tone === 'err' ? 'destructive' : d.tone === 'warn' ? 'secondary' : 'default'}
                        >
                          {d.reason}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Test λογαριασμοί</CardTitle>
          <p className="text-xs text-muted-foreground mt-1">
            Δημιουργεί επιβεβαιωμένο λογαριασμό για γρήγορες δοκιμές.
          </p>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex gap-2 flex-wrap">
            <Button size="sm" onClick={() => createTestAccount('customer')} disabled={!!busy}>
              {busy === 'acct-customer' ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <UserPlus className="h-3.5 w-3.5 mr-1.5" />}
              Test πελάτης
            </Button>
            <Button size="sm" variant="outline" onClick={() => createTestAccount('driver')} disabled={!!busy}>
              {busy === 'acct-driver' ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <UserPlus className="h-3.5 w-3.5 mr-1.5" />}
              Test οδηγός
            </Button>
          </div>
          {creds && (
            <div className="rounded-lg border border-border bg-muted/40 p-3 text-sm space-y-1.5">
              <div className="text-xs uppercase tracking-wide text-muted-foreground font-semibold">
                Νέος {creds.role}
              </div>
              <CredRow label="Email" value={creds.email} onCopy={() => copy(creds.email)} />
              <CredRow label="Password" value={creds.password} onCopy={() => copy(creds.password)} />
              <p className="text-[11px] text-muted-foreground pt-1">
                Αποθήκευσε τα — ο κωδικός δεν εμφανίζεται ξανά.
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function Stat({ label, value, tone = 'ok' }: { label: string; value: number; tone?: 'ok' | 'err' }) {
  return (
    <div className="rounded-lg border border-border bg-card p-3">
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground font-semibold">{label}</div>
      <div className={`text-2xl font-heading font-bold mt-0.5 ${tone === 'err' ? 'text-destructive' : 'text-foreground'}`}>
        {value}
      </div>
    </div>
  );
}

function CredRow({ label, value, onCopy }: { label: string; value: string; onCopy: () => void }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-muted-foreground w-20 shrink-0">{label}</span>
      <code className="text-xs bg-background border border-border rounded px-2 py-1 flex-1 truncate">{value}</code>
      <Button size="icon" variant="ghost" className="h-7 w-7" onClick={onCopy}>
        <Copy className="h-3.5 w-3.5" />
      </Button>
    </div>
  );
}
