import { useCallback, useEffect, useRef, useState } from 'react';
import { Truck, Hash, PackageCheck } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { formatDistanceToNow } from 'date-fns';
import { el } from 'date-fns/locale';
import { toast } from 'sonner';
import { playDeliverySound } from '@/lib/notifications';
import { showOsNotification } from '@/lib/push-notifications';
import { loadStoreSoundPrefs } from '@/lib/store-sound-prefs';

interface Delivery {
  call_id: string;
  driver_call_id: number | null;
  driver_name: string | null;
  delivered_at: string;
}

interface Props {
  storeId: string;
  storeName: string;
}

const POLL_MS = 4000;

/** 1..9999 → four-digit display (#0042); null → — */
function fmtId(n: number | null | undefined): string {
  return n == null ? '—' : `#${String(n).padStart(4, '0')}`;
}

/**
 * N-store deliveries box (lives under the announcements panel).
 *
 * Shows the latest finished call's driver ID (a shared 1..9999 counter that
 * wraps to 1 forever) plus a short history. When a delivery completes it also
 * sends the store a text: "Οδηγός #ID — Παράδοση ολοκληρώθηκε".
 */
export function StoreDriverIdPanel({ storeId, storeName }: Props) {
  const [deliveries, setDeliveries] = useState<Delivery[]>([]);
  const [loading, setLoading] = useState(true);
  const bootstrapped = useRef(false);
  const notified = useRef<Set<string>>(new Set());

  const fetchDeliveries = useCallback(async () => {
    try {
      const { data } = await (supabase as any).rpc('my_store_recent_deliveries', {
        p_store_id: storeId,
      });
      if (!data) return;
      const rows = data as Delivery[];

      // First read just sets the baseline — old deliveries don't re-alert.
      if (!bootstrapped.current) {
        bootstrapped.current = true;
        notified.current = new Set(rows.map((r) => r.call_id));
        setDeliveries(rows);
        setLoading(false);
        return;
      }

      setDeliveries(rows);
      const newest = rows[0];
      if (newest && newest.driver_call_id != null && !notified.current.has(newest.call_id)) {
        notified.current.add(newest.call_id);
        playDeliverySound(loadStoreSoundPrefs().orderVolume);
        void showOsNotification({
          title: '🛵 Παράδοση ολοκληρώθηκε',
          body: `Οδηγός ${fmtId(newest.driver_call_id)} — Η παραγγελία παραδόθηκε (${storeName})`,
          tag: `store-delivery-${newest.call_id}`,
          vibrate: true,
        });
        toast.success(`Οδηγός ${fmtId(newest.driver_call_id)} — Παράδοση ολοκληρώθηκε`, {
          description: newest.driver_name ? `${newest.driver_name} παρέδωσε την παραγγελία.` : undefined,
        });
      }
    } catch {
      /* keep last known state; retry at next poll */
    } finally {
      setLoading(false);
    }
  }, [storeId, storeName]);

  useEffect(() => {
    if (!storeId) return;
    void fetchDeliveries();
    const id = setInterval(() => void fetchDeliveries(), POLL_MS);
    return () => clearInterval(id);
  }, [fetchDeliveries, storeId]);

  const latest = deliveries[0];

  return (
    <Card className="overflow-hidden">
      <div className="flex items-center gap-2 border-b border-border bg-muted/40 px-3.5 py-2.5">
        <div className="h-7 w-7 rounded-lg bg-emerald-500/10 flex items-center justify-center shrink-0">
          <Truck className="h-4 w-4 text-emerald-600" />
        </div>
        <h2 className="font-heading font-bold text-sm text-foreground flex-1 min-w-0">Παραδόσεις</h2>
        {deliveries.length > 0 && (
          <span className="h-5 min-w-5 px-1.5 rounded-full bg-emerald-500/10 text-emerald-700 text-[10px] font-bold flex items-center justify-center">
            {deliveries.length}
          </span>
        )}
      </div>
      <CardContent className="p-2.5">
        {loading && deliveries.length === 0 ? (
          <div className="text-center py-6 px-2">
            <div className="h-7 w-7 border-[3px] border-primary border-t-transparent rounded-full animate-spin mx-auto mb-2" />
            <p className="text-xs text-muted-foreground font-heading">Φόρτωση…</p>
          </div>
        ) : deliveries.length === 0 ? (
          <div className="text-center py-6 px-2">
            <Hash className="h-8 w-8 text-muted-foreground/50 mx-auto mb-2" />
            <p className="text-xs text-muted-foreground font-heading">Καμία παράδοση ακόμα.</p>
          </div>
        ) : (
          <div className="space-y-1.5">
            {/* Latest delivery — big ID */}
            <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/[0.06] px-3 py-2.5">
              <div className="flex items-center gap-2">
                <PackageCheck className="h-4 w-4 text-emerald-600 shrink-0" />
                <span className="text-[10.5px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Τελευταία παράδοση
                </span>
              </div>
              <p className="mt-1 font-mono text-[26px] font-extrabold leading-none text-emerald-700 dark:text-emerald-400 tabular-nums">
                {fmtId(latest?.driver_call_id)}
              </p>
              {latest?.driver_name && (
                <p className="mt-1 text-xs font-medium text-foreground/90">{latest.driver_name}</p>
              )}
              {latest?.delivered_at && (
                <p className="text-[10px] text-muted-foreground mt-0.5">
                  {formatDistanceToNow(new Date(latest.delivered_at), { addSuffix: true, locale: el })}
                </p>
              )}
            </div>

            {/* History */}
            {deliveries.slice(1, 5).map((d) => (
              <div
                key={d.call_id}
                className="flex items-center gap-2 rounded-lg border border-border/60 bg-background px-3 py-2"
              >
                <span className="font-mono text-[12.5px] font-bold text-foreground/90 tabular-nums">
                  {fmtId(d.driver_call_id)}
                </span>
                <span className="min-w-0 flex-1 truncate text-[11px] text-muted-foreground">
                  {d.driver_name ?? 'Οδηγός'}
                </span>
                <span className="text-[10px] text-muted-foreground shrink-0">
                  {formatDistanceToNow(new Date(d.delivered_at), { addSuffix: true, locale: el })}
                </span>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}