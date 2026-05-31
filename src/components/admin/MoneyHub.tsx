import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Zap, BookOpen, Wallet, Send, TrendingUp, ShieldCheck, Activity,
  ArrowUpRight, Banknote, Sparkles,
} from 'lucide-react';
import MoneyEnginePanel from './MoneyEnginePanel';
import LedgerExplorer from './LedgerExplorer';
import BasketDashboard from './BasketDashboard';
import BufferDistributor from './BufferDistributor';
import { cn } from '@/lib/utils';

/**
 * Money Hub — unified financial control room.
 * Live KPI strip + tabbed deep-dives (engine, buffer, ledger, basket).
 */
export default function MoneyHub() {
  const [tab, setTab] = useState<'engine' | 'buffer' | 'ledger' | 'basket'>('engine');

  const kpis = useQuery({
    queryKey: ['money-hub-kpis'],
    refetchInterval: 15_000,
    queryFn: async () => {
      const since = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
      const [treasury, basket, todayTx, driverWallets] = await Promise.all([
        (supabase as any).from('admin_treasury').select('platform_pool, admin_balance').eq('id', 1).maybeSingle(),
        (supabase as any).from('basket_health').select('current_balance, target_balance').maybeSingle(),
        (supabase as any).from('transactions').select('amount, wallet_kind, type').gte('created_at', since),
        (supabase as any).from('driver_wallets').select('available_balance, pending_balance'),
      ]);

      const txs = (todayTx.data ?? []) as { amount: number; wallet_kind: string; type: string }[];
      const adminInflow = txs
        .filter(t => t.wallet_kind === 'admin' && Number(t.amount) > 0)
        .reduce((s, t) => s + Number(t.amount), 0);
      const driverPayouts = txs
        .filter(t => t.wallet_kind === 'driver' && Number(t.amount) > 0)
        .reduce((s, t) => s + Number(t.amount), 0);
      const drvWallets = (driverWallets.data ?? []) as { available_balance: number; pending_balance: number }[];
      const driverLiability = drvWallets.reduce(
        (s, w) => s + Number(w.available_balance ?? 0) + Number(w.pending_balance ?? 0), 0,
      );

      return {
        pool: Number(treasury.data?.platform_pool ?? 0),
        admin: Number(treasury.data?.admin_balance ?? 0),
        basketCurrent: Number(basket.data?.current_balance ?? 0),
        basketTarget: Number(basket.data?.target_balance ?? 500),
        adminInflow24h: adminInflow,
        driverPayouts24h: driverPayouts,
        driverLiability,
        txCount24h: txs.length,
      };
    },
  });

  const k = kpis.data;
  const basketPct = k ? Math.min(100, Math.round((k.basketCurrent / Math.max(1, k.basketTarget)) * 100)) : 0;
  const basketTone = basketPct < 25 ? 'destructive' : basketPct < 60 ? 'warning' : 'success';

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
        <div>
          <h2 className="font-heading font-bold text-2xl flex items-center gap-2">
            <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-success to-primary grid place-items-center shadow-elegant">
              <Wallet className="h-5 w-5 text-primary-foreground" />
            </div>
            Money Hub
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            Ενιαίο κέντρο ελέγχου: ζωντανά KPIs, split engine, buffer διανομές, καθολικό και Driver Basket.
          </p>
        </div>
        <Badge variant="outline" className="gap-1.5 self-start sm:self-auto">
          <Activity className="h-3 w-3 text-success animate-pulse" />
          Live · ανανέωση 15s
        </Badge>
      </div>

      {/* KPI strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCard
          icon={<Banknote className="h-4 w-4" />}
          label="Driver Pool"
          value={`€${(k?.pool ?? 0).toFixed(2)}`}
          hint={`Στόχος basket €${(k?.basketTarget ?? 0).toFixed(0)}`}
          tone="primary"
          progress={basketPct}
          progressTone={basketTone}
        />
        <KpiCard
          icon={<ShieldCheck className="h-4 w-4" />}
          label="Admin Treasury"
          value={`€${(k?.admin ?? 0).toFixed(2)}`}
          hint={`+€${(k?.adminInflow24h ?? 0).toFixed(2)} σε 24ω`}
          tone="success"
        />
        <KpiCard
          icon={<ArrowUpRight className="h-4 w-4" />}
          label="Πληρωμές οδηγών 24ω"
          value={`€${(k?.driverPayouts24h ?? 0).toFixed(2)}`}
          hint={`${k?.txCount24h ?? 0} κινήσεις συνολικά`}
          tone="warning"
        />
        <KpiCard
          icon={<TrendingUp className="h-4 w-4" />}
          label="Υποχρεώσεις οδηγών"
          value={`€${(k?.driverLiability ?? 0).toFixed(2)}`}
          hint="Διαθέσιμα + εκκρεμή"
          tone="accent"
        />
      </div>

      {/* Tabs */}
      <Tabs value={tab} onValueChange={(v) => setTab(v as any)}>
        <TabsList className="grid grid-cols-4 w-full h-auto p-1 bg-muted/60">
          <TabTrigger value="engine" icon={<Zap className="h-4 w-4" />} label="Engine" hint="Split 85/10/5" />
          <TabTrigger value="buffer" icon={<Send className="h-4 w-4" />} label="Buffer" hint="Διανομές" />
          <TabTrigger value="ledger" icon={<BookOpen className="h-4 w-4" />} label="Καθολικό" hint="Όλες οι κινήσεις" />
          <TabTrigger value="basket" icon={<Sparkles className="h-4 w-4" />} label="Basket" hint="Driver pool" />
        </TabsList>

        <TabsContent value="engine" className="mt-5"><MoneyEnginePanel /></TabsContent>
        <TabsContent value="buffer" className="mt-5"><BufferDistributor /></TabsContent>
        <TabsContent value="ledger" className="mt-5"><LedgerExplorer /></TabsContent>
        <TabsContent value="basket" className="mt-5"><BasketDashboard /></TabsContent>
      </Tabs>
    </div>
  );
}

