import { useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Wallet, Banknote, Building2, Coins, Activity } from 'lucide-react';
import { format } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

interface Props {
  orders: any[];
  stores: any[];
  profiles: any[];
  reviews: any[];
  earnings: any[];
}

/* ─────────────────────────  Money Bag card  ─────────────────────── */
function MoneyBag({
  label, value, sub, icon: Icon, tone, percent, tip,
}: {
  label: string; value: string; sub: string; icon: React.ElementType;
  tone: 'emerald' | 'blue' | 'orange' | 'red';
  percent: number; tip: string;
}) {
  const toneMap = {
    emerald: { bg: 'bg-emerald-500/10', text: 'text-emerald-600 dark:text-emerald-400', bar: 'bg-emerald-500' },
    blue:    { bg: 'bg-blue-500/10',    text: 'text-blue-600 dark:text-blue-400',       bar: 'bg-blue-500' },
    orange:  { bg: 'bg-orange-500/10',  text: 'text-orange-600 dark:text-orange-400',   bar: 'bg-orange-500' },
    red:     { bg: 'bg-red-500/10',     text: 'text-red-600 dark:text-red-400',         bar: 'bg-red-500' },
  }[tone];
  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="rounded-xl border border-border bg-card p-3 hover:shadow-sm transition-shadow cursor-help">
            <div className="flex items-start justify-between mb-2">
              <div className="min-w-0">
                <p className="text-[11px] uppercase tracking-wide text-muted-foreground font-medium">{label}</p>
                <p className="text-xl font-bold tabular-nums mt-0.5 truncate">{value}</p>
              </div>
              <div className={cn('h-8 w-8 rounded-lg flex items-center justify-center shrink-0', toneMap.bg)}>
                <Icon className={cn('h-4 w-4', toneMap.text)} />
              </div>
            </div>
            <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
              <div
                className={cn('h-full rounded-full transition-all', toneMap.bar)}
                style={{ width: `${Math.min(Math.max(percent, 4), 100)}%` }}
              />
            </div>
            <p className="text-[10.5px] text-muted-foreground mt-1.5 truncate">{sub}</p>
          </div>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="max-w-xs text-xs">{tip}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

/* ─────────────────────────  Main Overview (Money Bags only)  ────────────── */
export default function AdminOverview({}: Props) {
  const today = new Date();
  const qcTop = useQueryClient();

  useEffect(() => {
    const ch = supabase
      .channel('admin-overview-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'admin_treasury' },
        () => qcTop.invalidateQueries({ queryKey: ['admin-treasury-overview'] }))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'store_wallets' },
        () => qcTop.invalidateQueries({ queryKey: ['admin-store-owed'] }))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'driver_state' },
        () => qcTop.invalidateQueries({ queryKey: ['admin-cash-on-street'] }))
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [qcTop]);

  const { data: treasury } = useQuery({
    queryKey: ['admin-treasury-overview'],
    queryFn: async () => {
      const { data } = await (supabase as any).from('admin_treasury').select('*').eq('id', 1).maybeSingle();
      return data as { admin_balance: number; platform_pool: number; lifetime_admin_earned: number; lifetime_platform_earned: number } | null;
    },
    refetchInterval: 30_000,
  });

  const { data: storeOwed } = useQuery({
    queryKey: ['admin-store-owed'],
    queryFn: async () => {
      const { data } = await (supabase as any).from('store_wallets').select('available_balance');
      return (data ?? []).reduce((s: number, r: any) => s + Number(r.available_balance ?? 0), 0);
    },
    refetchInterval: 60_000,
  });

  const { data: cashOnStreet } = useQuery({
    queryKey: ['admin-cash-on-street'],
    queryFn: async () => {
      const { data } = await (supabase as any).from('driver_state').select('shift_cash_balance, shift_started_at');
      return (data ?? []).filter((r: any) => r.shift_started_at).reduce((s: number, r: any) => s + Number(r.shift_cash_balance ?? 0), 0);
    },
    refetchInterval: 30_000,
  });

  const adminBal = Number(treasury?.admin_balance ?? 0);
  const platformBal = Number(treasury?.platform_pool ?? 0);
  const lifetimeAdmin = Number(treasury?.lifetime_admin_earned ?? 1);
  const lifetimePlat = Number(treasury?.lifetime_platform_earned ?? 1);
  const owedBal = Number(storeOwed ?? 0);
  const cashBal = Number(cashOnStreet ?? 0);

  return (
    <div className="space-y-4 max-w-2xl">
      <div className="min-w-0">
        <h1 className="text-2xl font-bold tracking-tight">Command Center</h1>
        <p className="text-[12px] text-muted-foreground flex items-center gap-1.5 mt-0.5">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
          Live · {format(today, 'EEE, dd MMM yyyy · HH:mm')}
        </p>
      </div>

      <div className="rounded-xl border border-border bg-card p-3.5">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Wallet className="h-4 w-4 text-muted-foreground" />
            <span className="font-semibold text-sm">Money Bags</span>
          </div>
          <Badge variant="outline" className="text-[10px] h-5">Live</Badge>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          <MoneyBag
            label="Driver Pool"
            value={`€${platformBal.toFixed(2)}`}
            sub={`Lifetime €${lifetimePlat.toFixed(0)}`}
            icon={Coins} tone="emerald"
            percent={Math.min((platformBal / Math.max(lifetimePlat, 1)) * 100, 100)}
            tip="Πλεόνασμα από επιτυχημένες παραδόσεις. Επιδοτεί εγγυήσεις & μεγάλες αποστάσεις."
          />
          <MoneyBag
            label="Treasury (5%)"
            value={`€${adminBal.toFixed(2)}`}
            sub={`Lifetime €${lifetimeAdmin.toFixed(0)}`}
            icon={Banknote} tone="blue"
            percent={Math.min((adminBal / Math.max(lifetimeAdmin, 1)) * 100, 100)}
            tip="Έσοδα admin από προμήθειες. Αποθηκεύεται για συντήρηση πλατφόρμας & φόρους."
          />
          <MoneyBag
            label="Owed to Stores"
            value={`€${owedBal.toFixed(2)}`}
            sub="Pending payouts"
            icon={Building2} tone="orange"
            percent={owedBal > 0 ? Math.min(Math.log10(owedBal + 1) * 25, 100) : 4}
            tip="Σύνολο από store_wallets που δεν έχει ακόμα εκταμιευθεί στα καταστήματα."
          />
          <MoneyBag
            label="Cash on Street"
            value={`€${cashBal.toFixed(2)}`}
            sub="Held by active drivers"
            icon={Activity} tone="red"
            percent={cashBal > 0 ? Math.min(Math.log10(cashBal + 1) * 25, 100) : 4}
            tip="Φυσικά μετρητά που έχουν συλλέξει οι οδηγοί σε ενεργή βάρδια. Πρέπει να επιστραφούν."
          />
        </div>
      </div>
    </div>
  );
}
