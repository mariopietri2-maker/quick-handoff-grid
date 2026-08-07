import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { format, subDays, startOfDay } from 'date-fns';
import { cn } from '@/lib/utils';
import { formatOrderNumber } from '@/lib/order-number';
import { isDriverPresenceOnline } from '@/lib/driver-presence';
import { supabase } from '@/integrations/supabase/client';
import type { Database } from '@/integrations/supabase/types';
import {
  TrendingUp, TrendingDown, ShoppingBag, Wallet, Bike, Clock,
} from 'lucide-react';

interface Props {
  orders: any[];
  profiles: any[];
  driverStates?: any[];
  driverLocations?: any[];
  driverWallets?: any[];
  storeWallets?: any[];
  onNavigate?: (tab: string) => void;
}

const STATUS_LABELS: Record<string, string> = {
  pending: 'Εκκρεμεί', placed: 'Υποβλήθηκε', accepted: 'Αποδεκτή',
  preparing: 'Ετοιμάζεται', ready: 'Έτοιμη', picked_up: 'Παραλήφθηκε',
  arrived: 'Έφτασε', delivered: 'Παραδόθηκε', cancelled: 'Ακυρώθηκε',
};

const STATUS_TONE: Record<string, string> = {
  pending:   'bg-yellow-500/10 text-yellow-700 dark:text-yellow-400 border-yellow-500/30',
  placed:    'bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/30',
  accepted:  'bg-indigo-500/10 text-indigo-700 dark:text-indigo-400 border-indigo-500/30',
  preparing: 'bg-orange-500/10 text-orange-700 dark:text-orange-400 border-orange-500/30',
  ready:     'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/30',
  picked_up: 'bg-purple-500/10 text-purple-700 dark:text-purple-400 border-purple-500/30',
  arrived:   'bg-violet-500/10 text-violet-700 dark:text-violet-400 border-violet-500/30',
  delivered: 'bg-green-500/10 text-green-700 dark:text-green-400 border-green-500/30',
  cancelled: 'bg-red-500/10 text-red-700 dark:text-red-400 border-red-500/30',
};

const CARD = 'rounded-2xl border border-border bg-card shadow-[0_1px_2px_rgba(15,23,42,.05),0_8px_24px_-12px_rgba(15,23,42,.12)]';
type TreasuryBalanceRow = Pick<
  Database['public']['Tables']['admin_treasury']['Row'],
  'admin_balance' | 'platform_pool'
>;

