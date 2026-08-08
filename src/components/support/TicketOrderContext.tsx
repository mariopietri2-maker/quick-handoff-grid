import { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { formatOrderNumber } from '@/lib/order-number';
import { cn } from '@/lib/utils';
import { differenceInMinutes } from 'date-fns';
import { Loader2, MapPin, Phone, RefreshCw, Store as StoreIcon, Timer, Truck, UserRound, Wallet, Zap } from 'lucide-react';
import { openRealtimeChannel } from '@/lib/realtime-channel';

const orderStatusMap: Record<string, { label: string; cls: string }> = {
  placed: { label: 'Καταχωρήθηκε', cls: 'bg-info/10 text-info border-info/30' },
  accepted: { label: 'Αποδεκτή', cls: 'bg-info/10 text-info border-info/30' },
  preparing: { label: 'Ετοιμάζεται', cls: 'bg-warning/10 text-warning border-warning/30' },
  ready: { label: 'Έτοιμη', cls: 'bg-success/10 text-success border-success/30' },
  arrived: { label: 'Στο Κατάστημα', cls: 'bg-accent/10 text-accent border-accent/30' },
  picked_up: { label: 'Σε Μεταφορά', cls: 'bg-accent/10 text-accent border-accent/30' },
  delivered: { label: 'Παραδόθηκε', cls: 'bg-success/10 text-success border-success/30' },
  cancelled: { label: 'Ακυρώθηκε', cls: 'bg-destructive/10 text-destructive border-destructive/30' },
};

function profileQuery(userId?: string | null) {
  return {
    enabled: !!userId,
    queryKey: ['ticket-order-profile', userId ?? 'none'],
    queryFn: async () => {
      if (!userId) return null;
      const { data, error } = await supabase
        .from('profiles')
        .select('id, full_name, phone')
        .eq('id', userId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  };
}

type TicketOrderContextProps = {
  orderId: string;
  className?: string;
};

export function TicketOrderContext({ orderId, className }: TicketOrderContextProps) {
  const qc = useQueryClient();
  const { isAdmin } = useAuth();

  const [dlg, setDlg] = useState<'reassign' | 'refund' | 'credit' | 'unassign' | 'cancel' | null>(null);
  const [busy, setBusy] = useState(false);
  const [driverId, setDriverId] = useState('');
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('');

  // ── Live order ─────────────────────────────────────
  const order = useQuery({
    queryKey: ['ticket-order', orderId],
    queryFn: async () => {
      const { data, error } = await supabase.from('orders').select('*').eq('id', orderId).maybeSingle();
      if (error) throw error;
      return data;
    },
    refetchInterval: 8000,
    staleTime: 4000,
  });

  // Realtime: instant status/driver updates
  useEffect(() => {
    const channel = openRealtimeChannel(`ticket-order-${orderId}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'orders', filter: `id=eq.${orderId}` },
        () => qc.invalidateQueries({ queryKey: ['ticket-order', orderId] })
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [orderId, qc]);

  const store = useQuery({
    enabled: !!order.data?.store_id,
    queryKey: ['ticket-order-store', order.data?.store_id ?? 'none'],
    queryFn: async () => {
      const storeId = order.data?.store_id;
      if (!storeId) return null;
      const { data, error } = await supabase.from('stores').select('id, name').eq('id', storeId).maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const driver = useQuery(profileQuery(order.data?.driver_id));
  const customer = useQuery(profileQuery(order.data?.customer_id));

  const drivers = useQuery({
    enabled: true,
    queryKey: ['ticket-order-drivers'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, full_name')
        .eq('role', 'driver')
        .order('full_name');
      if (error) throw error;
      return data ?? [];
    },
  });

  // ── Actions (mirror DeliveryControlCenter) ─────────
  const call = async (rpc: string, args: any, okMsg: string) => {
    setBusy(true);
    const { error } = await (supabase.rpc as any)(rpc, args);
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success(okMsg);
    qc.invalidateQueries({ queryKey: ['ticket-order', orderId] });
    qc.invalidateQueries({ queryKey: ['dcc-orders'] });
    qc.invalidateQueries({ queryKey: ['dcc-offers'] });
    setDlg(null);
    setAmount(''); setReason(''); setDriverId('');
  };

  const close = () => { if (!busy) { setDlg(null); setAmount(''); setReason(''); setDriverId(''); } };

  const doReassign = () => {
    if (!driverId) return toast.error('Επίλεξε οδηγό');
    void call('admin_force_assign_order', { p_order_id: orderId, p_driver_id: driverId, p_reason: 'Support: reassign' }, 'Η παραγγελία ανατέθηκε');
  };
  const doUnassign = () => {
    void call('support_unassign_order', { p_order_id: orderId }, 'Επιστράφηκε στη διανομή');
  };
  const doCancel = () => {
    if (!reason.trim()) return toast.error('Λόγος');
    void call('support_cancel_order', { p_order_id: orderId, p_reason: reason }, 'Παραγγελία ακυρώθηκε');
  };
  const doRefund = () => {
    const amt = Number(amount);
    if (!amt) return toast.error('Ποσό');
    void call('admin_refund_order', { p_order_id: orderId, p_amount: amt, p_reason: reason || null }, `Επιστράφηκαν ${amt.toFixed(2)}€`);
  };
  const doCredit = () => {
    const amt = Number(amount);
    if (!amt || !order.data?.customer_id) return toast.error('Ποσό');
    void call('admin_credit_customer_wallet', { p_customer_id: order.data.customer_id, p_amount: amt, p_reason: reason || null }, `+${amt.toFixed(2)}€ στο wallet πελάτη`);
  };

  if (order.isLoading) {
    return (
      <div className={cn('rounded-xl border bg-card p-3 shadow-sm flex items-center gap-2 text-xs text-muted-foreground', className)}>
        <Loader2 className="h-3.5 w-3.5 animate-spin" /> Φορτώνω ζωντανό πλαίσιο παραγγελίας…
      </div>
    );
  }

  const o = order.data;
  if (!o) {
    return (
      <div className={cn('rounded-xl border border-destructive/30 bg-destructive/5 p-3 text-xs text-destructive', className)}>
        Η παραγγελία δεν βρέθηκε (μπορεί να διαγράφηκε).
      </div>
    );
  }

  const st = orderStatusMap[o.status] ?? { label: o.status, cls: 'bg-muted text-muted-foreground border-border/50' };
  const ageMin = differenceInMinutes(new Date(), new Date(o.created_at));

  return (
    <div className={cn('rounded-xl border bg-card p-3 shadow-sm', className)}>
      {/* Header */}
      <div className="flex items-center gap-2">
        <div className="h-7 w-7 rounded-lg bg-amber-500/10 text-amber-600 flex items-center justify-center shrink-0">
          <Zap className="h-3.5 w-3.5" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-heading font-semibold text-sm leading-tight truncate">
            Ζωντανό πλαίσιο παραγγελίας
          </p>
          <p className="text-[10px] text-muted-foreground truncate leading-tight mt-0.5">
            {formatOrderNumber(o)} {o.created_at ? ` · ${differenceInMinutes(new Date(), new Date(o.created_at))}λ πριν` : ''}
          </p>
        </div>
        <Badge variant="outline" className={cn('text-[10px] shrink-0', st.cls)}>{st.label}</Badge>
        <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" disabled={busy} onClick={() => qc.invalidateQueries({ queryKey: ['ticket-order', orderId] })} title="Ανανέωση">
          <RefreshCw className={cn('h-3.5 w-3.5', order.isFetching && 'animate-spin')} />
        </Button>
      </div>

      {/* Rows */}
      <div className="mt-2.5 space-y-1.5 text-xs">
        <div className="flex items-center gap-2">
          <StoreIcon className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
          <span className="text-muted-foreground w-16 shrink-0">Κατάστημα</span>
          <span className="font-medium truncate">{store.data?.name ?? (store.isLoading ? '…' : '—')}</span>
        </div>
        <div className="flex items-center gap-2">
          <Truck className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
          <span className="text-muted-foreground w-16 shrink-0">Οδηγός</span>
          <span className={cn('font-medium truncate', !o.driver_id && 'text-muted-foreground')}>
            {o.driver_id ? (driver.data?.full_name ?? '…') : 'Δεν ανατέθηκε'}
          </span>
          {o.status !== 'cancelled' && o.status !== 'delivered' && (
            <span className="ml-auto flex items-center gap-1 shrink-0">
              <Button size="sm" variant="outline" className="h-6 px-2 text-[10px]" disabled={busy} onClick={() => setDlg('reassign')}>
                Ανάθεση
              </Button>
              {o.driver_id && (
                <Button size="sm" variant="ghost" className="h-6 px-2 text-[10px]" disabled={busy} onClick={() => setDlg('unassign')}>
                  Αλλαγή
                </Button>
              )}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <UserRound className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
          <span className="text-muted-foreground w-16 shrink-0">Πελάτης</span>
          <span className="font-medium truncate">{customer.data?.full_name ?? '…'}</span>
          {customer.data?.phone && (
            <a href={`tel:${customer.data.phone}`} className="ml-auto inline-flex items-center gap-1 text-[10px] text-primary hover:underline shrink-0">
              <Phone className="h-3 w-3" /> {customer.data.phone}
            </a>
          )}
        </div>
        <div className="flex items-start gap-2">
          <MapPin className="h-3.5 w-3.5 text-muted-foreground shrink-0 mt-0.5" />
          <span className="text-muted-foreground w-16 shrink-0">Διεύθυνση</span>
          <span className="font-medium leading-snug">{o.delivery_address ?? '—'}</span>
        </div>
        <div className="flex items-center gap-2">
          <Timer className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
          <span className="text-muted-foreground w-16 shrink-0">Ποσό</span>
          <span className="font-semibold tabular-nums">{Number(o.total_amount ?? 0).toFixed(2)}€</span>
          <span className="ml-auto text-[10px] text-muted-foreground tabular-nums">{ageMin}λ από δημιουργία</span>
        </div>
      </div>

      {/* Admin quick actions */}
      {isAdmin && o.status !== 'cancelled' && (
        <div className="mt-2.5 pt-2.5 border-t flex items-center gap-1.5 flex-wrap">
          <span className="text-[10px] font-semibold text-muted-foreground mr-1 uppercase tracking-wide">Admin</span>
          <Button size="sm" variant="outline" className="h-6 px-2 text-[10px]" disabled={busy} onClick={() => setDlg('refund')}>
            Refund
          </Button>
          {o.customer_id && (
            <Button size="sm" variant="outline" className="h-6 px-2 text-[10px]" disabled={busy} onClick={() => setDlg('credit')}>
              <Wallet className="h-3 w-3 mr-1" /> +€ Wallet
            </Button>
          )}
          <Button size="sm" variant="outline" className="h-6 px-2 text-[10px] text-destructive" disabled={busy} onClick={() => setDlg('cancel')}>
            Ακύρωση
          </Button>
        </div>
      )}

      {/* ── Dialogs ─────────────────────────────────────── */}
      <Dialog open={dlg === 'reassign'} onOpenChange={(v) => !v && close()}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>Ανάθεση σε οδηγό</DialogTitle>
            <DialogDescription>Επανεκχώρηση {formatOrderNumber(o)} σε συγκεκριμένο οδηγό.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>Οδηγός</Label>
              <Select value={driverId} onValueChange={setDriverId}>
                <SelectTrigger className="w-full"><SelectValue placeholder="Επίλεξε οδηγό" /></SelectTrigger>
                <SelectContent>
                  {(drivers.data ?? []).map((d) => (
                    <SelectItem key={d.id} value={d.id}>{d.full_name ?? '—'}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={close}>Άκυρο</Button>
            <Button disabled={busy} onClick={doReassign}>
              {busy && <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />} Ανάθεση
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={dlg === 'unassign'} onOpenChange={(v) => !v && close()}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>Επιστροφή στη διανομή</DialogTitle>
            <DialogDescription>Η παραγγελία θα επιστρέψει στην ουρά ανάθεσης χωρίς οδηγό.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={close}>Άκυρο</Button>
            <Button variant="destructive" disabled={busy} onClick={doUnassign}>
              {busy && <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />} Επιστροφή
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={dlg === 'refund'} onOpenChange={(v) => !v && close()}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>Επιστροφή χρημάτων</DialogTitle>
            <DialogDescription>Refund για {formatOrderNumber(o)}.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>Ποσό (€)</Label>
              <Input type="number" min="0" step="0.01" placeholder="0.00" value={amount} onChange={(e) => setAmount(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Λόγος</Label>
              <Textarea placeholder="Προαιρετικό" value={reason} onChange={(e) => setReason(e.target.value)} className="min-h-[70px]" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={close}>Άκυρο</Button>
            <Button disabled={busy} onClick={doRefund}>
              {busy && <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />} Refund
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={dlg === 'credit'} onOpenChange={(v) => !v && close()}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>Πίστωση wallet</DialogTitle>
            <DialogDescription>Ενίσχυση του wallet του πελάτη με αντίτιμο.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>Ποσό (€)</Label>
              <Input type="number" min="0" step="0.01" placeholder="0.00" value={amount} onChange={(e) => setAmount(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Λόγος</Label>
              <Textarea placeholder="Προαιρετικό" value={reason} onChange={(e) => setReason(e.target.value)} className="min-h-[70px]" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={close}>Άκυρο</Button>
            <Button disabled={busy} onClick={doCredit}>
              {busy && <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />} Πίστωση
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={dlg === 'cancel'} onOpenChange={(v) => !v && close()}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>Ακύρωση παραγγελίας</DialogTitle>
            <DialogDescription>Αυτό είναι μη αναστρέψιμο για {formatOrderNumber(o)}.</DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label>Λόγος</Label>
            <Textarea placeholder="Υποχρεωτικό" value={reason} onChange={(e) => setReason(e.target.value)} className="min-h-[70px]" />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={close}>Άκυρο</Button>
            <Button variant="destructive" disabled={busy} onClick={doCancel}>
              {busy && <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />} Ακύρωση
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
