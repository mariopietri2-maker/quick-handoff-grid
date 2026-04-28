import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ShoppingBag, DollarSign, Clock, TrendingUp, FileDown, Loader2, AlertTriangle } from 'lucide-react';
import { format } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { toast } from 'sonner';
import LiveOpsMap from './LiveOpsMap';

interface Props {
  orders: any[];
  stores: any[];
  profiles: any[];
  reviews: any[];
  earnings: any[];
}

export default function AdminOverview({ orders }: Props) {
  const today = new Date();
  const todayKey = format(today, 'yyyy-MM-dd');
  const todayOrders = orders.filter(o => o.created_at.slice(0, 10) === todayKey);
  const todayRevenue = todayOrders.reduce((s, o) => s + Number(o.total_amount), 0);
  const activeOrders = orders.filter(o => !['delivered', 'cancelled'].includes(o.status));

  const { data: treasury } = useQuery({
    queryKey: ['admin-treasury-overview'],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('admin_treasury').select('*').eq('id', 1).maybeSingle();
      if (error) throw error;
      return data as { admin_balance: number; platform_pool: number; lifetime_admin_earned: number; lifetime_platform_earned: number } | null;
    },
    refetchInterval: 30_000,
  });

  const recentOrders = orders.slice(0, 6);

  const statusColors: Record<string, string> = {
    pending: 'bg-yellow-500/10 text-yellow-700 dark:text-yellow-400 border-yellow-500/30',
    placed: 'bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/30',
    accepted: 'bg-indigo-500/10 text-indigo-700 dark:text-indigo-400 border-indigo-500/30',
    preparing: 'bg-orange-500/10 text-orange-700 dark:text-orange-400 border-orange-500/30',
    ready: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/30',
    picked_up: 'bg-purple-500/10 text-purple-700 dark:text-purple-400 border-purple-500/30',
    delivered: 'bg-green-500/10 text-green-700 dark:text-green-400 border-green-500/30',
    cancelled: 'bg-red-500/10 text-red-700 dark:text-red-400 border-red-500/30',
  };
  const statusLabels: Record<string, string> = {
    pending: 'Εκκρεμεί', placed: 'Υποβλήθηκε', accepted: 'Αποδεκτή',
    preparing: 'Ετοιμάζεται', ready: 'Έτοιμη', picked_up: 'Παραλήφθηκε',
    delivered: 'Παραδόθηκε', cancelled: 'Ακυρώθηκε',
  };

  const adminBal = Number(treasury?.admin_balance ?? 0);
  const platformBal = Number(treasury?.platform_pool ?? 0);

  return (
    <div className="space-y-3">
      <div className="flex items-end justify-between gap-3 mb-1 flex-wrap">
        <div className="min-w-0">
          <h1>Dashboard</h1>
          <p className="text-[12px] text-muted-foreground">{format(today, 'EEE, dd MMM yyyy · HH:mm')}</p>
        </div>
        <TaxSnapshotButton adminBal={adminBal} platformBal={platformBal} />
      </div>

      {/* 4 simple KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
        <KPI label="Έσοδα Σήμερα" value={`€${todayRevenue.toFixed(2)}`} sub={`${todayOrders.length} παραγγελίες`} icon={DollarSign} accent="bg-emerald-500" />
        <KPI label="Ενεργές Τώρα" value={activeOrders.length} sub="σε εξέλιξη" icon={Clock} accent="bg-blue-500" />
        <KPI label="Ταμείο Admin" value={`€${adminBal.toFixed(2)}`} sub="προς απόδοση" icon={TrendingUp} accent="bg-primary" />
        <KPI label="Πλατφόρμα" value={`€${platformBal.toFixed(2)}`} sub="πλεόνασμα" icon={TrendingUp} accent="bg-violet-500" />
      </div>

      <LiveOpsMap />

      <div className="admin-card overflow-hidden">
        <div className="admin-card-header">
          <div className="flex items-center gap-2">
            <ShoppingBag className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="admin-card-title">Πρόσφατες Παραγγελίες</span>
          </div>
          <span className="text-[11px] tabular-nums text-muted-foreground">{recentOrders.length} / {orders.length}</span>
        </div>
        <div className="overflow-x-auto">
          <table className="admin-table">
            <thead>
              <tr>
                <th className="w-24">ID</th>
                <th>Κατάσταση</th>
                <th className="text-right">Σύνολο</th>
                <th className="text-right">Ώρα</th>
              </tr>
            </thead>
            <tbody>
              {recentOrders.map(order => (
                <tr key={order.id}>
                  <td className="font-mono text-[11.5px] text-muted-foreground">#{order.id.slice(0, 8)}</td>
                  <td>
                    <span className={`admin-pill ${statusColors[order.status] ?? ''}`}>
                      {statusLabels[order.status] ?? order.status}
                    </span>
                  </td>
                  <td className="text-right font-semibold tabular-nums">€{Number(order.total_amount).toFixed(2)}</td>
                  <td className="text-right text-[11.5px] text-muted-foreground tabular-nums">{format(new Date(order.created_at), 'dd MMM, HH:mm')}</td>
                </tr>
              ))}
              {!recentOrders.length && (
                <tr><td colSpan={4} className="text-center text-muted-foreground py-8">Δεν υπάρχουν παραγγελίες</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function TaxSnapshotButton({ adminBal, platformBal }: { adminBal: number; platformBal: number }) {
  const [busy, setBusy] = useState(false);

  const handleConfirm = async () => {
    setBusy(true);
    try {
      // 1. Pull period info & ledger BEFORE the close
      const periodStart = format(new Date(new Date().getFullYear(), new Date().getMonth(), 1), 'yyyy-MM-dd');
      const periodEnd = format(new Date(), 'yyyy-MM-dd');

      const { data: ledger, error: ledErr } = await (supabase as any)
        .from('admin_treasury_ledger').select('*')
        .gte('created_at', periodStart)
        .order('created_at', { ascending: true });
      if (ledErr) throw ledErr;

      // 2. Run the snapshot+reset RPC (admin_close_month already does both)
      const { data: reportId, error: rpcErr } = await (supabase as any)
        .rpc('admin_close_month', { p_period_start: periodStart });
      if (rpcErr) throw rpcErr;

      // 3. Build CSV for tax records
      const csvRows = [
        ['Tax Snapshot', `${periodStart} → ${periodEnd}`],
        ['Generated', new Date().toISOString()],
        ['Report ID', reportId ?? ''],
        ['Admin balance (closed)', adminBal.toFixed(2)],
        ['Platform pool (closed)', platformBal.toFixed(2)],
        [],
        ['Date', 'Type', 'Bag', 'Amount (€)', 'Order', 'Description'],
        ...(ledger ?? []).map((r: any) => [
          r.created_at, r.type, r.bag, Number(r.amount).toFixed(2), r.order_id ?? '', (r.description ?? '').replace(/[\r\n,]/g, ' '),
        ]),
      ];
      const csv = csvRows.map(row => row.map(c => `"${String(c ?? '').replace(/"/g, '""')}"`).join(',')).join('\n');
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `tax-snapshot-${periodStart}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);

      toast.success('Snapshot αποθηκεύτηκε & ταμείο μηδενίστηκε');
    } catch (e: any) {
      toast.error(e?.message ?? 'Αποτυχία');
    } finally {
      setBusy(false);
    }
  };

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button size="sm" variant="outline" className="h-9">
          <FileDown className="h-3.5 w-3.5 mr-1.5" />
          Snapshot Φόρου & Reset
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-yellow-500" />
            Αποθήκευση δεδομένων φόρου
          </AlertDialogTitle>
          <AlertDialogDescription className="space-y-2">
            <span className="block">Θα εκτελεστούν τα παρακάτω, με τη σειρά:</span>
            <ul className="list-disc list-inside text-xs space-y-1 pl-2">
              <li>Κατέβασμα CSV με όλες τις κινήσεις του τρέχοντα μήνα</li>
              <li>Δημιουργία αρχειοθετημένης αναφοράς (Monthly Report)</li>
              <li>
                <strong>Μηδενισμός</strong> ταμείου admin (€{adminBal.toFixed(2)}) και πλατφόρμας (€{platformBal.toFixed(2)})
              </li>
            </ul>
            <span className="block text-[11px] text-muted-foreground pt-1">
              Τα lifetime totals και το ιστορικό παραγγελιών παραμένουν ανέπαφα.
            </span>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={busy}>Άκυρο</AlertDialogCancel>
          <AlertDialogAction onClick={handleConfirm} disabled={busy}>
            {busy ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <FileDown className="h-4 w-4 mr-1" />}
            Επιβεβαίωση
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

function KPI({ label, value, sub, icon: Icon, accent }: {
  label: string; value: string | number; sub: string; icon: React.ElementType; accent: string;
}) {
  return (
    <div className="admin-kpi group hover:border-border transition-colors">
      <span className={`admin-kpi-accent ${accent}`} />
      <div className="flex items-center justify-between">
        <span className="admin-kpi-label">{label}</span>
        <Icon className="h-3 w-3 text-muted-foreground/60 group-hover:text-muted-foreground transition-colors" />
      </div>
      <div className="admin-kpi-value">{value}</div>
      <div className="admin-kpi-sub">{sub}</div>
    </div>
  );
}
