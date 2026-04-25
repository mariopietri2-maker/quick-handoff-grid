import { useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Banknote, Building2, Shield, TrendingUp, CheckCircle2, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';

const fmt = (n: number | null | undefined) => `€${Number(n ?? 0).toFixed(2)}`;

export default function MoneyBagsPanel() {
  const qc = useQueryClient();

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

  const { data: storeWallets } = useQuery({
    queryKey: ['admin-store-wallets'],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('store_wallets')
        .select('store_id, available_balance, lifetime_earnings, stores!inner(name)')
        .order('available_balance', { ascending: false });
      if (error) throw error;
      return (data ?? []) as Array<{ store_id: string; available_balance: number; lifetime_earnings: number; stores: { name: string } }>;
    },
  });

  const { data: cashDebts } = useQuery({
    queryKey: ['admin-cash-debts'],
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

  const { data: driverWallets } = useQuery({
    queryKey: ['admin-driver-wallets-summary'],
    queryFn: async () => {
      const { data, error } = await supabase.from('driver_wallets').select('available_balance, pending_balance');
      if (error) throw error;
      return (data ?? []) as Array<{ available_balance: number; pending_balance: number }>;
    },
  });

  // Realtime refresh
  useEffect(() => {
    const ch = supabase
      .channel('money-bags')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'admin_treasury' }, () => qc.invalidateQueries({ queryKey: ['admin-treasury'] }))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'store_wallets' }, () => qc.invalidateQueries({ queryKey: ['admin-store-wallets'] }))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'driver_cash_debts' }, () => qc.invalidateQueries({ queryKey: ['admin-cash-debts'] }))
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [qc]);

  const driverTotal = (driverWallets ?? []).reduce((sum, w) => sum + Number(w.available_balance) + Number(w.pending_balance), 0);
  const storeTotal = (storeWallets ?? []).reduce((sum, w) => sum + Number(w.available_balance), 0);
  const adminTotal = Number(treasury?.admin_balance ?? 0) + Number(treasury?.platform_pool ?? 0);

  const settleDebt = async (id: string) => {
    const { error } = await (supabase as any).rpc('admin_settle_driver_cash', { p_debt_id: id });
    if (error) toast.error(error.message);
    else {
      toast.success('Cash settled');
      qc.invalidateQueries({ queryKey: ['admin-cash-debts'] });
    }
  };

  const payoutStore = async (storeId: string, amount: number) => {
    if (amount <= 0) return;
    const { error } = await (supabase as any).rpc('admin_payout_store', {
      p_store_id: storeId, p_amount: amount, p_description: 'Manual payout',
    });
    if (error) toast.error(error.message);
    else {
      toast.success(`Paid out ${fmt(amount)}`);
      qc.invalidateQueries({ queryKey: ['admin-store-wallets'] });
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-heading font-bold">💰 Money Bags</h2>
        <p className="text-sm text-muted-foreground">Driver fair pay · Store 85% · Admin 5% + platform 10% pool</p>
      </div>

      {/* Three Money Bags */}
      <div className="grid gap-4 md:grid-cols-3">
        {/* DRIVERS BAG */}
        <Card className="border-l-4 border-l-blue-500">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-heading text-muted-foreground uppercase tracking-wider">Drivers Bag</CardTitle>
              <Banknote className="h-5 w-5 text-blue-500" />
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-heading font-extrabold tabular-nums">{fmt(driverTotal)}</p>
            <p className="text-xs text-muted-foreground mt-1">Total owed to drivers (available + pending)</p>
            <div className="mt-3 text-xs text-blue-600 dark:text-blue-400 font-medium">
              ⚖ Always paid fair (min pay guaranteed)
            </div>
          </CardContent>
        </Card>

        {/* STORES BAG */}
        <Card className="border-l-4 border-l-emerald-500">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-heading text-muted-foreground uppercase tracking-wider">Stores Bag</CardTitle>
              <Building2 className="h-5 w-5 text-emerald-500" />
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-heading font-extrabold tabular-nums">{fmt(storeTotal)}</p>
            <p className="text-xs text-muted-foreground mt-1">Total owed to {storeWallets?.length ?? 0} stores (85% of orders)</p>
            <div className="mt-3 text-xs text-emerald-600 dark:text-emerald-400 font-medium">
              − 15% platform commission
            </div>
          </CardContent>
        </Card>

        {/* ADMIN BAG */}
        <Card className="border-l-4 border-l-amber-500">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-heading text-muted-foreground uppercase tracking-wider">Admin Treasury</CardTitle>
              <Shield className="h-5 w-5 text-amber-500" />
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-heading font-extrabold tabular-nums">{fmt(adminTotal)}</p>
            <div className="mt-2 space-y-1 text-xs">
              <div className="flex justify-between"><span className="text-muted-foreground">Admin (5%)</span><span className="font-medium tabular-nums">{fmt(treasury?.admin_balance)}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Platform pool (10%)</span><span className="font-medium tabular-nums">{fmt(treasury?.platform_pool)}</span></div>
              <div className="flex justify-between text-blue-600 dark:text-blue-400"><span>↳ Driver top-ups</span><span className="font-medium tabular-nums">{fmt(treasury?.lifetime_driver_topup)}</span></div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Lifetime stats */}
      <Card>
        <CardHeader><CardTitle className="text-base flex items-center gap-2"><TrendingUp className="h-4 w-4" /> Lifetime Platform Earnings</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-3 gap-4 text-center">
          <div>
            <p className="text-xs text-muted-foreground">Admin earned</p>
            <p className="text-xl font-heading font-bold tabular-nums">{fmt(treasury?.lifetime_admin_earned)}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Platform earned (net)</p>
            <p className="text-xl font-heading font-bold tabular-nums">{fmt(treasury?.lifetime_platform_earned)}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Driver top-ups paid</p>
            <p className="text-xl font-heading font-bold tabular-nums text-blue-600">{fmt(treasury?.lifetime_driver_topup)}</p>
          </div>
        </CardContent>
      </Card>

      {/* Cash debts to settle */}
      {cashDebts && cashDebts.length > 0 && (
        <Card className="border-amber-500/40">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2 text-amber-600 dark:text-amber-400">
              <AlertCircle className="h-4 w-4" /> Pending Cash Settlements ({cashDebts.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Driver</TableHead>
                  <TableHead className="text-right">Cash</TableHead>
                  <TableHead className="text-right">Owed</TableHead>
                  <TableHead className="text-right">Store</TableHead>
                  <TableHead className="text-right">Admin</TableHead>
                  <TableHead className="text-right">Platform</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {cashDebts.map((d) => (
                  <TableRow key={d.id}>
                    <TableCell className="font-mono text-xs">{d.driver_id.slice(0, 8)}…</TableCell>
                    <TableCell className="text-right tabular-nums">{fmt(d.cash_collected)}</TableCell>
                    <TableCell className="text-right tabular-nums font-bold">{fmt(d.amount_owed)}</TableCell>
                    <TableCell className="text-right tabular-nums text-emerald-600">{fmt(d.store_share)}</TableCell>
                    <TableCell className="text-right tabular-nums text-amber-600">{fmt(d.admin_share)}</TableCell>
                    <TableCell className="text-right tabular-nums">{fmt(d.platform_share)}</TableCell>
                    <TableCell>
                      <Button size="sm" onClick={() => settleDebt(d.id)} className="gap-1">
                        <CheckCircle2 className="h-3 w-3" /> Settle
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Store wallets list */}
      <Card>
        <CardHeader><CardTitle className="text-base">Store Wallets</CardTitle></CardHeader>
        <CardContent>
          {storeWallets && storeWallets.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Store</TableHead>
                  <TableHead className="text-right">Available</TableHead>
                  <TableHead className="text-right">Lifetime</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {storeWallets.map((w) => (
                  <TableRow key={w.store_id}>
                    <TableCell className="font-medium">{w.stores?.name ?? w.store_id.slice(0, 8)}</TableCell>
                    <TableCell className="text-right tabular-nums font-bold text-emerald-600">{fmt(w.available_balance)}</TableCell>
                    <TableCell className="text-right tabular-nums text-muted-foreground">{fmt(w.lifetime_earnings)}</TableCell>
                    <TableCell className="text-right">
                      <Button size="sm" variant="outline" disabled={w.available_balance <= 0}
                        onClick={() => payoutStore(w.store_id, Number(w.available_balance))}>
                        Payout all
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-6">No store wallets yet — they'll appear after the first delivered order.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
