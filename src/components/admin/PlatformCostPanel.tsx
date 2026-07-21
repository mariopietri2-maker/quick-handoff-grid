import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { format, startOfDay } from 'date-fns';
import {
  Activity,
  AlertTriangle,
  Banknote,
  Bike,
  Building2,
  Cloud,
  CreditCard,
  Gauge,
  RefreshCw,
  Store,
  TrendingUp,
  Wallet,
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import {
  getAiCallsToday,
  loadGuardrails,
  useUsageMeter,
} from '@/lib/cost-guardrails';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';

/** Stripe EE card estimate: 1.4% + €0.25 — labeled as estimate, not invoice. */
const STRIPE_PCT = 0.014;
const STRIPE_FIXED = 0.25;

function euro(n: number) {
  return `€${Number(n || 0).toLocaleString('el-GR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function Kpi({
  label,
  value,
  hint,
  icon: Icon,
  tone = 'neutral',
}: {
  label: string;
  value: string;
  hint?: string;
  icon: typeof Gauge;
  tone?: 'good' | 'warn' | 'bad' | 'neutral';
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

function Row({ label, value, sub, estimate }: { label: string; value: string; sub?: string; estimate?: boolean }) {
  return (
    <div className="flex items-start justify-between gap-3 py-2.5 border-b border-border/60 last:border-0">
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <p className="text-[13px] font-medium text-foreground">{label}</p>
          {estimate && (
            <Badge variant="outline" className="text-[10px] h-5 px-1.5 font-normal text-muted-foreground">
              εκτίμηση
            </Badge>
          )}
        </div>
        {sub && <p className="text-[11px] text-muted-foreground mt-0.5">{sub}</p>}
      </div>
      <p className="text-[13px] font-semibold tabular-nums text-foreground shrink-0 text-right">{value}</p>
    </div>
  );
}

type TodayAgg = {
  orderCount: number;
  deliveredCount: number;
  gmv: number;
  platformProfit: number;
  driverPayout: number;
  storeCharge: number;
  deliveryFee: number;
  cardVolume: number;
  cardOrders: number;
  openOrders: number;
};

export default function PlatformCostPanel({ onNavigate }: { onNavigate?: (tab: string) => void }) {
  const meter = useUsageMeter();
  const guardrails = loadGuardrails();
  const aiUsed = getAiCallsToday();

  const { data, isLoading, isFetching, dataUpdatedAt, refetch } = useQuery({
    queryKey: ['admin-platform-cost'],
    refetchInterval: 15_000,
    queryFn: async () => {
      const todayStart = startOfDay(new Date()).toISOString();

      const [
        treasuryRes,
        settingsRes,
        todayOrdersRes,
        openOrdersRes,
        driverWalletsRes,
        storeWalletsRes,
        pendingPayoutsRes,
        ordersCountRes,
        locationsCountRes,
      ] = await Promise.all([
        (supabase as any)
          .from('admin_treasury')
          .select('platform_pool, admin_balance, lifetime_platform_earned, lifetime_driver_topup')
          .eq('id', 1)
          .maybeSingle(),
        (supabase as any)
          .from('platform_settings')
          .select('low_pool_threshold, pool_critical_threshold, pool_healthy_threshold')
          .eq('id', 1)
          .maybeSingle(),
        supabase
          .from('orders')
          .select(
            'id, status, total_amount, platform_profit, driver_payout, store_charge, delivery_fee, tip_amount, payment_method, created_at',
          )
          .gte('created_at', todayStart)
          .limit(5000),
        supabase
          .from('orders')
          .select('id', { count: 'exact', head: true })
          .in('status', ['placed', 'accepted', 'preparing', 'ready', 'arrived', 'picked_up'] as any),
        supabase.from('driver_wallets').select('available_balance, pending_balance').limit(5000),
        (supabase as any).from('store_wallets').select('available_balance').limit(5000),
        (supabase as any)
          .from('pending_driver_payouts')
          .select('amount')
          .eq('resolved', false)
          .limit(2000),
        supabase.from('orders').select('id', { count: 'exact', head: true }),
        supabase.from('driver_locations').select('id', { count: 'exact', head: true }),
      ]);

      const orders = todayOrdersRes.data ?? [];
      const delivered = orders.filter((o) => o.status === 'delivered');
      const cardOrders = delivered.filter((o) => {
        const m = String(o.payment_method ?? '').toLowerCase();
        return m.includes('card') || m.includes('stripe') || m === 'online';
      });

      const today: TodayAgg = {
        orderCount: orders.length,
        deliveredCount: delivered.length,
        gmv: delivered.reduce((s, o) => s + Number(o.total_amount ?? 0), 0),
        platformProfit: delivered.reduce((s, o) => s + Number(o.platform_profit ?? 0), 0),
        driverPayout: delivered.reduce((s, o) => s + Number(o.driver_payout ?? 0), 0),
        storeCharge: delivered.reduce((s, o) => s + Number(o.store_charge ?? 0), 0),
        deliveryFee: delivered.reduce((s, o) => s + Number(o.delivery_fee ?? 0), 0),
        cardVolume: cardOrders.reduce((s, o) => s + Number(o.total_amount ?? 0), 0),
        cardOrders: cardOrders.length,
        openOrders: openOrdersRes.count ?? 0,
      };

      const driverLiability = (driverWalletsRes.data ?? []).reduce(
        (s, w) => s + Number(w.available_balance ?? 0) + Number(w.pending_balance ?? 0),
        0,
      );
      const storeLiability = ((storeWalletsRes.data as any[]) ?? []).reduce((s, w) => {
        const bal = Number(w.available_balance ?? 0);
        return s + (bal > 0 ? bal : 0);
      }, 0);
      const unresolvedPayouts = ((pendingPayoutsRes.data as any[]) ?? []).reduce(
        (s, r) => s + Number(r.amount ?? 0),
        0,
      );

      const treasury = treasuryRes.data ?? {
        platform_pool: 0,
        admin_balance: 0,
        lifetime_platform_earned: 0,
        lifetime_driver_topup: 0,
      };
      const settings = settingsRes.data ?? {
        low_pool_threshold: 50,
        pool_critical_threshold: 20,
        pool_healthy_threshold: 500,
      };

      return {
        treasury,
        settings,
        today,
        driverLiability,
        storeLiability,
        unresolvedPayouts,
        ordersTotal: ordersCountRes.count ?? 0,
        locationsTotal: locationsCountRes.count ?? 0,
      };
    },
  });

  const stripeEstimate = useMemo(() => {
    if (!data) return 0;
    const { cardVolume, cardOrders } = data.today;
    return cardVolume * STRIPE_PCT + cardOrders * STRIPE_FIXED;
  }, [data]);

  const netPosition = useMemo(() => {
    if (!data) return 0;
    const held =
      Number(data.treasury.platform_pool ?? 0) + Number(data.treasury.admin_balance ?? 0);
    const owed = data.driverLiability + data.storeLiability + data.unresolvedPayouts;
    return held - owed;
  }, [data]);

  const pool = Number(data?.treasury.platform_pool ?? 0);
  const adminBal = Number(data?.treasury.admin_balance ?? 0);
  const critical = Number(data?.settings.pool_critical_threshold ?? 20);
  const low = Number(data?.settings.low_pool_threshold ?? 50);
  const healthy = Number(data?.settings.pool_healthy_threshold ?? 500);
  const poolTone = pool < critical ? 'bad' : pool < low ? 'warn' : pool >= healthy ? 'good' : 'neutral';
  const budgetCap = Math.max(guardrails.dailyBudgetCredits, 0.0001);
  const budgetPct = Math.min(100, (meter.total / budgetCap) * 100);

  const updatedLabel = dataUpdatedAt
    ? format(new Date(dataUpdatedAt), 'HH:mm:ss')
    : '—';

  return (
    <div className="space-y-4 max-w-5xl">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-heading font-bold text-xl flex items-center gap-2">
            <Activity className="h-5 w-5 text-primary" />
            Κόστος πλατφόρμας
          </h2>
          <p className="text-sm text-muted-foreground mt-1 max-w-2xl">
            Ζωντανή εικόνα λειτουργικού κόστους: ταμείο, υποχρεώσεις προς οδηγούς/καταστήματα,
            σημερινά payouts &amp; κέρδος, και εκτιμήσεις υποδομής.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="tabular-nums text-xs font-normal">
            Live · {updatedLabel}
          </Badge>
          <Button
            size="sm"
            variant="outline"
            className="gap-1.5"
            onClick={() => refetch()}
            disabled={isFetching}
          >
            <RefreshCw className={cn('h-3.5 w-3.5', isFetching && 'animate-spin')} />
            Ανανέωση
          </Button>
        </div>
      </div>

      {isLoading && !data ? (
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-24 rounded-xl border border-border bg-muted/40 animate-pulse" />
          ))}
        </div>
      ) : (
        <>
          {/* Treasury + liability */}
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <Kpi
              label="Driver pool"
              value={euro(pool)}
              hint={`Υγιές ≥ ${euro(healthy)}`}
              icon={Wallet}
              tone={poolTone}
            />
            <Kpi
              label="Admin balance"
              value={euro(adminBal)}
              hint="Ledger ταμείο admin"
              icon={Banknote}
            />
            <Kpi
              label="Οφειλές οδηγών"
              value={euro((data?.driverLiability ?? 0) + (data?.unresolvedPayouts ?? 0))}
              hint="Wallets + εκκρεμή payouts"
              icon={Bike}
              tone={(data?.driverLiability ?? 0) > 0 ? 'warn' : 'neutral'}
            />
            <Kpi
              label="Οφειλές καταστημάτων"
              value={euro(data?.storeLiability ?? 0)}
              hint="Θετικά store wallets"
              icon={Store}
              tone={(data?.storeLiability ?? 0) > 0 ? 'warn' : 'neutral'}
            />
          </div>

          <Card
            className={cn(
              'border-2',
              netPosition < 0 && 'border-destructive/40 bg-destructive/5',
              netPosition >= 0 && 'border-success/30 bg-success/5',
            )}
          >
            <CardContent className="p-4 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div
                  className={cn(
                    'h-10 w-10 rounded-xl flex items-center justify-center',
                    netPosition < 0 ? 'bg-destructive/15 text-destructive' : 'bg-success/15 text-success',
                  )}
                >
                  {netPosition < 0 ? (
                    <AlertTriangle className="h-5 w-5" />
                  ) : (
                    <TrendingUp className="h-5 w-5" />
                  )}
                </div>
                <div>
                  <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">
                    Καθαρή θέση (κρατούμενα − οφειλές)
                  </p>
                  <p className="font-heading font-bold text-2xl tabular-nums">{euro(netPosition)}</p>
                </div>
              </div>
              <p className="text-xs text-muted-foreground max-w-sm">
                Κρατούμενα = pool + admin. Οφειλές = driver wallets + εκκρεμή payouts + θετικά store
                wallets.
              </p>
            </CardContent>
          </Card>

          {/* Today marketplace cost */}
          <div className="grid lg:grid-cols-2 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <Building2 className="h-4 w-4 text-primary" />
                  Σήμερα — marketplace
                </CardTitle>
                <CardDescription>
                  Παραδομένες παραγγελίες από {format(startOfDay(new Date()), 'HH:mm')} ·{' '}
                  {data?.today.deliveredCount ?? 0} / {data?.today.orderCount ?? 0} παραγγελίες ·{' '}
                  {data?.today.openOrders ?? 0} ανοιχτές
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-0">
                <Row label="GMV" value={euro(data?.today.gmv ?? 0)} sub="Σύνολο παραδομένων" />
                <Row
                  label="Κέρδος πλατφόρμας"
                  value={euro(data?.today.platformProfit ?? 0)}
                  sub="platform_profit από παραδόσεις"
                />
                <Row
                  label="Payouts οδηγών"
                  value={euro(data?.today.driverPayout ?? 0)}
                  sub="Κόστος παράδοσης σήμερα"
                />
                <Row
                  label="Store charges"
                  value={euro(data?.today.storeCharge ?? 0)}
                  sub="Χρεώσεις καταστημάτων"
                />
                <Row
                  label="Delivery fees"
                  value={euro(data?.today.deliveryFee ?? 0)}
                  sub="Τέλη παράδοσης πελατών"
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <Cloud className="h-4 w-4 text-primary" />
                  Υποδομή — εκτιμήσεις
                </CardTitle>
                <CardDescription>
                  Δεν είναι τιμολόγιο παρόχου. Τα credits είναι τοπικός μετρητής· Stripe/Mapbox
                  είναι προσεγγίσεις.
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-0 space-y-3">
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">Ημερήσιο budget (credits)</span>
                    <span className="font-semibold tabular-nums">
                      {meter.total.toFixed(3)} / {guardrails.dailyBudgetCredits}
                    </span>
                  </div>
                  <Progress value={budgetPct} />
                </div>
                <Row
                  label="AI κλήσεις σήμερα"
                  value={`${aiUsed} / ${guardrails.aiDailyCallCap}`}
                  estimate
                />
                <Row
                  label="Credits · AI / DB / RT / Storage"
                  value={`${meter.buckets.ai.toFixed(3)} / ${meter.buckets.db.toFixed(3)} / ${meter.buckets.realtime.toFixed(3)} / ${meter.buckets.storage.toFixed(3)}`}
                  estimate
                />
                <Row
                  label="Stripe fees (εκτίμηση)"
                  value={euro(stripeEstimate)}
                  sub={`${data?.today.cardOrders ?? 0} card παραγγελίες · ${STRIPE_PCT * 100}% + €${STRIPE_FIXED}`}
                  estimate
                />
                <Row
                  label="DB όγκος"
                  value={`${(data?.ordersTotal ?? 0).toLocaleString('el-GR')} orders · ${(data?.locationsTotal ?? 0).toLocaleString('el-GR')} locations`}
                  sub="Proxy κόστους Supabase — δες Cloud usage για cleanup"
                  estimate
                />
              </CardContent>
            </Card>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="outline" onClick={() => onNavigate?.('buffer')}>
              Buffer / ταμείο
            </Button>
            <Button size="sm" variant="outline" onClick={() => onNavigate?.('driver_payables')}>
              Πληρωμές οδηγών
            </Button>
            <Button size="sm" variant="outline" onClick={() => onNavigate?.('store_payables')}>
              Πληρωμές καταστημάτων
            </Button>
            <Button size="sm" variant="outline" onClick={() => onNavigate?.('cloud_usage')}>
              <CreditCard className="h-3.5 w-3.5 mr-1.5" />
              Cloud usage
            </Button>
            <Button size="sm" variant="outline" onClick={() => onNavigate?.('pricing')}>
              Τιμολόγηση
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
