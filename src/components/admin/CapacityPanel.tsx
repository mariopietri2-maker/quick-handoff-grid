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
  return `${Number(n || 0).toFixed(2)}€`;
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
    toast.success(next ? 'Surge ενεργό' : 'Surge κλειστό');
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
        Υπολογισμός χωρητικότητας…
      </div>
    );
  }

  const s = model.s;

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-heading font-extrabold text-lg text-foreground">Χωρητικότητα πλατφόρμας</h2>
          <p className="text-[12.5px] text-muted-foreground mt-0.5 max-w-2xl">
            Πόσο μπορεί να αντέξει το σύστημα τώρα — βάσει online οδηγών, ρυθμίσεων stacking/dispatch
            και μετρημένων ορίων από stress test ({BM.measuredAt}).
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="tabular-nums text-[10px]">
            {dataUpdatedAt ? new Date(dataUpdatedAt).toLocaleTimeString('el-GR') : '—'}
          </Badge>
          <Button variant="outline" size="sm" disabled={isFetching} onClick={() => void refetch()}>
            Ανανέωση
          </Button>
        </div>
      </div>

      {/* Hero KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-2.5">
        <CapCard
          icon={Gauge}
          label="Θεωρητικά / ώρα"
          value={`${model.theoreticalOph}`}
          hint={`${model.online} οδηγοί × ${model.effectiveStack} slot × ${Math.round(60 / model.cycleMin)} κύκλοι/ώρα`}
          tone={model.theoreticalOph > 0 ? 'good' : 'warn'}
        />
        <CapCard
          icon={Package}
          label="Ανοιχτές τώρα"
          value={`${model.openTotal}`}
          hint={`${model.assigned} ανατεθειμένες · ${model.unassigned} χωρίς οδηγό`}
          tone={model.loadTone}
        />
        <CapCard
          icon={Bike}
          label="Slots οδηγών"
          value={`${model.concurrentSlots}`}
          hint={`Utilization ${pct(model.openTotal, Math.max(model.concurrentSlots, 1))}%`}
          tone={model.utilization >= 0.95 ? 'bad' : model.utilization >= 0.75 ? 'warn' : 'good'}
        />
        <CapCard
          icon={Activity}
          label="Τελευταία ώρα"
          value={`${model.ordersLastHour}`}
          hint={
            model.theoreticalOph > 0
              ? `Headroom ~${model.headroomOph}/ώρα vs θεωρητικό`
              : 'Χρειάζονται online οδηγοί'
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
          hint={`Max wave offers ≈ ${model.maxConcurrentOffers}`}
          tone={model.pendingOffers > model.maxConcurrentOffers ? 'warn' : 'neutral'}
        />
      </div>

      {model.online === 0 && (
        <div className="flex items-start gap-2 rounded-xl border border-warning/30 bg-warning/10 px-3.5 py-3 text-[13px]">
          <AlertTriangle className="h-4 w-4 text-warning shrink-0 mt-0.5" />
          <p>
            Κανένας οδηγός online — η θεωρητική χωρητικότητα είναι <strong>0</strong>. Άνοιξε βάρδιες ή
            δες{' '}
            <button
              type="button"
              className="underline font-semibold"
              onClick={() => onNavigate?.('drivers_live_map')}
            >
              Live χάρτη
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
            Κύκλος παράδοσης σήμερα: <strong className="text-foreground">{model.cycleMin} λεπτά</strong>
            {model.cycleSample > 0
              ? ` (median από ${model.cycleSample} παραδόσεις)`
              : ` (fallback ${BM.fallbackCycleMinutes}′ — λίγες παραδόσεις σήμερα)`}
          </p>
        </section>

        {/* Fleet / stores */}
        <section className="rounded-xl border border-border bg-card p-4">
          <div className="flex items-center gap-2 mb-3">
            <Bike className="h-4 w-4 text-primary" />
            <h3 className="font-semibold text-sm">Στόλος & καταστήματα</h3>
          </div>
          <CapRow
            label="Online οδηγοί"
            value={`${model.online}`}
            sub={`${model.onBreak} σε διάλειμμα · ${model.offlineActive} ενεργά προφίλ`}
          />
          <CapRow
            label="Supply ratio"
            value={`${model.online} / ${model.supplyNeeded}`}
            sub={`Κανόνας: 1 οδηγός ≈ ${BM.ordersPerDriverConcurrent} ανοιχτές παραγγελίες`}
          />
          <CapRow
            label="Ενεργά καταστήματα"
            value={`${model.activeStores}`}
            sub={
              model.busyStores > 0
                ? `${model.busyStores} σε busy mode · avg prep buffer ${model.avgPrep}′`
                : `Avg prep buffer ${model.avgPrep}′`
            }
          />
          <CapRow
            label="Ζώνες παράδοσης"
            value={`${model.zones.length}`}
            sub={model.zones.map((z) => z.city || z.name || '—').slice(0, 3).join(' · ') || '—'}
          />
          <CapRow
            label="Ταμείο κοντά στο όριο"
            value={`${model.nearCash} / ${model.atCash} capped`}
            sub={`Όριο μετρητών ${euro(model.cashCap)} ανά βάρδια`}
          />
        </section>
      </div>

      <div className="grid lg:grid-cols-3 gap-3">
        {/* Configured caps */}
        <section className="rounded-xl border border-border bg-card p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Settings2 className="h-4 w-4 text-primary" />
              <h3 className="font-semibold text-sm">Ρυθμισμένα caps</h3>
            </div>
            <Button variant="ghost" size="sm" className="h-7 text-[11px]" onClick={() => onNavigate?.('delivery_control')}>
              Dispatch →
            </Button>
          </div>
          <CapRow
            label="Stacking"
            value={model.stackingOn ? `ON · max ${model.stack}` : `OFF · 1 / οδηγό`}
            sub={
              s?.stack_max_detour_minutes != null
                ? `Max detour ${s.stack_max_detour_minutes}′`
                : undefined
            }
          />
          <CapRow label="Max cash / βάρδια" value={euro(model.cashCap)} />
          <CapRow
            label="Auto-dispatch"
            value={s?.auto_dispatch_enabled ? 'ΕΝΕΡΓΟ' : 'ΚΛΕΙΣΤΟ'}
            sub={`Mode: ${s?.assignment_mode || '—'}`}
          />
          <CapRow
            label="Dispatch lead"
            value={`${s?.dispatch_lead_minutes ?? '—'}′`}
            sub="Λεπτά πριν το ready"
          />
          <CapRow
            label="Offer waves"
            value={`${model.waveSize} × ${model.maxWaves}`}
            sub={`Timeout ${s?.dist_offer_timeout_seconds ?? '—'}s · radius ${s?.dist_search_radius_km ?? '—'} km`}
          />
          <div className="flex items-start justify-between gap-3 py-2 border-b border-border/60">
            <div className="min-w-0">
              <p className="text-[13px] font-medium text-foreground">Surge</p>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                Peak / demand multipliers · off by default
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
            value={s?.maintenance_mode ? 'ΝΑΙ' : 'Όχι'}
          />
        </section>

        {/* Fee snapshot */}
        <section className="rounded-xl border border-border bg-card p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Banknote className="h-4 w-4 text-primary" />
              <h3 className="font-semibold text-sm">Τιμές / αμοιβές</h3>
            </div>
            <Button variant="ghost" size="sm" className="h-7 text-[11px]" onClick={() => onNavigate?.('pricing')}>
              Τιμολόγηση →
            </Button>
          </div>
          <CapRow label="Customer base fee" value={euro(Number(s?.customer_base_fee ?? 0))} />
          <CapRow label="Customer / km" value={euro(Number(s?.customer_per_km_fee ?? 0))} />
          <CapRow label="Platform service fee" value={euro(Number(s?.platform_service_fee ?? 0))} />
          <CapRow label="Driver base pay" value={euro(Number(s?.base_pay ?? 0))} />
          <CapRow label="Driver / km" value={euro(Number(s?.per_km_rate ?? 0))} />
          <CapRow
            label="Driver min → max"
            value={`${euro(Number(s?.min_pay ?? 0))} → ${euro(Number(s?.max_pay ?? 0))}`}
          />
        </section>

        {/* Infrastructure / measured */}
        <section className="rounded-xl border border-border bg-card p-4">
          <div className="flex items-center gap-2 mb-3">
            <Server className="h-4 w-4 text-primary" />
            <h3 className="font-semibold text-sm">Υποδομή (μετρημένα)</h3>
          </div>
          <CapRow
            label="place_order burst"
            value={`~${BM.placeOrderBurstRps}/s`}
            sub={`p50 ${BM.placeOrderP50Ms}ms · p95 ${BM.placeOrderP95Ms}ms · ${BM.placeOrderBurstConcurrency} concurrent`}
          />
          <CapRow
            label="Ασφαλές ρυθμός ops"
            value={`~${BM.safePlacePerMinute}/λεπτό`}
            sub={`~${BM.safePlacePerHour.toLocaleString('el-GR')} / ώρα (load-sim target)`}
          />
          <CapRow
            label="Read mix (SPA+API)"
            value={`~${BM.readMixRps} rps`}
            sub={`SPA p50 ~${BM.spaP50Ms}ms · PostgREST p95 ~${BM.postgrestP95Ms}ms`}
          />
          <CapRow
            label="Mapbox token edge"
            value={`≲ ${BM.mapboxHealthyRps} rps`}
            sub={BM.mapboxNote}
          />
          <CapRow
            label="GPS writes / λεπτό"
            value={`${model.gpsWritesPerMin}`}
            sub={
              guardrails.realtimeLocationsEnabled
                ? `Interval ${guardrails.driverLocationIntervalSec}s × ${model.online} online`
                : 'Location realtime απενεργοποιημένο'
            }
          />
          <CapRow
            label="AI daily cap"
            value={`${guardrails.aiDailyCallCap}`}
            sub={`Budget ${guardrails.dailyBudgetCredits} credits/ημέρα · soft throttle @ ${guardrails.softThrottlePct}%`}
          />
        </section>
      </div>

      {/* Formula explainer */}
      <section className="rounded-xl border border-dashed border-border bg-muted/30 p-4 space-y-2">
        <div className="flex items-center gap-2">
          <Zap className="h-4 w-4 text-primary" />
          <h3 className="font-semibold text-sm">Πώς υπολογίζεται</h3>
        </div>
        <p className="text-[12.5px] text-muted-foreground leading-relaxed">
          <strong className="text-foreground">Θεωρητικά παραγγελίες/ώρα</strong> = online οδηγοί ×
          effective stack ({model.effectiveStack}) × (60 ÷ μέσος κύκλος {model.cycleMin}′).
          Αυτό είναι το πρακτικό όριο παράδοσης με τον τρέχοντα στόλο — όχι το όριο της βάσης
          (που άντεξε ~{BM.placeOrderBurstRps} place/s στο stress test).
        </p>
        <p className="text-[12.5px] text-muted-foreground leading-relaxed">
          Αν ανοίξουν περισσότεροι οδηγοί ή μειωθεί ο κύκλος (γρηγορότερα stores / μικρότερες
          αποστάσεις), η χωρητικότητα ανεβαίνει γραμμικά. Το cash cap ({euro(model.cashCap)}) μπορεί
          να κόψει οδηγούς από νέες παραγγελίες ακόμα κι αν υπάρχουν slots.
        </p>
        <div className="flex flex-wrap gap-2 pt-1">
          <Button size="sm" variant="outline" onClick={() => onNavigate?.('delivery_control')}>
            <Waves className="h-3.5 w-3.5 mr-1.5" /> Dispatch
          </Button>
          <Button size="sm" variant="outline" onClick={() => onNavigate?.('drivers_live_map')}>
            <MapPin className="h-3.5 w-3.5 mr-1.5" /> Live χάρτης
          </Button>
          <Button size="sm" variant="outline" onClick={() => onNavigate?.('service_zones')}>
            <Store className="h-3.5 w-3.5 mr-1.5" /> Ζώνες
          </Button>
          <Button size="sm" variant="outline" onClick={() => onNavigate?.('cloud_usage')}>
            <Clock className="h-3.5 w-3.5 mr-1.5" /> Cloud usage
          </Button>
        </div>
      </section>
    </div>
  );
}
