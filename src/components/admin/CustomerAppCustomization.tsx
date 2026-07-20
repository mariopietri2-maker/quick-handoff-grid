import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import {
  Trash2, Plus, Eye, Rocket, RotateCcw, ArrowUp, ArrowDown,
  Image as ImageIcon, Smartphone,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  DEFAULT_CONFIG,
  mergeCustomerAppConfig,
  type CustomerAppConfig,
  type TileTone,
} from '@/hooks/useCustomerAppConfig';

type Row = {
  draft_config: CustomerAppConfig;
  published_config: CustomerAppConfig;
  published_at: string | null;
  updated_at: string;
};

const TILE_TONES: { value: TileTone; label: string }[] = [
  { value: 'accent', label: 'Accent' },
  { value: 'cream', label: 'Cream' },
  { value: 'warm', label: 'Warm' },
  { value: 'pink', label: 'Pink' },
];

const TONE_PREVIEW: Record<TileTone, string> = {
  accent: 'bg-[hsl(4_90%_47%)] text-white',
  cream: 'bg-[hsl(36,100%,95%)] text-[hsl(0,0%,9%)]',
  warm: 'bg-[hsl(28,40%,92%)] text-[hsl(0,0%,9%)]',
  pink: 'bg-[hsl(330,80%,95%)] text-[hsl(0,0%,9%)]',
};

async function uploadBrandingAsset(file: File, prefix: string): Promise<string> {
  const ext = file.name.split('.').pop() || 'png';
  const path = `${prefix}-${Date.now()}.${ext}`;
  const { error } = await supabase.storage
    .from('app-branding')
    .upload(path, file, { cacheControl: '3600', upsert: false });
  if (error) throw error;
  const { data } = supabase.storage.from('app-branding').getPublicUrl(path);
  return data.publicUrl;
}

function moveItem<T>(arr: T[], from: number, dir: -1 | 1): T[] {
  const to = from + dir;
  if (to < 0 || to >= arr.length) return arr;
  const next = [...arr];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}