function Sparkline({ data, color = 'hsl(var(--primary))' }: { data: number[]; color?: string }) {
  if (!data.length) return null;
  const w = 110, h = 34, pad = 2;
  const max = Math.max(...data, 1);
  const min = Math.min(...data, 0);
  const range = max - min || 1;
  const step = (w - pad * 2) / Math.max(data.length - 1, 1);
  const pts = data.map((v, i) => {
    const x = pad + i * step;
    const y = h - pad - ((v - min) / range) * (h - pad * 2);
    return x.toFixed(1) + ',' + y.toFixed(1);
  });
  const area = 'M' + pad + ',' + h + ' L' + pts.join(' L') + ' L' + (w - pad) + ',' + h + ' Z';
  return (
    <svg width={w} height={h} className="overflow-visible shrink-0">
      <path d={area} fill={color} opacity={0.12} />
      <polyline points={pts.join(' ')} fill="none" stroke={color} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function Kpi(props: {
  label: string; value: React.ReactNode; sub?: string;
  icon: any; iconCls: string; trend?: number; spark?: number[]; sparkColor?: string;
}) {
  const up = (props.trend ?? 0) >= 0;
  return (
    <div className={cn(CARD, 'p-4')}>
      <div className="mb-3 flex items-center justify-between">
        <span className={cn('inline-flex h-9 w-9 items-center justify-center rounded-xl', props.iconCls)}>
          <props.icon className="h-4 w-4" />
        </span>
        {typeof props.trend === 'number' && (
          <span className={cn('flex items-center gap-0.5 rounded-full px-2 py-0.5 text-[10.5px] font-bold', up ? 'bg-emerald-500/10 text-emerald-700' : 'bg-rose-500/10 text-rose-600')}>
            {up ? <TrendingUp className="h-2.5 w-2.5" /> : <TrendingDown className="h-2.5 w-2.5" />}
            {Math.abs(props.trend).toFixed(1)}%
          </span>
        )}
      </div>
      <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{props.label}</p>
      <p className="mt-1 text-2xl font-extrabold tabular-nums">{props.value}</p>
      <div className="mt-2 flex items-end justify-between gap-2">
        <span className="text-[10.5px] text-muted-foreground">{props.sub}</span>
        {props.spark && <Sparkline data={props.spark} color={props.sparkColor} />}
      </div>
    </div>
  );
}

function Ring(props: { pct: number; value: string; label: string; sub: string; color: string; bgColor: string }) {
  const r = 23, c = 2 * Math.PI * r;
  const p = Math.min(Math.max(props.pct, 0), 100) / 100;
  const dashoff = c - p * c;
  return (
    <div className="flex items-center gap-3 rounded-xl border border-border/60 bg-muted/40 p-3">
      <div className="relative h-14 w-14 shrink-0">
        <svg width="56" height="56" viewBox="0 0 56 56">
          <circle cx="28" cy="28" r={r} fill="none" stroke={props.bgColor} strokeWidth="7" />
          <circle cx="28" cy="28" r={r} fill="none" stroke={props.color} strokeWidth="7" strokeLinecap="round"
            strokeDasharray={c.toFixed(2)} strokeDashoffset={dashoff.toFixed(2)} transform="rotate(-90 28 28)" />
        </svg>
        <b className="absolute inset-0 flex items-center justify-center text-[10px] tabular-nums">{props.value}</b>
      </div>
      <div className="min-w-0">
        <b className="block truncate text-sm font-bold leading-tight">{props.label}</b>
        <span className="truncate text-[10.5px] font-medium text-muted-foreground">{props.sub}</span>
      </div>
    </div>
  );
}

export default function AdminDashboard(props: Props) {
  const { orders, profiles, driverStates = [], driverLocations = [], driverWallets = [], storeWallets = [] } = props;
  const [span, setSpan] = useState<'today' | '7d' | '30d'>('7d');

  const { data: treasuryBal } = useQuery({
    queryKey: ['admin-dashboard-treasury'],
    queryFn: async () => {
      const { data } = await supabase
        .from('admin_treasury')
        .select('admin_balance, platform_pool')
        .eq('id', 1)
        .maybeSingle();
      return (data as TreasuryBalanceRow | null) ?? null;
    },
    refetchInterval: 30_000,
  });
  const adminBal = Number(treasuryBal?.admin_balance ?? 0);
  const platformPool = Number(treasuryBal?.platform_pool ?? 0);

  const driverNames = useMemo(() => new Map(profiles.map((p) => [p.user_id, p.full_name])), [profiles]);
  const drivers = useMemo(() => profiles.filter((p) => p.role === 'driver'), [profiles]);
  const locMap = useMemo(() => new Map(driverLocations.map((l) => [l.driver_id, l.updated_at])), [driverLocations]);
  const onlineCount = useMemo(() => driverStates.filter((d) => {
    if (d.on_break) return false;
    return isDriverPresenceOnline(locMap.get(d.driver_id)) && !!d.shift_started_at;
  }).length, [driverStates, locMap]);

  const today = useMemo(() => {
    const now = new Date();
    const nx = startOfDay(now);
    const d = startOfDay(subDays(now, 1));
    const tod = orders.filter((o) => new Date(o.created_at) >= nx);
    const yes = orders.filter((o) => {
      const t = new Date(o.created_at);
      return t >= d && t < nx;
    });
    const revNow = tod.filter((o) => o.status === 'delivered').reduce((s, o) => s + Number(o.total_amount || 0), 0);
    const revYes = yes.filter((o) => o.status === 'delivered').reduce((s, o) => s + Number(o.total_amount || 0), 0);
    return { todayCount: tod.length, yestCount: yes.length, revNow, revYes, pending: tod.filter((o) => !['delivered', 'cancelled'].includes(o.status)).length };
  }, [orders]);

  const revTrend = today.revYes > 0 ? ((today.revNow - today.revYes) / today.revYes) * 100 : 0;
  const orderTrend = today.yestCount > 0 ? ((today.todayCount - today.yestCount) / today.yestCount) * 100 : 0;

  const series = useMemo(() => {
    const days = span === 'today' ? 1 : span === '7d' ? 7 : 30;
    const rev: number[] = [];
    const ord: number[] = [];
    const now = new Date();
    for (let i = days - 1; i >= 0; i--) {
      const d = startOfDay(subDays(now, i));
      const nx = startOfDay(subDays(now, i - 1));
      const day = orders.filter((o) => {
        const t = new Date(o.created_at);
        return t >= d && t < nx;
      });
      rev.push(day.filter((o) => o.status === 'delivered').reduce((s, o) => s + Number(o.total_amount || 0), 0));
      ord.push(day.length);
    }
    return { rev, ord };
  }, [orders, span]);

  const pool = useMemo(() => driverWallets.reduce((s, w) => s + Number(w.available_balance || 0), 0), [driverWallets]);
  const owed = useMemo(() => storeWallets.reduce((s, w) => s + Number(w.available_balance || 0), 0), [storeWallets]);
  const cash = useMemo(() => driverStates.filter((d) => d.shift_started_at).reduce((s, d) => s + Number(d.shift_cash_balance || 0), 0), [driverStates]);

  const liveOrders = orders.filter((o) => !['delivered', 'cancelled'].includes(o.status));
  const recent = orders.slice(0, 12);
  const total = Math.max(pool + owed + cash, 1);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-extrabold tracking-tight">Καλησπέρα 👋</h1>
          <p className="mt-1 text-xs text-muted-foreground">{format(new Date(), 'EEEE, dd MMMM yyyy')} · Σύνοψη λειτουργίας σε πραγματικό χρόνο</p>
        </div>
        <div className="flex gap-1 rounded-xl border border-border/60 bg-muted p-0.5">
          {([['today', 'Σήμερα'], ['7d', '7 ημέρες'], ['30d', '30 ημέρες']] as const).map(([id, lbl]) => (
            <button key={id} onClick={() => setSpan(id)}
              className={cn('h-7 rounded-lg px-3 text-xs font-semibold transition-colors',
                span === id ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground')}>
              {lbl}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-5">
        <Kpi label="Έσοδα σήμερα" value={`€${today.revNow.toFixed(0)}`} sub={`${today.todayCount} παραγγελίες`}
          icon={Wallet} iconCls="bg-emerald-500/10 text-emerald-600" trend={revTrend} spark={series.rev} sparkColor="hsl(var(--success))" />
        <Kpi label="Παραγγελίες" value={String(today.todayCount)} sub={`${today.pending} σε ροή`}
          icon={ShoppingBag} iconCls="bg-indigo-500/10 text-indigo-500" trend={orderTrend} spark={series.ord} sparkColor="#6366f1" />
        <Kpi label="Ενεργοί Οδηγοί" value={String(onlineCount)} sub={`από ${drivers.length} εγγεγ.`}
          icon={Bike} iconCls="bg-sky-500/10 text-sky-500" />
        <Kpi label="Ταμεία Pool" value={`€${pool.toFixed(0)}`} sub="διαθέσιμο balance"
          icon={Clock} iconCls="bg-amber-500/10 text-amber-600" />
        <Kpi label="Καλάθι (Treasury)" value={`€${adminBal.toFixed(0)}`} sub={`platform pool €${platformPool.toFixed(0)}`}
          icon={Wallet} iconCls="bg-indigo-500/10 text-indigo-500" />
      </div>

      <div className="grid grid-cols-2 gap-2.5 lg:grid-cols-4">
        <Ring color="#10b981" bgColor="#e7f8f1" value="€" label="Driver Pool" sub={`€${pool.toFixed(0)}`} pct={(pool / total) * 100} />
        <Ring color="#6366f1" bgColor="#eef0ff" value="€" label="Treasury (Καλάθι)" sub={`€${adminBal.toFixed(0)}`} pct={total > 0 ? (adminBal / total) * 100 : 0} />
        <Ring color="#f59e0b" bgColor="#fef3e2" value="€" label="Owed to Stores" sub={`€${owed.toFixed(0)}`} pct={(owed / total) * 100} />
        <Ring color="#f43f5e" bgColor="#ffe9ee" value="€" label="Cash on Street" sub={`€${cash.toFixed(0)}`} pct={(cash / total) * 100} />
      </div>

      <div className={cn(CARD, 'p-4')}>
        <div className="mb-3 flex items-center justify-between">
          <h3 className="flex items-center gap-2 text-sm font-bold">
            <span className="inline-flex h-2 w-2 rounded-full bg-emerald-500 animate-pulse" /> Live ροή παραγγελιών
          </h3>
          <span className="text-[10.5px] font-semibold uppercase tracking-wide text-muted-foreground">{liveOrders.length} ενεργές</span>
        </div>
        {liveOrders.length === 0 ? (
          <p className="py-6 text-center text-xs text-muted-foreground">Καμία ενεργή παραγγελία τώρα</p>
        ) : (
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {liveOrders.slice(0, 9).map((o) => (
              <div key={o.id} className="rounded-lg border border-border/70 bg-muted/30 p-2.5">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-[11px] font-bold">{formatOrderNumber(o)}</span>
                  <span className="text-[13px] font-semibold tabular-nums">€{Number(o.total_amount || 0).toFixed(2)}</span>
                </div>
                <div className="mt-1.5 flex items-center gap-1.5 text-[10.5px] text-muted-foreground">
                  <span className={cn('inline-flex items-center rounded-full border px-2 py-0.5', STATUS_TONE[o.status] ?? 'border-border bg-muted text-muted-foreground')}>
                    {STATUS_LABELS[o.status] ?? o.status}
                  </span>
                  <span className="truncate">{o.driver_id ? (driverNames.get(o.driver_id) || '—') : <i>χωρίς οδηγό</i>}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className={cn(CARD, 'overflow-hidden')}>
        <div className="flex items-center justify-between border-b border-border p-4">
          <h3 className="text-sm font-bold">Πρόσφατες Παραγγελίες</h3>
          <span className="rounded-full bg-muted px-2 py-0.5 text-[10.5px] font-semibold text-muted-foreground">{recent.length}</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-[12.5px]">
            <thead className="bg-muted/40 text-muted-foreground">
              <tr>
                <th className="px-3 py-2 text-left font-medium">ID</th>
                <th className="px-3 py-2 text-left font-medium">Οδηγός</th>
                <th className="px-3 py-2 text-left font-medium">Κατάσταση</th>
                <th className="px-3 py-2 text-right font-medium">Ποσό</th>
                <th className="px-3 py-2 text-right font-medium">Ώρα</th>
              </tr>
            </thead>
            <tbody>
              {recent.map((o) => (
                <tr key={o.id} className="border-t border-border/50 hover:bg-muted/20">
                  <td className="px-3 py-2 font-mono text-[11.5px] font-bold text-foreground">{formatOrderNumber(o)}</td>
                  <td className="px-3 py-2 text-muted-foreground">{o.driver_id ? (driverNames.get(o.driver_id) || o.driver_id.slice(0, 6)) : <i>—</i>}</td>
                  <td className="px-3 py-2">
                    <span className={cn('inline-flex items-center rounded-full border px-2 py-0.5 text-[10.5px] font-medium', STATUS_TONE[o.status] ?? 'border-border bg-muted text-muted-foreground')}>
                      {STATUS_LABELS[o.status] ?? o.status}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-right font-semibold tabular-nums">€{Number(o.total_amount).toFixed(2)}</td>
                  <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">{format(new Date(o.created_at), 'dd MMM, HH:mm')}</td>
                </tr>
              ))}
              {!recent.length && (
                <tr>
                  <td colSpan={5} className="px-3 py-10 text-center text-muted-foreground">Καμία παραγγελία</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
