import { useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import CashTracker from './CashTracker';
import { Banknote, Receipt, AlertCircle } from 'lucide-react';

interface CashDebt {
  id: string;
  order_id: string;
  cash_collected: number;
  amount_owed: number;
  settled: boolean;
  created_at: string;
}

export default function DriverCashWallet() {
  const { user } = useAuth();
  const qc = useQueryClient();

  const { data: debts = [] } = useQuery({
    queryKey: ['driver-cash-debts', user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('driver_cash_debts')
        .select('id, order_id, cash_collected, amount_owed, settled, created_at')
        .eq('driver_id', user!.id)
        .order('created_at', { ascending: false })
        .limit(30);
      if (error) throw error;
      return (data ?? []) as CashDebt[];
    },
  });

  useEffect(() => {
    if (!user) return;
    const ch = supabase
      .channel('driver-cash')
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'driver_cash_debts', filter: `driver_id=eq.${user.id}` },
        () => qc.invalidateQueries({ queryKey: ['driver-cash-debts', user.id] }))
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [user, qc]);

  const unsettled = debts.filter(d => !d.settled);
  const totalOwed = unsettled.reduce((s, d) => s + Number(d.amount_owed), 0);

  return (
    <div className="space-y-4">
      {/* Cash tracker — shift cash balance */}
      <CashTracker />

      {/* What you owe admin */}
      <div className="rounded-2xl driver-glass p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Receipt className="h-4 w-4 text-[hsl(var(--driver-text-muted))]" />
            <h3 className="font-heading font-bold text-sm text-[hsl(var(--driver-text))]">Οφειλές προς διαχειριστή</h3>
          </div>
          {unsettled.length > 0 && (
            <span className="text-[10px] font-heading uppercase tracking-wider px-2 py-1 rounded-md bg-amber-500/15 text-amber-600 dark:text-amber-400">
              {unsettled.length} εκκρεμή
            </span>
          )}
        </div>

        {totalOwed > 0 && (
          <div className="rounded-xl bg-amber-500/10 border border-amber-500/30 p-3 mb-3 flex items-start gap-2.5">
            <AlertCircle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
            <div className="text-xs leading-relaxed">
              <p className="font-bold text-amber-700 dark:text-amber-400">Οφείλεις €{totalOwed.toFixed(2)}</p>
              <p className="text-[hsl(var(--driver-text-muted))] mt-0.5">
                Είναι μετρητά που εισέπραξες από πελάτες αντί της πλατφόρμας. Παρέδωσέ τα στον διαχειριστή για να εκκαθαριστούν.
              </p>
            </div>
          </div>
        )}

        <div className="space-y-2">
          {unsettled.length === 0 ? (
            <p className="text-xs text-[hsl(var(--driver-text-muted))] text-center py-6">
              ✓ Όλες οι οφειλές έχουν εκκαθαριστεί.
            </p>
          ) : (
            unsettled.map(d => (
              <div key={d.id} className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-[hsl(var(--driver-surface))]">
                <div className="h-9 w-9 rounded-xl flex items-center justify-center bg-amber-500/15">
                  <Banknote className="h-4 w-4 text-amber-500" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-[hsl(var(--driver-text))] truncate">
                    Σε αναμονή παράδοσης
                  </p>
                  <p className="text-[10px] text-[hsl(var(--driver-text-muted))]">
                    {new Date(d.created_at).toLocaleDateString('el-GR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
                <span className="font-heading font-bold text-sm tabular-nums text-[hsl(var(--driver-text))]">
                  €{Number(d.amount_owed).toFixed(2)}
                </span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
