import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { Loader2, Save, Store } from 'lucide-react';

type StoreAppearance = {
  id: string;
  name: string;
  image_url: string | null;
  cover_image_url: string | null;
  tagline: string | null;
  promo_badge: string | null;
  highlight_color: string | null;
  is_active: boolean | null;
  covers_delivery_fee: boolean | null;
  fulfilment_mode: string | null;
  delivery_fee: number | null;
  delivery_free_min: number | null;
};

const emptyDraft = {
  tagline: '',
  promo_badge: '',
  cover_image_url: '',
  highlight_color: '',
  image_url: '',
  covers_delivery_fee: false,
  fulfilment_mode: 'platform',
  delivery_fee: '',
  delivery_free_min: '',
};

const BADGE_PRESETS = ['Νέο', 'Top', 'Hit', '-20%', 'Δωρεάν delivery', '2x1'];

/** Admin editor for per-store customer-facing appearance (premium cards). */
export default function AdminStoreAppearance() {
  const [stores, setStores] = useState<StoreAppearance[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [draft, setDraft] = useState(emptyDraft);
  const [saving, setSaving] = useState(false);
  const [q, setQ] = useState('');

  const FULL_COLS = 'id, name, image_url, cover_image_url, tagline, promo_badge, highlight_color, is_active, covers_delivery_fee, fulfilment_mode, delivery_fee, delivery_free_min';
  const LEGACY_COLS = 'id, name, image_url, cover_image_url, tagline, promo_badge, highlight_color, is_active';

  const load = async () => {
    setLoading(true);
    let { data, error } = await (supabase as any).from('stores').select(FULL_COLS).order('name');
    if (error && /delivery_fee|delivery_free_min|covers_delivery_fee|fulfilment_mode|column/i.test(error.message)) {
      // Prod DB without the 20260907 migration yet — fall back so the screen still lists stores.
      const retry = await (supabase as any).from('stores').select(LEGACY_COLS).order('name');
      data = retry.data; error = retry.error;
      if (!error) toast.warning('Το migration delivery-controls δεν έχει εφαρμοστεί ακόμα — οι νέες στήλες θα ενεργοποιηθούν μετά το push.');
    }
    setLoading(false);
    if (error) {
      toast.error('Αποτυχία φόρτωσης: ' + error.message);
      return;
    }
    const rows = (data ?? []) as StoreAppearance[];
    setStores(rows);
    if (!selectedId && rows[0]) setSelectedId(rows[0].id);
  };

  useEffect(() => { void load(); }, []);

  const selected = useMemo(
    () => stores.find((s) => s.id === selectedId) ?? null,
    [stores, selectedId],
  );

  useEffect(() => {
    if (!selected) {
      setDraft(emptyDraft);
      return;
    }
    setDraft({
      tagline: selected.tagline ?? '',
      promo_badge: selected.promo_badge ?? '',
      cover_image_url: selected.cover_image_url ?? '',
      highlight_color: selected.highlight_color ?? '',
      image_url: selected.image_url ?? '',
      covers_delivery_fee: !!selected.covers_delivery_fee,
      fulfilment_mode: selected.fulfilment_mode === 'store' ? 'store' : 'platform',
      delivery_fee: selected.delivery_fee != null ? String(selected.delivery_fee) : '',
      delivery_free_min: selected.delivery_free_min != null ? String(selected.delivery_free_min) : '',
    });
  }, [selected?.id, selected?.tagline, selected?.promo_badge, selected?.cover_image_url, selected?.highlight_color, selected?.image_url, selected?.covers_delivery_fee, selected?.fulfilment_mode, selected?.delivery_fee, selected?.delivery_free_min]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return stores;
    return stores.filter((s) => s.name.toLowerCase().includes(needle));
  }, [stores, q]);

  const dirty = !!selected && (
    draft.tagline !== (selected.tagline ?? '') ||
    draft.promo_badge !== (selected.promo_badge ?? '') ||
    draft.cover_image_url !== (selected.cover_image_url ?? '') ||
    draft.highlight_color !== (selected.highlight_color ?? '') ||
    draft.image_url !== (selected.image_url ?? '') ||
    draft.covers_delivery_fee !== !!selected.covers_delivery_fee ||
    draft.fulfilment_mode !== (selected.fulfilment_mode === 'store' ? 'store' : 'platform') ||
    draft.delivery_fee !== (selected.delivery_fee != null ? String(selected.delivery_fee) : '') ||
    draft.delivery_free_min !== (selected.delivery_free_min != null ? String(selected.delivery_free_min) : '')
  );

  const parseNum = (v: string): number | null => {
    const t = v.trim().replace(',', '.');
    if (!t) return null;
    const n = Number(t);
    if (!Number.isFinite(n) || n < 0) return null;
    return Math.round(n * 100) / 100;
  };

  const save = async () => {
    if (!selected || !dirty) return;
    const fee = parseNum(draft.delivery_fee);
    const freeMin = parseNum(draft.delivery_free_min);
    if (draft.delivery_fee.trim() && fee == null) { toast.error('Μη έγκυρο κόστος delivery'); return; }
    if (draft.delivery_free_min.trim() && freeMin == null) { toast.error('Μη έγκυρο όριο δωρεάν delivery'); return; }
    setSaving(true);
    const payload = {
      tagline: draft.tagline.trim() || null,
      promo_badge: draft.promo_badge.trim() || null,
      cover_image_url: draft.cover_image_url.trim() || null,
      highlight_color: draft.highlight_color.trim() || null,
      image_url: draft.image_url.trim() || null,
      covers_delivery_fee: draft.covers_delivery_fee,
      fulfilment_mode: draft.fulfilment_mode === 'store' ? 'store' : 'platform',
      delivery_fee: fee,
      delivery_free_min: freeMin,
    };
    const { error } = await (supabase as any).from('stores').update(payload).eq('id', selected.id);
    if (error && /delivery_fee|delivery_free_min/i.test(error.message)) {
      // Columns missing pre-migration: save everything except the two new fee fields.
      const { delivery_fee: _f, delivery_free_min: _m, ...rest } = payload;
      const retry = await (supabase as any).from('stores').update(rest).eq('id', selected.id);
      setSaving(false);
      if (retry.error) { toast.error('Αποτυχία αποθήκευσης: ' + retry.error.message); return; }
      toast.warning('Αποθηκεύτηκε — τα κόστη delivery θέλουν το migration.');
      setStores((prev) => prev.map((s) => (s.id === selected.id ? { ...s, ...rest } : s)));
      return;
    }
    setSaving(false);
    if (error) {
      toast.error('Αποτυχία αποθήκευσης: ' + error.message);
      return;
    }
    toast.success('Εμφάνιση καταστήματος αποθηκεύτηκε');
    setStores((prev) => prev.map((s) => (s.id === selected.id ? { ...s, ...payload } : s)));
  };

  const previewCover = draft.cover_image_url || draft.image_url;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-heading font-extrabold">Εμφάνιση & delivery καταστημάτων</h1>
        <p className="text-sm text-muted-foreground">
          Tagline, badge, cover, ποιος παραδίδει (Fresh2GO/κατάστημα), δωρεάν delivery, χρέωση ανά κατάστημα.
        </p>
      </div>

      <div className="grid lg:grid-cols-[280px_1fr] gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Καταστήματα</CardTitle>
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Αναζήτηση…"
              className="mt-2"
            />
          </CardHeader>
          <CardContent className="p-2 max-h-[60vh] overflow-y-auto space-y-1">
            {loading && (
              <div className="flex items-center justify-center py-8 text-muted-foreground text-sm gap-2">
                <Loader2 className="h-4 w-4 animate-spin" /> Φόρτωση…
              </div>
            )}
            {!loading && filtered.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => setSelectedId(s.id)}
                className={`w-full text-left rounded-lg px-3 py-2 text-sm transition-colors ${
                  s.id === selectedId ? 'bg-primary/10 text-foreground font-semibold' : 'hover:bg-muted'
                }`}
              >
                <div className="truncate">{s.name}</div>
                <div className="text-[11px] text-muted-foreground">
                  {s.is_active === false ? 'Ανενεργό' : 'Ενεργό'}
                  {s.promo_badge ? ` · ${s.promo_badge}` : ''}
                  {s.covers_delivery_fee ? ' · Δωρεάν' : ''}
                  {s.delivery_fee != null ? ` · ${String(s.delivery_fee).replace('.', ',')}€` : ''}
                  {s.fulfilment_mode === 'store' ? ' · Κατάστημα' : ''}
                </div>
              </button>
            ))}
            {!loading && filtered.length === 0 && (
              <div className="py-8 text-center text-muted-foreground text-sm">
                <Store className="h-6 w-6 mx-auto mb-2 opacity-40" />
                Κανένα αποτέλεσμα
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              {selected ? selected.name : 'Επίλεξε κατάστημα'}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {!selected ? (
              <p className="text-sm text-muted-foreground">Διάλεξε κατάστημα από τη λίστα.</p>
            ) : (
              <>
                <div className="grid sm:grid-cols-2 gap-3">
                  <div className="space-y-1.5 sm:col-span-2">
                    <Label>Tagline</Label>
                    <Input
                      value={draft.tagline}
                      onChange={(e) => setDraft((p) => ({ ...p, tagline: e.target.value }))}
                      maxLength={80}
                      placeholder="π.χ. Αυθεντικό σουβλάκι από το 1998"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Promo badge</Label>
                    <Input
                      value={draft.promo_badge}
                      onChange={(e) => setDraft((p) => ({ ...p, promo_badge: e.target.value }))}
                      maxLength={24}
                      placeholder="π.χ. -20% · Νέο · Hit"
                      list="badge-presets"
                    />
                    <datalist id="badge-presets">
                      {BADGE_PRESETS.map((b) => <option key={b} value={b} />)}
                    </datalist>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Highlight χρώμα (HSL)</Label>
                    <div className="flex gap-2 items-center">
                      <Input
                        value={draft.highlight_color}
                        onChange={(e) => setDraft((p) => ({ ...p, highlight_color: e.target.value }))}
                        placeholder="152 100% 39%"
                      />
                      <div
                        className="h-9 w-9 rounded-md border shrink-0"
                        style={{
                          background: draft.highlight_color
                            ? `hsl(${draft.highlight_color})`
                            : 'transparent',
                        }}
                      />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Κύρια εικόνα (URL)</Label>
                    <Input
                      value={draft.image_url}
                      onChange={(e) => setDraft((p) => ({ ...p, image_url: e.target.value }))}
                      placeholder="https://..."
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Cover εικόνα (URL)</Label>
                    <Input
                      value={draft.cover_image_url}
                      onChange={(e) => setDraft((p) => ({ ...p, cover_image_url: e.target.value }))}
                      placeholder="Προαιρετικό wide cover"
                    />
                  </div>
                </div>

                <div className="rounded-xl border p-3 space-y-3 bg-muted/30">
                  <div className="text-sm font-semibold">Delivery & εκπλήρωση</div>
                  <div className="grid sm:grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label>Παράδοση από</Label>
                      <Select
                        value={draft.fulfilment_mode}
                        onValueChange={(v) => setDraft((p) => ({ ...p, fulfilment_mode: v }))}
                      >
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="platform">Delivered by Fresh2GO</SelectItem>
                          <SelectItem value="store">Παράδοση καταστήματος</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="flex items-center justify-between gap-3 rounded-lg border bg-background px-3 py-2">
                      <div>
                        <div className="text-sm font-medium">Δωρεάν delivery</div>
                        <div className="text-[11px] text-muted-foreground">Badge + χρέωση 0€ στο customer</div>
                      </div>
                      <Switch
                        checked={draft.covers_delivery_fee}
                        onCheckedChange={(v) => setDraft((p) => ({ ...p, covers_delivery_fee: v }))}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Κόστος delivery / κατάστημα (€)</Label>
                      <Input
                        value={draft.delivery_fee}
                        onChange={(e) => setDraft((p) => ({ ...p, delivery_fee: e.target.value }))}
                        inputMode="decimal"
                        placeholder="Κενό = default πλατφόρμας"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Δωρεάν από καλάθι ≥ (€)</Label>
                      <Input
                        value={draft.delivery_free_min}
                        onChange={(e) => setDraft((p) => ({ ...p, delivery_free_min: e.target.value }))}
                        inputMode="decimal"
                        placeholder="π.χ. 15"
                      />
                    </div>
                  </div>
                </div>

                {previewCover && (
                  <div className="relative rounded-xl overflow-hidden border h-40 bg-muted/30">
                    <img
                      src={previewCover}
                      alt=""
                      className="w-full h-full object-cover"
                      onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
                    />
                    <div className="absolute top-3 left-3 flex gap-1.5">
                      {draft.promo_badge && (
                        <span className="text-[10px] font-extrabold uppercase tracking-wide text-white bg-emerald-600 px-2 py-0.5 rounded-md">
                          {draft.promo_badge}
                        </span>
                      )}
                      {draft.covers_delivery_fee && (
                        <span className="text-[10px] font-extrabold uppercase tracking-wide text-white bg-sky-600 px-2 py-0.5 rounded-md">
                          Δωρεάν delivery
                        </span>
                      )}
                      <span className={`text-[10px] font-extrabold uppercase tracking-wide px-2 py-0.5 rounded-md ${draft.fulfilment_mode === 'store' ? 'bg-muted text-foreground' : 'bg-orange-600 text-white'}`}>
                        {draft.fulfilment_mode === 'store' ? 'Κατάστημα' : 'Fresh2GO'}
                      </span>
                    </div>
                    {draft.delivery_fee.trim() && (
                      <span className="absolute bottom-3 right-3 text-[11px] font-bold bg-background/90 px-2 py-0.5 rounded-md">
                        {draft.delivery_fee.trim().replace('.', ',')}€
                      </span>
                    )}
                    {draft.highlight_color && (
                      <div
                        className="absolute inset-x-0 bottom-0 h-1.5"
                        style={{ background: `hsl(${draft.highlight_color})` }}
                      />
                    )}
                  </div>
                )}

                <Button onClick={save} disabled={!dirty || saving} className="w-full sm:w-auto">
                  {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
                  Αποθήκευση εμφάνισης
                </Button>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
