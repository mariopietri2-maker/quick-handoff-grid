import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
};

const emptyDraft = {
  tagline: '',
  promo_badge: '',
  cover_image_url: '',
  highlight_color: '',
  image_url: '',
};

/** Admin editor for per-store customer-facing appearance (premium cards). */
export default function AdminStoreAppearance() {
  const [stores, setStores] = useState<StoreAppearance[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [draft, setDraft] = useState(emptyDraft);
  const [saving, setSaving] = useState(false);
  const [q, setQ] = useState('');

  const load = async () => {
    setLoading(true);
    const { data, error } = await (supabase as any)
      .from('stores')
      .select('id, name, image_url, cover_image_url, tagline, promo_badge, highlight_color, is_active')
      .order('name');
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
    });
  }, [selected?.id, selected?.tagline, selected?.promo_badge, selected?.cover_image_url, selected?.highlight_color, selected?.image_url]);

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
    draft.image_url !== (selected.image_url ?? '')
  );

  const save = async () => {
    if (!selected || !dirty) return;
    setSaving(true);
    const payload = {
      tagline: draft.tagline.trim() || null,
      promo_badge: draft.promo_badge.trim() || null,
      cover_image_url: draft.cover_image_url.trim() || null,
      highlight_color: draft.highlight_color.trim() || null,
      image_url: draft.image_url.trim() || null,
    };
    const { error } = await (supabase as any).from('stores').update(payload).eq('id', selected.id);
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
        <h1 className="text-2xl font-heading font-extrabold">Εμφάνιση καταστημάτων</h1>
        <p className="text-sm text-muted-foreground">
          Tagline, promo badge, cover και accent για premium κάρτες στο customer app.
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
                    />
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

                {previewCover && (
                  <div className="relative rounded-xl overflow-hidden border h-40 bg-muted/30">
                    <img
                      src={previewCover}
                      alt=""
                      className="w-full h-full object-cover"
                      onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
                    />
                    {draft.promo_badge && (
                      <span className="absolute bottom-3 left-3 text-[10px] font-extrabold uppercase tracking-wide text-white bg-emerald-600 px-2 py-0.5 rounded-md">
                        {draft.promo_badge}
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
