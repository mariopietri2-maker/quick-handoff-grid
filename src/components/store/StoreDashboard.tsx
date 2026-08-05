import { useMemo } from 'react';
import {
  TrendingUp, ShoppingBag, Wallet, CheckCircle2, PackagePlus,
} from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { useStoreAnalytics } from '@/hooks/useStoreAnalytics';
import { OrderQueue } from './OrderQueue';
import { formatOrderNumber } from '@/lib/order-number';
import type { OrderWithItems } from '@/hooks/useOrders';

interface Props {
  storeId: string;
  storeName: string;
  orders: OrderWithItems[];
  onStatusUpdate: (orderId: string, newStatus: string, options?: { estimatedPrepTime?: number }) => Promise<boolean> | void;
  pendingIds?: string[] | Set<string>;
}

const CARD = 'rounded-2xl border border-border bg-card shadow-[0_1px_2px_rgba(15,23,42,.05),0_8px_24px_-12px_rgba(15,23,42,.12)]';

function BigStat(props: {
  icon: any; label: string; value: React.ReactNode; sub?: string; accent: string;
}) {
  const Icon = props.icon;
  return (
    <div className={cn(CARD, 'flex items-center gap-3 p-4')}>
      <span className={cn('inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl', props.accent)}>
        <Icon className="h-[19px] w-[19px]" strokeWidth={2.2} />
      </span>
      <div className="min-w-0">
        <span className="block text-[10.5px] font-semibold uppercase tracking-wider text-muted-foreground">{props.label}</span>
        <b className="mt-0.5 block truncate text-[19px] font-extrabold leading-tight tabular-nums">{props.value}</b>
        {props.sub && <span className="block truncate text-[10.5px] text-muted-foreground">{props.sub}</span>}
      </div>
    </div>
  );
}

const orderStatus: Record<string, { label: string; cls: string }> = {
  placed:    { label: 'Νέα',           cls: 'text-amber-700 bg-amber-500/10 border-amber-500/30' },
  accepted:  { label: 'Αποδεκτή',      cls: 'text-indigo-700 bg-indigo-500/10 border-indigo-500/30' },
  preparing: { label: 'Κουζίνα',       cls: 'text-orange-700 bg-orange-500/10 border-orange-500/30' },
  ready:     { label: 'Έτοιμη',        cls: 'text-sky-700 bg-sky-500/10 border-sky-500/30' },
  picked_up: { label: 'Παραλήφθηκε',   cls: 'text-violet-700 bg-violet-500/10 border-violet-500/30' },
  delivered: { label: 'Παραδόθηκε',    cls: 'text-emerald-700 bg-emerald-500/10 border-emerald-500/30' },
  cancelled: { label: 'Ακυρώθηκε',     cls: 'text-rose-700 bg-rose-500/10 border-rose-500/30' },
};

