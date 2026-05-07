import { useEffect, useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card as UICard, CardHeader, CardTitle } from '@/components/ui/card';
import MonthCloseCard from './MonthCloseCard';
import CustomOrderDialog from './CustomOrderDialog';
import {
  Banknote, Building2, Shield, TrendingUp, CheckCircle2, AlertCircle,
  RotateCcw, Wallet, Loader2, ArrowRight, Activity, ArrowDownCircle,
  Sparkles, ChevronDown, ChevronUp, Info,
} from 'lucide-react';

const fmt = (n: number | null | undefined) => `€${Number(n ?? 0).toFixed(2)}`;

type ResetKind = 'admin' | 'pool' | 'drivers' | 'stores';

const RESET_META: Record<ResetKind, { title: string; body: string; rpc: string; invalidate: string[] }> = {
  admin: {
    title: 'Μηδενισμός Admin bag',
    body: 'Μηδενίζει το ταμείο admin (5% delivery fee). Καταγράφεται στο treasury ledger. Lifetime totals διατηρούνται.',
    rpc: 'admin_reset_admin_bag',
    invalidate: ['admin-treasury'],
  },
  pool: {
    title: 'Μηδενισμός Platform pool',
    body: 'Μηδενίζει το platform pool (10% commission). Καταγράφεται στο treasury ledger. Lifetime totals διατηρούνται.',
    rpc: 'admin_reset_platform_pool',
    invalidate: ['admin-treasury'],
  },
  drivers: {
    title: 'Μηδενισμός ΟΛΩΝ των driver wallets',
    body: 'Μηδενίζει διαθέσιμο + εκκρεμές κάθε οδηγού. Χρήση μόνο μετά από batch payout. Lifetime totals διατηρούνται.',
    rpc: 'admin_reset_all_driver_wallets',
    invalidate: ['mb-driver-wallets', 'admin-driver-payables'],
  },
  stores: {
    title: 'Μηδενισμός ΟΛΩΝ των store wallets',
    body: 'Μηδενίζει το διαθέσιμο υπόλοιπο κάθε καταστήματος. Χρήση μετά από payout cycle. Lifetime earnings διατηρούνται.',
    rpc: 'admin_reset_all_store_wallets',
    invalidate: ['mb-store-wallets', 'admin-store-payables'],
  },
};

/**
 * Money Bags — platform-wide treasury overview.
 * Three bags (Drivers / Stores / Admin Treasury) with totals, distribution bar,
 * lifetime stats, pending cash settlements, and per-bag reset actions.
 * Per-driver and per-store breakdowns live in their own dedicated panels.
 */
