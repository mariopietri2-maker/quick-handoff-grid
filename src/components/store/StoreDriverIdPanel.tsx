import { useCallback, useEffect, useRef, useState } from 'react';
import { Truck, Hash, PackageCheck, Bike } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { formatDistanceToNow } from 'date-fns';
import { el } from 'date-fns/locale';
import { toast } from 'sonner';
import { playDeliverySound } from '@/lib/notifications';
import { showOsNotification } from '@/lib/push-notifications';
import { loadStoreSoundPrefs } from '@/lib/store-sound-prefs';
import { formatDriverCode } from '@/lib/driver-code';

interface Delivery {
  call_id: string;
  driver_call_id: number | null;
  driver_code: string | null;
  driver_name: string | null;
  delivered_at: string;
  /** accepted = in progress; closed = delivered */
  status?: string;
}

interface Props {
  storeId: string;
  storeName: string;
}

const POLL_MS = 4000;

function fmtId(n: number | null | undefined): string {
  return n == null ? '—' : `#${String(n).padStart(4, '0')}`;
}

function driverLabel(d: Delivery | undefined): string {
  return formatDriverCode(d?.driver_code, { fallback: d?.driver_name ?? 'Οδηγός' });
}

/** N-store deliveries box for the store owner. */
export function StoreDriverIdPanel({ storeId, storeName }: Props) {
  const [deliveries, setDeliveries] = useState<Delivery[]>([]);
  const [active, setActive] = useState<Delivery | null>(null);
  const [loading, setLoading] = useState(true);
  const bootstrapped = useRef(false);
  const notified = useRef<Set<string>>(new Set());

  const fetchDeliveries = useCallback(async () => {
    try {
      const [{ data: done }, { data: live }] = await Promise.all([
        (supabase as any).rpc('my_store_recent_deliveries', { p_store_id: storeId }),
        (supabase as any).rpc('my_store_active_delivery', { p_store_id: storeId }),
      ]);

      const rows = (done ?? []) as Delivery[];
      const liveRow = (Array.isArray(live) ? live[0] : live) as Delivery | null | undefined;

      if (!bootstrapped.current) {
        bootstrapped.current = true;
        notified.current = new Set(rows.map((r) => r.call_id));
        setDeliveries(rows);
        setActive(liveRow ?? null);
        setLoading(false);
        return;
      }

      setDeliveries(rows);
      setActive(liveRow ?? null);

      const newest = rows[0];
      if (newest && newest.driver_call_id != null && !notified.current.has(newest.call_id)) {
        notified.current.add(newest.call_id);
        playDeliverySound(loadStoreSoundPrefs().orderVolume);
        const label = driverLabel(newest);
        void showOsNotification({
          title: '🛵 Παράδοση ολοκληρώθηκε',
          body: `Οδηγός ${label} — Παράδοση ${fmtId(newest.driver_call_id)} (${storeName})`,
          tag: `store-delivery-${newest.call_id}`,
          vibrate: true,
        });
        toast.success(`Οδηγός ${label} — Παράδοση ολοκληρώθηκε`, {
          description: `Παράδοση ${fmtId(newest.driver_call_id)}.`,
        });
      }
    } catch {
      /* keep last known state */
    } finally {
      setLoading(false);
    }
  }, [storeId, storeName]);

  useEffect(() => {
    if (!storeId) return;
    void fetchDeliveries();
    const id = setInterval(() => void fetchDeliveries(), POLL_MS);

    const ch = supabase
      .channel(`store-deliveries-${storeId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'store_driver_calls', filter: `store_id=eq.${storeId}` },
        () => { void fetchDeliveries(); },
      )
      .subscribe();

    return () => {
      clearInterval(id);
      void supabase.removeChannel(ch);
    };
  }, [fetchDeliveries, storeId]);

  const latest = deliveries[0];

  return (
    <Card className="overflow-hidden border-emerald-500/20 shadow-sm">
      <div className="flex items-center gap-2 border-b border-border bg-emerald-500/5 px-3.5 py-2.5">
        <div className="h-7 w-7 rounded-lg bg-emerald-500/15 flex items-center justify-center shrink-0">
          <Truck className="h-4 w-4 text-emerald-600" />
        </div>
        <h2 className="font-heading font-bold text-sm text-foreground flex-1 min-w-0">Παραδόσεις</h2>
        {deliveries.length > 0 && (
          <span className="h-5 min-w-5 px-1.5 rounded-full bg-emerald-500/15 text-emerald-700 text-[10px] font-bold flex items-center justify-center">
            {deliveries.length}
          </span>
        )}
      </div>
      <CardContent className="p-2.5 space-y-2">
        {loading && deliveries.length === 0 && !active ? (
          <div className="text-center py-6 px-2">
            <div className="h-7 w-7 border-[3px] border-primary border-t-transparent rounded-full animate-spin mx-auto mb-2" />
            <p className="text-xs text-muted-foreground font-heading">Φόρτωση…</p>
          </div>
        ) : (
          <>
            {active && (
              <div className="rounded-xl border border-sky-500/30 bg-sky-500/10 px-3.5 py-3">
                <div className="flex items-center gap-2 mb-1">
                  <Bike className="h-4 w-4 text-sky-600 animate-pulse" />
                  <span className="text-[11px] font-heading font-bold uppercase tracking-wide text-sky-700 dark:text-sky-400">
                    Σε εξέλιξη
                  </span>
                </div>
                <p className="text-sm font-heading font-semibold text-foreground">{driverLabel(active)}</p>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  Ο οδηγός είναι σε παράδοση — ο αριθμός εμφανίζεται όταν ολοκληρώσει.
                </p>
              </div>
            )}

            {latest ? (
              <div className="rounded-xl border border-emerald-500/25 bg-emerald-500/5 px-3.5 py-3 flex gap-3 items-start">
                <div className="h-10 w-10 rounded-xl bg-emerald-500/15 flex items-center justify-center shrink-0">
                  <PackageCheck className="h-5 w-5 text-emerald-600" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[10px] font-heading font-bold uppercase tracking-wide text-emerald-700/80 dark:text-emerald-400/90">
                    Τελευταία παράδοση
                  </p>
                  <p className="mt-0.5 font-mono text-[28px] font-extrabold leading-none text-emerald-700 dark:text-emerald-400 tabular-nums">
                    {fmtId(latest.driver_call_id)}
                  </p>
                  <p className="mt-1 text-xs font-semibold text-foreground/90">{driverLabel(latest)}</p>
                  {latest.delivered_at && (
                    <p className="text-[10px] text-muted-foreground mt-0.5">
                      Ολοκληρώθηκε{' '}
                      {formatDistanceToNow(new Date(latest.delivered_at), { addSuffix: true, locale: el })}
                    </p>
                  )}
                </div>
              </div>
            ) : !active ? (
              <div className="text-center py-5 px-2">
                <Hash className="h-8 w-8 text-muted-foreground/50 mx-auto mb-2" />
                <p className="text-xs text-muted-foreground font-heading">Καμία παράδοση ακόμα.</p>
                <p className="text-[10px] text-muted-foreground mt-1">
                  Όταν ο οδηγός ολοκληρώσει κλήση, θα εμφανιστεί εδώ ο αριθμός παράδοσης.
                </p>
              </div>
            ) : null}

            {deliveries.slice(1, 6).map((d) => (
              <div
                key={d.call_id}
                className="flex items-center gap-2 rounded-lg border border-border/60 bg-background px-3 py-2"
              >
                <span className="font-mono text-[12.5px] font-bold text-foreground/90 tabular-nums">
                  {fmtId(d.driver_call_id)}
                </span>
                <span className="min-w-0 flex-1 truncate text-[11px] text-muted-foreground">
                  {driverLabel(d)}
                </span>
                <span className="text-[10px] text-muted-foreground shrink-0">
                  {formatDistanceToNow(new Date(d.delivered_at), { addSuffix: true, locale: el })}
                </span>
              </div>
            ))}
          </>
        )}
      </CardContent>
    </Card>
  );
}