export default function StoreDashboard({
  storeId, storeName, orders, onStatusUpdate, pendingIds,
}: Props) {
  const analytics = useStoreAnalytics(storeId);

  const { data: walletBal } = useQuery({
    queryKey: ['store-wallet-balance', storeId],
    queryFn: async () => {
      if (!storeId) return null;
      const { data } = await (supabase as any)
        .from('store_wallets')
        .select('available_balance')
        .eq('store_id', storeId)
        .maybeSingle();
      return data?.available_balance ?? null;
    },
    enabled: !!storeId,
  });

  const extCount = useMemo(
    () => orders.filter((o) => o.source && o.source !== 'in_app').length,
    [orders],
  );

  const onTime = useMemo(() => {
    const s = analytics.statusBreakdown ?? {};
    const delivered = s.delivered ?? 0;
    const cancelled = s.cancelled ?? 0;
    const resolved = delivered + cancelled;
    return { delivered, cancelled };
  }, [analytics.statusBreakdown]);

  const revenue = analytics.loading ? null : analytics.todayRevenue;
  const orderCount = analytics.loading ? null : analytics.todayOrders;
  const onTimePct = onTime.delivered + onTime.cancelled > 0
    ? Math.round((onTime.delivered / (onTime.delivered + onTime.cancelled)) * 100)
    : null;

  return (
    <div className="space-y-3">
      {/* Overview strip */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <BigStat icon={TrendingUp} label="Έσοδα Σήμερα"
          value={revenue === null ? '—' : `€${revenue.toFixed(0)}`}
          sub={revenue === null ? 'φόρτωση…' : `€${revenue.toFixed(2)}`}
          accent="bg-amber-500/10 text-amber-700" />
        <BigStat icon={ShoppingBag} label="Παραγγελίες Σήμερα"
          value={orderCount === null ? '—' : String(orderCount)}
          sub={`${orders.length} ενεργές`}
          accent="bg-emerald-500/10 text-emerald-700" />
        <BigStat icon={Wallet} label="Σε Πορτοφόλι"
          value={typeof walletBal === 'number' ? `€${walletBal.toFixed(0)}` : '—'}
          sub={typeof walletBal === 'number' ? `€${walletBal.toFixed(2)}` : 'φόρτωση…'}
          accent="bg-sky-500/10 text-sky-600" />
        <BigStat icon={CheckCircle2} label="On-time Παράδοση"
          value={onTimePct === null ? '—' : `${onTimePct}%`}
          sub={`${onTime.delivered} παραδόθηκαν`}
          accent="bg-indigo-500/10 text-indigo-500" />
      </div>

      {/* Kitchen board */}
      <OrderQueue orders={orders} onStatusUpdate={onStatusUpdate} storeName={storeName} pendingIds={pendingIds} />

      {/* Bottom panels */}
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        <div className={cn(CARD, 'overflow-hidden')}>
          <div className="flex items-center gap-2 border-b border-border p-3">
            <PackagePlus className="h-4 w-4 text-muted-foreground" />
            <h3 className="text-sm font-bold">Σύνοψη Παραγγελιών</h3>
            <span className="ml-auto rounded-full bg-muted px-2 py-0.5 text-[10.5px] font-semibold text-muted-foreground">{orders.length}</span>
          </div>
          <div className="divide-y divide-border/70">
            {orders.length === 0 ? (
              <p className="px-3 py-8 text-center text-xs text-muted-foreground">Καμία ενεργή παραγγελία</p>
            ) : (
              orders.slice(0, 6).map((o) => {
                const item = orderStatus[o.status] ?? orderStatus.placed;
                return (
                  <div key={o.id} className="flex items-center gap-2.5 px-3 py-2.5 text-[12.5px]">
                    <span className="font-mono text-[11.5px] font-bold">{formatOrderNumber(o)}</span>
                    <span className={cn('inline-flex items-center rounded-full border px-2 py-0.5 text-[10.5px] font-semibold', item.cls)}>{item.label}</span>
                    <span className="min-w-0 flex-1 truncate text-muted-foreground">{o.order_items?.[0]?.name ?? '—'}</span>
                    <span className="font-bold tabular-nums">€{Number(o.total_amount).toFixed(2)}</span>
                  </div>
                );
              })
            )}
          </div>
        </div>

        <div className={cn(CARD, 'overflow-hidden')}>
          <div className="flex items-center gap-2 border-b border-border p-3">
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
            <h3 className="text-sm font-bold">Σήμερα</h3>
            <span className="ml-auto inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10.5px] font-semibold text-emerald-700">
              {orderCount} παραγγελίες
            </span>
          </div>
          <div className="divide-y divide-border/70 text-[12.5px]">
            <div className="flex items-center justify-between px-3 py-2.5">
              <span className="text-muted-foreground">Έσοδα</span>
              <b className="tabular-nums">€{revenue === null ? '—' : revenue.toFixed(2)}</b>
            </div>
            <div className="flex items-center justify-between px-3 py-2.5">
              <span className="text-muted-foreground">Μέσος χρόνος ετοιμασίας</span>
              <b className="tabular-nums">{analytics.avgPrepTime > 0 ? `${analytics.avgPrepTime}λ` : '—'}</b>
            </div>
            <div className="flex items-center justify-between px-3 py-2.5">
              <span className="text-muted-foreground">Ενεργές τώρα</span>
              <b className="tabular-nums">{orders.length}</b>
            </div>
            <div className="flex items-center justify-between px-3 py-2.5">
              <span className="text-muted-foreground">Εκτός πλατφόρμας (eFood/Wolt/Box)</span>
              <b className="tabular-nums">{extCount}</b>
            </div>
            <div className="flex items-center justify-between px-3 py-2.5">
              <span className="text-muted-foreground">Σε Πορτοφόλι</span>
              <b className="tabular-nums">{typeof walletBal === 'number' ? `€${walletBal.toFixed(0)}` : '—'}</b>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}