function PhonePreview({ draft }: { draft: CustomerAppConfig }) {
  const accent = draft.branding.accent_hsl || DEFAULT_CONFIG.branding.accent_hsl;
  const tiles = draft.tiles.slice(0, 4);
  const enabledPromos = draft.promos.filter((p) => p.enabled).length;

  return (
    <div
      className="mx-auto w-[260px] rounded-[28px] border border-border bg-white shadow-xl overflow-hidden"
      style={{
        ['--c-accent' as string]: accent,
        ['--c-accent-dark' as string]: draft.branding.accent_dark_hsl,
      }}
    >
      <div
        className="px-3.5 pt-3 pb-2.5 border-b"
        style={{ background: `linear-gradient(180deg, hsl(${accent} / 0.08), white)` }}
      >
        <div className="flex items-center gap-2 mb-2">
          {draft.branding.logo_url ? (
            <img src={draft.branding.logo_url} alt="" className="h-6 w-6 rounded-md object-cover" />
          ) : (
            <div
              className="h-6 w-6 rounded-md flex items-center justify-center text-[10px] font-black text-white"
              style={{ background: `hsl(${accent})` }}
            >
              {(draft.branding.monogram || 'F').slice(0, 1)}
            </div>
          )}
          <span className="text-[12px] font-black truncate tracking-tight text-[hsl(0,0%,9%)]">
            {draft.branding.app_name || 'App'}
          </span>
        </div>
        <div className="text-[9px] uppercase tracking-wider text-muted-foreground font-bold mb-0.5">
          Παράδοση σε
        </div>
        <div className="text-[11px] font-extrabold truncate text-[hsl(0,0%,9%)]">
          {draft.branding.city_label || '—'}
        </div>
        <div className="mt-2 h-7 rounded-xl bg-[hsl(0,0%,96%)] px-2.5 flex items-center text-[10px] text-muted-foreground truncate">
          {draft.branding.search_placeholder || 'Αναζήτηση…'}
        </div>
      </div>

      <div className="p-3 space-y-2.5 min-h-[280px]">
        {draft.sections.show_tiles && tiles.length > 0 && (
          <div className="grid grid-cols-4 gap-1.5">
            {tiles.map((tile, i) => (
              <div key={i} className="flex flex-col items-center gap-1">
                <div
                  className={`w-full aspect-square rounded-xl flex items-center justify-center text-base ${
                    TONE_PREVIEW[tile.tone ?? (['accent', 'cream', 'warm', 'pink'] as TileTone[])[i % 4]]
                  }`}
                >
                  {tile.emoji || '🍽️'}
                </div>
                <span className="text-[8px] font-bold truncate w-full text-center">{tile.label}</span>
              </div>
            ))}
          </div>
        )}

        {draft.sections.show_offers_cta && (
          <div className="rounded-xl border px-2.5 py-2 flex items-center justify-between gap-2">
            <div className="min-w-0">
              <div className="text-[10px] font-extrabold truncate">{draft.copy.offers_cta_title}</div>
              <div className="text-[8px] text-muted-foreground truncate">{draft.copy.offers_cta_subtitle}</div>
            </div>
            <span
              className="shrink-0 text-[8px] font-extrabold text-white rounded-full px-2 py-1"
              style={{ background: `hsl(${accent})` }}
            >
              {draft.copy.offers_cta_button}
            </span>
          </div>
        )}

        {draft.sections.show_promos && enabledPromos > 0 && (
          <div
            className="rounded-xl h-14 px-2.5 py-2 text-white flex flex-col justify-end"
            style={{
              background: draft.promos.find((p) => p.enabled)?.gradient === 'dark'
                ? 'linear-gradient(135deg,#1a1a1a,#333)'
                : `linear-gradient(135deg, hsl(${accent}), hsl(${draft.branding.accent_dark_hsl}))`,
            }}
          >
            <div className="text-[9px] font-black truncate">
              {draft.promos.find((p) => p.enabled)?.title}
            </div>
            <div className="text-[8px] opacity-90 truncate">
              {draft.promos.find((p) => p.enabled)?.subtitle}
            </div>
          </div>
        )}

        {draft.sections.show_promoted && (
          <div>
            <div className="text-[10px] font-black">{draft.copy.promoted_title}</div>
            <div className="text-[7px] uppercase tracking-wider text-muted-foreground font-bold">
              {draft.copy.promoted_eyebrow}
            </div>
            <div className="mt-1.5 flex gap-1.5">
              {[1, 2].map((n) => (
                <div key={n} className="h-10 w-16 rounded-lg bg-[hsl(0,0%,94%)]" />
              ))}
            </div>
          </div>
        )}

        {draft.sections.show_nearby && (
          <div>
            <div className="text-[10px] font-black mb-1">{draft.copy.nearby_title}</div>
            <div className="h-12 rounded-xl bg-[hsl(0,0%,96%)]" />
          </div>
        )}
      </div>

      <div className="grid grid-cols-4 border-t px-1 py-1.5 text-center">
        {[
          draft.copy.nav_discover,
          draft.copy.nav_food,
          draft.copy.nav_orders,
          draft.copy.nav_account,
        ].map((label, i) => (
          <div key={i} className="text-[7px] font-bold text-muted-foreground truncate px-0.5">
            <div
              className="mx-auto mb-0.5 h-3 w-3 rounded-full"
              style={{ background: i === 0 ? `hsl(${accent})` : 'hsl(0 0% 90%)' }}
            />
            {label}
          </div>
        ))}
      </div>
    </div>
  );
}