export default function MoneyBagsPanel() {
  const qc = useQueryClient();
  const [pendingReset, setPendingReset] = useState<ResetKind | null>(null);
  const [busy, setBusy] = useState<ResetKind | null>(null);
  const [settling, setSettling] = useState<string | null>(null);
  const [bulkSettling, setBulkSettling] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);

  const { data: health } = useQuery({
    queryKey: ['treasury-health'],
    queryFn: async () => {
      const { data, error } = await (supabase as any).rpc('get_treasury_health');
      if (error) throw error;
      return data as {
        pool_balance: number; pool_low: boolean; pool_negative: boolean; threshold: number;
        open_cash_debts_total: number; open_cash_debts_count: number;
      };
    },
    refetchInterval: 30_000,
  });

  const settleAllCash = async () => {
    setBulkSettling(true);
    const { data, error } = await (supabase as any).rpc('admin_settle_all_driver_cash');
    setBulkSettling(false);
    if (error) { toast.error(error.message); return; }
    toast.success(`Συμψηφίστηκαν ${data?.settled ?? 0} χρέη (${fmt(Number(data?.total ?? 0))})`);
    qc.invalidateQueries({ queryKey: ['mb-cash-debts'] });
    qc.invalidateQueries({ queryKey: ['admin-treasury'] });
    qc.invalidateQueries({ queryKey: ['treasury-health'] });
  };

  const { data: treasury } = useQuery({
    queryKey: ['admin-treasury'],
    queryFn: async () => {
      const { data, error } = await (supabase as any).from('admin_treasury').select('*').eq('id', 1).maybeSingle();
      if (error) throw error;
      return data as {
        admin_balance: number; platform_pool: number;
        lifetime_admin_earned: number; lifetime_platform_earned: number; lifetime_driver_topup: number;
      } | null;
    },
  });

  const { data: storeAgg } = useQuery({
    queryKey: ['mb-store-wallets'],
    queryFn: async () => {
      const { data, error } = await (supabase as any).from('store_wallets').select('available_balance, lifetime_earnings');
      if (error) throw error;
      const rows = (data ?? []) as Array<{ available_balance: number; lifetime_earnings: number }>;
      return {
        count: rows.length,
        owe: rows.reduce((s, r) => s + Math.max(0, Number(r.available_balance)), 0),
        debt: rows.reduce((s, r) => s + Math.max(0, -Number(r.available_balance)), 0),
        lifetime: rows.reduce((s, r) => s + Number(r.lifetime_earnings ?? 0), 0),
      };
    },
  });

  const { data: driverAgg } = useQuery({
    queryKey: ['mb-driver-wallets'],
    queryFn: async () => {
      const [{ data: w, error: e1 }, { data: s, error: e2 }] = await Promise.all([
        supabase.from('driver_wallets').select('available_balance, pending_balance, total_withdrawn'),
        (supabase as any).from('driver_state').select('shift_cash_balance'),
      ]);
      if (e1) throw e1;
      if (e2) throw e2;
      const wallets = (w ?? []) as Array<{ available_balance: number; pending_balance: number; total_withdrawn: number }>;
      const states = (s ?? []) as Array<{ shift_cash_balance: number }>;
      return {
        count: wallets.length,
        available: wallets.reduce((sum, x) => sum + Number(x.available_balance), 0),
        pending: wallets.reduce((sum, x) => sum + Number(x.pending_balance), 0),
        withdrawn: wallets.reduce((sum, x) => sum + Number(x.total_withdrawn), 0),
        cash: states.reduce((sum, x) => sum + Number(x.shift_cash_balance), 0),
      };
    },
  });

  const { data: cashDebts } = useQuery({
    queryKey: ['mb-cash-debts'],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('driver_cash_debts')
        .select('*')
        .eq('settled', false)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data ?? []) as Array<{
        id: string; driver_id: string; order_id: string;
        cash_collected: number; amount_owed: number; store_share: number;
        admin_share: number; platform_share: number; created_at: string;
      }>;
    },
  });

  const { data: profiles } = useQuery({
    queryKey: ['mb-driver-names'],
    queryFn: async () => {
      const { data, error } = await supabase.from('profiles').select('user_id, full_name').eq('role', 'driver');
      if (error) throw error;
      const m = new Map<string, string>();
      (data ?? []).forEach((p: any) => m.set(p.user_id, p.full_name ?? ''));
      return m;
    },
  });

  // Withdrawals + wallets + earnings (merged from former Ταμείο tab)
  const { data: wallets } = useQuery({
    queryKey: ['admin-wallets'],
    queryFn: async () => {
      const { data, error } = await supabase.from('driver_wallets').select('*').order('updated_at', { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: transactions } = useQuery({
    queryKey: ['admin-transactions'],
    queryFn: async () => {
      const { data, error } = await supabase.from('wallet_transactions').select('*').order('created_at', { ascending: false }).limit(100);
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: earnings } = useQuery({
    queryKey: ['admin-earnings'],
    queryFn: async () => {
      const { data, error } = await supabase.from('earnings').select('*').order('created_at', { ascending: false }).limit(200);
      if (error) throw error;
      return data ?? [];
    },
  });

  const pendingWithdrawals = (transactions ?? []).filter((t: any) => t.type === 'withdrawal_request' && t.status === 'pending');

  const handleApproveWithdrawal = async (txId: string, driverId: string, amount: number) => {
    const { error } = await supabase.from('wallet_transactions').update({ status: 'completed' }).eq('id', txId);
    if (error) { toast.error('Αποτυχία'); return; }
    const w = wallets?.find((x: any) => x.driver_id === driverId);
    await supabase.from('driver_wallets').update({
      pending_balance: 0,
      total_withdrawn: (w ? Number(w.total_withdrawn) : 0) + amount,
    } as any).eq('driver_id', driverId);
    toast.success('Ανάληψη εγκρίθηκε');
    qc.invalidateQueries({ queryKey: ['admin-wallets'] });
    qc.invalidateQueries({ queryKey: ['admin-transactions'] });
  };

  const handleRejectWithdrawal = async (txId: string, driverId: string, amount: number) => {
    const { error } = await supabase.from('wallet_transactions').update({ status: 'rejected' }).eq('id', txId);
    if (error) { toast.error('Αποτυχία'); return; }
    const w = wallets?.find((x: any) => x.driver_id === driverId);
    await supabase.from('driver_wallets').update({
      available_balance: Number(w?.available_balance ?? 0) + amount,
      pending_balance: Math.max(0, Number(w?.pending_balance ?? 0) - amount),
    } as any).eq('driver_id', driverId);
    toast.success('Ανάληψη απορρίφθηκε — ποσό επεστράφη');
    qc.invalidateQueries({ queryKey: ['admin-wallets'] });
    qc.invalidateQueries({ queryKey: ['admin-transactions'] });
  };

  // Realtime
  useEffect(() => {
    const ch = supabase
      .channel('money-bags-overview')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'admin_treasury' }, () => qc.invalidateQueries({ queryKey: ['admin-treasury'] }))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'store_wallets' }, () => qc.invalidateQueries({ queryKey: ['mb-store-wallets'] }))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'driver_wallets' }, () => qc.invalidateQueries({ queryKey: ['mb-driver-wallets'] }))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'driver_state' }, () => qc.invalidateQueries({ queryKey: ['mb-driver-wallets'] }))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'driver_cash_debts' }, () => qc.invalidateQueries({ queryKey: ['mb-cash-debts'] }))
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [qc]);

  const driverTotal = (driverAgg?.available ?? 0) + (driverAgg?.pending ?? 0);
  const storeTotal = storeAgg?.owe ?? 0;
  const adminBag = Number(treasury?.admin_balance ?? 0);
  const platformPool = Number(treasury?.platform_pool ?? 0);
  const adminTotal = adminBag + platformPool;

  const grandTotal = driverTotal + storeTotal + adminTotal;
  const pct = (n: number) => grandTotal > 0 ? (n / grandTotal) * 100 : 0;

  const lifetimeOrders = useMemo(() => {
    const a = Number(treasury?.lifetime_admin_earned ?? 0);
    const p = Number(treasury?.lifetime_platform_earned ?? 0);
    const s = Number(storeAgg?.lifetime ?? 0);
    return { admin: a, platform: p, stores: s, total: a + p + s };
  }, [treasury, storeAgg]);

  const settleDebt = async (id: string) => {
    setSettling(id);
    const { error } = await (supabase as any).rpc('admin_settle_driver_cash', { p_debt_id: id });
    setSettling(null);
    if (error) toast.error(error.message);
    else {
      toast.success('Cash settled');
      qc.invalidateQueries({ queryKey: ['mb-cash-debts'] });
    }
  };

  const doReset = async () => {
    if (!pendingReset) return;
    const meta = RESET_META[pendingReset];
    setBusy(pendingReset);
    const { error } = await (supabase as any).rpc(meta.rpc, {});
    setBusy(null);
    if (error) { toast.error(error.message); return; }
    toast.success('Μηδενίστηκε');
    meta.invalidate.forEach(k => qc.invalidateQueries({ queryKey: [k] }));
    setPendingReset(null);
  };

  const driverName = (id: string) => profiles?.get(id) || `${id.slice(0, 6)}…`;

  return (
    <div className="space-y-4">
      <div className="admin-section-header flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="admin-section-title">Money Bags · Ταμείο</h2>
          <p className="admin-section-sub mt-0.5">
            85% Κατάστημα · 10% Driver pool · 5% Admin — ζωντανή κατανομή χρημάτων στην πλατφόρμα.
          </p>
        </div>
        <CustomOrderDialog />
      </div>

      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList className="flex flex-wrap h-auto gap-1">
          <TabsTrigger value="overview">
            <Activity className="h-3.5 w-3.5 mr-1" />Επισκόπηση
          </TabsTrigger>
          <TabsTrigger value="withdrawals">
            <ArrowDownCircle className="h-3.5 w-3.5 mr-1" />Αναλήψεις
            {pendingWithdrawals.length > 0 && (
              <Badge className="ml-1.5 h-4 px-1.5 bg-warning/20 text-warning border-warning/30">
                {pendingWithdrawals.length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="wallets">
            <Wallet className="h-3.5 w-3.5 mr-1" />Πορτοφόλια
          </TabsTrigger>
          <TabsTrigger value="earnings">
            <TrendingUp className="h-3.5 w-3.5 mr-1" />Κέρδη
          </TabsTrigger>
          <TabsTrigger value="month">Κλείσιμο μήνα</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4 m-0">


      {/* Health alerts */}
      {health?.pool_low && (
        <Card className={health.pool_negative ? 'border-destructive bg-destructive/5' : 'border-warning bg-warning/5'}>
          <CardContent className="p-4 flex items-start gap-3">
            <AlertCircle className={`h-5 w-5 shrink-0 mt-0.5 ${health.pool_negative ? 'text-destructive' : 'text-warning'}`} />
            <div className="flex-1 min-w-0">
              <p className="font-heading font-bold text-sm">
                {health.pool_negative ? 'Driver Pool στο κόκκινο' : 'Χαμηλό Driver Pool'}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Τρέχον υπόλοιπο: <span className="font-bold tabular-nums">{fmt(health.pool_balance)}</span> ·
                όριο ειδοποίησης {fmt(health.threshold)}. Τα driver top-ups πληρώνονται από εδώ — αν εξαντληθεί, οι εγγυημένες αμοιβές σπάνε.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* How it works — collapsible help */}
      <Card className="border-primary/30 bg-primary/[0.02]">
        <button
          onClick={() => setHelpOpen(v => !v)}
          className="w-full flex items-center gap-2 p-4 text-left hover:bg-primary/[0.04] transition-colors"
        >
          <Info className="h-4 w-4 text-primary shrink-0" />
          <span className="text-sm font-heading font-semibold flex-1">Πώς δουλεύει το Money Bags σύστημα</span>
          {helpOpen ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
        </button>
        {helpOpen && (
          <CardContent className="pt-0 pb-4 px-4 text-sm space-y-4">
            <div>
              <p className="font-heading font-bold mb-1.5">Ροή κάθε παραγγελίας (split 85/10/5)</p>
              <p className="text-muted-foreground text-[13px] leading-relaxed">
                Όταν μια παραγγελία γίνει <code className="px-1 rounded bg-muted">delivered</code>, το trigger
                <code className="px-1 rounded bg-muted">settle_order_money_bags</code> τρέχει αυτόματα και χωρίζει τα χρήματα:
              </p>
              <ul className="mt-2 space-y-1 text-[13px] pl-4 list-disc text-foreground">
                <li><b>85% του φαγητού</b> → store wallet</li>
                <li><b>10% του φαγητού</b> → Driver Pool (πληρώνει top-ups & μπόνους)</li>
                <li><b>5% του delivery fee</b> → Admin bag (καθαρό κέρδος)</li>
                <li><b>Delivery fee + tip</b> → driver wallet (με min-pay εγγύηση)</li>
              </ul>
            </div>

            <div className="rounded-lg border border-border bg-background p-3">
              <p className="font-heading font-bold text-[13px] mb-2 flex items-center gap-1.5">
                <Sparkles className="h-3.5 w-3.5 text-primary" /> Παράδειγμα: παραγγελία 20€ + 2€ delivery + 1€ tip
              </p>
              <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-[12.5px] tabular-nums">
                <span className="text-muted-foreground">Store παίρνει</span><span className="text-emerald-600 font-bold">+17.00€ (85% × 20)</span>
                <span className="text-muted-foreground">Driver Pool</span><span className="text-primary font-bold">+2.00€ (10% × 20)</span>
                <span className="text-muted-foreground">Admin bag</span><span className="text-amber-600 font-bold">+0.10€ (5% × 2)</span>
                <span className="text-muted-foreground">Driver wallet</span><span className="font-bold">+3.00€ (2 fee + 1 tip)</span>
                <span className="text-muted-foreground">Σύνολο commission</span><span>1.00€ (5% × 20)</span>
              </div>
            </div>

            <div>
              <p className="font-heading font-bold mb-1.5">Καθημερινή χρήση</p>
              <ol className="space-y-1.5 text-[13px] pl-4 list-decimal">
                <li><b>Cash παραγγελίες:</b> ο οδηγός μαζεύει μετρητά → εμφανίζεται στα «Εκκρεμείς ταμειακοί συμψηφισμοί». Όταν φέρει τα λεφτά, πάτα <kbd className="px-1.5 py-0.5 rounded bg-muted text-[11px] border">Settle all</kbd> για να συμψηφιστούν όλα μαζί.</li>
                <li><b>Driver payouts:</b> έγκρινε αναλήψεις στην καρτέλα «Αναλήψεις». Lifetime totals διατηρούνται.</li>
                <li><b>Store payouts:</b> πλήρωσε καταστήματα (banking) και μετά reset το store wallet τους.</li>
                <li><b>Κλείσιμο μήνα:</b> τρέχει αυτόματα την 1η κάθε μήνα στις 03:00. Μπορείς και χειροκίνητα από την καρτέλα «Κλείσιμο μήνα».</li>
              </ol>
            </div>

            <div>
              <p className="font-heading font-bold mb-1.5">Αυτόματα προστατευτικά</p>
              <ul className="space-y-1 text-[13px] pl-4 list-disc text-muted-foreground">
                <li>Ειδοποίηση όταν το Driver Pool πέσει κάτω από το όριο (default {fmt(health?.threshold ?? 50)}).</li>
                <li>Min-pay εγγύηση για κάθε οδηγό — top-up αυτόματα από το pool.</li>
                <li>Όλες οι κινήσεις γράφονται στο <code className="px-1 rounded bg-muted">admin_treasury_ledger</code> για audit.</li>
              </ul>
            </div>
          </CardContent>
        )}
      </Card>

      {/* Hero distribution */}
      <Card className="overflow-hidden">
        <CardContent className="p-5">
          <div className="flex items-baseline justify-between mb-1">
            <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Σύνολο σε εκκρεμότητα</p>
            <p className="text-[11px] text-muted-foreground">Ζωντανά υπόλοιπα · χωρίς lifetime</p>
          </div>
          <p className="text-4xl font-heading font-extrabold tabular-nums">{fmt(grandTotal)}</p>

          {/* Stacked distribution bar */}
          <div className="mt-4 h-3 w-full rounded-full overflow-hidden bg-muted flex">
            <div className="bg-emerald-500 h-full transition-all" style={{ width: `${pct(storeTotal)}%` }} title={`Stores ${fmt(storeTotal)}`} />
            <div className="bg-primary h-full transition-all" style={{ width: `${pct(driverTotal)}%` }} title={`Drivers ${fmt(driverTotal)}`} />
            <div className="bg-amber-500 h-full transition-all" style={{ width: `${pct(adminTotal)}%` }} title={`Admin ${fmt(adminTotal)}`} />
          </div>
          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[11px]">
            <Legend color="bg-emerald-500" label="Καταστήματα" value={fmt(storeTotal)} pct={pct(storeTotal)} />
            <Legend color="bg-primary" label="Οδηγοί" value={fmt(driverTotal)} pct={pct(driverTotal)} />
            <Legend color="bg-amber-500" label="Admin treasury" value={fmt(adminTotal)} pct={pct(adminTotal)} />
          </div>
        </CardContent>
      </Card>

      {/* Unified Money Bag */}
      <Card className="border-l-4 border-l-primary">
        <CardContent className="p-5">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="h-10 w-10 rounded-lg flex items-center justify-center shrink-0 bg-primary/10 text-primary">
                <Wallet className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-heading font-bold truncate">Money Bag</p>
                <p className="text-[11px] text-muted-foreground truncate">
                  {(driverAgg?.count ?? 0)} οδηγοί · {(storeAgg?.count ?? 0)} καταστήματα · 85/10/5
                </p>
              </div>
            </div>
          </div>

          <p className="text-4xl font-heading font-extrabold tabular-nums">{fmt(grandTotal)}</p>
          <p className="text-[11px] text-muted-foreground mt-0.5">Συνολικό υπόλοιπο πλατφόρμας</p>

          {/* Three sections inside */}
          <div className="mt-5 grid gap-3 sm:grid-cols-3">
            {/* Drivers section */}
            <div className="rounded-lg border border-border/60 p-3 space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <Banknote className="h-3.5 w-3.5 text-primary" />
                  <span className="text-[11px] font-heading font-semibold">Οδηγοί</span>
                </div>
                <Button size="icon" variant="ghost"
                  className="h-6 w-6 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                  onClick={() => setPendingReset('drivers')} disabled={busy === 'drivers'} title="Reset όλων">
                  {busy === 'drivers' ? <Loader2 className="h-3 w-3 animate-spin" /> : <RotateCcw className="h-3 w-3" />}
                </Button>
              </div>
              <p className="text-xl font-heading font-bold tabular-nums">{fmt(driverTotal)}</p>
              <div className="space-y-1 pt-1.5 border-t border-border/50 text-[11px]">
                <Row label="Διαθέσιμο" value={fmt(driverAgg?.available)} tone="text-emerald-600" />
                <Row label="Εκκρεμές" value={fmt(driverAgg?.pending)} />
                <Row label="Cash βάρδιας" value={fmt(driverAgg?.cash)} tone="text-warning" />
                <Row label="Αναλήφθηκαν" value={fmt(driverAgg?.withdrawn)} />
              </div>
            </div>

            {/* Stores section */}
            <div className="rounded-lg border border-border/60 p-3 space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <Building2 className="h-3.5 w-3.5 text-emerald-600" />
                  <span className="text-[11px] font-heading font-semibold">Καταστήματα</span>
                </div>
                <Button size="icon" variant="ghost"
                  className="h-6 w-6 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                  onClick={() => setPendingReset('stores')} disabled={busy === 'stores'} title="Reset όλων">
                  {busy === 'stores' ? <Loader2 className="h-3 w-3 animate-spin" /> : <RotateCcw className="h-3 w-3" />}
                </Button>
              </div>
              <p className="text-xl font-heading font-bold tabular-nums">{fmt(storeTotal)}</p>
              <div className="space-y-1 pt-1.5 border-t border-border/50 text-[11px]">
                <Row label="Admin χρωστάει" value={fmt(storeAgg?.owe)} tone="text-emerald-600" />
                <Row label="Καταστήματα χρωστούν" value={fmt(storeAgg?.debt)} tone="text-destructive" />
                <Row label="Lifetime" value={fmt(storeAgg?.lifetime)} />
              </div>
            </div>

            {/* Admin section */}
            <div className="rounded-lg border border-border/60 p-3 space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <Shield className="h-3.5 w-3.5 text-amber-600" />
                  <span className="text-[11px] font-heading font-semibold">Admin Treasury</span>
                </div>
              </div>
              <p className="text-xl font-heading font-bold tabular-nums">{fmt(adminTotal)}</p>
              <div className="space-y-1 pt-1.5 border-t border-border/50 text-[11px]">
                <RowWithReset label="Admin (5%)" value={fmt(adminBag)} tone="text-amber-600" onReset={() => setPendingReset('admin')} />
                <RowWithReset label="Platform pool" value={fmt(platformPool)} onReset={() => setPendingReset('pool')} />
                <Row label="Driver top-ups" value={fmt(treasury?.lifetime_driver_topup)} tone="text-primary" />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Lifetime */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center gap-2 mb-3">
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
            <h3 className="text-sm font-heading font-semibold">Lifetime Earnings</h3>
            <Badge variant="outline" className="text-[10px] h-4 px-1.5 ml-auto">All time</Badge>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Stat label="Admin earned" value={fmt(lifetimeOrders.admin)} accent="text-amber-600" />
            <Stat label="Platform earned" value={fmt(lifetimeOrders.platform)} accent="text-primary" />
            <Stat label="Stores earned" value={fmt(lifetimeOrders.stores)} accent="text-emerald-600" />
            <Stat label="Driver top-ups" value={fmt(treasury?.lifetime_driver_topup)} accent="text-info" />
          </div>
        </CardContent>
      </Card>

      {/* Cash debts */}
      <Card className={cashDebts && cashDebts.length > 0 ? 'border-warning/40' : ''}>
        <CardContent className="p-4">
          <div className="flex items-center gap-2 mb-3">
            {cashDebts && cashDebts.length > 0
              ? <AlertCircle className="h-4 w-4 text-warning" />
              : <CheckCircle2 className="h-4 w-4 text-emerald-600" />}
            <h3 className="text-sm font-heading font-semibold">
              Εκκρεμείς ταμειακοί συμψηφισμοί
            </h3>
            {cashDebts && cashDebts.length > 0 && (
              <Badge className="ml-auto bg-warning/15 text-warning border-warning/30 hover:bg-warning/20">
                {cashDebts.length}
              </Badge>
            )}
          </div>

          {!cashDebts || cashDebts.length === 0 ? (
            <p className="text-sm text-muted-foreground py-3">Όλα τα μετρητά έχουν συμψηφιστεί.</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Οδηγός</TableHead>
                    <TableHead className="text-right">Cash</TableHead>
                    <TableHead className="text-right">Owed</TableHead>
                    <TableHead className="text-right hidden md:table-cell">Store</TableHead>
                    <TableHead className="text-right hidden md:table-cell">Admin</TableHead>
                    <TableHead className="text-right hidden md:table-cell">Pool</TableHead>
                    <TableHead className="hidden lg:table-cell">Πότε</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {cashDebts.map((d) => (
                    <TableRow key={d.id}>
                      <TableCell className="font-medium">{driverName(d.driver_id)}</TableCell>
                      <TableCell className="text-right tabular-nums">{fmt(d.cash_collected)}</TableCell>
                      <TableCell className="text-right tabular-nums font-bold">{fmt(d.amount_owed)}</TableCell>
                      <TableCell className="text-right tabular-nums text-emerald-600 hidden md:table-cell">{fmt(d.store_share)}</TableCell>
                      <TableCell className="text-right tabular-nums text-amber-600 hidden md:table-cell">{fmt(d.admin_share)}</TableCell>
                      <TableCell className="text-right tabular-nums text-primary hidden md:table-cell">{fmt(d.platform_share)}</TableCell>
                      <TableCell className="text-xs text-muted-foreground hidden lg:table-cell">
                        {format(new Date(d.created_at), 'dd MMM, HH:mm')}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button size="sm" onClick={() => settleDebt(d.id)} disabled={settling === d.id} className="gap-1 h-8">
                          {settling === d.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <CheckCircle2 className="h-3 w-3" />}
                          Settle
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
        </TabsContent>

        <TabsContent value="withdrawals" className="m-0">
          <UICard>
            <CardHeader><CardTitle className="font-heading text-base">Εκκρεμή Αιτήματα Ανάληψης</CardTitle></CardHeader>
            <CardContent className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Οδηγός</TableHead>
                    <TableHead className="text-right">Ποσό</TableHead>
                    <TableHead className="hidden md:table-cell">Ημερομηνία</TableHead>
                    <TableHead className="text-right">Ενέργειες</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pendingWithdrawals.map((tx: any) => (
                    <TableRow key={tx.id}>
                      <TableCell className="font-medium">{driverName(tx.driver_id)}</TableCell>
                      <TableCell className="text-right tabular-nums font-bold">{fmt(tx.amount)}</TableCell>
                      <TableCell className="text-xs text-muted-foreground hidden md:table-cell">
                        {format(new Date(tx.created_at), 'dd MMM, HH:mm')}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-2 justify-end">
                          <Button size="sm" className="h-8" onClick={() => handleApproveWithdrawal(tx.id, tx.driver_id, Number(tx.amount))}>
                            <CheckCircle2 className="h-3 w-3 mr-1" />Έγκριση
                          </Button>
                          <Button size="sm" variant="destructive" className="h-8" onClick={() => handleRejectWithdrawal(tx.id, tx.driver_id, Number(tx.amount))}>
                            Απόρριψη
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                  {!pendingWithdrawals.length && (
                    <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-8">Κανένα εκκρεμές αίτημα</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </UICard>
        </TabsContent>

        <TabsContent value="wallets" className="m-0">
          <UICard>
            <CardHeader><CardTitle className="font-heading text-base">Πορτοφόλια Οδηγών</CardTitle></CardHeader>
            <CardContent className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Οδηγός</TableHead>
                    <TableHead className="text-right">Διαθέσιμο</TableHead>
                    <TableHead className="text-right">Εκκρεμές</TableHead>
                    <TableHead className="text-right hidden md:table-cell">Αναληφθέντα</TableHead>
                    <TableHead className="hidden lg:table-cell">Τελ. Ενημέρωση</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(wallets ?? []).map((w: any) => (
                    <TableRow key={w.id}>
                      <TableCell className="font-medium">{driverName(w.driver_id)}</TableCell>
                      <TableCell className="text-right tabular-nums font-bold text-emerald-600">{fmt(w.available_balance)}</TableCell>
                      <TableCell className="text-right tabular-nums text-warning">{fmt(w.pending_balance)}</TableCell>
                      <TableCell className="text-right tabular-nums hidden md:table-cell">{fmt(w.total_withdrawn)}</TableCell>
                      <TableCell className="text-xs text-muted-foreground hidden lg:table-cell">
                        {format(new Date(w.updated_at), 'dd MMM, HH:mm')}
                      </TableCell>
                    </TableRow>
                  ))}
                  {!wallets?.length && (
                    <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">Κανένα πορτοφόλι</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </UICard>
        </TabsContent>

        <TabsContent value="earnings" className="m-0">
          <UICard>
            <CardHeader><CardTitle className="font-heading text-base">Πρόσφατα Κέρδη</CardTitle></CardHeader>
            <CardContent className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Οδηγός</TableHead>
                    <TableHead className="text-right">Βάση</TableHead>
                    <TableHead className="text-right hidden md:table-cell">Tips</TableHead>
                    <TableHead className="text-right hidden md:table-cell">Bonus</TableHead>
                    <TableHead className="text-right">Σύνολο</TableHead>
                    <TableHead className="hidden lg:table-cell">Ημερομηνία</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(earnings ?? []).map((e: any) => (
                    <TableRow key={e.id}>
                      <TableCell className="font-medium">{driverName(e.driver_id)}</TableCell>
                      <TableCell className="text-right tabular-nums">{fmt(e.base_pay)}</TableCell>
                      <TableCell className="text-right tabular-nums text-primary hidden md:table-cell">{fmt(e.tip)}</TableCell>
                      <TableCell className="text-right tabular-nums text-warning hidden md:table-cell">{fmt(e.bonus)}</TableCell>
                      <TableCell className="text-right tabular-nums font-bold">{fmt(e.total)}</TableCell>
                      <TableCell className="text-xs text-muted-foreground hidden lg:table-cell">
                        {format(new Date(e.created_at), 'dd MMM, HH:mm')}
                      </TableCell>
                    </TableRow>
                  ))}
                  {!earnings?.length && (
                    <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">Κανένα κέρδος</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </UICard>
        </TabsContent>

        <TabsContent value="month" className="m-0">
          <MonthCloseCard />
        </TabsContent>
      </Tabs>

      {/* Reset confirm */}

      <AlertDialog open={!!pendingReset} onOpenChange={(v) => !v && setPendingReset(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <RotateCcw className="h-5 w-5 text-destructive" />
              {pendingReset ? RESET_META[pendingReset].title : ''}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {pendingReset ? RESET_META[pendingReset].body : ''}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={!!busy}>Άκυρο</AlertDialogCancel>
            <AlertDialogAction
              onClick={doReset}
              disabled={!!busy}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {busy && <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />}
              Reset to 0
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

/* — small subcomponents — */

function Legend({ color, label, value, pct }: { color: string; label: string; value: string; pct: number }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={`h-2 w-2 rounded-sm ${color}`} />
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium tabular-nums">{value}</span>
      <span className="text-muted-foreground">({pct.toFixed(0)}%)</span>
    </span>
  );
}

function Stat({ label, value, accent }: { label: string; value: string; accent?: string }) {
  return (
    <div className="rounded-lg bg-muted/40 p-3">
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className={`text-xl font-heading font-bold tabular-nums mt-0.5 ${accent ?? ''}`}>{value}</p>
    </div>
  );
}

function Row({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span className={`font-medium tabular-nums ${tone ?? ''}`}>{value}</span>
    </div>
  );
}

function RowWithReset({ label, value, tone, onReset }: { label: string; value: string; tone?: string; onReset: () => void }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-muted-foreground">{label}</span>
      <div className="flex items-center gap-1">
        <span className={`font-medium tabular-nums ${tone ?? ''}`}>{value}</span>
        <Button size="icon" variant="ghost"
          className="h-5 w-5 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
          onClick={onReset} title="Reset">
          <RotateCcw className="h-2.5 w-2.5" />
        </Button>
      </div>
    </div>
  );
}