type Tone = 'primary' | 'success' | 'warning' | 'accent' | 'destructive';

function KpiCard({
  icon, label, value, hint, tone, progress, progressTone,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  hint?: string;
  tone: Tone;
  progress?: number;
  progressTone?: Tone;
}) {
  const toneRing: Record<Tone, string> = {
    primary: 'from-primary/20 to-primary/5 text-primary',
    success: 'from-success/20 to-success/5 text-success',
    warning: 'from-warning/20 to-warning/5 text-warning',
    accent: 'from-accent/20 to-accent/5 text-accent-foreground',
    destructive: 'from-destructive/20 to-destructive/5 text-destructive',
  };
  const barTone: Record<Tone, string> = {
    primary: 'bg-primary',
    success: 'bg-success',
    warning: 'bg-warning',
    accent: 'bg-accent',
    destructive: 'bg-destructive',
  };
  return (
    <Card className="overflow-hidden border-border/60 hover:border-border transition-colors">
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-[11px] uppercase tracking-wide text-muted-foreground font-medium">{label}</span>
          <div className={cn('h-7 w-7 rounded-lg grid place-items-center bg-gradient-to-br', toneRing[tone])}>
            {icon}
          </div>
        </div>
        <p className="text-2xl font-heading font-bold tabular-nums">{value}</p>
        {hint && <p className="text-[11px] text-muted-foreground mt-1">{hint}</p>}
        {typeof progress === 'number' && (
          <div className="mt-3 h-1.5 rounded-full bg-muted overflow-hidden">
            <div
              className={cn('h-full rounded-full transition-all', barTone[progressTone ?? tone])}
              style={{ width: `${progress}%` }}
            />
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function TabTrigger({
  value, icon, label, hint,
}: { value: string; icon: React.ReactNode; label: string; hint: string }) {
  return (
    <TabsTrigger
      value={value}
      className="flex flex-col items-center gap-0.5 py-2.5 data-[state=active]:bg-background data-[state=active]:shadow-sm"
    >
      <span className="flex items-center gap-1.5 font-medium text-sm">{icon}{label}</span>
      <span className="text-[10px] text-muted-foreground hidden sm:block">{hint}</span>
    </TabsTrigger>
  );
}
