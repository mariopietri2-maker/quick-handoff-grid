import { useEffect, useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { supabase } from '@/integrations/supabase/client';
import { MapPin, Pencil, Search, ShoppingBag, Ticket, User } from 'lucide-react';
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

type OrderLite = {
  id: string;
  customer_id: string | null;
  status: string | null;
  total_amount: number | null;
  created_at: string | null;
};

type SavedAddressRow = {
  id: string;
  label: string;
  address: string;
  is_default: boolean;
};

type Props = {
  profiles: Profile[] | undefined;
  orders: OrderLite[];
};

export default function CustomerRegistryPanel({ profiles, orders }: Props) {
  const queryClient = useQueryClient();
  const [q, setQ] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [saving, setSaving] = useState(false);

  const rows = useMemo(() => {
    return (profiles ?? [])
      .filter((p) => p.role === 'customer')
      .map((p) => {
        const cOrders = orders.filter((o) => o.customer_id === p.user_id);
        const delivered = cOrders.filter((o) => o.status === 'delivered');
        const spent = delivered.reduce((s, o) => s + Number(o.total_amount ?? 0), 0);
        const lastAt = cOrders
          .map((o) => o.created_at)
          .filter(Boolean)
          .sort()
          .at(-1) ?? null;
        return { profile: p, orderCount: cOrders.length, spent, lastOrderAt: lastAt };
      })
      .filter(({ profile, orderCount }) => {
        if (!q.trim()) return true;
        const s = q.trim().toLowerCase();
        return (
          (profile.full_name || '').toLowerCase().includes(s) ||
          (profile.phone || '').includes(s) ||
          profile.user_id.toLowerCase().includes(s) ||
          String(orderCount).includes(s)
        );
      })
      .sort((a, b) => b.orderCount - a.orderCount || (a.profile.full_name || '').localeCompare(b.profile.full_name || ''));
  }, [profiles, orders, q]);

  const selected = rows.find((r) => r.profile.user_id === selectedId) ?? rows[0] ?? null;

  const uid = selected?.profile.user_id ?? null;

  const addresses = useQuery({
    queryKey: ['admin-customer-addresses', uid],
    enabled: !!uid,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('saved_addresses')
        .select('id, label, address, is_default')
        .eq('user_id', uid!)
        .order('is_default', { ascending: false });
      if (error) throw error;
      return (data ?? []) as SavedAddressRow[];
    },
  });

  const wallet = useQuery({
    queryKey: ['admin-customer-wallet', uid],
    enabled: !!uid,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('customer_wallets')
        .select('balance, lifetime_credit')
        .eq('user_id', uid!)
        .maybeSingle();
      if (error) throw error;
      return data as { balance: number; lifetime_credit: number } | null;
    },
  });

  const rewards = useQuery({
    queryKey: ['admin-customer-rewards', uid],
    enabled: !!uid,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('customer_rewards')
        .select('points, tier, lifetime_points')
        .eq('user_id', uid!)
        .maybeSingle();
      if (error) throw error;
      return data as { points: number; tier: string; lifetime_points: number } | null;
    },
  });

  useEffect(() => {
    setEditing(false);
  }, [uid]);

  function startEdit() {
    if (!selected) return;
    setFullName(selected.profile.full_name ?? '');
    setPhone(selected.profile.phone ?? '');
    setEditing(true);
  }

  async function save() {
    if (!selected) return;
    setSaving(true);
    try {
      const patch: Record<string, unknown> = {};
      if (fullName !== (selected.profile.full_name ?? '')) patch.full_name = fullName.trim() || null;
      if (phone !== (selected.profile.phone ?? '')) patch.phone = phone.trim() || null;
      if (Object.keys(patch).length) {
        const { error } = await supabase.from('profiles').update(patch).eq('user_id', selected.profile.user_id);
        if (error) throw error;
      }
      await queryClient.invalidateQueries({ queryKey: ['admin-profiles'] });
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
          <h2 className="admin-section-title truncate">Μητρώο πελατών</h2>
          <span className="text-[11px] tabular-nums text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
            {rows.length}
          </span>
          <span className="admin-section-sub truncate">· στοιχεία · παραγγελίες · διευθύνσεις · πορτοφόλι</span>
        </div>
      </div>

      <div className="relative max-w-md">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Αναζήτηση: όνομα, τηλέφωνο…"
          className="pl-8 h-9 text-[13px]"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-3">
        {/* List */}
        <div className="lg:col-span-2 admin-card overflow-hidden max-h-[70vh] overflow-y-auto">
          <table className="admin-table">
            <thead className="sticky top-0 bg-card z-10">
              <tr>
                <th>Πελάτης</th>
                <th className="text-right">Παραγ.</th>
                <th className="text-right">Σύνολο</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(({ profile, orderCount, spent }) => {
                const active = selected?.profile.user_id === profile.user_id;
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
                      <div className="font-medium text-[12.5px] leading-tight truncate max-w-[160px]">
                        {profile.full_name || 'Πελάτης'}
                      </div>
                      <div className="text-[10.5px] text-muted-foreground tabular-nums">
                        {profile.phone || '—'}
                      </div>
                    </td>
                    <td className="text-right tabular-nums text-[12px]">{orderCount}</td>
                    <td className="text-right tabular-nums text-[12px]">€{spent.toFixed(2)}</td>
                  </tr>
                );
              })}
              {!rows.length && (
                <tr>
                  <td colSpan={3} className="text-center text-muted-foreground py-10">
                    Κανένας πελάτης
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Detail */}
        <div className="lg:col-span-3 admin-card p-4 space-y-4 max-h-[70vh] overflow-y-auto">
          {!selected ? (
            <p className="text-sm text-muted-foreground py-8 text-center">Επίλεξε πελάτη από τη λίστα</p>
          ) : (
            <>
              <div className="flex items-start gap-3">
                <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                  <User className="h-6 w-6 text-primary" />
                </div>
                <div className="min-w-0 flex-1">
                  {!editing ? (
                    <>
                      <h3 className="font-semibold text-[15px] truncate">
                        {selected.profile.full_name || 'Πελάτης'}
                      </h3>
                      <p className="text-[12px] text-muted-foreground tabular-nums">
                        {selected.profile.phone || '—'}
                      </p>
                    </>
                  ) : (
                    <div className="space-y-2">
                      <Input value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Ονοματεπώνυμο" className="h-9 text-[13px]" />
                      <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Τηλέφωνο" className="h-9 text-[13px]" />
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

              <Section title="Στατιστικά">
                <div className="grid grid-cols-3 gap-2">
                  <StatTile
                    icon={<ShoppingBag className="h-3.5 w-3.5" />}
                    label="Παραγγελίες"
                    value={String(selected.orderCount)}
                  />
                  <StatTile label="Σύνολο δαπανών" value={`€${selected.spent.toFixed(2)}`} />
                  <StatTile
                    icon={<Ticket className="h-3.5 w-3.5" />}
                    label="Κουπόνια"
                    value={wallet.data ? `€${Number(wallet.data.balance).toFixed(2)}` : '€0.00'}
                  />
                </div>
                <Field
                  label="Συνολικά κουπόνια"
                  value={
                    wallet.data && Number(wallet.data.lifetime_credit) > 0
                      ? `€${Number(wallet.data.lifetime_credit).toFixed(2)}`
                      : null
                  }
                />
                {rewards.data && (
                  <>
                    <Field label="Πόντοι ανταμοιβής" value={`${rewards.data.points} (${rewards.data.tier})`} />
                    <Field label="Συνολικοί πόντοι" value={String(rewards.data.lifetime_points)} />
                  </>
                )}
                <Field label="Τελευταία παραγγελία" value={selected.lastOrderAt ? fmtDate(selected.lastOrderAt) : null} />
                <Field label="Εγγραφή" value={selected.profile.created_at ? fmtDate(selected.profile.created_at) : null} />
              </Section>

              <Section title="Διευθύνσεις">
                {(addresses.data ?? []).map((a) => (
                  <div key={a.id} className="flex items-start gap-2 text-[12.5px] py-0.5">
                    <MapPin className="h-3.5 w-3.5 mt-0.5 text-muted-foreground shrink-0" />
                    <div className="min-w-0">
                      <span className="font-medium">{a.label}</span>
                      {a.is_default && (
                        <Badge variant="secondary" className="ml-1.5 h-4 px-1 text-[9px]">
                          Προεπιλογή
                        </Badge>
                      )}
                      <div className="text-muted-foreground text-[11.5px] break-all">{a.address}</div>
                    </div>
                  </div>
                ))}
                {addresses.data && !addresses.data.length && (
                  <p className="text-[12px] text-muted-foreground">Καμία αποθηκευμένη διεύθυνση</p>
                )}
              </Section>

              <p className="text-[10.5px] text-muted-foreground font-mono">
                ID: <span className="opacity-70">{selected.profile.user_id}</span>
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function fmtDate(v: string) {
  return format(new Date(v), 'd MMM yyyy, HH:mm', { locale: el });
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <h4 className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{title}</h4>
      <div className="rounded-lg border border-border/60 bg-muted/20 px-3 py-2 space-y-1">{children}</div>
    </div>
  );
}

function Field({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="flex gap-2 text-[12.5px]">
      <span className="text-muted-foreground w-[150px] shrink-0">{label}</span>
      <span className="min-w-0 break-all font-medium">{value?.trim() || '—'}</span>
    </div>
  );
}

function StatTile({ icon, label, value }: { icon?: React.ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border/60 bg-background px-2.5 py-2">
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground flex items-center gap-1">
        {icon}
        {label}
      </p>
      <p className="font-semibold text-[14px] tabular-nums mt-0.5">{value}</p>
    </div>
  );
}
