import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Shield } from 'lucide-react';
import { format } from 'date-fns';
import { SectionHeader } from './AdminSectionHeader';

export function UsersSection({ profiles, adminUserIds, driverCodeMap, onChangeRole, onToggleAdmin }: any) {
  return (
    <div className="space-y-3">
      <SectionHeader title="Χρήστες & Δικαιώματα" count={profiles?.length ?? 0} />
      <div className="admin-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="admin-table">
            <thead><tr><th>Όνομα</th><th>Κωδικός</th><th>Ρόλος</th><th>Admin</th><th>Τηλέφωνο</th><th>Εγγραφή</th></tr></thead>
            <tbody>
              {profiles?.map((profile: any) => (
                <tr key={profile.id}>
                  <td className="font-medium">{profile.full_name || '—'}</td>
                  <td>{driverCodeMap.get(profile.user_id) ? <span className="font-mono text-[11px] text-muted-foreground">{driverCodeMap.get(profile.user_id)}</span> : '—'}</td>
                  <td>
                    <Select value={profile.role} onValueChange={val => onChangeRole(profile.user_id, val)}>
                      <SelectTrigger className="w-28 h-7 text-[11.5px]"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {(['customer','driver','m','store'] as const).map(r => (
                          <SelectItem key={r} value={r}>
                            {{ customer: 'Πελάτης', driver: 'Οδηγός', m: 'M (Monitor)', store: 'Κατάστημα' }[r]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </td>
                  <td>
                    <div className="flex items-center gap-1.5">
                      <Switch checked={adminUserIds.has(profile.user_id)} onCheckedChange={() => onToggleAdmin(profile.user_id, adminUserIds.has(profile.user_id))} />
                      {adminUserIds.has(profile.user_id) && (
                        <span className="admin-pill bg-primary/10 text-primary border-primary/30"><Shield className="h-2.5 w-2.5" />Admin</span>
                      )}
                    </div>
                  </td>
                  <td className="text-muted-foreground tabular-nums">{profile.phone || '—'}</td>
                  <td className="text-[11.5px] text-muted-foreground tabular-nums">{format(new Date(profile.created_at), 'dd MMM yyyy')}</td>
                </tr>
              ))}
              {!profiles?.length && <tr><td colSpan={6} className="text-center text-muted-foreground py-10">Κανένας χρήστης</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}