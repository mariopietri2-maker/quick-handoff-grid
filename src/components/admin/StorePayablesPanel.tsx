import { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Wallet, Search, RotateCcw, AlertTriangle, Loader2, FileDown, TrendingUp } from 'lucide-react';

/**
 * Per-store payables overview.
 * - Shows what admin owes each store (positive available_balance) or what each store owes admin (negative).
 * - Per-row "Reset to 0" via admin_reset_store_wallet RPC.
 * - Bulk "Reset all" via admin_reset_all_store_wallets RPC.
 * - CSV export of the current snapshot.
 */
export default function StorePayablesPanel() {
  const qc = useQueryClient();
  const [q, setQ] = useState('');
  const [resetTarget, setResetTarget] = useState<{ id: string; name: string; amount: number } | null>(null);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['admin-store-payables'],
    queryFn: async () => {
      const [{ data: stores, error: e1 }, { data: wallets, error: e2 }] = await Promise.all([
        supabase.from('stores').select('id, name, owner_id, is_active'),
        (supabase as any).from('store_wallets').select('store_id, available_balance, lifetime_earnings, updated_at'),
      ]);
      if (e1) throw e1;
      if (e2) throw e2;
      const wmap = new Map((wallets ?? []).map((w: any) => [w.store_id, w]));
      return (stores ?? []).map((s: any) => {
        const w: any = wmap.get(s.id);
        return {
          id: s.id,
          name: s.name as string,
          is_active: s.is_active as boolean | null,
          available: Number(w?.available_balance ?? 0),
          lifetime: Number(w?.lifetime_earnings ?? 0),
          updated_at: w?.updated_at as string | undefined,
        };
      });
    },
  });

  const filtered = useMemo(() => {
    const rows = data ?? [];
    const needle = q.trim().toLowerCase();
    const f = needle ? rows.filter(r => r.name.toLowerCase().includes(needle)) : rows;
    return [...f].sort((a, b) => b.available - a.available);
  }, [data, q]);

  const totals = useMemo(() => {
    const rows = data ?? [];
    const owe = rows.filter(r => r.available > 0).reduce((s, r) => s + r.available, 0);
    const owed = rows.filter(r => r.available < 0).reduce((s, r) => s + Math.abs(r.available), 0);
    const stores = rows.length;
    const withBalance = rows.filter(r => r.available !== 0).length;
    return { owe, owed, stores, withBalance };
  }, [data]);

  const exportCsv = () => {
    const rows = filtered;
    const header = ['Κατάστημα', 'Υπόλοιπο (€)', 'Κατάσταση', 'Lifetime (€)', 'Τελευταία ενημέρωση'];
    const csv = [
      header.join(','),
      ...rows.map(r => [
        `"${r.name.replace(/"/g, '""')}"`,
        r.available.toFixed(2),
        r.available > 0 ? 'Admin χρωστάει' : r.available < 0 ? 'Κατάστημα χρωστάει' : 'Μηδέν',
        r.lifetime.toFixed(2),
        r.updated_at ? format(new Date(r.updated_at), 'dd/MM/yyyy HH:mm') : '-',
      ].join(',')),
    ].join('\n');
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `store-payables-${format(new Date(), 'yyyy-MM-dd_HHmm')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('CSV κατέβηκε');
  };

  const doReset = async () => {
    if (!resetTarget) return;
    setBusy(resetTarget.id);
    try {
      const { error } = await (supabase.rpc as any)('admin_reset_store_wallet', { p_store_id: resetTarget.id });
      if (error) throw error;
      toast.success(`Μηδενίστηκε: ${resetTarget.name}`);
      setResetTarget(null);
      qc.invalidateQueries({ queryKey: ['admin-store-payables'] });
    } catch (e: any) {
      toast.error(e?.message ?? 'Αποτυχία');
    } finally {
      setBusy(null);
    }
  };

  const doBulkReset = async () => {
    setBusy('bulk');
    try {
      const { error } = await (supabase.rpc as any)('admin_reset_all_store_wallets');
      if (error) throw error;
      toast.success('Όλα τα πορτοφόλια καταστημάτων μηδενίστηκαν');
      setBulkOpen(false);
      qc.invalidateQueries({ queryKey: ['admin-store-payables'] });
    } catch (e: any) {
      toast.error(e?.message ?? 'Αποτυχία');
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="space-y-4">
      <div className="admin-section-header">
        <div>
          <h2 className="admin-section-title">Πληρωμές προς Καταστήματα</h2>
          <p className="admin-section-sub mt-0.5">
            Πόσα χρωστάει ο admin σε κάθε κατάστημα (in-app · 85%) — με δυνατότητα μηδενισμού μετά την πληρωμή.
          </p>
        </div>
        <div className="flex items-center gap-1.5">
          <Button size="sm" variant="outline" className="h-8" onClick={exportCsv}>
            <FileDown className="h-3.5 w-3.5 mr-1.5" /> CSV
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="h-8 border-destructive/60 text-destructive hover:bg-destructive/10 hover:text-destructive"
            onClick={() => setBulkOpen(true)}
          >
            <RotateCcw className="h-3.5 w-3.5 mr-1.5" /> Μηδενισμός όλων
          </Button>
        </div>
      </div>

      {/* Summary tiles */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="border-l-4 border-l-emerald-500">
          <CardContent className="p-3.5 flex items-center gap-3">
            <div className="h-9 w-9 rounded-md bg-emerald-500/10 flex items-center justify-center">
              <Wallet className="h-4 w-4 text-emerald-600" />
            </div>
            <div className="min-w-0">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Admin χρωστάει συνολικά</p>
              <p className="font-heading font-bold text-xl tabular-nums text-emerald-600">€{totals.owe.toFixed(2)}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-destructive">
          <CardContent className="p-3.5 flex items-center gap-3">
            <div className="h-9 w-9 rounded-md bg-destructive/10 flex items-center justify-center">
              <AlertTriangle className="h-4 w-4 text-destructive" />
            </div>
            <div className="min-w-0">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Καταστήματα χρωστούν</p>
              <p className="font-heading font-bold text-xl tabular-nums text-destructive">€{totals.owed.toFixed(2)}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3.5 flex items-center gap-3">
            <div className="h-9 w-9 rounded-md bg-muted flex items-center justify-center">
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </div>
            <div className="min-w-0">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Με ανοιχτό υπόλοιπο</p>
              <p className="font-heading font-bold text-xl tabular-nums">{totals.withBalance}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3.5 flex items-center gap-3">
            <div className="h-9 w-9 rounded-md bg-muted flex items-center justify-center">
              <Wallet className="h-4 w-4 text-muted-foreground" />
            </div>
            <div className="min-w-0">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Σύνολο καταστημάτων</p>
              <p className="font-heading font-bold text-xl tabular-nums">{totals.stores}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
        <Input
          placeholder="Αναζήτηση καταστήματος…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="pl-8 h-9 bg-muted/40 border-border/60"
        />
      </div>

      {/* Table */}
      <Card>
        <CardContent className="p-0 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Κατάστημα</TableHead>
                <TableHead className="text-right">Υπόλοιπο</TableHead>
                <TableHead>Κατάσταση</TableHead>
                <TableHead className="text-right hidden md:table-cell">Lifetime</TableHead>
                <TableHead className="hidden lg:table-cell">Ενημερώθηκε</TableHead>
                <TableHead className="text-right">Ενέργειες</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-10 text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin inline mr-2" /> Φόρτωση…
                  </TableCell>
                </TableRow>
              ) : filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-10 text-muted-foreground">
                    Δεν βρέθηκαν καταστήματα.
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((r) => {
                  const owe = r.available > 0;
                  const debt = r.available < 0;
                  const zero = r.available === 0;
                  return (
                    <TableRow key={r.id}>
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="truncate">{r.name}</span>
                          {r.is_active === false && (
                            <Badge variant="outline" className="text-[10px] h-4 px-1">Ανενεργό</Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className={`text-right font-heading font-bold tabular-nums ${
                        owe ? 'text-emerald-600' : debt ? 'text-destructive' : 'text-muted-foreground'
                      }`}>
                        €{r.available.toFixed(2)}
                      </TableCell>
                      <TableCell>
                        {owe && <Badge className="bg-emerald-500/15 text-emerald-700 border-emerald-500/30 hover:bg-emerald-500/20">Πληρωμή</Badge>}
                        {debt && <Badge variant="destructive" className="bg-destructive/15 text-destructive border-destructive/30 hover:bg-destructive/20">Οφειλή</Badge>}
                        {zero && <Badge variant="outline" className="text-muted-foreground">—</Badge>}
                      </TableCell>
                      <TableCell className="text-right tabular-nums hidden md:table-cell">€{r.lifetime.toFixed(2)}</TableCell>
                      <TableCell className="text-xs text-muted-foreground hidden lg:table-cell">
                        {r.updated_at ? format(new Date(r.updated_at), 'dd MMM, HH:mm') : '—'}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={zero || busy === r.id}
                          className="h-8"
                          onClick={() => setResetTarget({ id: r.id, name: r.name, amount: r.available })}
                        >
                          {busy === r.id ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <RotateCcw className="h-3 w-3 mr-1" />}
                          Reset 0
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Per-store reset confirm */}
      <AlertDialog open={!!resetTarget} onOpenChange={(v) => !v && setResetTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-warning" />
              Μηδενισμός υπολοίπου
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2 text-sm">
                <p>
                  Θα μηδενιστεί το υπόλοιπο του <strong>{resetTarget?.name}</strong>{' '}
                  (<span className={resetTarget && resetTarget.amount >= 0 ? 'text-emerald-600' : 'text-destructive'}>
                    €{resetTarget?.amount.toFixed(2)}
                  </span>).
                </p>
                <p className="text-muted-foreground">
                  Χρήση μετά από εξωτερική πληρωμή/συμψηφισμό. Lifetime totals διατηρούνται.
                </p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={!!busy}>Άκυρο</AlertDialogCancel>
            <AlertDialogAction onClick={doReset} disabled={!!busy}>
              {busy === resetTarget?.id && <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />}
              Μηδενισμός
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Bulk reset confirm */}
      <AlertDialog open={bulkOpen} onOpenChange={setBulkOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              Μηδενισμός ΟΛΩΝ των πορτοφολιών
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2 text-sm">
                <p>Θα μηδενιστεί το <strong>available balance</strong> κάθε καταστήματος.</p>
                <p className="text-warning">Χρησιμοποίησέ το μόνο μετά από batch payout. Lifetime totals διατηρούνται.</p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={!!busy}>Άκυρο</AlertDialogCancel>
            <AlertDialogAction
              onClick={doBulkReset}
              disabled={!!busy}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {busy === 'bulk' && <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />}
              Μηδενισμός όλων
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
