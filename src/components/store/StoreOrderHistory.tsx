import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import { el } from 'date-fns/locale';
import { ChevronDown, ChevronUp, History, Package, Search } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { formatOrderNumber } from '@/lib/order-number';
import { formatEuro, lineTotal, orderMoney, roundMoney } from '@/lib/money';
import { getStoreOrderPnl } from '@/lib/store-order-economics';

type HistoryOrder = {
  id: string;
  created_at: string;
  updated_at?: string | null;
  status: string;
  total_amount: number | null;
  delivery_fee: number | null;
  tip_amount: number | null;
  payment_method: string | null;
  delivery_address: string | null;
  notes: string | null;
  store_order_number?: number | null;
  customer_id?: string | null;
  source?: string | null;
  store_charge?: number | null;
  cash_received?: number | null;
  estimated_prep_time?: number | null;
  predicted_prep_minutes?: number | null;
  order_items?: Array<{
    id: string;
    name: string;
    quantity: number;
    unit_price: number;
  }> | null;
  customer_name?: string | null;
  customer_phone?: string | null;
};

const STATUS_LABEL: Record<string, string> = {
  delivered: 'Παραδόθηκε',
  cancelled: 'Ακυρώθηκε',
  picked_up: 'Παραλήφθηκε',
  ready: 'Έτοιμη',
  preparing: 'Ετοιμάζεται',
  accepted: 'Αποδεκτή',
  placed: 'Νέα',
};

const euro = formatEuro;

const STATUS_BANNER: Record<string, string> = {
  delivered: 'ΠΑΡΑΔΟΘΗΚΕ',
  picked_up: 'ΠΑΡΕΛΗΦΘΗ ΑΠΟ ΤΟΝ ΔΙΑΝΟΜΕΑ',
  ready: 'ΕΤΟΙΜΗ ΓΙΑ ΠΑΡΑΛΑΒΗ',
  cancelled: 'ΑΚΥΡΩΘΗΚΕ',
  preparing: 'ΕΤΟΙΜΑΖΕΤΑΙ',
  accepted: 'ΑΠΟΔΕΚΤΗ',
  placed: 'ΝΕΑ ΠΑΡΑΓΓΕΛΙΑ',
};

function signedEuro(n: number) {
  const v = Math.abs(n);
  return n < 0 ? `-${euro(v)}` : euro(v);
}

