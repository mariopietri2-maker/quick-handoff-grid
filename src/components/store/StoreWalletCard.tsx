import { useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Wallet, TrendingUp, Lock, Banknote } from 'lucide-react';

interface Props {
  storeId: string;
}

export default function StoreWalletCard({ storeId }: Props) {
  const qc = useQueryClient();

  const { data: wallet } = useQuery({
    queryKey: ['store-wallet', storeId],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('store_wallets')
        .select('available_balance, lifetime_earnings, updated_at')
        .eq('store_id', storeId)
        .maybeSingle();
      if (error) throw error;
      return data as { available_balance: number; lifetime_earnings: number; updated_at: string } | null;
    },
    enabled: !!storeId,
  });

  const { data: ledger } = useQuery({
    queryKey: ['store-wallet-ledger', storeId],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('store_wallet_ledger')
        .select('*')
        .eq('store_id', storeId)
        .order('created_at', { ascending: false })
        .limit(15);
      if (error) throw error;
      return (data ?? []) as Array<{ id: string; type: string; amount: number; description: string; created_at: string }>;
    },
    enabled: !!storeId,
  });

  useEffect(() => {
    if (!storeId) return;
    const ch = supabase
      .channel(`store-wallet-${storeId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'store_wallets', filter: `store_id=eq.${storeId}` },
        () => qc.invalidateQueries({ queryKey: ['store-wallet', storeId] }))
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'store_wallet_ledger', filter: `store_id=eq.${storeId}` },
        () => qc.invalidateQueries({ queryKey: ['store-wallet-ledger', storeId] }))
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [storeId, qc]);

  const available = Number(wallet?.available_balance ?? 0);
  const lifetime = Number(wallet?.lifetime_earnings ?? 0);

  return (
    <div className="space-y-4">
      <Card className="border-l-4 border-l-emerald-500 shadow-md">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-heading text-muted-foreground uppercase tracking-wider flex items-center gap-2">
              <Wallet className="h-4 w-4" /> Πορτοφόλι Καταστήματος
            </CardTitle>
            <span className="flex items-center gap-1 text-[9px] font-heading uppercase tracking-wider text-muted-foreground bg-muted px-2 py-1 rounded-md">
              <Lock className="h-2.5 w-2.5" /> Read-only
            </span>
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-4xl font-heading font-extrabold tabular-nums text-emerald-600 dark:text-emerald-400">
            €{available.toFixed(2)}
          </p>
          <p className="text-xs text-muted-foreground mt-1">Διαθέσιμο για πληρωμή (85% από κάθε παραγγελία)</p>
          <div className="mt-3 flex items-center gap-2 text-xs">
            <TrendingUp className="h-3 w-3 text-muted-foreground" />
            <span className="text-muted-foreground">Συνολικά κέρδη: <span className="font-medium tabular-nums">€{lifetime.toFixed(2)}</span></span>
          </div>
          <p className="text-[11px] text-muted-foreground mt-3 leading-relaxed">
            Η πλατφόρμα κρατά 15% (5% admin + 10% λειτουργίας).
            Η πληρωμή γίνεται από τη διαχείριση.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm font-heading">Πρόσφατες Συναλλαγές</CardTitle></CardHeader>
        <CardContent>
          {ledger && ledger.length > 0 ? (
            <div className="divide-y divide-border">
              {ledger.map((l) => (
                <div key={l.id} className="flex items-center gap-3 py-2.5">
                  <div className={`h-8 w-8 rounded-lg flex items-center justify-center ${
                    l.amount >= 0 ? 'bg-emerald-500/10 text-emerald-500' : 'bg-muted text-muted-foreground'
                  }`}>
                    <Banknote className="h-4 w-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{l.description ?? l.type}</p>
                    <p className="text-[10px] text-muted-foreground">{new Date(l.created_at).toLocaleString('el-GR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}</p>
                  </div>
                  <span className={`font-heading font-bold text-sm tabular-nums ${l.amount >= 0 ? 'text-emerald-600' : 'text-muted-foreground'}`}>
                    {l.amount >= 0 ? '+' : ''}€{Number(l.amount).toFixed(2)}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-6">Δεν υπάρχουν συναλλαγές ακόμα.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
