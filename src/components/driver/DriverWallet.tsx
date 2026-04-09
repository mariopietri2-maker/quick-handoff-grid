import { Wallet, ArrowDownCircle, ArrowUpCircle, Clock, Banknote, TrendingUp } from 'lucide-react';
import { useDriverWallet } from '@/hooks/useDriverWallet';
import { useEarnings } from '@/hooks/useEarnings';
import { toast } from '@/hooks/use-toast';

export function DriverWallet() {
  const { wallet, transactions, loading, cashOut, cashingOut } = useDriverWallet();
  const { today, week } = useEarnings();

  const handleCashOut = async () => {
    if (!wallet || wallet.available_balance <= 0) return;
    const { error } = await cashOut(wallet.available_balance);
    if (error) {
      toast({ title: 'Σφάλμα', description: error, variant: 'destructive' });
    } else {
      toast({ title: 'Επιτυχία!', description: 'Αίτημα ανάληψης υποβλήθηκε' });
    }
  };

  if (loading) {
    return (
      <div className="text-center py-16">
        <div className="h-8 w-8 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-3" />
        <p className="text-muted-foreground font-heading text-sm">Φόρτωση...</p>
      </div>
    );
  }

  const balance = wallet?.available_balance ?? 0;
  const pending = wallet?.pending_balance ?? 0;
  const withdrawn = wallet?.total_withdrawn ?? 0;

  return (
    <div className="space-y-4">
      {/* Balance card — DoorDash red card style */}
      <div className="rounded-2xl bg-primary text-primary-foreground p-6 shadow-lg">
        <div className="flex items-center gap-2 mb-1">
          <Wallet className="h-4 w-4 text-primary-foreground/70" />
          <span className="text-primary-foreground/70 text-xs font-heading uppercase tracking-wider">Διαθέσιμο Υπόλοιπο</span>
        </div>
        <p className="font-heading font-extrabold text-4xl">{balance.toFixed(2)}€</p>
        <div className="flex items-center gap-4 mt-2 text-xs text-primary-foreground/60">
          <span className="flex items-center gap-1"><Clock className="h-3 w-3" />Εκκρεμές: {pending.toFixed(2)}€</span>
          <span className="flex items-center gap-1"><TrendingUp className="h-3 w-3" />Αναληφθέντα: {withdrawn.toFixed(2)}€</span>
        </div>
        <button
          onClick={handleCashOut}
          disabled={balance <= 0 || cashingOut}
          className="w-full mt-4 h-11 rounded-xl text-sm font-heading font-bold bg-primary-foreground text-primary hover:bg-primary-foreground/90 transition-colors disabled:opacity-40 flex items-center justify-center gap-2"
        >
          <Banknote className="h-4 w-4" />
          {cashingOut ? 'Επεξεργασία...' : `Ανάληψη ${balance.toFixed(2)}€`}
        </button>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-3 gap-2">
        {[
          { label: 'Σήμερα', value: `${today.total.toFixed(2)}€` },
          { label: 'Εβδομάδα', value: `${week.total.toFixed(2)}€` },
          { label: 'Διαδρομές', value: `${today.trips}` },
        ].map(stat => (
          <div key={stat.label} className="rounded-xl bg-card border border-border p-3 text-center shadow-sm">
            <p className="text-[10px] text-muted-foreground font-heading uppercase tracking-wider">{stat.label}</p>
            <p className="font-heading font-bold text-lg text-foreground">{stat.value}</p>
          </div>
        ))}
      </div>

      {/* Transaction history */}
      <div className="rounded-2xl bg-card border border-border overflow-hidden shadow-sm">
        <div className="px-4 py-3 border-b border-border">
          <p className="font-heading font-bold text-sm text-foreground">Ιστορικό Συναλλαγών</p>
        </div>
        <div className="divide-y divide-border">
          {transactions.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">Δεν υπάρχουν συναλλαγές</p>
          ) : (
            transactions.map(tx => (
              <div key={tx.id} className="flex items-center gap-3 px-4 py-3">
                <div className={`h-9 w-9 rounded-full flex items-center justify-center ${
                  tx.type === 'earning_credit' ? 'bg-primary/10' : 'bg-muted'
                }`}>
                  {tx.type === 'earning_credit' ? (
                    <ArrowDownCircle className="h-4 w-4 text-primary" />
                  ) : (
                    <ArrowUpCircle className="h-4 w-4 text-muted-foreground" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">
                    {tx.type === 'earning_credit' ? 'Κέρδος παράδοσης' : 'Ανάληψη'}
                  </p>
                  <p className="text-[10px] text-muted-foreground">
                    {new Date(tx.created_at).toLocaleDateString('el-GR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                    {tx.status === 'pending' && ' • Εκκρεμεί'}
                  </p>
                </div>
                <span className={`font-heading font-bold text-sm ${
                  tx.type === 'earning_credit' ? 'text-primary' : 'text-muted-foreground'
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
