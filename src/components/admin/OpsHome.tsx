import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { TrendingUp, TrendingDown, Activity, Clock, CheckCircle2, Star, Wallet, Zap, LayoutGrid, MapPin } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useCountUp } from '@/hooks/useCountUp';
import DriverSupplyPanel from './DriverSupplyPanel';
import { Button } from '@/components/ui/button';
import { subDays, startOfDay } from 'date-fns';

/**
 * Admin ops home â€” KPI strip + driver supply + shortcuts.
 * Kanban / live map live in their own tabs (no duplicates here).
 */

interface KpiProps {
  label: string;
  value: string;
  target?: string;
  trend?: number; // %
  values: number[];
  tone?: 'good' | 'warn' | 'bad' | 'neutral';
  icon: any;
}

function Sparkline({ values, tone = 'good' }: { values: number[]; tone?: KpiProps['tone'] }) {
  if (!values.length) return null;
  const w = 80, h = 22, pad = 1;
  const max = Math.max(...values, 1);
  const min = Math.min(...values, 0);
  const range = max - min || 1;
  const step = (w - pad * 2) / Math.max(values.length - 1, 1);
  const pts = values.map((v, i) => {
    const x = pad + i * step;
    const y = h - pad - ((v - min) / range) * (h - pad * 2);
    return `${x},${y}`;
  }).join(' ');
  const colorMap = {
    good: 'hsl(var(--success))',
    warn: 'hsl(var(--warning))',
    bad: 'hsl(var(--destructive))',
    neutral: 'hsl(var(--primary))',
  };
  const color = colorMap[tone ?? 'good'];
  return (
    <svg width={w} height={h} className="overflow-visible">
      <polyline points={pts} fill="none" stroke={color} strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function AnimatedValue({ raw }: { raw: string }) {
  const m = raw.match(/^([^\d]*)([\d.eE-]+)([^\d]*)$/);
  const num = useCountUp(m ? parseFloat(m[2]) : 0, 500);
  if (!m) return <p className="text-xl font-bold tabular-nums leading-none">{raw}</p>;
  const isPercent = m[3] === '%';
  const val = isPercent
    ? `${num.toFixed(0)}%`
    : m[3] === "'"
      ? `${num.toFixed(0)}'`
      : /\./.test(m[2]) && m[2].split('.')[1]?.length > 0
        ? `${m[1]}${num.toFixed(Math.min(2, m[2].split('.')[1].length))}${m[3]}`
        : `${m[1]}${Math.round(num).toLocaleString('el-GR')}${m[3]}`;
  return <p className="text-xl font-bold tabular-nums leading-none">{val}</p>;
}

function KpiCard({ label, value, target, trend, values, tone = 'neutral', icon: Icon }: KpiProps) {
  const trendIsGood = (trend ?? 0) >= 0;
  return (
    <div className="rounded-xl border border-border bg-card p-3 hover:shadow-sm transition-shadow animate-fade-in">
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-1.5">
          <Icon className="h-3.5 w-3.5 text-muted-foreground" />
          <p className="text-[11px] uppercase tracking-wide text-muted-foreground font-medium">{label}</p>
        </div>
        {typeof trend === 'number' && (
          <span className={cn(
            'text-[10.5px] font-semibold tabular-nums flex items-center gap-0.5',
            trendIsGood ? 'text-success' : 'text-destructive',
          )}>
            {trendIsGood ? <TrendingUp className="h-2.5 w-2.5" /> : <TrendingDown className="h-2.5 w-2.5" />}
            {Math.abs(trend).toFixed(0)}%
          </span>
        )}
      </div>
      <div className="flex items-end justify-between gap-2">
        <div>
          <AnimatedValue raw={value} />
          {target && <p className="text-[10px] text-muted-foreground mt-1">target {target}</p>}
        </div>
        <Sparkline values={values} tone={tone} />
      </div>
    </div>
  );
}

export default function OpsHome({ onNavigate }: { onNavigate?: (tab: string) => void }) {
  // Fetch last 8 days of orders for trends + today's snapshot
  const { data } = useQuery({
    queryKey: ['ops-home-metrics'],
    refetchInterval: 30_000,
    queryFn: async () => {
      const since = subDays(new Date(), 8).toISOString();
      const { data: orders } = await supabase
        .from('orders')
        .select('id, status, created_at, total_amount, predicted_ready_at, updated_at, platform_profit, driver_id, commission_settled_at')
        .gte('created_at', since)
        .limit(2000);
      const { data: states } = await supabase.from('driver_state').select('driver_id, shift_started_at, on_break');
      const { data: offers } = await supabase
        .from('driver_offer_events')
        .select('action, created_at')
        .gte('created_at', since)
        .limit(2000);
      const { count: pendingOffers } = await supabase
        .from('pending_offers')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'pending');
      const { count: unassignedReady } = await supabase
        .from('orders')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'ready')
        .is('driver_id', null);
      return {
        orders: orders ?? [],
        states: states ?? [],
        offers: offers ?? [],
        pendingOffers: pendingOffers ?? 0,
        unassignedReady: unassignedReady ?? 0,
      };
    },
  });

  const metrics = useMemo(() => {
    if (!data) return null;
    const now = new Date();
    const days: { day: Date; orders: any[] }[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = startOfDay(subDays(now, i));
      const next = startOfDay(subDays(now, i - 1));
      days.push({
        day: d,
        orders: data.orders.filter((o) => {
          const t = new Date(o.created_at);
          return t >= d && t < next;
        }),
      });
    }

    // Acceptance rate per day
    const acceptanceSeries = (() => {
      const out: number[] = [];
      for (let i = 6; i >= 0; i--) {
        const d = startOfDay(subDays(now, i));
        const next = startOfDay(subDays(now, i - 1));
        const evs = data.offers.filter((e: any) => {
          const t = new Date(e.created_at);
          return t >= d && t < next;
        });
        const acc = evs.filter((e: any) => e.action === 'accepted').length;
        const dec = evs.filter((e: any) => e.action === 'declined').length;
        out.push(acc + dec === 0 ? 0 : (acc / (acc + dec)) * 100);
      }
      return out;
    })();
    const acceptanceToday = acceptanceSeries[acceptanceSeries.length - 1] ?? 0;
    const acceptancePrev = acceptanceSeries[acceptanceSeries.length - 2] ?? 0;
    const acceptanceTrend = acceptancePrev === 0 ? 0 : ((acceptanceToday - acceptancePrev) / acceptancePrev) * 100;

    // On-time delivery (delivered orders within predicted_ready_at + 25m)
    const onTimeSeries = days.map(({ orders }) => {
      const delivered = orders.filter((o: any) => o.status === 'delivered');
      if (delivered.length === 0) return 100;
      const onTime = delivered.filter((o: any) => {
        if (!o.predicted_ready_at) return true;
        const dueBy = new Date(o.predicted_ready_at).getTime() + 25 * 60 * 1000;
        return new Date(o.updated_at).getTime() <= dueBy;
      }).length;
      return (onTime / delivered.length) * 100;
    });
    const onTimeToday = onTimeSeries[onTimeSeries.length - 1];
    const onTimePrev = onTimeSeries[onTimeSeries.length - 2];
    const onTimeTrend = onTimePrev === 0 ? 0 : ((onTimeToday - onTimePrev) / onTimePrev) * 100;

    // Avg delivery time (created â†’ delivered)
    const avgDeliverySeries = days.map(({ orders }) => {
      const delivered = orders.filter((o: any) => o.status === 'delivered');
      if (delivered.length === 0) return 0;
      const sum = delivered.reduce((s: number, o: any) =>
        s + (new Date(o.updated_at).getTime() - new Date(o.created_at).getTime()) / 60000, 0);
      return sum / delivered.length;
    });
    const avgDeliveryToday = avgDeliverySeries[avgDeliverySeries.length - 1];

    // Revenue
    const revSeries = days.map(({ orders }) =>
      orders.filter((o: any) => o.status === 'delivered').reduce((s: number, o: any) => s + Number(o.total_amount || 0), 0));
    const revToday = revSeries[revSeries.length - 1];
    const revPrev = revSeries[revSeries.length - 2];
    const revTrend = revPrev === 0 ? 0 : ((revToday - revPrev) / revPrev) * 100;

    // Driver utilization (online drivers vs orders/day) â€” proxy: live online %
    const onlineNow = data.states.filter((s: any) => !!s.shift_started_at && !s.on_break).length;
    const utilSeries = days.map(({ orders }) => Math.min(100, orders.length * 8)); // crude proxy

    return {
      acceptance: { value: acceptanceToday, trend: acceptanceTrend, series: acceptanceSeries },
      onTime: { value: onTimeToday, trend: onTimeTrend, series: onTimeSeries },
      avgDelivery: { value: avgDeliveryToday, series: avgDeliverySeries },
      revenue: { value: revToday, trend: revTrend, series: revSeries },
      onlineNow,
      utilSeries,
      pendingOffers: data.pendingOffers,
      unassignedReady: data.unassignedReady,
    };
  }, [data]);

  if (!metrics) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-6 w-6 rounded-full border-2 border-primary border-t-transparent animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-3.5">
      {/* KPI strip with sparklines */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-2.5">
        <KpiCard
          label="Acceptance rate"
          value={`${metrics.acceptance.value.toFixed(0)}%`}
          target="â‰¥ 90%"
          trend={metrics.acceptance.trend}
          values={metrics.acceptance.series}
          tone={metrics.acceptance.value >= 90 ? 'good' : metrics.acceptance.value >= 75 ? 'warn' : 'bad'}
          icon={CheckCircle2}
        />
        <KpiCard
          label="On-time delivery"
          value={`${metrics.onTime.value.toFixed(0)}%`}
          target="â‰¥ 95%"
          trend={metrics.onTime.trend}
          values={metrics.onTime.series}
          tone={metrics.onTime.value >= 95 ? 'good' : metrics.onTime.value >= 85 ? 'warn' : 'bad'}
          icon={Clock}
        />
        <KpiCard
          label="Avg delivery time"
          value={`${metrics.avgDelivery.value.toFixed(0)}'`}
          target="â‰¤ 30'"
          values={metrics.avgDelivery.series}
          tone={metrics.avgDelivery.value <= 30 ? 'good' : metrics.avgDelivery.value <= 45 ? 'warn' : 'bad'}
          icon={Activity}
        />
        <KpiCard
          label="Revenue ÏƒÎ®Î¼ÎµÏÎ±"
          value={`â‚¬${metrics.revenue.value.toFixed(0)}`}
          trend={metrics.revenue.trend}
          values={metrics.revenue.series}
          tone="neutral"
          icon={Wallet}
        />
        <KpiCard
          label="Online drivers"
          value={`${metrics.onlineNow}`}
          values={metrics.utilSeries}
          tone="neutral"
          icon={Star}
        />
      </div>

      {/* Shortcuts + supply â€” no duplicate Kanban here */}
      <div className="grid grid-cols-1 xl:grid-cols-[1fr_320px] gap-3.5">
        <div className="min-w-0 space-y-3">
          <div className="rounded-xl border border-border bg-card p-4 space-y-3">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div>
                <p className="font-heading font-bold text-sm">Î“ÏÎ®Î³Î¿ÏÎµÏ‚ ÎµÎ½Î­ÏÎ³ÎµÎ¹ÎµÏ‚</p>
                <p className="text-xs text-muted-foreground">
                  {metrics.unassignedReady > 0
                    ? `${metrics.unassignedReady} Î­Ï„Î¿Î¹Î¼ÎµÏ‚ Ï‡Ï‰ÏÎ¯Ï‚ Î¿Î´Î·Î³ÏŒ Â· ${metrics.pendingOffers} ÎµÎ½ÎµÏÎ³Î­Ï‚ Ï€ÏÎ¿ÏƒÏ†Î¿ÏÎ­Ï‚`
                    : `${metrics.pendingOffers} ÎµÎ½ÎµÏÎ³Î­Ï‚ Ï€ÏÎ¿ÏƒÏ†Î¿ÏÎ­Ï‚`}
                </p>
              </div>
              {metrics.unassignedReady > 0 && (
                <span className="text-[11px] font-semibold text-amber-700 dark:text-amber-400 bg-amber-500/10 border border-amber-500/30 rounded-full px-2.5 py-1">
                  Î§ÏÎµÎ¹Î¬Î¶ÎµÏ„Î±Î¹ dispatch
                </span>
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              <Button size="sm" onClick={() => onNavigate?.('delivery_control')}>
                <Zap className="h-3.5 w-3.5 mr-1.5" /> Dispatch
              </Button>
              <Button size="sm" variant="outline" onClick={() => onNavigate?.('capacity')}>
                <Activity className="h-3.5 w-3.5 mr-1.5" /> Î§Ï‰ÏÎ·Ï„Î¹ÎºÏŒÏ„Î·Ï„Î±
              </Button>
              <Button size="sm" variant="outline" onClick={() => onNavigate?.('orders')}>
                <LayoutGrid className="h-3.5 w-3.5 mr-1.5" /> Pipeline
              </Button>
              <Button size="sm" variant="outline" onClick={() => onNavigate?.('drivers_ioannina_map')}>
                <MapPin className="h-3.5 w-3.5 mr-1.5" /> Live Ï‡Î¬ÏÏ„Î·Ï‚
              </Button>
            </div>
          </div>
        </div>
        <div className="space-y-3.5">
          <DriverSupplyPanel />
        </div>
      </div>
    </div>
  );
}
