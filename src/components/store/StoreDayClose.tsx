import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

type Row = {
  status: string | null;
  payment_method: string | null;
  total_amount: number | null;
  store_charge: number | null;
};

export function StoreDayClose({
  storeId,
  onCloseStore,
}: {
  storeId: string;
  onCloseStore: () => void;
}) {
  const [rows, setRows] = useState<Row[]>([]);

  useEffect(() => {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    void supabase
      .from('orders')
      .select('status, payment_method, total_amount, store_charge')
      .eq('store_id', storeId)
      .gte('created_at', start.toISOString())
      .then(({ data }) => setRows((data as Row[]) ?? []));
  }, [storeId]);

  const done = rows.filter((r) => !['cancelled', 'rejected', 'pending'].includes(String(r.status)));
  const cancelled = rows.filter((r) => r.status === 'cancelled');
  const cash = done.filter((r) => String(r.payment_method).toLowerCase() === 'cash');
  const card = done.filter((r) => String(r.payment_method).toLowerCase() !== 'cash');
  const sum = (list: Row[], key: 'total_amount' | 'store_charge') =>
    list.reduce((s, r) => s + Number(r[key] ?? 0), 0);
  const euro = (n: number) => `${n.toFixed(2)}€`;

  return (
    <div className="mb-4 rounded-2xl border border-border bg-card p-4">
      <div className="flex items-center justify-between gap-2 mb-3">
        <p className="font-heading font-bold">Σήμερα</p>
        <Button
          type="button"
          variant="outline"
          className="h-9 text-destructive border-destructive/40"
          onClick={() => {
            if (!window.confirm('Κλείσιμο καταστήματος για σήμερα; Οι πελάτες δεν θα μπορούν να παραγγείλουν.')) return;
            onCloseStore();
            toast.success('Το κατάστημα έκλεισε');
          }}
        >
          Κλείσιμο ημέρας
        </Button>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-sm">
        <Stat label="Μετρητά" value={euro(sum(cash, 'total_amount'))} />
        <Stat label="Κάρτα" value={euro(sum(card, 'total_amount'))} />
        <Stat label="Ακυρώσεις" value={String(cancelled.length)} />
        <Stat label="Οφειλή Fresh2GO" value={euro(sum(done, 'store_charge'))} />
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-muted/40 px-3 py-2">
      <p className="text-[11px] text-muted-foreground">{label}</p>
      <p className="font-heading font-bold text-base tabular-nums">{value}</p>
    </div>
  );
}
