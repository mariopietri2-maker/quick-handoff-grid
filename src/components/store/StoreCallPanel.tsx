import { useCallback, useEffect, useRef, useState } from 'react';
import { AlertDialog, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Loader2, Truck, CheckCircle, AlertCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { playDeliverySound } from '@/lib/notifications';
import { showOsNotification } from '@/lib/push-notifications';

interface Props {
  storeId: string;
  storeName: string;
}

type CallStatus = 'idle' | 'open' | 'accepted' | 'closed';

/** Must match DB cron store-call-expiry window. */
const OPEN_TTL_SEC = 15 * 60;

interface CallState {
  status: CallStatus;
  callId: string | null;
  driverName: string | null;
  acceptedAt: string | null;
  createdAt: string | null;
  error: string | null;
}

const idleState = (): CallState => ({
  status: 'idle',
  callId: null,
  driverName: null,
  acceptedAt: null,
  createdAt: null,
  error: null,
});

function mapStatus(raw: string | null | undefined): CallStatus {
  if (raw === 'open') return 'open';
  if (raw === 'accepted') return 'accepted';
  if (raw === 'closed') return 'closed';
  return 'idle';
}

function formatCountdown(totalSec: number): string {
  const s = Math.max(0, totalSec);
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
}

export function StoreCallPanel({ storeId, storeName }: Props) {
  const [state, setState] = useState<CallState>(idleState);
  const [loading, setLoading] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmCloseOpen, setConfirmCloseOpen] = useState(false);
  const { toast } = useToast();
  const prevStatusRef = useRef<CallStatus>('idle');
  const wakeLockRef = useRef<WakeLockSentinel | null>(null);
  /** Ignore stale closed/null polls after we create an open call. */
  const holdOpenUntilRef = useRef(0);
  const confirmOpenRef = useRef(false);
  const [, setTick] = useState(0);

  confirmOpenRef.current = confirmOpen;

  const fetchCall = useCallback(async () => {
    // Don't yank UI while the user is confirming a new call
    if (confirmOpenRef.current) return;

    try {
      const { data, error } = await supabase.rpc('my_store_driver_call', {
        p_store_id: storeId,
      });
      if (error) throw error;
      const call = data?.[0];

      setState((prev) => {
        const hold = Date.now() < holdOpenUntilRef.current;

        // Protect freshly created open call from stale null/closed polls
        if (hold && prev.status === 'open' && prev.callId) {
          if (!call || call.id !== prev.callId || call.status === 'closed') {
            return prev;
          }
        }

        if (!call) {
          if (hold && prev.status === 'open') return prev;
          // No active call → idle (ready to call again)
          return prev.status === 'idle' ? prev : idleState();
        }

        const next = mapStatus(call.status);

        // Closed history must NOT force the "closed" screen over idle/confirm.
        // Only open / accepted are live states the owner needs to see.
        if (next === 'closed' || next === 'idle') {
          if (hold && prev.status === 'open') return prev;
          return prev.status === 'idle' ? prev : idleState();
        }

        // Ignore a different closed-era id while we still show open
        if (prev.status === 'open' && call.id !== prev.callId && next !== 'open' && next !== 'accepted') {
          return prev;
        }

        return {
          status: next,
          callId: call.id,
          driverName: call.driver_name ?? null,
          acceptedAt: call.accepted_at ?? null,
          createdAt: call.created_at ?? null,
          error: null,
        };
      });
    } catch (e: unknown) {
      console.error('fetch call error', e);
    }
  }, [storeId]);

  useEffect(() => {
    fetchCall();
    const interval = setInterval(fetchCall, 3000);
    return () => clearInterval(interval);
  }, [fetchCall]);

  useEffect(() => {
    if (state.status !== 'open') return;
    const t = setInterval(() => setTick((n) => n + 1), 1000);
    return () => clearInterval(t);
  }, [state.status]);

  useEffect(() => {
    const prev = prevStatusRef.current;
    prevStatusRef.current = state.status;
    if (prev !== 'accepted' && state.status === 'accepted') {
      try {
        playDeliverySound();
      } catch {}
      try {
        if (typeof navigator !== 'undefined' && navigator.vibrate) {
          navigator.vibrate([0, 200, 80, 200, 80, 300]);
        }
      } catch {}
      void showOsNotification({
        title: 'Οδηγός βρέθηκε!',
        body: `${state.driverName || 'Οδηγός'} αποδέχτηκε την κλήση — ${storeName}`,
        tag: `store-call-accepted-${state.callId ?? 'x'}`,
        vibrate: true,
      });
      toast({
        title: 'Οδηγός βρέθηκε!',
        description: state.driverName
          ? `${state.driverName} αποδέχτηκε την κλήση.`
          : 'Ένας οδηγός αποδέχτηκε την κλήση.',
      });
    }
  }, [state.status, state.driverName, state.callId, storeName, toast]);

  useEffect(() => {
    const active = state.status === 'open' || state.status === 'accepted';
    let cancelled = false;

    const acquire = async () => {
      if (!active || typeof navigator === 'undefined' || !('wakeLock' in navigator)) return;
      try {
        const lock = await navigator.wakeLock.request('screen');
        if (cancelled) {
          void lock.release();
          return;
        }
        wakeLockRef.current = lock;
        lock.addEventListener('release', () => {
          if (wakeLockRef.current === lock) wakeLockRef.current = null;
        });
      } catch (e) {
        console.warn('Wake Lock unavailable', e);
      }
    };

    const release = () => {
      const lock = wakeLockRef.current;
      wakeLockRef.current = null;
      if (lock) void lock.release().catch(() => {});
    };

    if (active) {
      void acquire();
    } else {
      release();
    }

    const onVisibility = () => {
      if (document.visibilityState === 'visible' && active && !wakeLockRef.current) {
        void acquire();
      }
    };
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      cancelled = true;
      document.removeEventListener('visibilitychange', onVisibility);
      release();
    };
  }, [state.status]);

  const handleCreateCall = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.rpc('create_store_driver_call', {
        p_store_id: storeId,
      });
      if (error) throw error;
      const call = Array.isArray(data) ? data[0] : data;
      if (!call?.id) {
        throw new Error('Δεν επιστράφηκε κλήση από τον διακομιστή');
      }

      const createdAt = call.created_at ?? new Date().toISOString();
      holdOpenUntilRef.current = Date.now() + 15_000;
      setConfirmOpen(false);
      setState({
        status: 'open',
        callId: call.id,
        driverName: null,
        acceptedAt: null,
        createdAt,
        error: null,
      });
      toast({
        title: 'Κλήση ενεργή',
        description: 'Οι οδηγοί K ειδοποιήθηκαν. Η κλήση μένει ανοιχτή έως 15 λεπτά.',
      });
      setTimeout(() => fetchCall(), 2000);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Αποτυχία δημιουργίας κλήσης';
      setState((s) => ({ ...s, error: msg }));
      toast({ title: 'Σφάλμα', description: msg, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const handleCloseCall = async () => {
    if (!state.callId) return;
    setLoading(true);
    try {
      const { error } = await supabase.rpc('close_store_driver_call', {
        p_call_id: state.callId,
      });
      if (error) throw error;
      holdOpenUntilRef.current = 0;
      setState(idleState());
      toast({ title: 'Κλήση κλείστηκε' });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Σφάλμα';
      toast({ title: 'Σφάλμα', description: msg, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const secondsLeft =
    state.createdAt && state.status === 'open'
      ? Math.max(
          0,
          Math.ceil(
            (OPEN_TTL_SEC * 1000 - (Date.now() - new Date(state.createdAt).getTime())) / 1000,
          ),
        )
      : null;

  if (state.status === 'idle') {
    return (
      <Card className="w-full max-w-md mx-auto shadow-lg">
        <CardContent className="pt-8 pb-10 px-6 text-center">
          <div className="mx-auto h-20 w-20 rounded-full bg-emerald-500/10 flex items-center justify-center">
            <Truck className="h-12 w-12 text-emerald-600" />
          </div>
          <h3 className="mt-5 text-2xl font-bold tracking-tight">Κάλεσε οδηγό</h3>
          <p className="mt-3 text-base text-muted-foreground leading-relaxed">
            Πατώντας θα ειδοποιηθούν όλοι οι διαθέσιμοι οδηγοί με ρόλο <b>K</b>.
            Θα δουν μόνο το όνομά σας: <b>{storeName}</b>.
            Η κλήση μένει ανοιχτή έως <b>15 λεπτά</b>.
          </p>
          <Button
            type="button"
            className="mt-8 w-full h-16 text-xl font-semibold bg-emerald-600 hover:bg-emerald-700 rounded-2xl shadow-md active:scale-[0.98] transition-transform"
            disabled={loading}
            onClick={() => setConfirmOpen(true)}
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <Loader2 className="h-6 w-6 animate-spin" />
                Δημιουργία…
              </span>
            ) : (
              '📞 Κάλεσε τώρα τον οδηγό'
            )}
          </Button>

          <AlertDialog
            open={confirmOpen}
            onOpenChange={(open) => {
              if (loading && !open) return;
              setConfirmOpen(open);
            }}
          >
            <AlertDialogContent
              onPointerDownOutside={(e) => {
                if (loading) e.preventDefault();
              }}
              onEscapeKeyDown={(e) => {
                if (loading) e.preventDefault();
              }}
            >
              <AlertDialogHeader>
                <AlertDialogTitle>Επιβεβαίωση κλήσης οδηγού</AlertDialogTitle>
                <AlertDialogDescription>
                  Θα στείλετε ειδοποίηση σε όλους τους διαθέσιμους οδηγούς με ρόλο <b>K</b>.
                  Θα βλέπουν μόνο το όνομα: <b>{storeName}</b>.
                  Η κλήση θα μείνει ανοιχτή έως 15 λεπτά. Συνεχίζουμε;
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <Button type="button" variant="outline" onClick={() => setConfirmOpen(false)} disabled={loading}>
                  Ακύρωση
                </Button>
                <Button type="button" onClick={handleCreateCall} disabled={loading}>
                  {loading ? (
                    <span className="flex items-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Δημιουργία…
                    </span>
                  ) : (
                    'Επιβεβαίωση'
                  )}
                </Button>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
          {state.error && <p className="mt-3 text-sm text-destructive">{state.error}</p>}
        </CardContent>
      </Card>
    );
  }

  if (state.status === 'open') {
    return (
      <Card className="w-full max-w-md mx-auto border-amber-500/40 shadow-lg">
        <CardContent className="pt-8 pb-10 px-6 text-center">
          <Loader2 className="mx-auto h-16 w-16 animate-spin text-amber-500" />
          <h3 className="mt-5 text-2xl font-bold">Αναζήτηση οδηγού…</h3>
          <p className="mt-2 text-base text-muted-foreground">
            Η κλήση είναι ενεργή. Οι οδηγοί K έχουν ειδοποιηθεί.
          </p>
          {secondsLeft != null && (
            <div className="mt-5 inline-flex flex-col items-center rounded-2xl bg-amber-500/10 px-6 py-3 border border-amber-500/20">
              <span className="text-xs font-medium uppercase tracking-wide text-amber-700 dark:text-amber-400">
                Απομένει
              </span>
              <span className="text-4xl font-mono font-bold tabular-nums text-amber-600 dark:text-amber-400">
                {formatCountdown(secondsLeft)}
              </span>
            </div>
          )}
          {state.callId && (
            <Button
              type="button"
              variant="outline"
              className="mt-6 w-full h-12 text-base rounded-xl"
              onClick={handleCloseCall}
              disabled={loading}
            >
              <AlertCircle className="mr-2 h-5 w-5" />
              Ακύρωση κλήσης
            </Button>
          )}
        </CardContent>
      </Card>
    );
  }

  if (state.status === 'accepted') {
    return (
      <Card className="w-full max-w-md mx-auto border-emerald-500/40 shadow-lg ring-2 ring-emerald-500/20">
        <CardContent className="pt-8 pb-10 px-6 text-center">
          <div className="mx-auto h-20 w-20 rounded-full bg-emerald-500/15 flex items-center justify-center animate-pulse">
            <CheckCircle className="h-12 w-12 text-emerald-600" />
          </div>
          <h3 className="mt-5 text-2xl font-bold text-emerald-700 dark:text-emerald-400">Οδηγός βρέθηκε!</h3>
          <p className="mt-3 text-lg text-foreground">
            <b>{state.driverName || 'Άγνωστος οδηγός'}</b> αποδέχτηκε την κλήση.
          </p>
          {state.acceptedAt && (
            <p className="mt-1 text-sm text-muted-foreground">
              Αποδεκτή στις{' '}
              {new Date(state.acceptedAt).toLocaleTimeString('el-GR', {
                hour: '2-digit',
                minute: '2-digit',
              })}
            </p>
          )}
          <Button
            type="button"
            className="mt-8 w-full h-16 text-xl font-semibold bg-emerald-600 hover:bg-emerald-700 rounded-2xl shadow-md active:scale-[0.98] transition-transform"
            onClick={() => setConfirmCloseOpen(true)}
            disabled={loading}
          >
            <CheckCircle className="mr-2 h-6 w-6" />
            Ολοκλήρωση & Νέα κλήση
          </Button>
          <AlertDialog open={confirmCloseOpen} onOpenChange={setConfirmCloseOpen}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Ολοκλήρωση κλήσης;</AlertDialogTitle>
                <AlertDialogDescription>
                  Επιβεβαιώνετε ότι ο οδηγός ολοκλήρωσε την κλήση; Μετά μπορείτε να καλέσετε ξανά.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <Button type="button" variant="outline" onClick={() => setConfirmCloseOpen(false)} disabled={loading}>
                  Όχι
                </Button>
                <Button
                  type="button"
                  className="bg-emerald-600 hover:bg-emerald-700"
                  disabled={loading}
                  onClick={async () => {
                    setConfirmCloseOpen(false);
                    await handleCloseCall();
                  }}
                >
                  Ναι, ολοκληρώθηκε
                </Button>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </CardContent>
      </Card>
    );
  }

  // Fallback (should rarely show — closed maps to idle)
  return (
    <Card className="w-full max-w-md mx-auto border-rose-500/30 shadow-lg">
      <CardContent className="pt-8 pb-10 px-6 text-center">
        <AlertCircle className="mx-auto h-14 w-14 text-rose-500" />
        <h3 className="mt-4 text-xl font-bold">Κλήση κλειστή</h3>
        <p className="mt-2 text-muted-foreground">Η προηγούμενη κλήση ολοκληρώθηκε ή ακυρώθηκε.</p>
        <Button type="button" className="mt-6 w-full h-14 text-lg rounded-xl" onClick={() => setState(idleState())}>
          Νέα κλήση
        </Button>
      </CardContent>
    </Card>
  );
}
