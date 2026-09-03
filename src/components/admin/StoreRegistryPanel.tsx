import { useMemo, useState, useEffect } from 'react';
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
import { Building2, FileText, Pencil, Search, Store } from 'lucide-react';

type StoreRow = {
  id: string;
  name: string;
  legal_name: string | null;
  afm: string | null;
  doy: string | null;
  kad: string | null;
  phone: string | null;
  address: string;
  owner_id: string;
  is_active: boolean | null;
  store_role: string;
  commission_pct: number | null;
  created_at?: string;
};

type Profile = {
  user_id: string;
  full_name: string | null;
  phone: string | null;
};

type Props = {
  stores: StoreRow[] | undefined;
  profiles: Profile[] | undefined;
};

type FormState = {
  name: string;
  legal_name: string;
  afm: string;
  doy: string;
  kad: string;
  phone: string;
  address: string;
  commission_pct: string;
  store_role: string;
};

const emptyForm: FormState = {
  name: '',
  legal_name: '',
  afm: '',
  doy: '',
  kad: '',
  phone: '',
  address: '',
  commission_pct: '',
  store_role: 'standard',
};

function completeness(s: StoreRow) {
  let n = 0;
  if (s.legal_name?.trim()) n++;
  if (s.afm?.trim()) n++;
  if (s.doy?.trim()) n++;
  if (s.kad?.trim()) n++;
  if (s.phone?.trim()) n++;
  return n;
}

