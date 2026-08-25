 import { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Activity,
  AlertTriangle,
  Bike,
  Banknote,
  Clock,
  Gauge,
  Layers,
  MapPin,
  Package,
  Radio,
  Server,
  Settings2,
  Store,
  Waves,
  Zap,
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { CAPACITY_BENCHMARKS as BM } from '@/lib/capacity-benchmarks';
import { DEFAULT_GUARDRAILS, loadGuardrails } from '@/lib/cost-guardrails';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';
import { startOfDay, subHours } from 'date-fns';

type StatusFunnel = Record<string, number>;

const OPEN_STATUSES = ['placed', 'accepted', 'preparing', 'ready', 'arrived', 'picked_up'] as const;

function pct(n: number, d: number) {
  if (!d) return 0;
  return Math.round((n / d) * 100);
}

function euro(n: number) {
  return `${Number(n || 0).toFixed(2)}â‚¬`;
}

function CapCard({
  label,
  value,
  hint,
  tone = 'neutral',
  icon: Icon,
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: 'good' | 'warn' | 'bad' | 'neutral';
  icon: typeof Gauge;
}) {
  const toneCls =
    tone === 'good'
      ? 'text-success'
      : tone === 'warn'
        ? 'text-warning'
        : tone === 'bad'
          ? 'text-destructive'
          : 'text-foreground';
  return (
    <div className="rounded-xl border border-border bg-card p-3.5 space-y-1.5">
      <div className="flex items-center gap-1.5 text-muted-foreground">
        <Icon className="h-3.5 w-3.5" />
        <p className="text-[11px] uppercase tracking-wide font-medium">{label}</p>
      </div>
      <p className={cn('text-2xl font-bold tabular-nums leading-none', toneCls)}>{value}</p>
      {hint && <p className="text-[11px] text-muted-foreground leading-snug">{hint}</p>}
    </div>
  );
}

function CapRow({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="flex items-start justify-between gap-3 py-2 border-b border-border/60 last:border-0">
      <div className="min-w-0">
        <p className="text-[13px] font-medium text-foreground">{label}</p>
        {sub && <p className="text-[11px] text-muted-foreground mt-0.5">{sub}</p>}
      </div>
      <p className="text-[13px] font-semibold tabular-nums text-foreground shrink-0 text-right">{value}</p>
    </div>
  );
}

export default function CapacityPanel({ onNavigate }: { onNavigate?: (tab: string) => void }) {
  const qc = useQueryClient();
  const [surgeBusy, setSurgeBusy] = useState(false);
  const { data, isLoading, dataUpdatedAt, refetch, isFetching } = useQuery({
    queryKey: ['admin-capacity'],
    refetchInterval: 15_000,
    queryFn: async () => {
      const todayStart = startOfDay(new Date()).toISOString();
      const lastHour = subHours(new Date(), 1).toISOString();

      const [
        settingsRes,
        statesRes,
        openOrdersRes,
        todayDeliveredRes,
        lastHourOrdersRes,
        offersRes,
        storesRes,
        zonesRes,
        profilesRes,
      ] = await Promise.all([
        supabase
          .from('platform_settings')
          .select(
            `
            max_stacked_orders, stacking_enabled, stack_max_detour_minutes,
            max_cash_cap, auto_dispatch_enabled, assignment_mode, dispatch_lead_minutes,
            dist_wave_size, dist_max_waves, dist_offer_timeout_seconds, dist_search_radius_km,
            surge_enabled, maintenance_mode, customer_base_fee, customer_per_km_fee,
            platform_service_fee, base_pay, per_km_rate, min_pay, max_pay
          `,
          )
          .eq('id', 1)
          .maybeSingle(),
        supabase.from('driver_state').select('driver_id, shift_started_at, on_break, shift_cash_balance'),
        supabase
          .from('orders')
          .select('id, status, driver_id, created_at, updated_at')
          .in('status', [...OPEN_STATUSES]),
        supabase
          .from('orders')
          .select('id, created_at, updated_at')
          .eq('status', 'delivered')
          .gte('updated_at', todayStart)
          .limit(400),
        supabase
          .from('orders')
          .select('id', { count: 'exact', head: true })
          .gte('created_at', lastHour)
          .neq('status', 'cancelled'),
        supabase
          .from('pending_offers')
          .select('id', { count: 'exact', head: true })
          .eq('status', 'pending'),
        supabase.from('stores').select('id, is_active, busy_mode, prep_buffer_minutes'),
        (supabase as any)
          .from('service_zones')
          .select('id, name, city, radius_km, is_active')
          .eq('is_active', true),
        supabase.from('driver_profiles').select('user_id, is_active'),
      ]);

      return {
        settings: settingsRes.data,
        states: statesRes.data ?? [],
        openOrders: openOrdersRes.data ?? [],
        deliveredToday: todayDeliveredRes.data ?? [],
        ordersLastHour: lastHourOrdersRes.count ?? 0,
        pendingOffers: offersRes.count ?? 0,
        stores: storesRes.data ?? [],
        zones: (zonesRes.data ?? []) as {
          id: string;
          name: string | null;
          city: string | null;
          radius_km: number | null;
          is_active: boolean;
        }[],
        driverProfiles: profilesRes.data ?? [],
      };
    },
  });

  const guardrails = useMemo(() => {
    try {
      return loadGuardrails();
    } catch {
      return DEFAULT_GUARDRAILS;
    }
  }, [dataUpdatedAt]);

  const toggleSurge = async (next: boolean) => {
    setSurgeBusy(true);
    const { error } = await supabase
      .from('platform_settings')
      .update({ surge_enabled: next } as never)
      .eq('id', 1);
    setSurgeBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(next ? 'Surge ÎµÎ½ÎµÏÎ³ÏŒ' : 'Surge ÎºÎ»ÎµÎ¹ÏƒÏ„ÏŒ');
    qc.invalidateQueries({ queryKey: ['admin-capacity'] });
  };

  const model = useMemo(() => {
    if (!data) return null;
    const s = data.settings;
    const stack = Math.max(1, Number(s?.max_stacked_orders ?? 1));
    const stackingOn = Boolean(s?.stacking_enabled);
    const effectiveStack = stackingOn ? stack : 1;
    const cashCap = Number(s?.max_cash_cap ?? 200);

    const online = data.states.filter((d) => !!d.shift_started_at && !d.on_break).length;
    const onBreak = data.states.filter((d) => d.on_break).length;
    const offlineActive = data.driverProfiles.filter((p) => p.is_active).length;
    const nearCash = data.states.filter(
      (d) => Number(d.shift_cash_balance ?? 0) >= cashCap * 0.8,
    ).length;
    const atCash = data.states.filter(
      (d) => Number(d.shift_cash_balance ?? 0) >= cashCap,
    ).length;

    const funnel: StatusFunnel = {};
    for (const st of OPEN_STATUSES) funnel[st] = 0;
    for (const o of data.openOrders) funnel[o.status] = (funnel[o.status] || 0) + 1;
    const openTotal = data.openOrders.length;
    const unassigned = data.openOrders.filter((o) => !o.driver_id).length;
    const assigned = openTotal - unassigned;

    // Avg delivery cycle from today's delivered (cap unrealistic outliers)
    const cycles = data.deliveredToday
      .map((o) => (new Date(o.updated_at).getTime() - new Date(o.created_at).getTime()) / 60_000)
      .filter((m) => m > 2 && m < 120)
      .sort((a, b) => a - b);
    const mid = cycles.length ? cycles[Math.floor(cycles.length / 2)] : BM.fallbackCycleMinutes;
    const cycleMin = Math.max(8, Math.round(mid));

    // Theoretical concurrent slots & throughput
    const concurrentSlots = online * effectiveStack;
    const theoreticalOph = online > 0 ? Math.round(online * effectiveStack * (60 / cycleMin)) : 0;
    const supplyNeeded = Math.max(1, Math.ceil(openTotal / BM.ordersPerDriverConcurrent));
    const supplyRatio = online / supplyNeeded;
    const utilization = concurrentSlots > 0 ? openTotal / concurrentSlots : openTotal > 0 ? 1 : 0;

    const waveSize = Number(s?.dist_wave_size ?? 3);
    const maxWaves = Number(s?.dist_max_waves ?? 3);
    const maxConcurrentOffers = waveSize * maxWaves;

    const activeStores = data.stores.filter((st) => st.is_active).length;
    const busyStores = data.stores.filter((st) => st.is_active && st.busy_mode).length;
    const prepBufs = data.stores
      .filter((st) => st.is_active)
      .map((st) => Number(st.prep_buffer_minutes ?? 0));
    const avgPrep =
      prepBufs.length > 0
        ? Math.round(prepBufs.reduce((a, b) => a + b, 0) / prepBufs.length)
        : 0;

    const gpsWritesPerMin =
      online > 0 && guardrails.realtimeLocationsEnabled
        ? Math.round((online * 60) / Math.max(5, guardrails.driverLocationIntervalSec || BM.driverLocationIntervalSec))
        : 0;

    const headroomOph = Math.max(0, theoreticalOph - data.ordersLastHour);
    const loadTone: 'good' | 'warn' | 'bad' =
      utilization >= 0.95 || supplyRatio < 0.6
        ? 'bad'
        : utilization >= 0.75 || supplyRatio < 1
          ? 'warn'
          : 'good';

    return {
      s,
      stack,
      stackingOn,
      effectiveStack,
      cashCap,
      online,
      onBreak,
      offlineActive,
      nearCash,
      atCash,
      funnel,
      openTotal,
      unassigned,
      assigned,
      cycleMin,
      cycleSample: cycles.length,
      concurrentSlots,
      theoreticalOph,
      supplyNeeded,
      supplyRatio,
      utilization,
      waveSize,
      maxWaves,
      maxConcurrentOffers,
      activeStores,
      busyStores,
      avgPrep,
      gpsWritesPerMin,
      headroomOph,
      loadTone,
      ordersLastHour: data.ordersLastHour,
      pendingOffers: data.pendingOffers,
      zones: data.zones,
      deliveredTodayCount: data.deliveredToday.length,
    };
  }, [data, guardrails]);

  if (isLoading || !model) {
    return (
      <div className="py-16 text-center text-sm text-muted-foreground animate-pulse">
        Î¥Ï€Î¿Î»Î¿Î³Î¹ÏƒÎ¼ÏŒÏ‚ Ï‡Ï‰ÏÎ·Ï„Î¹ÎºÏŒÏ„Î·Ï„Î±Ï‚â€¦
      </div>
    );
  }

  const s = model.s;

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-heading font-extrabold text-lg text-foreground">Î§Ï‰ÏÎ·Ï„Î¹ÎºÏŒÏ„Î·Ï„Î± Ï€Î»Î±Ï„Ï†ÏŒÏÎ¼Î±Ï‚</h2>
          <p className="text-[12.5px] text-muted-foreground mt-0.5 max-w-2xl">
            Î ÏŒÏƒÎ¿ Î¼Ï€Î¿ÏÎµÎ¯ Î½Î± Î±Î½Ï„Î­Î¾ÎµÎ¹ Ï„Î¿ ÏƒÏÏƒÏ„Î·Î¼Î± Ï„ÏŽÏÎ± â€” Î²Î¬ÏƒÎµÎ¹ online Î¿Î´Î·Î³ÏŽÎ½, ÏÏ…Î¸Î¼Î¯ÏƒÎµÏ‰Î½ stacking/dispatch
            ÎºÎ±Î¹ Î¼ÎµÏ„ÏÎ·Î¼Î­Î½Ï‰Î½ Î¿ÏÎ¯Ï‰Î½ Î±Ï€ÏŒ stress test ({BM.measuredAt}).
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="tabular-nums text-[10px]">
            {dataUpdatedAt ? new Date(dataUpdatedAt).toLocaleTimeString('el-GR') : 'â€”'}
          </Badge>
          <Button variant="outline" size="sm" disabled={isFetching} onClick={() => void refetch()}>
            Î‘Î½Î±Î½Î­Ï‰ÏƒÎ·
          </Button>
        </div>
      </div>

      {/* Hero KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-2.5">
        <CapCard
          icon={Gauge}
          label="Î˜ÎµÏ‰ÏÎ·Ï„Î¹ÎºÎ¬ / ÏŽÏÎ±"
          value={`${model.theoreticalOph}`}
          hint={`${model.online} Î¿Î´Î·Î³Î¿Î¯ Ã— ${model.effectiveStack} slot Ã— ${Math.round(60 / model.cycleMin)} ÎºÏÎºÎ»Î¿Î¹/ÏŽÏÎ±`}
          tone={model.theoreticalOph > 0 ? 'good' : 'warn'}
        />
        <CapCard
          icon={Package}
          label="Î‘Î½Î¿Î¹Ï‡Ï„Î­Ï‚ Ï„ÏŽÏÎ±"
          value={`${model.openTotal}`}
          hint={`${model.assigned} Î±Î½Î±Ï„ÎµÎ¸ÎµÎ¹Î¼Î­Î½ÎµÏ‚ Â· ${model.unassigned} Ï‡Ï‰ÏÎ¯Ï‚ Î¿Î´Î·Î³ÏŒ`}
          tone={model.loadTone}
        />
        <CapCard
          icon={Bike}
          label="Slots Î¿Î´Î·Î³ÏŽÎ½"
          value={`${model.concurrentSlots}`}
          hint={`Utilization ${pct(model.openTotal, Math.max(model.concurrentSlots, 1))}%`}
          tone={model.utilization >= 0.95 ? 'bad' : model.utilization >= 0.75 ? 'warn' : 'good'}
        />
        <CapCard
          icon={Activity}
          label="Î¤ÎµÎ»ÎµÏ…Ï„Î±Î¯Î± ÏŽÏÎ±"
          value={`${model.ordersLastHour}`}
          hint={
            model.theoreticalOph > 0
              ? `Headroom ~${model.headroomOph}/ÏŽÏÎ± vs Î¸ÎµÏ‰ÏÎ·Ï„Î¹ÎºÏŒ`
              : 'Î§ÏÎµÎ¹Î¬Î¶Î¿Î½Ï„Î±Î¹ online Î¿Î´Î·Î³Î¿Î¯'
          }
          tone={
            model.theoreticalOph > 0 && model.ordersLastHour > model.theoreticalOph * 0.9
              ? 'warn'
              : 'neutral'
          }
        />
        <CapCard
          icon={Radio}
          label="Pending offers"
          value={`${model.pendingOffers}`}
          hint={`Max wave offers â‰ˆ ${model.maxConcurrentOffers}`}
          tone={model.pendingOffers > model.maxConcurrentOffers ? 'warn' : 'neutral'}
        />
      </div>

      {model.online === 0 && (
        <div className="flex items-start gap-2 rounded-xl border border-warning/30 bg-warning/10 px-3.5 py-3 text-[13px]">
          <AlertTriangle className="h-4 w-4 text-warning shrink-0 mt-0.5" />
          <p>
            ÎšÎ±Î½Î­Î½Î±Ï‚ Î¿Î´Î·Î³ÏŒÏ‚ online â€” Î· Î¸ÎµÏ‰ÏÎ·Ï„Î¹ÎºÎ® Ï‡Ï‰ÏÎ·Ï„Î¹ÎºÏŒÏ„Î·Ï„Î± ÎµÎ¯Î½Î±Î¹ <strong>0</strong>. Î†Î½Î¿Î¹Î¾Îµ Î²Î¬ÏÎ´Î¹ÎµÏ‚ Î®
            Î´ÎµÏ‚{' '}
            <button
              type="button"
              className="underline font-semibold"
              onClick={() => onNavigate?.('drivers_ioannina_map')}
            >
              Live Ï‡Î¬ÏÏ„Î·
            </button>
            .
          </p>
        </div>
      )}

      <div className="grid lg:grid-cols-2 gap-3">
        {/* Live funnel */}
        <section className="rounded-xl border border-border bg-card p-4">
          <div className="flex items-center gap-2 mb-3">
            <Layers className="h-4 w-4 text-primary" />
            <h3 className="font-semibold text-sm">Live funnel</h3>
          </div>
          <div className="space-y-2">
            {OPEN_STATUSES.map((st) => {
              const n = model.funnel[st] || 0;
              const w = pct(n, Math.max(model.openTotal, 1));
              return (
                <div key={st} className="space-y-1">
                  <div className="flex justify-between text-[12px]">
                    <span className="capitalize text-muted-foreground">{st}</span>
                    <span className="font-semibold tabular-nums">{n}</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                    <div className="h-full bg-primary/80 rounded-full" style={{ width: `${w}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
          <p className="text-[11px] text-muted-foreground mt-3">
            ÎšÏÎºÎ»Î¿Ï‚ Ï€Î±ÏÎ¬Î´Î¿ÏƒÎ·Ï‚ ÏƒÎ®Î¼ÎµÏÎ±: <strong className="text-foreground">{model.cycleMin} Î»ÎµÏ€Ï„Î¬</strong>
            {model.cycleSample > 0
              ? ` (median Î±Ï€ÏŒ ${model.cycleSample} Ï€Î±ÏÎ±Î´ÏŒÏƒÎµÎ¹Ï‚)`
              : ` (fallback ${BM.fallbackCycleMinutes}â€² â€” Î»Î¯Î³ÎµÏ‚ Ï€Î±ÏÎ±Î´ÏŒÏƒÎµÎ¹Ï‚ ÏƒÎ®Î¼ÎµÏÎ±)`}
          </p>
        </section>

        {/* Fleet / stores */}
        <section className="rounded-xl border border-border bg-card p-4">
          <div className="flex items-center gap-2 mb-3">
            <Bike className="h-4 w-4 text-primary" />
            <h3 className="font-semibold text-sm">Î£Ï„ÏŒÎ»Î¿Ï‚ & ÎºÎ±Ï„Î±ÏƒÏ„Î®Î¼Î±Ï„Î±</h3>
          </div>
          <CapRow
            label="Online Î¿Î´Î·Î³Î¿Î¯"
            value={`${model.online}`}
            sub={`${model.onBreak} ÏƒÎµ Î´Î¹Î¬Î»ÎµÎ¹Î¼Î¼Î± Â· ${model.offlineActive} ÎµÎ½ÎµÏÎ³Î¬ Ï€ÏÎ¿Ï†Î¯Î»`}
          />
          <CapRow
            label="Supply ratio"
            value={`${model.online} / ${model.supplyNeeded}`}
            sub={`ÎšÎ±Î½ÏŒÎ½Î±Ï‚: 1 Î¿Î´Î·Î³ÏŒÏ‚ â‰ˆ ${BM.ordersPerDriverConcurrent} Î±Î½Î¿Î¹Ï‡Ï„Î­Ï‚ Ï€Î±ÏÎ±Î³Î³ÎµÎ»Î¯ÎµÏ‚`}
          />
          <CapRow
            label="Î•Î½ÎµÏÎ³Î¬ ÎºÎ±Ï„Î±ÏƒÏ„Î®Î¼Î±Ï„Î±"
            value={`${model.activeStores}`}
            sub={
              model.busyStores > 0
                ? `${model.busyStores} ÏƒÎµ busy mode Â· avg prep buffer ${model.avgPrep}â€²`
                : `Avg prep buffer ${model.avgPrep}â€²`
            }
          />
          <CapRow
            label="Î–ÏŽÎ½ÎµÏ‚ Ï€Î±ÏÎ¬Î´Î¿ÏƒÎ·Ï‚"
            value={`${model.zones.length}`}
            sub={model.zones.map((z) => z.city || z.name || 'â€”').slice(0, 3).join(' Â· ') || 'â€”'}
          />
          <CapRow
            label="Î¤Î±Î¼ÎµÎ¯Î¿ ÎºÎ¿Î½Ï„Î¬ ÏƒÏ„Î¿ ÏŒÏÎ¹Î¿"
            value={`${model.nearCash} / ${model.atCash} capped`}
            sub={`ÎŒÏÎ¹Î¿ Î¼ÎµÏ„ÏÎ·Ï„ÏŽÎ½ ${euro(model.cashCap)} Î±Î½Î¬ Î²Î¬ÏÎ´Î¹Î±`}
          />
        </section>
      </div>

      <div className="grid lg:grid-cols-3 gap-3">
        {/* Configured caps */}
        <section className="rounded-xl border border-border bg-card p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Settings2 className="h-4 w-4 text-primary" />
              <h3 className="font-semibold text-sm">Î¡Ï…Î¸Î¼Î¹ÏƒÎ¼Î­Î½Î± caps</h3>
            </div>
            <Button variant="ghost" size="sm" className="h-7 text-[11px]" onClick={() => onNavigate?.('delivery_control')}>
              Dispatch â†’
            </Button>
          </div>
          <CapRow
            label="Stacking"
            value={model.stackingOn ? `ON Â· max ${model.stack}` : `OFF Â· 1 / Î¿Î´Î·Î³ÏŒ`}
            sub={
              s?.stack_max_detour_minutes != null
                ? `Max detour ${s.stack_max_detour_minutes}â€²`
                : undefined
            }
          />
          <CapRow label="Max cash / Î²Î¬ÏÎ´Î¹Î±" value={euro(model.cashCap)} />
          <CapRow
            label="Auto-dispatch"
            value={s?.auto_dispatch_enabled ? 'Î•ÎÎ•Î¡Î“ÎŸ' : 'ÎšÎ›Î•Î™Î£Î¤ÎŸ'}
            sub={`Mode: ${s?.assignment_mode || 'â€”'}`}
          />
          <CapRow
            label="Dispatch lead"
            value={`${s?.dispatch_lead_minutes ?? 'â€”'}â€²`}
            sub="Î›ÎµÏ€Ï„Î¬ Ï€ÏÎ¹Î½ Ï„Î¿ ready"
          />
          <CapRow
            label="Offer waves"
            value={`${model.waveSize} Ã— ${model.maxWaves}`}
            sub={`Timeout ${s?.dist_offer_timeout_seconds ?? 'â€”'}s Â· radius ${s?.dist_search_radius_km ?? 'â€”'} km`}
          />
          <div className="flex items-start justify-between gap-3 py-2 border-b border-border/60">
            <div className="min-w-0">
              <p className="text-[13px] font-medium text-foreground">Surge</p>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                Peak / demand multipliers Â· off by default
              </p>
            </div>
            <Switch
              checked={!!s?.surge_enabled}
              disabled={surgeBusy}
              onCheckedChange={(v) => void toggleSurge(v)}
            />
          </div>
          <CapRow
            label="Maintenance"
            value={s?.maintenance_mode ? 'ÎÎ‘Î™' : 'ÎŒÏ‡Î¹'}
          />
        </section>

        {/* Fee snapshot */}
        <section className="rounded-xl border border-border bg-card p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Banknote className="h-4 w-4 text-primary" />
              <h3 className="font-semibold text-sm">Î¤Î¹Î¼Î­Ï‚ / Î±Î¼Î¿Î¹Î²Î­Ï‚</h3>
            </div>
            <Button variant="ghost" size="sm" className="h-7 text-[11px]" onClick={() => onNavigate?.('pricing')}>
              Î¤Î¹Î¼Î¿Î»ÏŒÎ³Î·ÏƒÎ· â†’
            </Button>
          </div>
          <CapRow label="Customer base fee" value={euro(Number(s?.customer_base_fee ?? 0))} />
          <CapRow label="Customer / km" value={euro(Number(s?.customer_per_km_fee ?? 0))} />
          <CapRow label="Platform service fee" value={euro(Number(s?.platform_service_fee ?? 0))} />
          <CapRow label="Driver base pay" value={euro(Number(s?.base_pay ?? 0))} />
          <CapRow label="Driver / km" value={euro(Number(s?.per_km_rate ?? 0))} />
          <CapRow
            label="Driver min â†’ max"
            value={`${euro(Number(s?.min_pay ?? 0))} â†’ ${euro(Number(s?.max_pay ?? 0))}`}
          />
        </section>

        {/* Infrastructure / measured */}
        <section className="rounded-xl border border-border bg-card p-4">
          <div className="flex items-center gap-2 mb-3">
            <Server className="h-4 w-4 text-primary" />
            <h3 className="font-semibold text-sm">Î¥Ï€Î¿Î´Î¿Î¼Î® (Î¼ÎµÏ„ÏÎ·Î¼Î­Î½Î±)</h3>
          </div>
          <CapRow
            label="place_order burst"
            value={`~${BM.placeOrderBurstRps}/s`}
            sub={`p50 ${BM.placeOrderP50Ms}ms Â· p95 ${BM.placeOrderP95Ms}ms Â· ${BM.placeOrderBurstConcurrency} concurrent`}
          />
          <CapRow
            label="Î‘ÏƒÏ†Î±Î»Î­Ï‚ ÏÏ…Î¸Î¼ÏŒÏ‚ ops"
            value={`~${BM.safePlacePerMinute}/Î»ÎµÏ€Ï„ÏŒ`}
            sub={`~${BM.safePlacePerHour.toLocaleString('el-GR')} / ÏŽÏÎ± (load-sim target)`}
          />
          <CapRow
            label="Read mix (SPA+API)"
            value={`~${BM.readMixRps} rps`}
            sub={`SPA p50 ~${BM.spaP50Ms}ms Â· PostgREST p95 ~${BM.postgrestP95Ms}ms`}
          />
          <CapRow
            label="Mapbox token edge"
            value={`â‰² ${BM.mapboxHealthyRps} rps`}
            sub={BM.mapboxNote}
          />
          <CapRow
            label="GPS writes / Î»ÎµÏ€Ï„ÏŒ"
            value={`${model.gpsWritesPerMin}`}
            sub={
              guardrails.realtimeLocationsEnabled
                ? `Interval ${guardrails.driverLocationIntervalSec}s Ã— ${model.online} online`
                : 'Location realtime Î±Ï€ÎµÎ½ÎµÏÎ³Î¿Ï€Î¿Î¹Î·Î¼Î­Î½Î¿'
            }
          />
          <CapRow
            label="AI daily cap"
            value={`${guardrails.aiDailyCallCap}`}
            sub={`Budget ${guardrails.dailyBudgetCredits} credits/Î·Î¼Î­ÏÎ± Â· soft throttle @ ${guardrails.softThrottlePct}%`}
          />
        </section>
      </div>

      {/* Formula explainer */}
      <section className="rounded-xl border border-dashed border-border bg-muted/30 p-4 space-y-2">
        <div className="flex items-center gap-2">
          <Zap className="h-4 w-4 text-primary" />
          <h3 className="font-semibold text-sm">Î ÏŽÏ‚ Ï…Ï€Î¿Î»Î¿Î³Î¯Î¶ÎµÏ„Î±Î¹</h3>
        </div>
        <p className="text-[12.5px] text-muted-foreground leading-relaxed">
          <strong className="text-foreground">Î˜ÎµÏ‰ÏÎ·Ï„Î¹ÎºÎ¬ Ï€Î±ÏÎ±Î³Î³ÎµÎ»Î¯ÎµÏ‚/ÏŽÏÎ±</strong> = online Î¿Î´Î·Î³Î¿Î¯ Ã—
          effective stack ({model.effectiveStack}) Ã— (60 Ã· Î¼Î­ÏƒÎ¿Ï‚ ÎºÏÎºÎ»Î¿Ï‚ {model.cycleMin}â€²).
          Î‘Ï…Ï„ÏŒ ÎµÎ¯Î½Î±Î¹ Ï„Î¿ Ï€ÏÎ±ÎºÏ„Î¹ÎºÏŒ ÏŒÏÎ¹Î¿ Ï€Î±ÏÎ¬Î´Î¿ÏƒÎ·Ï‚ Î¼Îµ Ï„Î¿Î½ Ï„ÏÎ­Ï‡Î¿Î½Ï„Î± ÏƒÏ„ÏŒÎ»Î¿ â€” ÏŒÏ‡Î¹ Ï„Î¿ ÏŒÏÎ¹Î¿ Ï„Î·Ï‚ Î²Î¬ÏƒÎ·Ï‚
          (Ï€Î¿Ï… Î¬Î½Ï„ÎµÎ¾Îµ ~{BM.placeOrderBurstRps} place/s ÏƒÏ„Î¿ stress test).
        </p>
        <p className="text-[12.5px] text-muted-foreground leading-relaxed">
          Î‘Î½ Î±Î½Î¿Î¯Î¾Î¿Ï…Î½ Ï€ÎµÏÎ¹ÏƒÏƒÏŒÏ„ÎµÏÎ¿Î¹ Î¿Î´Î·Î³Î¿Î¯ Î® Î¼ÎµÎ¹Ï‰Î¸ÎµÎ¯ Î¿ ÎºÏÎºÎ»Î¿Ï‚ (Î³ÏÎ·Î³Î¿ÏÏŒÏ„ÎµÏÎ± stores / Î¼Î¹ÎºÏÏŒÏ„ÎµÏÎµÏ‚
          Î±Ï€Î¿ÏƒÏ„Î¬ÏƒÎµÎ¹Ï‚), Î· Ï‡Ï‰ÏÎ·Ï„Î¹ÎºÏŒÏ„Î·Ï„Î± Î±Î½ÎµÎ²Î±Î¯Î½ÎµÎ¹ Î³ÏÎ±Î¼Î¼Î¹ÎºÎ¬. Î¤Î¿ cash cap ({euro(model.cashCap)}) Î¼Ï€Î¿ÏÎµÎ¯
          Î½Î± ÎºÏŒÏˆÎµÎ¹ Î¿Î´Î·Î³Î¿ÏÏ‚ Î±Ï€ÏŒ Î½Î­ÎµÏ‚ Ï€Î±ÏÎ±Î³Î³ÎµÎ»Î¯ÎµÏ‚ Î±ÎºÏŒÎ¼Î± ÎºÎ¹ Î±Î½ Ï…Ï€Î¬ÏÏ‡Î¿Ï…Î½ slots.
        </p>
        <div className="flex flex-wrap gap-2 pt-1">
          <Button size="sm" variant="outline" onClick={() => onNavigate?.('delivery_control')}>
            <Waves className="h-3.5 w-3.5 mr-1.5" /> Dispatch
          </Button>
          <Button size="sm" variant="outline" onClick={() => onNavigate?.('drivers_ioannina_map')}>
            <MapPin className="h-3.5 w-3.5 mr-1.5" /> Live Ï‡Î¬ÏÏ„Î·Ï‚
          </Button>
          <Button size="sm" variant="outline" onClick={() => onNavigate?.('service_zones')}>
            <Store className="h-3.5 w-3.5 mr-1.5" /> Î–ÏŽÎ½ÎµÏ‚
          </Button>
          <Button size="sm" variant="outline" onClick={() => onNavigate?.('cloud_usage')}>
            <Clock className="h-3.5 w-3.5 mr-1.5" /> Cloud usage
          </Button>
        </div>
      </section>
    </div>
  );
}
