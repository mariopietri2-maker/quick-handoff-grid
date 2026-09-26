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
import { formatEuro, lineTotal, orderMoney } from '@/lib/money';

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

export default function StoreOrderHistory({ storeId }: { storeId: string }) {
  const [q, setQ] = useState('');
  const [openId, setOpenId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<'all' | 'delivered' | 'cancelled'>('all');

  const { data: orders = [], isLoading, refetch, isFetching } = useQuery({
    queryKey: ['store-order-history', storeId],
    enabled: !!storeId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('orders')
        .select('id, created_at, updated_at, status, total_amount, delivery_fee, tip_amount, payment_method, delivery_address, notes, store_order_number, customer_id, order_items(id, name, quantity, unit_price)')
        .eq('store_id', storeId)
        .in('status', ['delivered', 'cancelled', 'picked_up', 'ready'])
        .order('created_at', { ascending: false })
        .limit(80);
      if (error) throw error;
      const rows = (data ?? []) as HistoryOrder[];
      const custIds = [...new Set(rows.map((r) => r.customer_id).filter(Boolean))] as string[];
      let nameById: Record<string, { full_name?: string | null; phone?: string | null }> = {};
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
                      {o.customer_name ? ` · ${o.customer_name}` : ''}
                      {items.length ? ` · ${items.length} προϊόντα` : ''}
                    </p>
                  </div>
                  {open ? <ChevronUp className="h-4 w-4 shrink-0 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />}
                </button>
                {open && (
                  <CardContent className="border-t border-border bg-muted/20 px-4 py-3 space-y-3">
                    <div className="grid sm:grid-cols-2 gap-2 text-sm">
                      <div>
                        <p className="text-[11px] uppercase tracking-wide text-muted-foreground font-bold">Πελάτης</p>
                        <p className="font-heading font-semibold">{o.customer_name || '—'}</p>
                        <p className="text-muted-foreground">{o.customer_phone || ''}</p>
                      </div>
                      <div>
                        <p className="text-[11px] uppercase tracking-wide text-muted-foreground font-bold">Διεύθυνση</p>
                        <p className="font-heading">{o.delivery_address || '—'}</p>
                      </div>
                      <div>
                        <p className="text-[11px] uppercase tracking-wide text-muted-foreground font-bold">Πληρωμή</p>
                        <p className="font-heading">{o.payment_method || '—'}</p>
                      </div>
                      <div>
                        <p className="text-[11px] uppercase tracking-wide text-muted-foreground font-bold">Σύνολο</p>
                        <p className="font-heading font-bold text-primary tabular-nums">{euro(total)}</p>
                      </div>
                    </div>
                    {items.length > 0 && (
                      <div>
                        <p className="text-[11px] uppercase tracking-wide text-muted-foreground font-bold mb-1.5">Προϊόντα</p>
                        <ul className="space-y-1">
                          {items.map((i) => (
                            <li key={i.id} className="flex justify-between gap-2 text-sm font-heading">
                              <span><span className="font-bold tabular-nums">{i.quantity}×</span> {i.name}</span>
                              <span className="tabular-nums font-semibold shrink-0">{euro(lineTotal(i.unit_price, i.quantity))}</span>
                            </li>
                          ))}
                        </ul>
                        <div className="mt-2 pt-2 border-t border-border/60 space-y-0.5 text-sm">
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Υποσύνολο</span>
                            <span className="tabular-nums font-semibold">{euro(Math.max(0, total - Number(o.delivery_fee || 0) - Number(o.tip_amount || 0)))}</span>
                          </div>
                          {Number(o.delivery_fee || 0) > 0 && (
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">Παράδοση</span>
                              <span className="tabular-nums">{euro(o.delivery_fee)}</span>
                            </div>
                          )}
                          {Number(o.tip_amount || 0) > 0 && (
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">Φιλοδώρημα</span>
                              <span className="tabular-nums">{euro(o.tip_amount)}</span>
                            </div>
                          )}
                          <div className="flex justify-between font-bold">
                            <span>Σύνολο</span>
                            <span className="tabular-nums text-primary">{euro(total)}</span>
                          </div>
                        </div>
                      </div>
                    )}
                    {o.notes ? (
                      <div className="text-sm rounded-lg border border-border bg-background px-3 py-2">
                        <span className="font-bold">Σημείωση: </span>{o.notes}
                      </div>
                    ) : null}
                    <p className="text-[10px] text-muted-foreground font-mono">ID {o.id.slice(0, 8)}…</p>
                  </CardContent>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