export default function StoreRegistryPanel({ stores, profiles }: Props) {
  const queryClient = useQueryClient();
  const [q, setQ] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [isActive, setIsActive] = useState(true);
  const [saving, setSaving] = useState(false);

  const ownerMap = useMemo(() => {
    const m = new Map<string, Profile>();
    for (const p of profiles ?? []) m.set(p.user_id, p);
    return m;
  }, [profiles]);

  const rows = useMemo(() => {
    return (stores ?? [])
      .map((s) => ({
        store: s,
        owner: ownerMap.get(s.owner_id) ?? null,
        score: completeness(s),
      }))
      .filter(({ store, owner }) => {
        if (!q.trim()) return true;
        const s = q.trim().toLowerCase();
        return (
          store.name.toLowerCase().includes(s) ||
          (store.legal_name || '').toLowerCase().includes(s) ||
          (store.afm || '').includes(s) ||
          (store.phone || '').includes(s) ||
          (store.address || '').toLowerCase().includes(s) ||
          (owner?.full_name || '').toLowerCase().includes(s) ||
          store.id.toLowerCase().includes(s)
        );
      })
      .sort((a, b) => a.store.name.localeCompare(b.store.name, 'el'));
  }, [stores, ownerMap, q]);

  const selected = rows.find((r) => r.store.id === selectedId) ?? rows[0] ?? null;

  useEffect(() => {
    if (!selected) return;
    setIsActive(selected.store.is_active !== false);
  }, [selected?.store.id]);

  const startEdit = () => {
    if (!selected) return;
    const s = selected.store;
    setForm({
      name: s.name || '',
      legal_name: s.legal_name || '',
      afm: s.afm || '',
      doy: s.doy || '',
      kad: s.kad || '',
      phone: s.phone || '',
      address: s.address || '',
      commission_pct: s.commission_pct != null ? String(s.commission_pct) : '',
      store_role: s.store_role || 'standard',
    });
    setIsActive(s.is_active !== false);
    setEditing(true);
  };

  const save = async () => {
    if (!selected) return;
    setSaving(true);
    const commission =
      form.commission_pct.trim() === '' ? null : Number(form.commission_pct.replace(',', '.'));
    const { error } = await supabase
      .from('stores')
      .update({
        name: form.name.trim() || selected.store.name,
        legal_name: form.legal_name.trim() || null,
        afm: form.afm.trim() || null,
        doy: form.doy.trim() || null,
        kad: form.kad.trim() || null,
        phone: form.phone.trim() || null,
        address: form.address.trim() || selected.store.address,
        commission_pct: Number.isFinite(commission as number) ? commission : null,
        store_role: form.store_role || 'standard',
        is_active: isActive,
      })
      .eq('id', selected.store.id);
    setSaving(false);
    if (error) {
      toast.error(error.message || 'Αποτυχία αποθήκευσης');
      return;
    }
    toast.success('Το μητρώο καταστήματος ενημερώθηκε');
    setEditing(false);
    queryClient.invalidateQueries({ queryKey: ['admin-stores'] });
  };

  const missingLegal = selected
    ? !(selected.store.legal_name && selected.store.afm && selected.store.doy && selected.store.kad)
    : false;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 flex-wrap">
        <div className="flex items-center gap-2 min-w-0">
          <h2 className="admin-section-title truncate">Μητρώο καταστημάτων</h2>
          <span className="text-[11px] tabular-nums text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
            {rows.length}
          </span>
          <span className="admin-section-sub truncate">· ΑΦΜ · ΔΟΥ · ΚΑΔ · επωνυμία · ρόλος</span>
        </div>
      </div>

      <div className="relative max-w-md">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Αναζήτηση: όνομα, ΑΦΜ, διεύθυνση, ιδιοκτήτης…"
          className="pl-8 h-9 text-[13px]"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-3">
        <div className="lg:col-span-2 admin-card overflow-hidden max-h-[70vh] overflow-y-auto">
          <table className="admin-table">
            <thead className="sticky top-0 bg-card z-10">
              <tr>
                <th>Κατάστημα</th>
                <th>ΑΦΜ</th>
                <th className="text-center">Μητρώο</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(({ store, score }) => {
                const active = selected?.store.id === store.id;
                return (
                  <tr
                    key={store.id}
                    className={`cursor-pointer ${active ? 'bg-primary/10' : ''}`}
                    onClick={() => {
                      setSelectedId(store.id);
                      setEditing(false);
                    }}
                  >
                    <td>
                      <div className="font-medium text-[12.5px] leading-tight truncate max-w-[160px]">
                        {store.name}
                      </div>
                      <div className="text-[10.5px] text-muted-foreground flex items-center gap-1">
                        {store.is_active === false ? (
                          <Badge variant="outline" className="text-[9px] px-1 py-0 h-4 text-destructive border-destructive/40">
                            OFF
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-[9px] px-1 py-0 h-4 text-emerald-600 border-emerald-500/40">
                            ON
                          </Badge>
                        )}
                        <span className="uppercase">{store.store_role || 'standard'}</span>
                      </div>
                    </td>
                    <td className="tabular-nums text-[12px]">{store.afm || '—'}</td>
                    <td className="text-center">
                      <span
                        className={`text-[11px] font-bold tabular-nums ${
                          score >= 4 ? 'text-emerald-600' : score >= 2 ? 'text-amber-600' : 'text-destructive'
                        }`}
                      >
                        {score}/5
                      </span>
                    </td>
                  </tr>
                );
              })}
              {!rows.length && (
                <tr>
                  <td colSpan={3} className="text-center text-muted-foreground py-10">
                    Κανένα κατάστημα
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="lg:col-span-3 space-y-3">
          {!selected ? (
            <div className="admin-card p-8 text-center text-muted-foreground text-sm">
              Επιλέξτε κατάστημα από τη λίστα
            </div>
          ) : (
            <>
              <div className="admin-card p-4">
                <div className="flex items-start gap-3">
                  <div className="h-12 w-12 rounded-xl bg-warning/10 flex items-center justify-center shrink-0">
                    <Store className="h-6 w-6 text-warning" />
                  </div>
                  <div className="min-w-0 flex-1">
                    {!editing ? (
                      <>
                        <h3 className="font-semibold text-[15px] truncate">{selected.store.name}</h3>
                        <p className="text-[12px] text-muted-foreground truncate">
                          {selected.store.legal_name || 'Χωρίς επωνυμία'} · {selected.store.phone || '—'}
                        </p>
                        {missingLegal && (
                          <p className="text-[11px] text-amber-600 mt-1 flex items-center gap-1">
                            <FileText className="h-3 w-3" />
                            Ελλιπή νομικά στοιχεία (ΑΦΜ / ΔΟΥ / ΚΑΔ / επωνυμία)
                          </p>
                        )}
                      </>
                    ) : (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        <Input
                          value={form.name}
                          onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                          placeholder="Εμπορική ονομασία *"
                          className="h-9 text-[13px]"
                        />
                        <Input
                          value={form.legal_name}
                          onChange={(e) => setForm((f) => ({ ...f, legal_name: e.target.value }))}
                          placeholder="Επωνυμία (νομική)"
                          className="h-9 text-[13px]"
                        />
                      </div>
                    )}
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
              </div>

              <div className="admin-card p-4 space-y-3">
                <h4 className="text-[12px] font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
                  <Building2 className="h-3.5 w-3.5" />
                  Νομικά / ΑΑΔΕ
                </h4>
                {!editing ? (
                  <div className="grid grid-cols-2 gap-3 text-[13px]">
                    <Field label="Επωνυμία" value={selected.store.legal_name} />
                    <Field label="ΑΦΜ" value={selected.store.afm} mono />
                    <Field label="ΔΟΥ" value={selected.store.doy} />
                    <Field label="ΚΑΔ" value={selected.store.kad} mono />
                    <Field label="Τηλέφωνο" value={selected.store.phone} mono />
                    <Field label="Διεύθυνση" value={selected.store.address} />
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <Input value={form.afm} onChange={(e) => setForm((f) => ({ ...f, afm: e.target.value }))} placeholder="ΑΦΜ" className="h-9 text-[13px]" />
                    <Input value={form.doy} onChange={(e) => setForm((f) => ({ ...f, doy: e.target.value }))} placeholder="ΔΟΥ" className="h-9 text-[13px]" />
                    <Input value={form.kad} onChange={(e) => setForm((f) => ({ ...f, kad: e.target.value }))} placeholder="ΚΑΔ" className="h-9 text-[13px]" />
                    <Input value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} placeholder="Τηλέφωνο" className="h-9 text-[13px]" />
                    <Input value={form.address} onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))} placeholder="Διεύθυνση" className="h-9 text-[13px] sm:col-span-2" />
                  </div>
                )}
              </div>

              <div className="admin-card p-4 space-y-3">
                <h4 className="text-[12px] font-semibold text-muted-foreground uppercase tracking-wide">Λειτουργία πλατφόρμας</h4>
                {!editing ? (
                  <div className="grid grid-cols-2 gap-3 text-[13px]">
                    <Field label="Ρόλος" value={(selected.store.store_role || 'standard').toUpperCase()} />
                    <Field label="Προμήθεια %" value={selected.store.commission_pct != null ? `${selected.store.commission_pct}%` : 'Προεπιλογή πλατφόρμας'} />
                    <Field label="Κατάσταση" value={selected.store.is_active === false ? 'Ανενεργό' : 'Ενεργό'} />
                    <Field label="Ιδιοκτήτης" value={selected.owner?.full_name || selected.owner?.phone || selected.store.owner_id.slice(0, 8) + '…'} />
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-center">
                    <div className="space-y-1">
                      <label className="text-[11px] text-muted-foreground">Ρόλος (standard / N / K)</label>
                      <Select value={form.store_role} onValueChange={(v) => setForm((f) => ({ ...f, store_role: v }))}>
                        <SelectTrigger className="h-9 text-[13px]"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="standard">standard — κανονικές παραγγελίες</SelectItem>
                          <SelectItem value="N">N — call store</SelectItem>
                          <SelectItem value="K">K — μόνο calls</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1">
                      <label className="text-[11px] text-muted-foreground">Προμήθεια %</label>
                      <Input value={form.commission_pct} onChange={(e) => setForm((f) => ({ ...f, commission_pct: e.target.value }))} placeholder="κενό = default πλατφόρμας" className="h-9 text-[13px]" />
                    </div>
                    <div className="flex items-center justify-between sm:col-span-2 rounded-lg border border-border px-3 py-2">
                      <span className="text-[13px]">Ενεργό κατάστημα</span>
                      <Switch checked={isActive} onCheckedChange={setIsActive} />
                    </div>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function Field({ label, value, mono }: { label: string; value: string | null | undefined; mono?: boolean }) {
  return (
    <div>
      <div className="text-[10.5px] uppercase tracking-wide text-muted-foreground mb-0.5">{label}</div>
      <div className={`text-[13px] ${mono ? 'tabular-nums font-medium' : ''} break-words`}>
        {value?.trim() ? value : <span className="text-muted-foreground">—</span>}
      </div>
    </div>
  );
}
