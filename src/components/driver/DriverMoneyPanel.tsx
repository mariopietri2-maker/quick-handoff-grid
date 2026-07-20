import { ArrowDownCircle, ArrowUpCircle, Banknote, Wallet } from 'lucide-react';
import { useDriverWallet } from '@/hooks/useDriverWallet';
import { useEarnings } from '@/hooks/useEarnings';
import CashTracker from './CashTracker';

/** Compact money tab: balance, today, cash shift — no nested dashboards. */
export function DriverMoneyPanel() {
  const { wallet, transactions, loading } = useDriverWallet();
  const { today } = useEarnings();

  if (loading) {
    return (
      <div className="text-center py-12">
        <div className="h-8 w-8 border-4 border-[hsl(var(--driver-accent))] border-t-transparent rounded-full animate-spin mx-auto mb-3" />
        <p className="text-[hsl(var(--driver-text-muted))] font-heading text-sm">Φόρτωση...</p>
      </div>
    );
  }

  const balance = Number(wallet?.available_balance ?? 0);
  const pending = Number(wallet?.pending_balance ?? 0);
  const recent = transactions.slice(0, 8);

  return (
    <div className="space-y-4">
      <div className="rounded-2xl driver-gradient-earn p-5">
        <div className="flex items-center gap-2 mb-1">
          <Wallet className="h-4 w-4 text-white/70" />
          <span className="text-white/70 text-[10px] font-heading uppercase tracking-[0.12em]">Διαθέσιμα</span>
        </div>
        <p className="font-heading font-extrabold text-4xl text-white tabular-nums">{balance.toFixed(2)}€</p>
        <div className="mt-3 grid grid-cols-2 gap-2">
          <div className="rounded-xl bg-white/10 px-3 py-2">
            <p className="text-[10px] text-white/60 font-heading uppercase">Σήμερα</p>
            <p className="font-heading font-bold text-white tabular-nums text-lg">{today.total.toFixed(2)}€</p>
            <p className="text-[10px] text-white/50">{today.trips} παραδόσεις</p>
          </div>
          <div className="rounded-xl bg-white/10 px-3 py-2">
            <p className="text-[10px] text-white/60 font-heading uppercase">Εκκρεμές</p>
            <p className="font-heading font-bold text-white tabular-nums text-lg">{pending.toFixed(2)}€</p>
            <p className="text-[10px] text-white/50">προς πίστωση</p>
          </div>
        </div>
      </div>

      <CashTracker />

      <div className="rounded-2xl driver-glass overflow-hidden">
        <div className="px-4 py-3 border-b border-[hsl(var(--driver-border))] flex items-center gap-2">
          <Banknote className="h-4 w-4 text-[hsl(var(--driver-text-muted))]" />
          <p className="font-heading font-bold text-sm text-[hsl(var(--driver-text))]">Τελευταίες κινήσεις</p>
        </div>
        <div className="divide-y divide-[hsl(var(--driver-border))]">
          {recent.length === 0 ? (
            <p className="text-sm text-[hsl(var(--driver-text-muted))] text-center py-8">Καμία κίνηση ακόμα</p>
          ) : (
            recent.map((tx) => (
              <div key={tx.id} className="flex items-center gap-3 px-4 py-3">
                <div className={`h-9 w-9 rounded-xl flex items-center justify-center ${
                  tx.type === 'earning_credit' ? 'bg-[hsl(var(--driver-accent))]/15' : 'bg-[hsl(var(--driver-surface))]'
                }`}>
                  {tx.type === 'earning_credit' ? (
                    <ArrowDownCircle className="h-4 w-4 text-[hsl(var(--driver-accent))]" />
                  ) : (
                    <ArrowUpCircle className="h-4 w-4 text-[hsl(var(--driver-text-muted))]" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-[hsl(var(--driver-text))] truncate">
                    {tx.type === 'earning_credit' ? 'Κέρδος παράδοσης' : 'Ανάληψη'}
                  </p>
                  <p className="text-[10px] text-[hsl(var(--driver-text-muted))]">
                    {new Date(tx.created_at).toLocaleDateString('el-GR', {
                      day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
                    })}
                  </p>
                </div>
                <span className={`font-heading font-bold text-sm tabular-nums ${
                  tx.type === 'earning_credit' ? 'text-[hsl(var(--driver-accent))]' : 'text-[hsl(var(--driver-text-muted))]'
                }`}>
                  {tx.type === 'earning_credit' ? '+' : '-'}{Number(tx.amount).toFixed(2)}€
                </span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
