import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Wallet, TrendingUp, ArrowDownCircle, CheckCircle } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import MoneyBagsPanel from './MoneyBagsPanel';
import MonthCloseCard from './MonthCloseCard';
import CustomOrderDialog from './CustomOrderDialog';

export default function FinancialsManager() {
  const queryClient = useQueryClient();

  const { data: wallets } = useQuery({
    queryKey: ['admin-wallets'],
    queryFn: async () => {
      const { data, error } = await supabase.from('driver_wallets').select('*').order('updated_at', { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const { data: transactions } = useQuery({
    queryKey: ['admin-transactions'],
    queryFn: async () => {
      const { data, error } = await supabase.from('wallet_transactions').select('*').order('created_at', { ascending: false }).limit(100);
      if (error) throw error;
      return data;
    },
  });

  const { data: earnings } = useQuery({
    queryKey: ['admin-earnings'],
    queryFn: async () => {
      const { data, error } = await supabase.from('earnings').select('*').order('created_at', { ascending: false }).limit(200);
      if (error) throw error;
      return data;
    },
  });

  const { data: profiles } = useQuery({
    queryKey: ['admin-profiles'],
    queryFn: async () => {
      const { data, error } = await supabase.from('profiles').select('*');
      if (error) throw error;
      return data;
    },
  });

  const getName = (driverId: string) => {
    const p = profiles?.find((pr) => pr.user_id === driverId);
    return p?.full_name || driverId.slice(0, 8);
  };

  const pendingWithdrawals = transactions?.filter((t) => t.type === 'withdrawal_request' && t.status === 'pending') ?? [];
  const totalAvailable = wallets?.reduce((s, w) => s + Number(w.available_balance), 0) ?? 0;
  const totalPending = wallets?.reduce((s, w) => s + Number(w.pending_balance), 0) ?? 0;
  const totalEarnings = earnings?.reduce((s, e) => s + Number(e.total ?? 0), 0) ?? 0;

  const handleApproveWithdrawal = async (txId: string, driverId: string, amount: number) => {
    const { error } = await supabase.from('wallet_transactions').update({ status: 'completed' }).eq('id', txId);
    if (error) {
      toast.error('Αποτυχία');
      return;
    }
    await supabase.from('driver_wallets').update({
      pending_balance: 0,
      total_withdrawn: wallets?.find((w) => w.driver_id === driverId)
        ? Number(wallets.find((w) => w.driver_id === driverId)!.total_withdrawn) + amount
        : amount,
    } as any).eq('driver_id', driverId);
    toast.success('Ανάληψη εγκρίθηκε');
    queryClient.invalidateQueries({ queryKey: ['admin-wallets'] });
    queryClient.invalidateQueries({ queryKey: ['admin-transactions'] });
  };

  const handleRejectWithdrawal = async (txId: string, driverId: string, amount: number) => {
    const { error } = await supabase.from('wallet_transactions').update({ status: 'rejected' }).eq('id', txId);
    if (error) {
      toast.error('Αποτυχία');
      return;
    }
    await supabase.from('driver_wallets').update({
      available_balance: Number(wallets?.find((w) => w.driver_id === driverId)?.available_balance ?? 0) + amount,
      pending_balance: Math.max(0, Number(wallets?.find((w) => w.driver_id === driverId)?.pending_balance ?? 0) - amount),
    } as any).eq('driver_id', driverId);
    toast.success('Ανάληψη απορρίφθηκε — ποσό επεστράφη');
    queryClient.invalidateQueries({ queryKey: ['admin-wallets'] });
    queryClient.invalidateQueries({ queryKey: ['admin-transactions'] });
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        <CustomOrderDialog />
      </div>
      <MoneyBagsPanel />
      <MonthCloseCard />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <TrendingUp className="h-8 w-8 text-green-500" />
            <div>
              <p className="text-xs text-muted-foreground">Συνολικά Κέρδη</p>
              <p className="font-heading font-bold text-xl">€{totalEarnings.toFixed(2)}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <Wallet className="h-8 w-8 text-blue-500" />
            <div>
              <p className="text-xs text-muted-foreground">Διαθέσιμα</p>
              <p className="font-heading font-bold text-xl">€{totalAvailable.toFixed(2)}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <ArrowDownCircle className="h-8 w-8 text-yellow-500" />
            <div>
              <p className="text-xs text-muted-foreground">Εκκρεμείς Αναλήψεις</p>
              <p className="font-heading font-bold text-xl">€{totalPending.toFixed(2)}</p>
            </div>
          </CardContent>
        </Card>
        <Card className={pendingWithdrawals.length > 0 ? 'border-yellow-500/40 animate-pulse' : ''}>
          <CardContent className="p-4 flex items-center gap-3">
            <CheckCircle className="h-8 w-8 text-orange-500" />
            <div>
              <p className="text-xs text-muted-foreground">Αιτήματα Ανάληψης</p>
              <p className="font-heading font-bold text-xl">{pendingWithdrawals.length}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="withdrawals">
        <TabsList>
          <TabsTrigger value="withdrawals">Αιτήματα Ανάληψης {pendingWithdrawals.length > 0 && <Badge className="ml-1 bg-yellow-500/20 text-yellow-600">{pendingWithdrawals.length}</Badge>}</TabsTrigger>
          <TabsTrigger value="wallets">Πορτοφόλια Οδηγών</TabsTrigger>
          <TabsTrigger value="earnings">Κέρδη</TabsTrigger>
        </TabsList>

        <TabsContent value="withdrawals" className="mt-4">
          <Card>
            <CardHeader><CardTitle className="font-heading">Εκκρεμή Αιτήματα Ανάληψης</CardTitle></CardHeader>
            <CardContent className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Οδηγός</TableHead>
                    <TableHead>Ποσό</TableHead>
                    <TableHead>Ημερομηνία</TableHead>
                    <TableHead>Ενέργειες</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pendingWithdrawals.map((tx) => (
                    <TableRow key={tx.id}>
                      <TableCell className="font-semibold">{getName(tx.driver_id)}</TableCell>
                      <TableCell className="font-bold text-lg">€{Number(tx.amount).toFixed(2)}</TableCell>
                      <TableCell className="text-xs">{format(new Date(tx.created_at), 'dd MMM, HH:mm')}</TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          <Button size="sm" className="h-8" onClick={() => handleApproveWithdrawal(tx.id, tx.driver_id, Number(tx.amount))}>
                            <CheckCircle className="h-3 w-3 mr-1" />Έγκριση
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
          </Card>
        </TabsContent>

        <TabsContent value="wallets" className="mt-4">
          <Card>
            <CardHeader><CardTitle className="font-heading">Πορτοφόλια Οδηγών</CardTitle></CardHeader>
            <CardContent className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Οδηγός</TableHead>
                    <TableHead>Διαθέσιμο</TableHead>
                    <TableHead>Εκκρεμές</TableHead>
                    <TableHead>Αναληφθέντα</TableHead>
                    <TableHead>Τελ. Ενημέρωση</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {wallets?.map((w) => (
                    <TableRow key={w.id}>
                      <TableCell className="font-semibold">{getName(w.driver_id)}</TableCell>
                      <TableCell className="font-bold text-green-600">€{Number(w.available_balance).toFixed(2)}</TableCell>
                      <TableCell className="text-yellow-600">€{Number(w.pending_balance).toFixed(2)}</TableCell>
                      <TableCell>€{Number(w.total_withdrawn).toFixed(2)}</TableCell>
                      <TableCell className="text-xs">{format(new Date(w.updated_at), 'dd MMM, HH:mm')}</TableCell>
                    </TableRow>
                  ))}
                  {!wallets?.length && (
                    <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">Κανένα πορτοφόλι</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="earnings" className="mt-4">
          <Card>
            <CardHeader><CardTitle className="font-heading">Πρόσφατα Κέρδη</CardTitle></CardHeader>
            <CardContent className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Οδηγός</TableHead>
                    <TableHead>Βάση</TableHead>
                    <TableHead>Tips</TableHead>
                    <TableHead>Bonus</TableHead>
                    <TableHead>Σύνολο</TableHead>
                    <TableHead>Ημερομηνία</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {earnings?.map((e) => (
                    <TableRow key={e.id}>
                      <TableCell className="font-semibold">{getName(e.driver_id)}</TableCell>
                      <TableCell>€{Number(e.base_pay).toFixed(2)}</TableCell>
                      <TableCell className="text-blue-600">€{Number(e.tip ?? 0).toFixed(2)}</TableCell>
                      <TableCell className="text-yellow-600">€{Number(e.bonus ?? 0).toFixed(2)}</TableCell>
                      <TableCell className="font-bold">€{Number(e.total ?? 0).toFixed(2)}</TableCell>
                      <TableCell className="text-xs">{format(new Date(e.created_at), 'dd MMM, HH:mm')}</TableCell>
                    </TableRow>
                  ))}
                  {!earnings?.length && (
                    <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">Κανένα κέρδος</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
