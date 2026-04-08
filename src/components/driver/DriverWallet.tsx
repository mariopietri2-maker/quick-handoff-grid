import { Wallet, ArrowDownCircle, ArrowUpCircle, Clock, Banknote, TrendingUp } from 'lucide-react';
import { useDriverWallet } from '@/hooks/useDriverWallet';
import { useEarnings } from '@/hooks/useEarnings';
import { toast } from '@/hooks/use-toast';

export function DriverWallet() {
  const { wallet, transactions, loading, cashOut, cashingOut } = useDriverWallet();
  const { today } = useEarnings();

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
        <div className="h-8 w-8 border-3 border-[hsl(145,65%,42%)] border-t-transparent rounded-full animate-spin mx-auto mb-3" />
        <p className="text-[hsl(220,10%,45%)] font-heading text-sm">Φόρτωση πορτοφολιού...</p>
      </div>
    );
  }

  const balance = wallet?.available_balance ?? 0;
  const pending = wallet?.pending_balance ?? 0;
  const withdrawn = wallet?.total_withdrawn ?? 0;

  return (
    <div className="space-y-3">
      {/* Balance Card */}
      <div className="rounded-2xl overflow-hidden driver-gradient-earn p-5"
        style={{ boxShadow: '0 8px 32px hsl(145 65% 42% / 0.2)' }}
      >
        <div className="flex items-center gap-2 mb-1">
          <Wallet className="h-4 w-4 text-[hsl(145,80%,90%)/0.7]" />
          <span className="text-[hsl(145,80%,90%)/0.7] text-xs font-heading uppercase tracking-wider">Διαθέσιμο</span>
        </div>
        <p className="font-heading font-extrabold text-4xl text-[hsl(0,0%,100%)]">{balance.toFixed(2)}€</p>
        <div className="flex items-center gap-4 mt-2 text-xs text-[hsl(145,80%,90%)/0.6]">
          <span className="flex items-center gap-1">
            <Clock className="h-3 w-3" /> Αναμονή: {pending.toFixed(2)}€
          </span>
          <span className="flex items-center gap-1">
            <TrendingUp className="h-3 w-3" /> Σύνολο: {withdrawn.toFixed(2)}€
          </span>
        </div>
        <button
          onClick={handleCashOut}
          disabled={balance <= 0 || cashingOut}
          className="w-full mt-4 h-11 rounded-xl text-sm font-heading font-bold bg-[hsl(0,0%,100%)/0.15] hover:bg-[hsl(0,0%,100%)/0.25] text-[hsl(0,0%,100%)] border border-[hsl(0,0%,100%)/0.1] transition-colors disabled:opacity-40 flex items-center justify-center gap-2"
        >
          <Banknote className="h-4 w-4" />
          {cashingOut ? 'Επεξεργασία...' : `Ανάληψη ${balance.toFixed(2)}€`}
        </button>
      </div>

      {/* Today stats */}
      <div className="grid grid-cols-3 gap-2">
        {[
          { label: 'Σήμερα', value: `${today.total.toFixed(2)}€`, color: 'text-[hsl(220,14%,96%)]' },
          { label: 'Tips', value: `${today.tips.toFixed(2)}€`, color: 'text-[hsl(145,65%,55%)]' },
          { label: 'Διαδρομές', value: `${today.trips}`, color: 'text-[hsl(220,14%,96%)]' },
        ].map(stat => (
          <div key={stat.label} className="rounded-xl bg-[hsl(225,20%,12%)] border border-[hsl(225,15%,20%)] p-3 text-center">
            <p className="text-[10px] text-[hsl(220,10%,45%)] font-heading uppercase tracking-wider">{stat.label}</p>
            <p className={`font-heading font-bold text-lg ${stat.color}`}>{stat.value}</p>
          </div>
        ))}
      </div>

      {/* Transactions */}
      <div className="rounded-2xl bg-[hsl(225,20%,12%)] border border-[hsl(225,15%,20%)] overflow-hidden">
        <div className="px-4 py-3 border-b border-[hsl(225,15%,20%)]">
          <p className="font-heading font-bold text-sm text-[hsl(220,14%,96%)]">Ιστορικό</p>
        </div>
        <div className="divide-y divide-[hsl(225,15%,18%)]">
          {transactions.length === 0 ? (
            <p className="text-sm text-[hsl(220,10%,40%)] text-center py-8">Δεν υπάρχουν συναλλαγές</p>
          ) : (
            transactions.map(tx => (
              <div key={tx.id} className="flex items-center gap-3 px-4 py-3">
                <div className={`h-8 w-8 rounded-lg flex items-center justify-center ${
                  tx.type === 'earning_credit' ? 'bg-[hsl(145,65%,42%)/0.1]' : 'bg-primary/10'
                }`}>
                  {tx.type === 'earning_credit' ? (
                    <ArrowDownCircle className="h-4 w-4 text-[hsl(145,65%,50%)]" />
                  ) : (
                    <ArrowUpCircle className="h-4 w-4 text-primary" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-[hsl(220,14%,90%)] truncate">
                    {tx.type === 'earning_credit' ? 'Κέρδος παράδοσης' : 'Ανάληψη'}
                  </p>
                  <p className="text-[10px] text-[hsl(220,10%,40%)]">
                    {new Date(tx.created_at).toLocaleDateString('el-GR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                    {tx.status === 'pending' && ' • Αναμονή'}
                  </p>
                </div>
                <span className={`font-heading font-bold text-sm ${
                  tx.type === 'earning_credit' ? 'text-[hsl(145,65%,55%)]' : 'text-[hsl(220,14%,80%)]'
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
