import { useCallback, useEffect, useRef, useState } from 'react';
import { AlertDialog, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Loader2, Truck, CheckCircle, AlertCircle, X, Phone } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { playDeliverySound } from '@/lib/notifications';
import { loadStoreSoundPrefs } from '@/lib/store-sound-prefs';
import { showOsNotification } from '@/lib/push-notifications';

interface Props {
  storeId: string;
  storeName: string;
  muted?: boolean;
  disabled?: boolean;
}

const MAX_ACTIVE_CALLS = 3;
const OPEN_TTL_SEC = 15 * 60;

type CallStatus = 'open' | 'accepted' | 'closed';

interface ActiveCall {
  id: string;
  status: CallStatus;
  createdAt: string;
  driverName: string | null;
  acceptedAt: string | null;
}

function mapStatus(raw: string | null | undefined): CallStatus | null {
  if (raw === 'open' || raw === 'accepted' || raw === 'closed') return raw;
  return null;
}

function formatCountdown(totalSec: number): string {
  const s = Math.max(0, totalSec);
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
}

export function StoreCallPanel({ storeId, storeName, muted = false, disabled = false }: Props) {
  const [calls, setCalls] = useState<ActiveCall[]>([]);
  const [loading, setLoading] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [closingId, setClosingId] = useState<string | null>(null);
  const { toast } = useToast();
  const prevAcceptedRef = useRef<Set<string>>(new Set());
  const [, setTick] = useState(0);

  const fetchCalls = useCallback(async () => {
    try {
      const { data, error } = await supabase.rpc('my_store_driver_calls' as never, {
        p_store_id: storeId,
      } as never);
      if (error) {
        // Fallback to single-call RPC if plural not deployed yet
        const single = await supabase.rpc('my_store_driver_call', { p_store_id: storeId });
        if (single.error) throw error;
        const row = single.data?.[0];
        if (!row || row.status === 'closed') {
          setCalls([]);
          return;
        }
        setCalls([
          {
            id: row.id,
            status: mapStatus(row.status) === 'accepted' ? 'accepted' : 'open',
            createdAt: row.created_at,
            driverName: row.driver_name ?? null,
            acceptedAt: row.accepted_at ?? null,
          },
        ]);
        return;
      }
      const rows = (data as any[]) ?? [];
      const next: ActiveCall[] = rows
        .map((r) => {
          const st = mapStatus(r.status);
          if (st !== 'open' && st !== 'accepted') return null;
          return {
            id: r.id as string,
            status: st,
            createdAt: r.created_at as string,
            driverName: (r.driver_name as string | null) ?? null,
            acceptedAt: (r.accepted_at as string | null) ?? null,
          };
        })
        .filter(Boolean) as ActiveCall[];
      setCalls(next);
    } catch (e: any) {
      console.warn('fetchCalls', e?.message || e);
    }
  }, [storeId]);

  useEffect(() => {
    void fetchCalls();
    const t = window.setInterval(() => void fetchCalls(), 4000);
    return () => window.clearInterval(t);
  }, [fetchCalls]);

  useEffect(() => {
    const t = window.setInterval(() => setTick((n) => n + 1), 1000);
    return () => window.clearInterval(t);
  }, []);

  // Celebrate newly accepted calls
  useEffect(() => {
    const acceptedIds = new Set(calls.filter((c) => c.status === 'accepted').map((c) => c.id));
    for (const c of calls) {
      if (c.status !== 'accepted') continue;
      if (prevAcceptedRef.current.has(c.id)) continue;
      prevAcceptedRef.current.add(c.id);
      if (!muted) {
        try {
          const prefs = loadStoreSoundPrefs();
          void playDeliverySound(prefs);
          if (typeof navigator !== 'undefined' && navigator.vibrate) {
            navigator.vibrate([0, 200, 80, 200, 80, 300]);
          }
        } catch { /* ignore */ }
      }
      void showOsNotification({
        title: 'Οδηγός βρέθηκε!',
        body: `${c.driverName || 'Οδηγός'} αποδέχτηκε την κλήση — ${storeName}`,
        tag: `store-call-accepted-${c.id}`,
        vibrate: true,
      });
      toast({
        title: 'Οδηγός βρέθηκε!',
        description: c.driverName
          ? `${c.driverName} αποδέχτηκε την κλήση.`
          : 'Ένας οδηγός αποδέχτηκε την κλήση.',
      });
    }
    // Drop ids no longer active
    prevAcceptedRef.current = new Set(
      [...prevAcceptedRef.current].filter((id) => acceptedIds.has(id) || calls.some((c) => c.id === id)),
    );
  }, [calls, muted, storeName, toast]);

  // Realtime
  useEffect(() => {
    const channel = supabase
      .channel(`store-calls-${storeId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'store_driver_calls', filter: `store_id=eq.${storeId}` },
        () => {
          void fetchCalls();
        },
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [storeId, fetchCalls]);

  const openCount = calls.filter((c) => c.status === 'open').length;
  const activeCount = calls.length;
  // Can start another call without closing — only blocked when 3 are still waiting (open)
  const canCreateMore = openCount < MAX_ACTIVE_CALLS && !disabled;

  const handleCreateCall = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.rpc('create_store_driver_call', {
        p_store_id: storeId,
      });
      if (error) throw error;
      const call = Array.isArray(data) ? data[0] : data;
      if (!call?.id) throw new Error('Δεν επιστράφηκε κλήση από τον διακομιστή');
      setConfirmOpen(false);
      await fetchCalls();
      toast({
        title: 'Κλήση στάλθηκε',
        description: `Νέα κλήση στάλθηκε. Ανοιχτές σε αναμονή: έως ${MAX_ACTIVE_CALLS}.`,
      });
    } catch (e: any) {
      const msg = e?.message || 'Αποτυχία κλήσης';
      toast({ title: 'Σφάλμα', description: msg, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const handleCloseCall = async (callId: string) => {
    setClosingId(callId);
    setLoading(true);
    try {
      const { error } = await supabase.rpc('close_store_driver_call', { p_call_id: callId });
      if (error) throw error;
      await fetchCalls();
    } catch (e: any) {
      toast({ title: 'Σφάλμα', description: e?.message || 'Αποτυχία κλεισίματος', variant: 'destructive' });
    } finally {
      setLoading(false);
      setClosingId(null);
    }
  };

  return (
    <div className="w-full max-w-md mx-auto space-y-4">
      <Card className="shadow-lg border-violet-500/20">
        <CardContent className="pt-6 pb-6 px-5">
          <div className="flex items-center gap-3 mb-4">
            <div className="h-12 w-12 rounded-xl bg-violet-500/15 flex items-center justify-center shrink-0">
              <Phone className="h-6 w-6 text-violet-600" />
            </div>
            <div className="min-w-0">
              <h3 className="text-lg font-heading font-bold text-foreground">Κλήσεις Ghost Rider</h3>
              <p className="text-xs text-muted-foreground">
                Έως {MAX_ACTIVE_CALLS} ανοιχτές κλήσεις μαζί · {openCount} σε αναμονή · {activeCount} συνολικά
              </p>
            </div>
          </div>

          {calls.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-3">
              Δεν υπάρχει ανοιχτή κλήση. Κάλεσε έως {MAX_ACTIVE_CALLS} οδηγούς σε ξεχωριστές κλήσεις.
            </p>
          ) : (
            <ul className="space-y-2 mb-4">
              {calls.map((c, idx) => {
                const ageSec = Math.floor((Date.now() - new Date(c.createdAt).getTime()) / 1000);
                const left =
                  c.status === 'open'
                    ? Math.max(0, OPEN_TTL_SEC - ageSec)
                    : null;
                return (
                  <li
                    key={c.id}
                    className={`rounded-xl border px-3 py-3 ${
                      c.status === 'accepted'
                        ? 'border-emerald-500/40 bg-emerald-500/5'
                        : 'border-border bg-card'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-sm font-heading font-semibold">
                          Κλήση {idx + 1}{' '}
                          <span className="text-muted-foreground font-normal">
                            · {c.status === 'open' ? 'Αναμονή' : 'Αποδοχή'}
                          </span>
                        </p>
                        {c.status === 'accepted' ? (
                          <p className="text-xs text-emerald-700 mt-0.5 flex items-center gap-1">
                            <CheckCircle className="h-3.5 w-3.5" />
                            {c.driverName || 'Οδηγός'} αποδέχτηκε
                          </p>
                        ) : (
                          <p className="text-xs text-muted-foreground mt-0.5">
                            Λήγει σε {left != null ? formatCountdown(left) : '—'}
                          </p>
                        )}
                      </div>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="shrink-0 h-8"
                        disabled={loading && closingId === c.id}
                        onClick={() => void handleCloseCall(c.id)}
                      >
                        {closingId === c.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Κλείσιμο'}
                      </Button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}

          <Button
            type="button"
            className="w-full h-14 text-base font-semibold bg-violet-600 hover:bg-violet-700 rounded-2xl shadow-md disabled:opacity-50"
            disabled={loading || !canCreateMore}
            onClick={() => setConfirmOpen(true)}
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <Loader2 className="h-5 w-5 animate-spin" />
                Αποστολή…
              </span>
            ) : disabled ? (
              'Κλειστό — άνοιξε για κλήση'
            ) : !canCreateMore ? (
              `Μέγιστο ${MAX_ACTIVE_CALLS} ανοιχτές — περίμενε αποδοχή ή κλείσε μία`
            ) : (
              <span className="flex items-center justify-center gap-2">
                <Truck className="h-5 w-5" />
                {openCount === 0 && activeCount === 0 ? 'Κάλεσε οδηγό' : 'Κάλεσε ακόμα έναν (χωρίς να κλείσεις)'}
              </span>
            )}
          </Button>

          {!canCreateMore && !disabled && (
            <p className="mt-2 text-[11px] text-center text-muted-foreground flex items-center justify-center gap-1">
              <AlertCircle className="h-3.5 w-3.5" />
              Έχεις {MAX_ACTIVE_CALLS} ανοιχτές κλήσεις σε αναμονή. Μπορείς ξανά όταν κάποιος αποδεχτεί ή κλείσεις μία.
            </p>
          )}
        </CardContent>
      </Card>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Νέα κλήση Ghost Rider;</AlertDialogTitle>
            <AlertDialogDescription>
              Θα ειδοποιηθούν οι διαθέσιμοι Ghost Riders για το <b>{storeName}</b>.
              Μπορείς να ανοίξεις έως <b>{MAX_ACTIVE_CALLS}</b> κλήσεις μαζί χωρίς να κλείσεις τις προηγούμενες
              (τώρα ανοιχτές: {openCount}). Δεν χρειάζεται να κλείσεις για να καλέσεις τον επόμενο.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <Button type="button" variant="outline" onClick={() => setConfirmOpen(false)} disabled={loading}>
              Άκυρο
            </Button>
            <Button
              type="button"
              className="bg-violet-600 hover:bg-violet-700"
              disabled={loading}
              onClick={() => void handleCreateCall()}
            >
              {loading ? 'Αποστολή…' : 'Ναι — Κάλεσε'}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
