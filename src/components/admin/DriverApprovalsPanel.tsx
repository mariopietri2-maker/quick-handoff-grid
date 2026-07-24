import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { formatDriverCode } from '@/lib/driver-code';
import { Check, UserX } from 'lucide-react';
import { format } from 'date-fns';
import { el } from 'date-fns/locale';

type Profile = {
  id: string;
  user_id: string;
  full_name: string | null;
  phone: string | null;
  created_at: string;
  role: string;
};

type DriverProfile = {
  user_id: string;
  driver_code: string | null;
  is_active: boolean | null;
  suspended_at?: string | null;
  created_at?: string | null;
};

type Props = {
  profiles: Profile[] | undefined;
  driverProfiles: DriverProfile[] | undefined;
  onApprove: (userId: string, name: string) => void | Promise<void>;
  onReject: (userId: string, name: string) => void | Promise<void>;
};

export default function DriverApprovalsPanel({
  profiles,
  driverProfiles,
  onApprove,
  onReject,
}: Props) {
  const dpByUser = new Map((driverProfiles ?? []).map((d) => [d.user_id, d]));

  const pending = (profiles ?? [])
    .filter((p) => p.role === 'driver' || p.role === 'm')
    .map((p) => {
      const dp = dpByUser.get(p.user_id);
      return { profile: p, dp };
    })
    .filter(({ dp }) => !dp || dp.is_active === false)
    .sort((a, b) => {
      const ta = new Date(a.dp?.created_at || a.profile.created_at).getTime();
      const tb = new Date(b.dp?.created_at || b.profile.created_at).getTime();
      return tb - ta;
    });

  return (
    <div className="space-y-3">
      <div className="admin-section-header">
        <div className="flex items-baseline gap-2 min-w-0">
          <h2 className="admin-section-title truncate">Έγκριση οδηγών</h2>
          <span className="text-[11px] tabular-nums text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
            {pending.length}
          </span>
          <span className="admin-section-sub truncate">· νέοι λογαριασμοί σε αναμονή</span>
        </div>
      </div>

      <p className="text-[12.5px] text-muted-foreground px-0.5">
        Όταν ένας οδηγός δημιουργεί λογαριασμό από την εφαρμογή, μένει ανενεργός μέχρι να τον εγκρίνετε εδώ.
      </p>

      <div className="admin-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Κωδ.</th>
                <th>Όνομα</th>
                <th>Τηλέφωνο</th>
                <th>Εγγραφή</th>
                <th>Κατάσταση</th>
                <th className="text-right pr-3">Ενέργειες</th>
              </tr>
            </thead>
            <tbody>
              {pending.map(({ profile, dp }) => {
                const name = profile.full_name || 'Οδηγός';
                const registeredAt = dp?.created_at || profile.created_at;
                const isSuspended = !!dp?.suspended_at;
                return (
                  <tr key={profile.user_id} className={isSuspended ? 'opacity-60' : ''}>
                    <td>
                      <span className="font-mono text-[11px] text-muted-foreground">
                        {formatDriverCode(dp?.driver_code) || '—'}
                      </span>
                    </td>
                    <td>
                      <div className="flex items-center gap-1.5">
                        <span className="font-medium leading-tight">{name}</span>
                        {isSuspended && (
                          <Badge variant="outline" className="h-4 px-1 text-[9px] text-destructive border-destructive/40">
                            Ανεστάλη
                          </Badge>
                        )}
                      </div>
                    </td>
                    <td className="tabular-nums text-[12px] text-muted-foreground">
                      {profile.phone || '—'}
                    </td>
                    <td className="text-[11.5px] text-muted-foreground tabular-nums whitespace-nowrap">
                      {registeredAt
                        ? format(new Date(registeredAt), 'd MMM yyyy, HH:mm', { locale: el })
                        : '—'}
                    </td>
                    <td>
                      <Badge variant="secondary" className="h-5 px-1.5 text-[10.5px] bg-warning/15 text-warning border-warning/30">
                        Σε αναμονή
                      </Badge>
                    </td>
                    <td>
                      <div className="flex items-center justify-end gap-1.5 pr-2">
                        <Button
                          size="sm"
                          className="h-7 px-2.5 text-[11px] gap-1"
                          disabled={isSuspended}
                          onClick={() => onApprove(profile.user_id, name)}
                        >
                          <Check className="h-3.5 w-3.5" />
                          Έγκριση
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 px-2.5 text-[11px] gap-1 text-muted-foreground"
                          title="Παραμένει ανενεργός"
                          onClick={() => onReject(profile.user_id, name)}
                        >
                          <UserX className="h-3.5 w-3.5" />
                          Απόρριψη
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {!pending.length && (
                <tr>
                  <td colSpan={6} className="text-center text-muted-foreground py-10">
                    Δεν υπάρχουν οδηγοί σε αναμονή έγκρισης
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
