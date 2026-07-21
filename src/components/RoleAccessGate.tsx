import { useEffect, useState } from 'react';
import { Car, LogOut, Loader2 } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { useMobileFlavor } from '@/lib/mobileApp';
import { syncRoleForMobileShell } from '@/lib/syncAppRole';

/**
 * Shown when a signed-in user hits a role-gated route they can't access.
 * Especially important for the driver APK: sending them to `/` causes an
 * infinite MobileAppGate ↔ ProtectedRoute redirect loop (blank white screen).
 */
export default function RoleAccessGate({
  required,
}: {
  required: 'driver' | 'customer' | 'store' | 'generic';
}) {
  const { profile, signOut, refreshProfile } = useAuth();
  const [busy, setBusy] = useState(false);
  const [autoTried, setAutoTried] = useState(false);
  const { flavor } = useMobileFlavor();
  const role = profile?.role ?? 'customer';

  const canSyncDriver =
    required === 'driver' &&
    role === 'customer' &&
    (flavor === 'driver' || flavor === 'shared');

  const syncDriver = async (silent = false) => {
    setBusy(true);
    try {
      const res = await syncRoleForMobileShell('driver');
      if (!res.ok) throw new Error(res.error || 'Αποτυχία');
      await refreshProfile();
      if (!silent) toast.success('Ρόλος οδηγού ορίστηκε. Αναμονή έγκρισης.');
    } catch (e: any) {
      if (!silent) toast.error(e?.message || 'Αποτυχία αιτήματος');
    } finally {
      setBusy(false);
    }
  };

  // Driver APK: auto-claim pending driver role so first install doesn't stick on this gate.
  useEffect(() => {
    if (!canSyncDriver || autoTried) return;
    setAutoTried(true);
    void syncDriver(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canSyncDriver, autoTried]);

  const title =
    required === 'driver'
      ? 'Λογαριασμός οδηγού'
      : required === 'customer'
        ? 'Λογαριασμός πελάτη'
        : 'Δεν έχετε πρόσβαση';

  const body =
    required === 'driver' && role === 'customer'
      ? busy
        ? 'Ενεργοποίηση λογαριασμού οδηγού…'
        : 'Ο λογαριασμός σας είναι πελάτης. Για την εφαρμογή οδηγού χρειάζεται ρόλος οδηγού και έγκριση από το admin.'
      : `Συνδεθήκατε ως «${role}». Αυτή η οθόνη απαιτεί διαφορετικό ρόλο.`;

  return (
    <div className="min-h-[100dvh] bg-[hsl(220,20%,7%)] flex items-center justify-center p-6">
      <div className="text-center max-w-sm space-y-4">
        <div className="h-20 w-20 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto border border-primary/20">
          {busy ? (
            <Loader2 className="h-10 w-10 text-primary animate-spin" />
          ) : (
            <Car className="h-10 w-10 text-primary" />
          )}
        </div>
        <h1 className="font-heading text-2xl font-bold text-[hsl(220,14%,96%)]">{title}</h1>
        <p className="text-[hsl(220,10%,60%)] text-sm leading-relaxed">{body}</p>
        <div className="flex flex-col gap-2 pt-2">
          {canSyncDriver && !busy && (
            <Button onClick={() => syncDriver(false)} disabled={busy} className="w-full gap-2">
              Αίτημα πρόσβασης οδηγού
            </Button>
          )}
          <Button
            variant="outline"
            className="w-full gap-2 border-[hsl(220,20%,18%)] text-[hsl(220,14%,96%)]"
            onClick={() => signOut()}
          >
            <LogOut className="h-4 w-4" />
            Αποσύνδεση
          </Button>
        </div>
      </div>
    </div>
  );
}