export default function CustomerAppCustomization() {
  const [row, setRow] = useState<Row | null>(null);
  const [draft, setDraft] = useState<CustomerAppConfig>(DEFAULT_CONFIG);
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [uploadingPromo, setUploadingPromo] = useState<number | null>(null);

  const load = async () => {
    const { data } = await (supabase as any)
      .from('customer_app_config')
      .select('draft_config, published_config, published_at, updated_at')
      .maybeSingle();
    if (data) {
      setRow({
        ...data,
        draft_config: mergeCustomerAppConfig(data.draft_config),
        published_config: mergeCustomerAppConfig(data.published_config),
      });
      setDraft(mergeCustomerAppConfig(data.draft_config));
    }
  };

  useEffect(() => { load(); }, []);

  const saveDraft = async () => {
    setSaving(true);
    const { error } = await (supabase as any)
      .from('customer_app_config')
      .update({ draft_config: draft })
      .eq('id', true);
    setSaving(false);
    if (error) toast.error('Σφάλμα αποθήκευσης: ' + error.message);
    else { toast.success('Πρόχειρο αποθηκεύτηκε'); load(); }
  };

  const publish = async () => {
    setPublishing(true);
    const { data: session } = await supabase.auth.getSession();
    const { error } = await (supabase as any)
      .from('customer_app_config')
      .update({
        draft_config: draft,
        published_config: draft,
        published_at: new Date().toISOString(),
        published_by: session.session?.user?.id ?? null,
      })
      .eq('id', true);
    setPublishing(false);
    if (error) toast.error('Σφάλμα δημοσίευσης: ' + error.message);
    else { toast.success('Δημοσιεύτηκε στο customer app'); load(); }
  };

  const revert = () => {
    if (row) setDraft(mergeCustomerAppConfig(row.published_config));
    toast.info('Επαναφορά στο δημοσιευμένο');
  };

  const resetDefaults = () => {
    if (!confirm('Επαναφορά όλων των ρυθμίσεων στα defaults; (μόνο στο πρόχειρο)')) return;
    setDraft(DEFAULT_CONFIG);
    toast.info('Defaults φορτώθηκαν στο πρόχειρο — αποθήκευσε ή δημοσίευσε');
  };

  const isDirty = useMemo(
    () => JSON.stringify(draft) !== JSON.stringify(row?.draft_config),
    [draft, row],
  );
  const hasUnpublished = useMemo(
    () => JSON.stringify(draft) !== JSON.stringify(row?.published_config),
    [draft, row],
  );

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-heading font-extrabold">Customer App — Παραμετροποίηση</h1>
          <p className="text-sm text-muted-foreground">
            Branding, κείμενα, πλακίδια, κατηγορίες, promos & ενότητες — πρόχειρο → δημοσίευση.
            {row?.published_at && <> · Τελευταία δημοσίευση: {new Date(row.published_at).toLocaleString('el-GR')}</>}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={resetDefaults}>
            Defaults
          </Button>
          <Button variant="outline" size="sm" onClick={revert} disabled={!row}>
            <RotateCcw className="h-4 w-4 mr-1.5" /> Επαναφορά
          </Button>
          <Button variant="outline" size="sm" onClick={saveDraft} disabled={!isDirty || saving}>
            <Eye className="h-4 w-4 mr-1.5" /> {saving ? '…' : 'Αποθήκευση πρόχειρου'}
          </Button>
          <Button size="sm" onClick={publish} disabled={!hasUnpublished || publishing}>
            <Rocket className="h-4 w-4 mr-1.5" /> {publishing ? '…' : 'Δημοσίευση'}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[1fr_280px] gap-4 items-start">
        <Tabs defaultValue="branding" className="min-w-0">
          <TabsList className="flex flex-wrap h-auto gap-1 w-full justify-start">
            <TabsTrigger value="branding">Branding</TabsTrigger>
            <TabsTrigger value="copy">Κείμενα</TabsTrigger>
            <TabsTrigger value="tiles">Πλακίδια</TabsTrigger>
            <TabsTrigger value="categories">Κατηγορίες</TabsTrigger>
            <TabsTrigger value="promos">Promos</TabsTrigger>
            <TabsTrigger value="filters">Φίλτρα</TabsTrigger>
            <TabsTrigger value="sections">Ενότητες</TabsTrigger>
          </TabsList>

          {/* ── Branding ───────────────────────────────── */}
          <TabsContent value="branding" className="space-y-3">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Ταυτότητα</CardTitle>
                <CardDescription>Όνομα, χρώματα, logo & splash</CardDescription>
              </CardHeader>
              <CardContent className="grid sm:grid-cols-2 gap-4">
                <div>
                  <Label>Όνομα εφαρμογής</Label>
                  <Input
                    value={draft.branding.app_name}
                    onChange={(e) => setDraft({ ...draft, branding: { ...draft.branding, app_name: e.target.value } })}
                  />
                </div>
                <div>
                  <Label>Monogram (1 γράμμα)</Label>
                  <Input
                    maxLength={2}
                    value={draft.branding.monogram}
                    onChange={(e) => setDraft({ ...draft, branding: { ...draft.branding, monogram: e.target.value.slice(0, 2) } })}
                  />
                </div>
                <div>
                  <Label>Πόλη / Ετικέτα παράδοσης</Label>
                  <Input
                    value={draft.branding.city_label}
                    onChange={(e) => setDraft({ ...draft, branding: { ...draft.branding, city_label: e.target.value } })}
                  />
                </div>
                <div>
                  <Label>Tagline (splash)</Label>
                  <Input
                    value={draft.branding.tagline}
                    onChange={(e) => setDraft({ ...draft, branding: { ...draft.branding, tagline: e.target.value } })}
                    placeholder="Fast · Fresh · Local"
                  />
                </div>
                <div className="sm:col-span-2">
                  <Label>Placeholder αναζήτησης</Label>
                  <Input
                    value={draft.branding.search_placeholder}
                    onChange={(e) => setDraft({ ...draft, branding: { ...draft.branding, search_placeholder: e.target.value } })}
                  />
                </div>
                <div>
                  <Label>Accent χρώμα (HSL)</Label>
                  <div className="flex gap-2 items-center">
                    <Input
                      value={draft.branding.accent_hsl}
                      onChange={(e) => setDraft({ ...draft, branding: { ...draft.branding, accent_hsl: e.target.value } })}
                      placeholder="4 90% 47%"
                    />
                    <div className="h-9 w-9 rounded-md border shrink-0" style={{ background: `hsl(${draft.branding.accent_hsl})` }} />
                  </div>
                </div>
                <div>
                  <Label>Accent σκούρο (HSL)</Label>
                  <div className="flex gap-2 items-center">
                    <Input
                      value={draft.branding.accent_dark_hsl}
                      onChange={(e) => setDraft({ ...draft, branding: { ...draft.branding, accent_dark_hsl: e.target.value } })}
                      placeholder="4 90% 38%"
                    />
                    <div className="h-9 w-9 rounded-md border shrink-0" style={{ background: `hsl(${draft.branding.accent_dark_hsl})` }} />
                  </div>
                </div>
                <div className="sm:col-span-2 space-y-2">
                  <Label>Logo εφαρμογής</Label>
                  <div className="flex items-center gap-3">
                    {draft.branding.logo_url ? (
                      <img src={draft.branding.logo_url} alt="Logo" className="h-16 w-16 rounded-lg border object-contain bg-card" />
                    ) : (
                      <div
                        className="h-16 w-16 rounded-lg border flex items-center justify-center text-xl font-black text-white"
                        style={{ background: `hsl(${draft.branding.accent_hsl})` }}
                      >
                        {(draft.branding.monogram || 'F').slice(0, 1)}
                      </div>
                    )}
                    <div className="flex-1 space-y-2">
                      <Input
                        type="file"
                        accept="image/png,image/jpeg,image/webp,image/svg+xml"
                        disabled={uploadingLogo}
                        onChange={async (e) => {
                          const file = e.target.files?.[0];
                          if (!file) return;
                          setUploadingLogo(true);
                          try {
                            const url = await uploadBrandingAsset(file, 'logo');
                            setDraft({ ...draft, branding: { ...draft.branding, logo_url: url } });
                            toast.success('Logo ανέβηκε — μην ξεχάσεις Δημοσίευση');
                          } catch (err: any) {
                            toast.error('Αποτυχία upload: ' + (err?.message ?? err));
                          } finally {
                            setUploadingLogo(false);
                          }
                        }}
                      />
                      <Input
                        value={draft.branding.logo_url ?? ''}
                        onChange={(e) => setDraft({ ...draft, branding: { ...draft.branding, logo_url: e.target.value || null } })}
                        placeholder="ή επικόλλησε URL..."
                      />
                      {draft.branding.logo_url && (
                        <Button size="sm" variant="ghost" onClick={() => setDraft({ ...draft, branding: { ...draft.branding, logo_url: null } })}>
                          <Trash2 className="h-3.5 w-3.5 mr-1" /> Αφαίρεση logo
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ── Copy ───────────────────────────────────── */}
          <TabsContent value="copy">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Κείμενα αρχικής & nav</CardTitle>
                <CardDescription>Τίτλοι ενοτήτων, empty states, bottom nav</CardDescription>
              </CardHeader>
              <CardContent className="grid sm:grid-cols-2 gap-4">
                {(
                  [
                    ['offers_cta_title', 'Τίτλος CTA προσφορών'],
                    ['offers_cta_subtitle', 'Υπότιτλος CTA προσφορών'],
                    ['offers_cta_button', 'Κουμπί CTA προσφορών'],
                    ['promoted_title', 'Τίτλος sponsored'],
                    ['promoted_eyebrow', 'Eyebrow sponsored'],
                    ['nearby_title', 'Τίτλος λίστας καταστημάτων'],
                    ['empty_title', 'Empty — τίτλος'],
                    ['empty_subtitle', 'Empty — υπότιτλος'],
                    ['empty_clear_label', 'Empty — κουμπί καθαρισμού'],
                    ['nav_discover', 'Nav · Ανακάλυψε'],
                    ['nav_food', 'Nav · Φαγητό'],
                    ['nav_orders', 'Nav · Παραγγελίες'],
                    ['nav_account', 'Nav · Λογαριασμός'],
                    ['address_sheet_title', 'Sheet διεύθυνσης — τίτλος'],
                    ['address_sheet_hint', 'Sheet διεύθυνσης — hint'],
                  ] as const
                ).map(([key, label]) => (
                  <div key={key} className={key.includes('subtitle') || key.includes('hint') ? 'sm:col-span-2' : ''}>
                    <Label className="text-xs">{label}</Label>
                    <Input
                      value={draft.copy[key]}
                      onChange={(e) => setDraft({ ...draft, copy: { ...draft.copy, [key]: e.target.value } })}
                    />
                  </div>
                ))}
              </CardContent>
            </Card>
          </TabsContent>

          {/* ── Tiles ──────────────────────────────────── */}
          <TabsContent value="tiles">
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center justify-between gap-2 flex-wrap">
                  Πλακίδια γρήγορης πρόσβασης
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() =>
                      setDraft({
                        ...draft,
                        tiles: [...draft.tiles, { label: 'Νέο', emoji: '🍽️', category: 'all', tone: 'cream' }],
                      })
                    }
                  >
                    <Plus className="h-4 w-4 mr-1" /> Προσθήκη
                  </Button>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {draft.tiles.length === 0 && (
                  <p className="text-sm text-muted-foreground py-4 text-center">Κανένα πλακίδιο — πρόσθεσε ή ενεργοποίησε την ενότητα.</p>
                )}
                {draft.tiles.map((tile, i) => (
                  <div key={i} className="border rounded-lg p-3 bg-card grid grid-cols-[48px_1fr_1fr_110px_auto] gap-2 items-end max-sm:grid-cols-2">
                    <div>
                      <Label className="text-xs">Emoji</Label>
                      <Input
                        value={tile.emoji}
                        onChange={(e) => {
                          const tiles = [...draft.tiles];
                          tiles[i] = { ...tile, emoji: e.target.value };
                          setDraft({ ...draft, tiles });
                        }}
                      />
                    </div>
                    <div>
                      <Label className="text-xs">Ετικέτα</Label>
                      <Input
                        value={tile.label}
                        onChange={(e) => {
                          const tiles = [...draft.tiles];
                          tiles[i] = { ...tile, label: e.target.value };
                          setDraft({ ...draft, tiles });
                        }}
                      />
                    </div>
                    <div>
                      <Label className="text-xs">Κατηγορία (φίλτρο)</Label>
                      <Input
                        value={tile.category}
                        onChange={(e) => {
                          const tiles = [...draft.tiles];
                          tiles[i] = { ...tile, category: e.target.value };
                          setDraft({ ...draft, tiles });
                        }}
                        placeholder="all ή Πίτσες..."
                      />
                    </div>
                    <div>
                      <Label className="text-xs">Τόνος</Label>
                      <select
                        className="h-9 w-full rounded-md border bg-background text-xs px-2"
                        value={tile.tone ?? 'accent'}
                        onChange={(e) => {
                          const tiles = [...draft.tiles];
                          tiles[i] = { ...tile, tone: e.target.value as TileTone };
                          setDraft({ ...draft, tiles });
                        }}
                      >
                        {TILE_TONES.map((t) => (
                          <option key={t.value} value={t.value}>{t.label}</option>
                        ))}
                      </select>
                    </div>
                    <div className="flex items-center gap-0.5 pb-0.5">
                      <Button size="icon" variant="ghost" className="h-8 w-8" disabled={i === 0} onClick={() => setDraft({ ...draft, tiles: moveItem(draft.tiles, i, -1) })}>
                        <ArrowUp className="h-3.5 w-3.5" />
                      </Button>
                      <Button size="icon" variant="ghost" className="h-8 w-8" disabled={i === draft.tiles.length - 1} onClick={() => setDraft({ ...draft, tiles: moveItem(draft.tiles, i, 1) })}>
                        <ArrowDown className="h-3.5 w-3.5" />
                      </Button>
                      <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => setDraft({ ...draft, tiles: draft.tiles.filter((_, j) => j !== i) })}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          </TabsContent>

          {/* ── Categories ─────────────────────────────── */}
          <TabsContent value="categories">
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center justify-between gap-2 flex-wrap">
                  Emoji κατηγοριών (chips)
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setDraft({ ...draft, categories: [...draft.categories, { key: '', emoji: '🍴' }] })}
                  >
                    <Plus className="h-4 w-4 mr-1" /> Προσθήκη
                  </Button>
                </CardTitle>
                <CardDescription>
                  Αντιστοιχία ονόματος κατηγορίας καταστήματος → emoji. Matching case-insensitive.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                {draft.categories.map((cat, i) => (
                  <div key={i} className="grid grid-cols-[72px_1fr_auto] gap-2 items-end">
                    <div>
                      <Label className="text-xs">Emoji</Label>
                      <Input
                        value={cat.emoji}
                        onChange={(e) => {
                          const categories = [...draft.categories];
                          categories[i] = { ...cat, emoji: e.target.value };
                          setDraft({ ...draft, categories });
                        }}
                      />
                    </div>
                    <div>
                      <Label className="text-xs">Κλειδί κατηγορίας</Label>
                      <Input
                        value={cat.key}
                        onChange={(e) => {
                          const categories = [...draft.categories];
                          categories[i] = { ...cat, key: e.target.value };
                          setDraft({ ...draft, categories });
                        }}
                        placeholder="π.χ. πίτσες"
                      />
                    </div>
                    <Button size="icon" variant="ghost" onClick={() => setDraft({ ...draft, categories: draft.categories.filter((_, j) => j !== i) })}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                ))}
              </CardContent>
            </Card>
          </TabsContent>

          {/* ── Promos ─────────────────────────────────── */}
          <TabsContent value="promos">
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center justify-between gap-2 flex-wrap">
                  Promo banners
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() =>
                      setDraft({
                        ...draft,
                        promos: [
                          ...draft.promos,
                          { tag: 'NEW', title: 'Τίτλος', subtitle: 'Υπότιτλος', code: 'CODE', gradient: 'hero', enabled: true, image_url: null },
                        ],
                      })
                    }
                  >
                    <Plus className="h-4 w-4 mr-1" /> Προσθήκη
                  </Button>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {draft.promos.map((p, i) => (
                  <div key={i} className="border rounded-lg p-3 space-y-2 bg-card">
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <div className="flex items-center gap-2">
                        <Switch
                          checked={p.enabled}
                          onCheckedChange={(v) => {
                            const promos = [...draft.promos];
                            promos[i] = { ...p, enabled: v };
                            setDraft({ ...draft, promos });
                          }}
                        />
                        <span className="text-xs text-muted-foreground">{p.enabled ? 'Ενεργό' : 'Ανενεργό'}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <select
                          className="h-8 rounded border bg-background text-xs px-2"
                          value={p.gradient}
                          onChange={(e) => {
                            const promos = [...draft.promos];
                            promos[i] = { ...p, gradient: e.target.value as 'hero' | 'dark' };
                            setDraft({ ...draft, promos });
                          }}
                        >
                          <option value="hero">Accent gradient</option>
                          <option value="dark">Σκούρο</option>
                        </select>
                        <Button size="icon" variant="ghost" className="h-8 w-8" disabled={i === 0} onClick={() => setDraft({ ...draft, promos: moveItem(draft.promos, i, -1) })}>
                          <ArrowUp className="h-3.5 w-3.5" />
                        </Button>
                        <Button size="icon" variant="ghost" className="h-8 w-8" disabled={i === draft.promos.length - 1} onClick={() => setDraft({ ...draft, promos: moveItem(draft.promos, i, 1) })}>
                          <ArrowDown className="h-3.5 w-3.5" />
                        </Button>
                        <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => setDraft({ ...draft, promos: draft.promos.filter((_, j) => j !== i) })}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <Input placeholder="Tag (π.χ. NEW)" value={p.tag} onChange={(e) => { const promos = [...draft.promos]; promos[i] = { ...p, tag: e.target.value }; setDraft({ ...draft, promos }); }} />
                      <Input placeholder="Κωδικός κουπονιού" value={p.code} onChange={(e) => { const promos = [...draft.promos]; promos[i] = { ...p, code: e.target.value }; setDraft({ ...draft, promos }); }} />
                      <Input className="col-span-2" placeholder="Τίτλος" value={p.title} onChange={(e) => { const promos = [...draft.promos]; promos[i] = { ...p, title: e.target.value }; setDraft({ ...draft, promos }); }} />
                      <Input className="col-span-2" placeholder="Υπότιτλος" value={p.subtitle} onChange={(e) => { const promos = [...draft.promos]; promos[i] = { ...p, subtitle: e.target.value }; setDraft({ ...draft, promos }); }} />
                    </div>
                    <div className="flex items-start gap-3 pt-1">
                      {p.image_url ? (
                        <img src={p.image_url} alt="" className="h-14 w-24 rounded-md object-cover border" />
                      ) : (
                        <div className="h-14 w-24 rounded-md border bg-muted flex items-center justify-center">
                          <ImageIcon className="h-4 w-4 text-muted-foreground" />
                        </div>
                      )}
                      <div className="flex-1 space-y-1.5">
                        <Label className="text-xs">Εικόνα banner (προαιρετικό)</Label>
                        <Input
                          type="file"
                          accept="image/png,image/jpeg,image/webp"
                          disabled={uploadingPromo === i}
                          onChange={async (e) => {
                            const file = e.target.files?.[0];
                            if (!file) return;
                            setUploadingPromo(i);
                            try {
                              const url = await uploadBrandingAsset(file, `promo-${i}`);
                              const promos = [...draft.promos];
                              promos[i] = { ...p, image_url: url };
                              setDraft({ ...draft, promos });
                              toast.success('Εικόνα ανέβηκε');
                            } catch (err: any) {
                              toast.error('Upload failed: ' + (err?.message ?? err));
                            } finally {
                              setUploadingPromo(null);
                            }
                          }}
                        />
                        <Input
                          value={p.image_url ?? ''}
                          onChange={(e) => {
                            const promos = [...draft.promos];
                            promos[i] = { ...p, image_url: e.target.value || null };
                            setDraft({ ...draft, promos });
                          }}
                          placeholder="ή URL εικόνας…"
                        />
                        {p.image_url && (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 px-2"
                            onClick={() => {
                              const promos = [...draft.promos];
                              promos[i] = { ...p, image_url: null };
                              setDraft({ ...draft, promos });
                            }}
                          >
                            <Trash2 className="h-3 w-3 mr-1" /> Αφαίρεση εικόνας
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          </TabsContent>

          {/* ── Filters ────────────────────────────────── */}
          <TabsContent value="filters">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Γρήγορα φίλτρα λίστας</CardTitle>
                <CardDescription>Εμφάνιση & ετικέτες για Δωρεάν / Κορυφαία / Γρήγορα</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {(
                  [
                    ['show_free_delivery', 'free_label', 'Δωρεάν παράδοση'],
                    ['show_top_rated', 'top_label', 'Κορυφαία'],
                    ['show_fast', 'fast_label', 'Γρήγορα'],
                  ] as const
                ).map(([showKey, labelKey, fallback]) => (
                  <div key={showKey} className="flex flex-col sm:flex-row sm:items-center gap-3 border rounded-lg p-3 bg-card">
                    <div className="flex items-center gap-2 min-w-[160px]">
                      <Switch
                        checked={draft.filters[showKey]}
                        onCheckedChange={(v) => setDraft({ ...draft, filters: { ...draft.filters, [showKey]: v } })}
                      />
                      <span className="text-sm font-medium">{fallback}</span>
                    </div>
                    <Input
                      className="flex-1"
                      value={draft.filters[labelKey]}
                      disabled={!draft.filters[showKey]}
                      onChange={(e) => setDraft({ ...draft, filters: { ...draft.filters, [labelKey]: e.target.value } })}
                      placeholder="Ετικέτα κουμπιού"
                    />
                  </div>
                ))}
                <div>
                  <Label>Ελάχιστο rating για «Κορυφαία»</Label>
                  <Input
                    type="number"
                    step="0.1"
                    min={1}
                    max={5}
                    value={draft.filters.top_min_rating}
                    onChange={(e) =>
                      setDraft({
                        ...draft,
                        filters: { ...draft.filters, top_min_rating: Number(e.target.value) || 4.5 },
                      })
                    }
                    className="max-w-[140px]"
                  />
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ── Sections ───────────────────────────────── */}
          <TabsContent value="sections">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Ενότητες αρχικής</CardTitle>
                <CardDescription>Ενεργοποίησε / απενεργοποίησε ολόκληρα blocks</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {(
                  [
                    ['show_splash', 'Splash οθόνη εκκίνησης'],
                    ['show_tiles', 'Πλακίδια γρήγορης πρόσβασης'],
                    ['show_offers_cta', 'CTA προσφορών (collapsed)'],
                    ['show_promos', 'Promo banner carousel'],
                    ['show_hero_carousel', 'AI hero carousel'],
                    ['show_order_again', 'Λωρίδα «Παράγγειλε ξανά»'],
                    ['show_pro_delivery', 'Pro delivery banner'],
                    ['show_categories', 'Λωρίδα κατηγοριών (chips)'],
                    ['show_promoted', 'Sponsored / Δημοφιλή'],
                    ['show_filters', 'Γρήγορα φίλτρα λίστας'],
                    ['show_nearby', 'Κοντινά εστιατόρια'],
                  ] as const
                ).map(([key, label]) => (
                  <div key={key} className="flex items-center justify-between border rounded-lg p-3 bg-card">
                    <span className="text-sm font-medium">{label}</span>
                    <Switch
                      checked={draft.sections[key]}
                      onCheckedChange={(v) => setDraft({ ...draft, sections: { ...draft.sections, [key]: v } })}
                    />
                  </div>
                ))}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Live preview */}
        <aside className="xl:sticky xl:top-4 space-y-2">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider px-1">
            <Smartphone className="h-3.5 w-3.5" /> Live preview
            {(isDirty || hasUnpublished) && (
              <span className="normal-case tracking-normal font-medium text-amber-700 dark:text-amber-400">
                · πρόχειρο
              </span>
            )}
          </div>
          <PhonePreview draft={draft} />
          <p className="text-[11px] text-muted-foreground px-1 leading-relaxed">
            Το preview δείχνει το πρόχειρο. Οι πελάτες βλέπουν μόνο μετά τη <strong>Δημοσίευση</strong>.
            AI Hero cards επεξεργάζονται στο ξεχωριστό tab «AI Hero Cards».
          </p>
        </aside>
      </div>
    </div>
  );
}
