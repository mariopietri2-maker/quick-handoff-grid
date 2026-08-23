import { useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { formatDriverCode } from '@/lib/driver-code';
import type { DriverProfileRow } from '@/hooks/useAdminData';
import { ExternalLink, FileText, IdCard, Pencil, Search, User } from 'lucide-react';
import { format } from 'date-fns';
import { el } from 'date-fns/locale';

type Profile = {
  id?: string;
  user_id: string;
  full_name: string | null;
  phone: string | null;
  created_at?: string;
  role?: string;
};

type Props = {
  profiles: Profile[] | undefined;
  driverProfiles: DriverProfileRow[] | undefined;
};

type FormState = {
  full_name: string;
  phone: string;
  secondary_phone: string;
  home_address: string;
  date_of_birth: string;
  emergency_contact_name: string;
  emergency_contact_phone: string;
  vehicle_type: string;
  vehicle_make: string;
  vehicle_model: string;
  vehicle_year: string;
  vehicle_color: string;
  license_plate: string;
  license_number: string;
  license_expiry: string;
  iban: string;
  bank_name: string;
  account_holder: string;
};

function docStatus(url: string | null | undefined) {
  return url && url.trim().length > 0;
}

const emptyForm: FormState = {
  full_name: '',
  phone: '',
  secondary_phone: '',
  home_address: '',
  date_of_birth: '',
  emergency_contact_name: '',
  emergency_contact_phone: '',
  vehicle_type: '',
  vehicle_make: '',
  vehicle_model: '',
  vehicle_year: '',
  vehicle_color: '',
  license_plate: '',
  license_number: '',
  license_expiry: '',
  iban: '',
  bank_name: '',
  account_holder: '',
};

export default function DriverRegistryPanel({ profiles, driverProfiles }: Props) {
  const queryClient = useQueryClient();
  const [q, setQ] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [isActive, setIsActive] = useState(true);
  const [callRole, setCallRole] = useState<string>('standard');
  const [saving, setSaving] = useState(false);

  const rows = useMemo(() => {
    const dpByUser = new Map((driverProfiles ?? []).map((d) => [d.user_id, d]));
    return (profiles ?? [])
      .filter((p) => p.role === 'driver' || p.role === 'm' || dpByUser.has(p.user_id))
      .map((p) => ({
        profile: p,
        dp: dpByUser.get(p.user_id),
      }))
      .filter(({ profile, dp }) => {
        if (!q.trim()) return true;
        const s = q.trim().toLowerCase();
        const code = formatDriverCode(dp?.driver_code) || '';
        return (
          (profile.full_name || '').toLowerCase().includes(s) ||
          (profile.phone || '').includes(s) ||
          code.toLowerCase().includes(s) ||
          profile.user_id.toLowerCase().includes(s) ||
          (dp?.license_plate || '').toLowerCase().includes(s) ||
          (dp?.license_number || '').toLowerCase().includes(s)
        );
      })
      .sort((a, b) => {
        const ca = formatDriverCode(a.dp?.driver_code) || 'zzz';
        const cb = formatDriverCode(b.dp?.driver_code) || 'zzz';
        return ca.localeCompare(cb);
      });
  }, [profiles, driverProfiles, q]);

  const selected = rows.find((r) => r.profile.user_id === selectedId) ?? rows[0] ?? null;

  function startEdit() {
    if (!selected) return;
    const d = selected.dp;
    setForm({
      full_name: selected.profile.full_name ?? '',
      phone: selected.profile.phone ?? '',
      secondary_phone: d?.secondary_phone ?? '',
      home_address: d?.home_address ?? '',
      date_of_birth: d?.date_of_birth ?? '',
      emergency_contact_name: d?.emergency_contact_name ?? '',
      emergency_contact_phone: d?.emergency_contact_phone ?? '',
      vehicle_type: d?.vehicle_type ?? '',
      vehicle_make: d?.vehicle_make ?? '',
      vehicle_model: d?.vehicle_model ?? '',
      vehicle_year: d?.vehicle_year != null ? String(d.vehicle_year) : '',
      vehicle_color: d?.vehicle_color ?? '',
      license_plate: d?.license_plate ?? '',
      license_number: d?.license_number ?? '',
      license_expiry: d?.license_expiry ?? '',
      iban: d?.iban ?? '',
      bank_name: d?.bank_name ?? '',
      account_holder: d?.account_holder ?? '',
    });
    setIsActive(d?.is_active !== false);
    setCallRole(d?.call_role || 'standard');
    setEditing(true);
  }

  async function save() {
    if (!selected) return;
    const uid = selected.profile.user_id;
    setSaving(true);
    try {
      const nameChanged =
        form.full_name !== (selected.profile.full_name ?? '') ||
        form.phone !== (selected.profile.phone ?? '');
      if (nameChanged) {
        const { error } = await supabase
          .from('profiles')
          .update({ full_name: form.full_name.trim() || null, phone: form.phone.trim() || null })
          .eq('user_id', uid);
        if (error) throw error;
      }

      const dpPatch: Record<string, unknown> = {};
      const d = selected.dp;
      const put = (k: keyof FormState, cur: unknown) => {
        const v = form[k].trim();
        if (v !== (cur == null ? '' : String(cur))) dpPatch[k] = v === '' ? null : v;
      };
      put('secondary_phone', d?.secondary_phone);
      put('home_address', d?.home_address);
      put('date_of_birth', d?.date_of_birth);
      put('emergency_contact_name', d?.emergency_contact_name);
      put('emergency_contact_phone', d?.emergency_contact_phone);
      put('vehicle_type', d?.vehicle_type);
      put('vehicle_make', d?.vehicle_make);
      put('vehicle_model', d?.vehicle_model);
      put('vehicle_year', d?.vehicle_year);
      put('vehicle_color', d?.vehicle_color);
      put('license_plate', d?.license_plate);
      put('license_number', d?.license_number);
      put('license_expiry', d?.license_expiry);
      put('iban', d?.iban);
      put('bank_name', d?.bank_name);
      put('account_holder', d?.account_holder);

      const activeChanged = isActive !== (d?.is_active !== false);
      if (activeChanged) dpPatch.is_active = isActive;
      const roleChanged = callRole !== (d?.call_role || 'standard');
      if (roleChanged) dpPatch.call_role = callRole;

      if (Object.keys(dpPatch).length) {
        const { error } = await supabase
          .from('driver_profiles')
          .update(dpPatch)
          .eq('user_id', uid);
        if (error) throw error;
      }

      await queryClient.invalidateQueries({ queryKey: ['admin-profiles'] });
      await queryClient.invalidateQueries({ queryKey: ['admin-driver-profiles'] });
      toast.success('Το μητρώο ενημερώθηκε');
      setEditing(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Αποτυχία αποθήκευσης');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-3">
      <div className="admin-section-header">
        <div className="flex items-baseline gap-2 min-w-0 flex-wrap">
          <h2 className="admin-section-title truncate">Μητρώο οδηγών</h2>
          <span className="text-[11px] tabular-nums text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
            {rows.length}
          </span>
          <span className="admin-section-sub truncate">· ID · στοιχεία · έγγραφα · επεξεργασία</span>
        </div>
      </div>

      <div className="relative max-w-md">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Αναζήτηση: όνομα, τηλ, κωδ., πινακίδα, άδεια…"
          className="pl-8 h-9 text-[13px]"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-3">
        {/* List */}
        <div className="lg:col-span-2 admin-card overflow-hidden max-h-[70vh] overflow-y-auto">
          <table className="admin-table">
            <thead className="sticky top-0 bg-card z-10">
              <tr>
                <th>Κωδ.</th>
                <th>Όνομα</th>
                <th>Έγγραφα</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(({ profile, dp }) => {
                const active = selected?.profile.user_id === profile.user_id;
                const hasId = docStatus(dp?.id_document_url);
                const hasLic = docStatus(dp?.license_document_url);
                return (
                  <tr
                    key={profile.user_id}
                    className={`cursor-pointer ${active ? 'bg-primary/10' : ''}`}
                    onClick={() => {
                      setSelectedId(profile.user_id);
                      setEditing(false);
                    }}
                  >
                    <td>
                      <span className="font-mono text-[11px] text-muted-foreground">
                        {formatDriverCode(dp?.driver_code) || '—'}
                      </span>
                    </td>
                    <td>
                      <div className="font-medium text-[12.5px] leading-tight">
                        {profile.full_name || 'Οδηγός'}
                      </div>
                      <div className="text-[10.5px] text-muted-foreground tabular-nums">
                        {profile.phone || '—'}
                      </div>
                    </td>
                    <td>
                      <div className="flex gap-1">
                        <Badge
                          variant="outline"
                          className={`h-5 px-1 text-[9px] ${
                            hasId ? 'border-success/40 text-success' : 'text-muted-foreground'
                          }`}
                        >
                          ID
                        </Badge>
                        <Badge
                          variant="outline"
                          className={`h-5 px-1 text-[9px] ${
                            hasLic ? 'border-success/40 text-success' : 'text-muted-foreground'
                          }`}
                        >
                          Άδεια
                        </Badge>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {!rows.length && (
                <tr>
                  <td colSpan={3} className="text-center text-muted-foreground py-10">
                    Κανένας οδηγός
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Detail */}
        <div className="lg:col-span-3 admin-card p-4 space-y-4 max-h-[70vh] overflow-y-auto">
          {!selected ? (
            <p className="text-sm text-muted-foreground py-8 text-center">Επίλεξε οδηγό από τη λίστα</p>
          ) : (
            <>
              <div className="flex items-start gap-3">
                <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                  <User className="h-6 w-6 text-primary" />
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="font-semibold text-[15px] truncate">
                    {selected.profile.full_name || 'Οδηγός'}
                  </h3>
                  <p className="text-[12px] text-muted-foreground font-mono">
                    ID: {formatDriverCode(selected.dp?.driver_code) || '—'} ·{' '}
                    <span className="text-[10px] opacity-70">{selected.profile.user_id.slice(0, 8)}…</span>
                  </p>
                  <div className="flex flex-wrap gap-1.5 mt-1.5">
                    {selected.dp?.is_active !== false ? (
                      <Badge className="h-5 text-[10px] bg-success/15 text-success border-success/30" variant="outline">
                        Ενεργός
                      </Badge>
                    ) : (
                      <Badge className="h-5 text-[10px] bg-warning/15 text-warning border-warning/30" variant="outline">
                        Ανενεργός
                      </Badge>
                    )}
                    {selected.dp?.suspended_at && (
                      <Badge variant="destructive" className="h-5 text-[10px]">
                        Ανεστάλη
                      </Badge>
                    )}
                    {selected.dp?.call_role && (
                      <Badge variant="secondary" className="h-5 text-[10px]">
                        Call: {selected.dp.call_role}
                      </Badge>
                    )}
                  </div>
                </div>
                {!editing ? (
                  <Button size="sm" variant="outline" className="h-8 gap-1.5" onClick={startEdit}>
                    <Pencil className="h-3.5 w-3.5" />
                    Επεξεργασία
                  </Button>
                ) : (
                  <div className="flex gap-1.5">
                    <Button size="sm" variant="ghost" className="h-8" onClick={() => setEditing(false)} disabled={saving}>
                      Άκυρο
                    </Button>
                    <Button size="sm" className="h-8" onClick={save} disabled={saving}>
                      {saving ? 'Αποθήκευση…' : 'Αποθήκευση'}
                    </Button>
                  </div>
                )}
              </div>

              {editing && (
                <div className="rounded-lg border border-primary/30 bg-primary/5 px-3 py-2 flex flex-wrap items-center gap-x-6 gap-y-2">
                  <label className="flex items-center gap-2 text-[12.5px]">
                    <Switch checked={isActive} onCheckedChange={setIsActive} />
                    Ενεργός λογαριασμός
                  </label>
                  <label className="flex items-center gap-2 text-[12.5px]">
                    Call ρόλος:
                    <Select value={callRole} onValueChange={setCallRole}>
                      <SelectTrigger className="h-8 w-[130px] text-[12px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="standard">Κανονικός</SelectItem>
                        <SelectItem value="K">K — κλήσεις καταστημάτων</SelectItem>
                      </SelectContent>
                    </Select>
                  </label>
                </div>
              )}

              {editing ? (
                <>
                  <EditSection title="Επικοινωνία">
                    <EditField label="Ονοματεπώνυμο" value={form.full_name} onChange={(v) => setForm((f) => ({ ...f, full_name: v }))} />
                    <EditField label="Τηλέφωνο" value={form.phone} onChange={(v) => setForm((f) => ({ ...f, phone: v }))} />
                    <EditField label="Δεύτερο τηλ." value={form.secondary_phone} onChange={(v) => setForm((f) => ({ ...f, secondary_phone: v }))} />
                    <EditField label="Διεύθυνση" value={form.home_address} onChange={(v) => setForm((f) => ({ ...f, home_address: v }))} />
                    <EditField label="Ημ. γέννησης" type="date" value={form.date_of_birth} onChange={(v) => setForm((f) => ({ ...f, date_of_birth: v }))} />
                    <EditField label="Επικοινωνία έκτακτης ανάγκης" value={form.emergency_contact_name} onChange={(v) => setForm((f) => ({ ...f, emergency_contact_name: v }))} />
                    <EditField label="Τηλ. έκτακτης ανάγκης" value={form.emergency_contact_phone} onChange={(v) => setForm((f) => ({ ...f, emergency_contact_phone: v }))} />
                  </EditSection>

                  <EditSection title="Όχημα">
                    <EditField label="Τύπος" value={form.vehicle_type} onChange={(v) => setForm((f) => ({ ...f, vehicle_type: v }))} />
                    <EditField label="Μάρκα" value={form.vehicle_make} onChange={(v) => setForm((f) => ({ ...f, vehicle_make: v }))} />
                    <EditField label="Μοντέλο" value={form.vehicle_model} onChange={(v) => setForm((f) => ({ ...f, vehicle_model: v }))} />
                    <EditField label="Έτος" value={form.vehicle_year} onChange={(v) => setForm((f) => ({ ...f, vehicle_year: v }))} />
                    <EditField label="Χρώμα" value={form.vehicle_color} onChange={(v) => setForm((f) => ({ ...f, vehicle_color: v }))} />
                    <EditField label="Πινακίδα" value={form.license_plate} onChange={(v) => setForm((f) => ({ ...f, license_plate: v }))} mono />
                  </EditSection>

                  <EditSection title="Άδεια οδήγησης">
                    <EditField label="Αριθμός άδειας" value={form.license_number} onChange={(v) => setForm((f) => ({ ...f, license_number: v }))} mono />
                    <EditField label="Λήξη" type="date" value={form.license_expiry} onChange={(v) => setForm((f) => ({ ...f, license_expiry: v }))} />
                  </EditSection>

                  <EditSection title="Τραπεζικά">
                    <EditField label="IBAN" value={form.iban} onChange={(v) => setForm((f) => ({ ...f, iban: v }))} mono />
                    <EditField label="Τράπεζα" value={form.bank_name} onChange={(v) => setForm((f) => ({ ...f, bank_name: v }))} />
                    <EditField label="Δικαιούχος" value={form.account_holder} onChange={(v) => setForm((f) => ({ ...f, account_holder: v }))} />
                  </EditSection>
                </>
              ) : (
                <>
                  <Section title="Επικοινωνία">
                    <Field label="Τηλέφωνο" value={selected.profile.phone} />
                    <Field label="Δεύτερο τηλ." value={selected.dp?.secondary_phone} />
                    <Field label="Διεύθυνση" value={selected.dp?.home_address} />
                    <Field label="Ημ. γέννησης" value={selected.dp?.date_of_birth} />
                    <Field
                      label="Έκτακτη επαφή"
                      value={
                        [selected.dp?.emergency_contact_name, selected.dp?.emergency_contact_phone]
                          .filter(Boolean)
                          .join(' · ') || null
                      }
                    />
                  </Section>

                  <Section title="Όχημα">
                    <Field label="Τύπος" value={selected.dp?.vehicle_type} />
                    <Field
                      label="Μάρκα / Μοντέλο"
                      value={
                        [selected.dp?.vehicle_make, selected.dp?.vehicle_model, selected.dp?.vehicle_year]
                          .filter(Boolean)
                          .join(' ') || null
                      }
                    />
                    <Field label="Χρώμα" value={selected.dp?.vehicle_color} />
                    <Field label="Πινακίδα" value={selected.dp?.license_plate} mono />
                  </Section>

                  <Section title="Άδεια οδήγησης">
                    <Field label="Αριθμός άδειας" value={selected.dp?.license_number} mono />
                    <Field label="Λήξη" value={selected.dp?.license_expiry} />
                  </Section>

                  <Section title="Τραπεζικά">
                    <Field label="IBAN" value={selected.dp?.iban} mono />
                    <Field label="Τράπεζα" value={selected.dp?.bank_name} />
                    <Field label="Δικαιούχος" value={selected.dp?.account_holder} />
                  </Section>

                  <Section title="Έγγραφα">
                    <DocRow
                      icon={<IdCard className="h-4 w-4" />}
                      label="Ταυτότητα / διαβατήριο"
                      url={selected.dp?.id_document_url}
                    />
                    <DocRow
                      icon={<FileText className="h-4 w-4" />}
                      label="Άδεια οδήγησης (αρχείο)"
                      url={selected.dp?.license_document_url}
                    />
                    <p className="text-[11px] text-muted-foreground pt-1">
                      Τα αρχεία ανεβαίνουν από τον οδηγό (ή admin) στο προφίλ · εμφανίζονται εδώ όταν υπάρχει URL.
                    </p>
                  </Section>
                </>
              )}

              {selected.dp?.suspension_reason && !editing && (
                <Section title="Αναστολή">
                  <p className="text-[12.5px] text-destructive">{selected.dp.suspension_reason}</p>
                </Section>
              )}

              <p className="text-[10.5px] text-muted-foreground tabular-nums">
                Εγγραφή:{' '}
                {selected.dp?.created_at || selected.profile.created_at
                  ? format(
                      new Date(selected.dp?.created_at || selected.profile.created_at!),
                      'd MMM yyyy, HH:mm',
                      { locale: el },
                    )
                  : '—'}
                {selected.dp?.updated_at &&
                  ` · Ενημ. ${format(new Date(selected.dp.updated_at), 'd MMM yyyy', { locale: el })}`}
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <h4 className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{title}</h4>
      <div className="rounded-lg border border-border/60 bg-muted/20 px-3 py-2 space-y-1">{children}</div>
    </div>
  );
}

function EditSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <h4 className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{title}</h4>
      <div className="rounded-lg border border-border/60 bg-background px-3 py-2 space-y-2">{children}</div>
    </div>
  );
}

function Field({ label, value, mono }: { label: string; value?: string | null; mono?: boolean }) {
  return (
    <div className="flex gap-2 text-[12.5px]">
      <span className="text-muted-foreground w-[110px] shrink-0">{label}</span>
      <span className={`min-w-0 break-all ${mono ? 'font-mono text-[11.5px]' : 'font-medium'}`}>
        {value?.trim() || '—'}
      </span>
    </div>
  );
}

function EditField({
  label,
  value,
  onChange,
  mono,
  type = 'text',
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  mono?: boolean;
  type?: string;
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-muted-foreground text-[11.5px] w-[150px] shrink-0">{label}</span>
      <Input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={`h-8 text-[12.5px] ${mono ? 'font-mono' : ''}`}
      />
    </div>
  );
}

function DocRow({
  icon,
  label,
  url,
}: {
  icon: React.ReactNode;
  label: string;
  url?: string | null;
}) {
  const ok = docStatus(url);
  return (
    <div className="flex items-center gap-2 text-[12.5px] py-1">
      <span className="text-muted-foreground">{icon}</span>
      <span className="flex-1">{label}</span>
      {ok ? (
        <Button variant="outline" size="sm" className="h-7 text-[11px] gap-1" asChild>
          <a href={url!} target="_blank" rel="noopener noreferrer">
            <ExternalLink className="h-3 w-3" />
            Άνοιγμα
          </a>
        </Button>
      ) : (
        <Badge variant="secondary" className="h-5 text-[10px]">
          Δεν έχει ανέβει
        </Badge>
      )}
    </div>
  );
}
