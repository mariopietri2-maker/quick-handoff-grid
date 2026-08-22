import { useEffect, useState } from 'react';
import { AlertDialog, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Loader2, Phone, Truck, CheckCircle, AlertCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface Props {
  storeId: string;
  storeName: string;
}

type CallStatus = 'idle' | 'open' | 'accepted' | 'closed';

interface CallState {
  status: CallStatus;
  callId: string | null;
  driverName: string | null;
  acceptedAt: string | null;
  error: string | null;
}

export function StoreCallPanel({ storeId, storeName }: Props) {
  const [state, setState] = useState<CallState>({
    status: 'idle',
    callId: null,
    driverName: null,
    acceptedAt: null,
    error: null,
  });
  const [loading, setLoading] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const { toast } = useToast();

  // Fetch current call state on mount and poll
  const fetchCall = async () => {
    try {
      const { data, error } = await supabase.rpc('my_store_driver_call', {
        p_store_id: storeId,
      });
      if (error) throw error;
      const call = data?.[0];
      if (call) {
        setState({
          status: call.status === 'open' ? 'open' : call.status === 'accepted' ? 'accepted' : 'closed',
          callId: call.id,
          driverName: call.driver_name,
          acceptedAt: call.accepted_at,
          error: null,
        });
      } else {
        setState({ status: 'idle', callId: null, driverName: null, acceptedAt: null, error: null });
      }
    } catch (e: any) {
      console.error('fetch call error', e);
    }
  };

  useEffect(() => {
    fetchCall();
    const interval = setInterval(fetchCall, 5000);
    return () => clearInterval(interval);
  }, [storeId]);

  const handleCreateCall = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.rpc('create_store_driver_call', {
        p_store_id: storeId,
      });
      if (error) throw error;
      const call = data?.[0];
      if (call) {
        setState({ status: 'open', callId: call.id, driverName: null, acceptedAt: null, error: null });
        toast({ title: 'Κλήση δημιουργήθηκε', description: 'Οι διαθέσιμοι οδηγοί Κ έχουν ειδοποιηθεί.' });
        setConfirmOpen(false);
      }
    } catch (e: any) {
      setState(s => ({ ...s, error: e?.message || 'Αποτυχία δημιουργίας κλήσης' }));
      toast({ title: 'Σφάλμα', description: e?.message || 'Αποτυχία δημιουργίας κλήσης', variant: 'destructive' });
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
      setState({ status: 'idle', callId: null, driverName: null, acceptedAt: null, error: null });
      toast({ title: 'Κλήση κλείστηκε' });
    } catch (e: any) {
      toast({ title: 'Σφάλμα', description: e?.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  if (state.status === 'idle') {
    return (
      <Card className="w-full max-w-md mx-auto">
        <CardContent className="pt-6 pb-8 px-6 text-center">
          <Truck className="mx-auto h-14 w-14 text-emerald-600" />
          <h3 className="mt-4 text-xl font-bold">Κάλεσε οδηγό</h3>
          <p className="mt-2 text-muted-foreground">
            Πατώντας θα ειδοποιηθούν όλοι οι διαθέσιμοι οδηγοί με ρόλο <b>K</b>.
            Θα δουν μόνο το όνομά σας: <b>{storeName}</b>.
          </p>
          <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
            <AlertDialogTrigger asChild>
              <Button
                className="mt-6 w-full h-14 text-lg bg-emerald-600 hover:bg-emerald-700"
                disabled={loading}
              >
                {loading ? (
                  <span className="flex items-center justify-center gap-2">
                    <Loader2 className="h-5 w-5 animate-spin" />
                    Δημιουργία…
                  </span>
                ) : (
                  '📞 Κάλεσε τώρα τον οδηγό'
                )}
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Επιβεβαίωση κλήσης οδηγού</AlertDialogTitle>
                <AlertDialogDescription>
                  Θα στείλετε ειδοποίηση σε όλους τους διαθέσιμους οδηγούς με ρόλο <b>K</b>.
                  Θα βλέπουν μόνο το όνομα: <b>{storeName}</b>.
                  Συνεχίζουμε;
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <Button variant="outline" onClick={() => setConfirmOpen(false)}>Ακύρωση</Button>
                <Button onClick={handleCreateCall} disabled={loading}>
                  {loading ? 'Δημιουργία…' : 'Επιβεβαίωση'}
                </Button>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </CardContent>
      </Card>
    );
  }

  if (state.status === 'open') {
    return (
      <Card className="w-full max-w-md mx-auto border-amber-500/30">
        <CardContent className="pt-6 pb-8 px-6 text-center">
          <Loader2 className="mx-auto h-14 w-14 animate-spin text-amber-500" />
          <h3 className="mt-4 text-xl font-bold">Αναζήτηση οδηγού…</h3>
          <p className="mt-2 text-muted-foreground">
            Η κλήση είναι ενεργή. Οι οδηγοί K έχουν ειδοποιηθεί.
          </p>
          {state.callId && (
            <Button
              variant="outline"
              className="mt-4 w-full"
              onClick={handleCloseCall}
              disabled={loading}
            >
              <AlertCircle className="mr-2 h-4 w-4" />
              Ακύρωση κλήσης
            </Button>
          )}
        </CardContent>
      </Card>
    );
  }

  if (state.status === 'accepted') {
    return (
      <Card className="w-full max-w-md mx-auto border-emerald-500/30">
        <CardContent className="pt-6 pb-8 px-6 text-center">
          <CheckCircle className="mx-auto h-14 w-14 text-emerald-600" />
          <h3 className="mt-4 text-xl font-bold">Οδηγός βρέθηκε!</h3>
          <p className="mt-2 text-muted-foreground">
            <b>{state.driverName || 'Άγνωστος οδηγός'}</b> αποδέχτηκε την κλήση.
          </p>
          {state.acceptedAt && (
            <p className="mt-1 text-sm text-muted-foreground">
              Αποδεκτή στις {new Date(state.acceptedAt).toLocaleTimeString('el-GR', { hour: '2-digit', minute: '2-digit' })}
            </p>
          )}
          <Button
            className="mt-6 w-full bg-emerald-600 hover:bg-emerald-700"
            onClick={handleCloseCall}
            disabled={loading}
          >
            <CheckCircle className="mr-2 h-4 w-4" />
            Ολοκλήρωση & Νέα κλήση
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full max-w-md mx-auto border-rose-500/30">
      <CardContent className="pt-6 pb-8 px-6 text-center">
        <AlertCircle className="mx-auto h-14 w-14 text-rose-500" />
        <h3 className="mt-4 text-xl font-bold">Κλήση κλειστή</h3>
        <p className="mt-2 text-muted-foreground">Η προηγούμενη κλήση ολοκληρώθηκε ή ακυρώθηκε.</p>
        <Button className="mt-6 w-full" onClick={() => setState(s => ({ ...s, status: 'idle' }))}>
          Νέα κλήση
        </Button>
      </CardContent>
    </Card>
  );
}