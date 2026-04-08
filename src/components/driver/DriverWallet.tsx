import { useState } from 'react';
import { Wallet, ArrowDownCircle, ArrowUpCircle, Clock, Banknote, TrendingUp } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
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
      toast({ title: 'Επιτυχία!', description: 'Το αίτημα ανάληψης υποβλήθηκε' });
    }
  };

  if (loading) {
    return (
      <div className="text-center py-12">
        <div className="h-8 w-8 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-3" />
        <p className="text-muted-foreground font-heading">Φόρτωση πορτοφολιού...</p>
      </div>
    );
  }

  const balance = wallet?.available_balance ?? 0;
  const pending = wallet?.pending_balance ?? 0;
  const withdrawn = wallet?.total_withdrawn ?? 0;

  return (
    <div className="space-y-4">
      {/* Main Balance Card */}
      <Card className="gradient-primary text-primary-foreground shadow-primary overflow-hidden">
        <CardContent className="p-6">
          <div className="flex items-center gap-2 mb-1">
            <Wallet className="h-5 w-5 text-primary-foreground/80" />
            <span className="text-primary-foreground/80 text-sm font-heading">Διαθέσιμο Υπόλοιπο</span>
          </div>
          <p className="font-heading font-bold text-4xl">{balance.toFixed(2)}€</p>
          <div className="flex items-center gap-4 mt-3 text-sm text-primary-foreground/70">
            <span className="flex items-center gap-1">
              <Clock className="h-3.5 w-3.5" /> Σε αναμονή: {pending.toFixed(2)}€
            </span>
            <span className="flex items-center gap-1">
              <TrendingUp className="h-3.5 w-3.5" /> Συνολικά: {withdrawn.toFixed(2)}€
            </span>
          </div>
          <Button
            onClick={handleCashOut}
            disabled={balance <= 0 || cashingOut}
            className="w-full mt-4 h-12 text-lg font-heading bg-white/20 hover:bg-white/30 text-primary-foreground border-0"
          >
            <Banknote className="h-5 w-5 mr-2" />
            {cashingOut ? 'Επεξεργασία...' : `Ανάληψη ${balance.toFixed(2)}€`}
          </Button>
        </CardContent>
      </Card>

      {/* Today's Stats */}
      <div className="grid grid-cols-3 gap-3">
        <Card className="shadow-[var(--shadow-sm)]">
          <CardContent className="p-3 text-center">
            <p className="text-xs text-muted-foreground">Σήμερα</p>
            <p className="font-heading font-bold text-lg text-foreground">{today.total.toFixed(2)}€</p>
          </CardContent>
        </Card>
        <Card className="shadow-[var(--shadow-sm)]">
          <CardContent className="p-3 text-center">
            <p className="text-xs text-muted-foreground">Tips</p>
            <p className="font-heading font-bold text-lg text-success">{today.tips.toFixed(2)}€</p>
          </CardContent>
        </Card>
        <Card className="shadow-[var(--shadow-sm)]">
          <CardContent className="p-3 text-center">
            <p className="text-xs text-muted-foreground">Διαδρομές</p>
            <p className="font-heading font-bold text-lg text-foreground">{today.trips}</p>
          </CardContent>
        </Card>
      </div>

      {/* Transaction History */}
      <Card className="shadow-[var(--shadow-md)]">
        <CardHeader className="pb-2">
          <CardTitle className="font-heading text-lg">Ιστορικό Συναλλαγών</CardTitle>
        </CardHeader>
        <CardContent className="space-y-1">
          {transactions.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">Δεν υπάρχουν συναλλαγές ακόμα</p>
          ) : (
            transactions.map(tx => (
              <div key={tx.id} className="flex items-center gap-3 py-2.5 border-b border-border last:border-0">
                <div className={`h-8 w-8 rounded-full flex items-center justify-center ${
                  tx.type === 'earning_credit' ? 'bg-success/10' : 'bg-primary/10'
                }`}>
                  {tx.type === 'earning_credit' ? (
                    <ArrowDownCircle className="h-4 w-4 text-success" />
                  ) : (
                    <ArrowUpCircle className="h-4 w-4 text-primary" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">
                    {tx.type === 'earning_credit' ? 'Κέρδος παράδοσης' : 'Αίτημα ανάληψης'}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {new Date(tx.created_at).toLocaleDateString('el-GR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                    {tx.status === 'pending' && ' • Σε αναμονή'}
                  </p>
                </div>
                <span className={`font-heading font-bold text-sm ${
                  tx.type === 'earning_credit' ? 'text-success' : 'text-foreground'
                }`}>
                  {tx.type === 'earning_credit' ? '+' : '-'}{Number(tx.amount).toFixed(2)}€
                </span>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