export default function StoreOrderHistory({ storeId }: { storeId: string }) {
  const [q, setQ] = useState('');
  const [openId, setOpenId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<'all' | 'delivered' | 'cancelled'>('all');

  const { data: storeMeta } = useQuery({
    queryKey: ['store-commission', storeId],
    enabled: !!storeId,
    queryFn: async () => {
      const { data } = await (supabase as any).from('stores').select('commission_pct').eq('id', storeId).maybeSingle();
      return data as { commission_pct: number | null } | null;
    },
  });
  const commissionPct = storeMeta?.commission_pct ?? 15;

  const { data: orders = [], isLoading, refetch, isFetching } = useQuery({
    queryKey: ['store-order-history', storeId],
    enabled: !!storeId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('orders')
        .select('id, created_at, updated_at, status, total_amount, delivery_fee, tip_amount, payment_method, delivery_address, notes, store_order_number, customer_id, source, store_charge, cash_received, estimated_prep_time, predicted_prep_minutes, order_items(id, name, quantity, unit_price)')
        .eq('store_id', storeId)
        .in('status', ['delivered', 'cancelled', 'picked_up', 'ready'])
        .order('created_at', { ascending: false })
        .limit(80);
      if (error) throw error;
      const rows = (data ?? []) as HistoryOrder[];
      const custIds = [...new Set(rows.map((r) => r.customer_id).filter(Boolean))] as string[];
      const nameById: Record<string, { full_name?: string | null; phone?: string | null }> = {};
      if (custIds.length > 0) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('user_id, full_name, phone')
          .in('user_id', custIds);
        for (const pr of (profiles as { user_id: string; full_name?: string | null; phone?: string | null }[]) ?? []) {
          nameById[pr.user_id] = { full_name: pr.full_name, phone: pr.phone };
        }
      }
      return rows.map((o) => ({
        ...o,
        customer_name: nameById[o.customer_id ?? '']?.full_name ?? null,
        customer_phone: nameById[o.customer_id ?? '']?.phone ?? null,
      }));
    },
  });

  const filtered = useMemo(() => {
    let list = orders;
    if (statusFilter !== 'all') list = list.filter((o) => o.status === statusFilter);
    const needle = q.trim().toLowerCase();
    if (!needle) return list;
    return list.filter((o) => {
      const no = formatOrderNumber(o as never).toLowerCase();
      const name = (o.customer_name ?? '').toLowerCase();
      const phone = (o.customer_phone ?? '').toLowerCase();
      const addr = (o.delivery_address ?? '').toLowerCase();
      const items = (o.order_items ?? []).map((i) => i.name).join(' ').toLowerCase();
      return no.includes(needle) || name.includes(needle) || phone.includes(needle) || addr.includes(needle) || items.includes(needle) || o.id.toLowerCase().includes(needle);
    });
  }, [orders, q, statusFilter]);

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-2 sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <History className="h-5 w-5 text-primary" />
          <div>
            <h2 className="font-heading font-bold text-foreground">Ιστορικό παραγγελιών</h2>
            <p className="text-xs text-muted-foreground">Τελευταίες {orders.length} · πάτα για λεπτομέρειες</p>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={() => void refetch()} disabled={isFetching}>
          Ανανέωση
        </Button>
      </div>

      <div className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Αναζήτηση αριθμού, πελάτη, τηλ., προϊόν..." className="pl-9 font-heading" />
        </div>
        <div className="flex gap-1.5">
          {([['all', 'Όλα'], ['delivered', 'Παραδομένες'], ['cancelled', 'Ακυρωμένες']] as const).map(([id, label]) => (
            <Button key={id} size="sm" variant={statusFilter === id ? 'default' : 'outline'} className="font-heading" onClick={() => setStatusFilter(id)}>
              {label}
            </Button>
          ))}
        </div>
      </div>

      {isLoading ? (
        <div className="text-center py-12 text-muted-foreground font-heading">Φόρτωση ιστορικού...</div>
      ) : filtered.length === 0 ? (
        <Card><CardContent className="py-12 text-center text-muted-foreground font-heading">Δεν βρέθηκαν παραγγελίες</CardContent></Card>
      ) : (
        <div className="space-y-2">
          {filtered.map((o) => {
            const open = openId === o.id;
            const items = o.order_items ?? [];
            const total = orderMoney(o).total;
            const pnl = getStoreOrderPnl(o, commissionPct);
            const fee = pnl.isExternal ? (pnl.storeCharge ?? 0) : pnl.platformFee;
            const vat = roundMoney(fee * 0.24);
            const earnings = roundMoney(pnl.gross - fee - vat);
            const prep = Number(o.estimated_prep_time || o.predicted_prep_minutes || 0);
            const eta = prep > 0
              ? format(new Date(new Date(o.created_at).getTime() + prep * 60000), 'HH:mm')
              : '—';
            return (
              <Card key={o.id} className="overflow-hidden border-border/80">
                <button type="button" className="w-full text-left p-3 sm:p-4 flex items-start gap-3 hover:bg-muted/40 transition-colors" onClick={() => setOpenId(open ? null : o.id)}>
                  <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                    <Package className="h-5 w-5 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-heading font-bold text-foreground">{formatOrderNumber(o as never)}</span>
                      <Badge variant={o.status === 'delivered' ? 'default' : 'secondary'}>{STATUS_LABEL[o.status] ?? o.status}</Badge>
                      <span className="text-sm font-bold tabular-nums text-primary ml-auto">{euro(total)}</span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {format(new Date(o.created_at), 'dd/MM/yyyy HH:mm', { locale: el })}
                     {open && (
                  <div className="border-t border-border bg-white">
                    <div className="px-4 pt-3 pb-2 flex items-start justify-between gap-3">
                      <div>
                        <p className="text-[11px] font-bold tracking-wide text-primary uppercase">{STATUS_BANNER[o.status] ?? STATUS_LABEL[o.status] ?? o.status}</p>
                        <p className="text-3xl font-heading font-bold tracking-tight text-foreground mt-0.5">{formatOrderNumber(o as never)}</p>
                      </div>
                      <p className="text-xs text-muted-foreground">{format(new Date(o.created_at), 'dd/MM/yyyy HH:mm', { locale: el })}</p>
                    </div>

                    <div className="px-4 py-2 flex items-center justify-between text-sm border-t border-border/60">
                      <span className="text-muted-foreground">Εκτιμώμενη ώρα παράδοσης</span>
                      <span className="font-semibold tabular-nums">{eta}</span>
                    </div>

                    <div className="px-4 pt-4 pb-2">
                      <p className="font-heading font-bold text-lg">Λεπτομέρειες παραγγελίας</p>
                    </div>

                    {items.length > 0 && (
                      <div className="px-4 pb-2 space-y-2">
                        {items.map((i) => (
                          <div key={i.id} className="flex items-start justify-between gap-3 text-sm">
                            <span className="font-heading"><span className="font-bold tabular-nums">{i.quantity}×</span> {i.name}</span>
                            <span className="tabular-nums font-semibold shrink-0">{euro(lineTotal(i.unit_price, i.quantity))}</span>
                          </div>
                        ))}
                      </div>
                    )}

                    <div className="px-4 py-2 space-y-1.5 text-sm border-t border-border/60">
                      <div className="flex justify-between"><span className="text-muted-foreground">Υποσύνολο</span><span className="tabular-nums">{euro(pnl.subtotal)}</span></div>
                      <div className="flex justify-between"><span className="text-muted-foreground">Κόστος διανομής</span><span className="tabular-nums">{euro(pnl.deliveryFee)}</span></div>
                      {pnl.tip > 0 && (
                        <div className="flex justify-between"><span className="text-muted-foreground">Φιλοδώρημα</span><span className="tabular-nums">{euro(pnl.tip)}</span></div>
                      )}
                      <div className="flex justify-between"><span className="text-muted-foreground">Προμήθεια{pnl.commissionPct != null ? ` ${pnl.commissionPct}%` : ''}</span><span className="tabular-nums text-destructive">{signedEuro(-fee)}</span></div>
                      <div className="flex justify-between"><span className="text-muted-foreground">ΦΠΑ 24%</span><span className="tabular-nums text-destructive">{signedEuro(-vat)}</span></div>
                      <div className="flex justify-between font-bold text-base pt-1"><span>Εκτιμώμενα κέρδη</span><span className="tabular-nums">{euro(earnings)}</span></div>
                      {Number(o.cash_received || 0) > 0 && (
                        <div className="flex justify-between"><span className="text-muted-foreground">Μετρητά που εισπράχθηκαν</span><span className="tabular-nums font-semibold">{euro(o.cash_received)}</span></div>
                      )}
                      <div className="flex justify-between text-muted-foreground"><span>Πελάτης πλήρωσε</span><span className="tabular-nums">{euro(pnl.gross)}</span></div>
                    </div>

                    <div className="px-4 py-3 border-t border-border/60 text-sm space-y-1 text-muted-foreground">
                      <p><span className="font-semibold text-foreground">Πελάτης:</span> {o.customer_name || '—'}{o.customer_phone ? ` · ${o.customer_phone}` : ''}</p>
                      <p><span className="font-semibold text-foreground">Διεύθυνση:</span> {o.delivery_address || '—'}</p>
                      <p><span className="font-semibold text-foreground">Πληρωμή:</span> {o.payment_method || '—'}</p>
                      {o.notes ? <p><span className="font-semibold text-foreground">Σημείωση:</span> {o.notes}</p> : null}
                    </div>
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
