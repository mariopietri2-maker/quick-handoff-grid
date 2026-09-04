import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { formatOrderNumber } from '@/lib/order-number';
import { getStoreOrderPnl } from '@/lib/store-order-economics';
import {
  Card, CardContent, CardHeader, CardTitle,
} from '@/components/ui/card';
import { Receipt, TrendingDown, TrendingUp, Wallet, Loader2 } from 'lucide-react';

interface Props {
  storeId: string;
}

const SOURCE_LABEL: Record<string, string> = {
  in_app: 'In-app',
  manual: 'Χειροκίνητη',
  efood: 'eFood',
  wolt: 'Wolt',
  box: 'Box',
  other: 'Άλλο',
};

export default function StoreOrderPnl({ storeId }: Props) {
  const { data: storeMeta } = useQuery({
    queryKey: ['store-commission', storeId],
    queryFn: async () => {
      if (!storeId) return null;
      const { data } = await (supabase as any)
        .from('stores')
        .select('commission_pct')
        .eq('id', storeId)
        .maybeSingle();
      return data as { commission_pct: number | null } | null;
    },
    enabled: !!storeId,
  });

  const { data: delivered, isLoading } = useQuery({
    queryKey: ['store-pnl-orders', storeId],
    queryFn: async () => {
      if (!storeId) return [];
      const { data, error } = await supabase
        .from('orders')
        .select('id, store_order_number, source, status, total_amount, delivery_fee, tip_amount, store_charge, created_at')
        .eq('store_id', storeId)
        .in('status', ['delivered'])
        .order('created_at', { ascending: false })
        .limit(60);
      if (error) throw error;
      return (data ?? []) as Array<{
        id: string;
        store_order_number: number | null;
        source: string | null;
        status: string | null;
        total_amount: number | null;
        delivery_fee: number | null;
        tip_amount: number | null;
        store_charge: number | null;
        created_at: string;
      }>;
    },
    enabled: !!storeId,
  });

  const commissionPct = storeMeta?.commission_pct ?? null;

  const pnls = useMemo(
    () => (delivered ?? []).map((o) => ({ order: o, pnl: getStoreOrderPnl(o, commissionPct) })),
    [delivered, commissionPct],
  );

  const totals = useMemo(() => {
    const gross = pnls.reduce((s, x) => s + x.pnl.gross, 0);
    const net = pnls.reduce((s, x) => s + x.pnl.net, 0);
    const platformFee = pnls.reduce((s, x) => s + x.pnl.platformFee, 0);
    const storeCharge = pnls.reduce((s, x) => s + (x.pnl.storeCharge ?? 0), 0);
    const externalNet = pnls.filter((x) => x.pnl.isExternal).reduce((s, x) => s + x.pnl.net, 0);
    const inAppNet = net - externalNet;
    return { gross, net, platformFee, storeCharge, inAppNet, externalNet };
  }, [pnls]);

  const money = (n: number) => `${n >= 0 ? '' : '−'}€${Math.abs(n).toFixed(2)}`;

  if (isLoading) {
    return (
      <div className="text-center py-16">
        <Loader2 className="h-6 w-6 animate-spin mx-auto mb-3 text-muted-foreground" />
        <p className="text-sm text-muted-foreground font-heading">Φόρτωση κερδοφορίας...</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Card>
          <CardContent className="p-4">
            <p className="flex items-center gap-1.5 text-[11px] text-muted-foreground font-heading mb-1">
              <Receipt className="h-3.5 w-3.5" /> Ακαθάριστα
            </p>
            <p className="text-2xl font-extrabold tabular-nums">{money(totals.gross)}</p>
            <p className="text-[11px] text-muted-foreground">{pnls.length} παραδόθηκαν</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="flex items-center gap-1.5 text-[11px] text-muted-foreground font-heading mb-1 text-emerald-600">
              <TrendingUp className="h-3.5 w-3.5" /> In-app καθαρό
            </p>
            <p className="text-2xl font-extrabold tabular-nums text-emerald-600">{money(totals.inAppNet)}</p>
            <p className="text-[11px] text-muted-foreground">μετά προμήθεια {commissionPct?.toFixed(1) ?? 15}%</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="flex items-center gap-1.5 text-[11px] text-muted-foreground font-heading mb-1 text-destructive">
              <TrendingDown className="h-3.5 w-3.5" /> External
            </p>
            <p className="text-2xl font-extrabold tabular-nums text-destructive">{money(totals.externalNet)}</p>
            <p className="text-[11px] text-muted-foreground">χρέωση delivery {money(totals.storeCharge)}</p>
          </CardContent>
        </Card>
        <Card className="border-emerald-500/40">
          <CardContent className="p-4">
            <p className="flex items-center gap-1.5 text-[11px] text-muted-foreground font-heading mb-1">
              <Wallet className="h-3.5 w-3.5" /> ΚΑΘΑΡΟ ΣΥΝΟΛΟ
            </p>
            <p className={`text-2xl font-extrabold tabular-nums ${totals.net >= 0 ? 'text-emerald-600' : 'text-destructive'}`}>
              {money(totals.net)}
            </p>
            <p className="text-[11px] text-muted-foreground">τελευταίες {pnls.length} παραγγελίες</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="font-heading text-lg flex items-center gap-2">
            <Receipt className="h-4 w-4 text-muted-foreground" />
            Ανάλυση ανά Παραγγελία
          </CardTitle>
        </CardHeader>
        <CardContent>
          {pnls.length === 0 ? (
            <p className="text-center text-sm text-muted-foreground py-6">Δεν υπάρχουν παραδοθείσες παραγγελίες ακόμα</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-[12.5px]">
                <thead>
                  <tr className="text-left text-[11px] uppercase tracking-wider text-muted-foreground border-b border-border">
                    <th className="py-2 pr-2 font-semibold">Παραγγελία</th>
                    <th className="py-2 pr-2 font-semibold">Πηγή</th>
                    <th className="py-2 pr-2 font-semibold text-right">Ακαθάριστα</th>
                    <th className="py-2 pr-2 font-semibold text-right hidden sm:table-cell">Υποσύνολο</th>
                    <th className="py-2 pr-2 font-semibold text-right">Προμήθεια</th>
                    <th className="py-2 font-semibold text-right">Καθαρό</th>
                  </tr>
                </thead>
                <tbody>
                  {pnls.map(({ order, pnl }) => (
                    <tr key={order.id} className="border-b border-border/50 last:border-0">
                      <td className="py-2 pr-2 font-mono font-bold text-[11.5px]">
                        {formatOrderNumber(order)}
                      </td>
                      <td className="py-2 pr-2">
                        <span className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-[10.5px] font-semibold text-muted-foreground">
                          {SOURCE_LABEL[order.source ?? 'in_app'] ?? order.source}
                        </span>
                      </td>
                      <td className="py-2 pr-2 text-right tabular-nums">{money(pnl.gross)}</td>
                      <td className="py-2 pr-2 text-right tabular-nums text-muted-foreground hidden sm:table-cell">
                        {money(pnl.subtotal)}
                      </td>
                      <td className="py-2 pr-2 text-right tabular-nums text-muted-foreground">
                        {pnl.isExternal ? money(pnl.storeCharge ?? 0) : money(pnl.platformFee)}
                        {pnl.isExternal && <span className="block text-[10px]">delivery</span>}
                      </td>
                      <td className={`py-2 text-right tabular-nums font-bold ${pnl.net >= 0 ? 'text-emerald-600' : 'text-destructive'}`}>
                        {money(pnl.net)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <p className="text-[11px] text-muted-foreground leading-relaxed px-1">
        <strong>In-app:</strong> καθαρό = υποσύνολο − προμήθεια πλατφόρμας. Το φιλοδώρημα και το κόστος παράδοσης
        δεν αφαιρούνται από εσάς. <strong>External:</strong> καθαρό = ακαθάριστα − χρέωση delivery που σας βαρύνει.
      </p>
    </div>
  );
}