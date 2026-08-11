import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { RotateCcw, RefreshCw, CreditCard, Wallet } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { format } from 'date-fns';

interface RefundRow {
  id: string;
  order_id: string;
  customer_id: string | null;
  amount: number | string;
  reason: string | null;
  refund_type: string | null;
  notes: string | null;
  status: string;
  attempts: number | null;
  stripe_refund_id: string | null;
  failure_message: string | null;
  created_at: string;
  processed_at: string | null;
}

const statusFilterOptions = [
  { id: 'all', label: 'Όλα' },
  { id: 'pending', label: 'Εκκρεμεί' },
  { id: 'processing', label: 'Σε επεξεργασία' },
  { id: 'failed', label: 'Απέτυχαν' },
  { id: 'completed', label: 'Ολοκληρώθηκαν' },
];

const statusMeta: Record<string, { label: string; cls: string }> = {
  pending: { label: 'Εκκρεμεί', cls: 'bg-yellow-500/10 text-yellow-700 dark:text-yellow-400 border-yellow-500/30' },
  processing: { label: 'Σε επεξεργασία', cls: 'bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/30' },
  succeeded: { label: 'Επιτυχής', cls: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/30' },
  completed: { label: 'Ολοκληρώθηκε', cls: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/30' },
  failed: { label: 'Απέτυχε', cls: 'bg-red-500/10 text-red-700 dark:text-red-400 border-red-500/30' },
};

export default function RefundsPanel() {
  const [refunds, setRefunds] = useState<RefundRow[]>([]);
  const [names, setNames] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [retryingId, setRetryingId] = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const load = useCallback(async () => {
    const { data, error } = await (supabase.from('refunds') as any)
      .select('id, order_id, customer_id, amount, reason, refund_type, notes, status, attempts, stripe_refund_id, failure_message, created_at, processed_at')
      .order('created_at', { ascending: false })
      .limit(200);
    if (error) {
      toast.error('Δεν μπόρεσε να φορτωθούν οι επιστροφές: ' + error.message);
      return;
    }
    const rows = (data ?? []) as RefundRow[];
    setRefunds(rows);

    const customerIds = Array.from(new Set(rows.map((r) => r.customer_id).filter(Boolean))) as string[];
    if (customerIds.length > 0) {
      const { data: profiles } = await (supabase.from('profiles') as any)
        .select('user_id, full_name')
        .in('user_id', customerIds);
      const map: Record<string, string> = {};
      for (const p of profiles ?? []) {
        if (p.full_name) map[p.user_id] = p.full_name;
      }
      setNames(map);
    }
  }, []);

  useEffect(() => {
    load().finally(() => setLoading(false));
    timerRef.current = setInterval(() => { void load(); }, 20000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [load]);

  const filtered = useMemo(() => {
    if (filter === 'all') return refunds;
    if (filter === 'completed') return refunds.filter((r) => ['succeeded', 'completed'].includes(r.status));
    return refunds.filter((r) => r.status === filter);
  }, [refunds, filter]);

  const counts = useMemo(() => {
    const pending = refunds.filter((r) => r.status === 'pending' || r.status === 'processing').length;
    const failed = refunds.filter((r) => r.status === 'failed').length;
    const totalToday = refunds
      .filter((r) => new Date(r.created_at) >= new Date(new Date().setHours(0, 0, 0, 0)))
      .reduce((s, r) => s + Number(r.amount ?? 0), 0);
    return { pending, failed, totalToday };
  }, [refunds]);

  const retry = async (row: RefundRow) => {
    if (!confirm(`Να γίνει επανάληψη της επιστροφής #${row.id.slice(0, 8)} (${Number(row.amount).toFixed(2)} €);`)) return;
    setRetryingId(row.id);
    const { error } = await (supabase.rpc as any)('retry_failed_card_refund', { p_refund_id: row.id });
    setRetryingId(null);
    if (error) {
      toast.error('Αποτυχία: ' + error.message);
      return;
    }
    toast.success('Η επιστροφή ξαναμπήκε στην ουρά');
    void load();
  };

  return (
    <div className="space-y-3">
      <div className="admin-section-header">
        <div className="flex items-baseline gap-2 min-w-0">
          <h2 className="admin-section-title truncate">Επιστροφές</h2>
          <span className="text-[11px] tabular-nums text-muted-foreground bg-muted px-1.5 py-0.5 rounded">{refunds.length}</span>
          <span className="admin-section-sub truncate">· πορτοφόλι & κάρτα</span>
        </div>
        <div className="flex items-center gap-1.5">
          <Button variant="outline" size="sm" className="h-7 text-[11.5px] gap-1.5" onClick={() => { setLoading(true); void load().finally(() => setLoading(false)); }}>
            <RefreshCw className="h-3.5 w-3.5" /> Ανανέωση
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2">
        <div className="admin-card p-3">
          <div className="text-[10.5px] uppercase tracking-wide text-muted-foreground">Σε εξέλιξη</div>
          <div className="text-lg font-semibold tabular-nums">{counts.pending}</div>
        </div>
        <div className="admin-card p-3">
          <div className="text-[10.5px] uppercase tracking-wide text-muted-foreground">Απέτυχαν</div>
          <div className="text-lg font-semibold tabular-nums text-red-600 dark:text-red-400">{counts.failed}</div>
        </div>
        <div className="admin-card p-3">
          <div className="text-[10.5px] uppercase tracking-wide text-muted-foreground">Σήμερα</div>
          <div className="text-lg font-semibold tabular-nums">€{counts.totalToday.toFixed(2)}</div>
        </div>
      </div>

      <div className="flex gap-1 p-0.5 bg-muted rounded-md w-max max-w-full overflow-x-auto">
        {statusFilterOptions.map((o) => (
          <button
            key={o.id}
            onClick={() => setFilter(o.id)}
            className={`px-2.5 h-6 text-[11px] font-medium rounded whitespace-nowrap transition-colors ${filter === o.id ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
          >
            {o.label}
          </button>
        ))}
      </div>

      <div className="admin-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Refund</th><th>Παραγγελία</th><th>Πελάτης</th>
                <th className="text-right">Ποσό</th><th>Μέθοδος</th><th>Κατάσταση</th>
                <th>Σφάλμα</th><th className="text-right">Ημ/νία</th><th className="w-24">Ενέργειες</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => {
                const meta = statusMeta[r.status] ?? { label: r.status, cls: 'bg-muted text-muted-foreground border-border' };
                return (
                  <tr key={r.id}>
                    <td className="font-mono text-[11.5px] text-muted-foreground">#{r.id.slice(0, 8)}</td>
                    <td className="font-mono text-[11.5px] text-muted-foreground">#{r.order_id.slice(0, 8)}</td>
                    <td className="text-[12.5px] max-w-[160px] truncate">{names[r.customer_id ?? ''] ?? (r.customer_id ? r.customer_id.slice(0, 8) : '—')}</td>
                    <td className="font-semibold tabular-nums text-right">€{Number(r.amount).toFixed(2)}</td>
                    <td>
                      <Badge className={r.refund_type === 'original_payment' ? 'bg-indigo-500/10 text-indigo-700 dark:text-indigo-400 border-indigo-500/30' : 'bg-muted text-muted-foreground border-border'}>
                        {r.refund_type === 'original_payment' ? <CreditCard className="h-3 w-3 mr-1" /> : <Wallet className="h-3 w-3 mr-1" />}
                        {r.refund_type === 'original_payment' ? 'Κάρτα' : 'Πορτοφόλι'}
                      </Badge>
                    </td>
                    <td>
                      <span className={`admin-pill ${meta.cls}`}>{meta.label}</span>
                      {r.status === 'failed' && r.attempts != null && (
                        <span className="ml-1 text-[10px] text-muted-foreground">×{r.attempts}</span>
                      )}
                    </td>
                    <td className="text-[11px] text-muted-foreground max-w-[220px]">
                      <span className="block truncate" title={r.failure_message ?? ''}>
                        {r.stripe_refund_id ? `ref_${r.stripe_refund_id.slice(-6)}` : (r.failure_message ?? '—')}
                      </span>
                    </td>
                    <td className="text-[11.5px] text-muted-foreground tabular-nums text-right whitespace-nowrap">
                      {r.processed_at ? format(new Date(r.processed_at), 'dd MMM, HH:mm') : format(new Date(r.created_at), 'dd MMM, HH:mm')}
                    </td>
                    <td>
                      {r.status === 'failed' ? (
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 text-[11px] gap-1"
                          disabled={retryingId === r.id}
                          onClick={() => retry(r)}
                        >
                          {retryingId === r.id ? <RefreshCw className="h-3 w-3 animate-spin" /> : <RotateCcw className="h-3 w-3" />}
                          Retry
                        </Button>
                      ) : (
                        <span className="text-[11px] text-muted-foreground">—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
              {!filtered.length && (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-[12.5px] text-muted-foreground">
                    {loading ? 'Φόρτωση…' : 'Δεν υπάρχουν επιστροφές σε αυτό το φίλτρο'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
