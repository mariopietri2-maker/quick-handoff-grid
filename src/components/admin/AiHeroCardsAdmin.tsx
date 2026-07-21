import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import {
  Sparkles, Trash2, Upload, Loader2, ArrowUp, ArrowDown, Image as ImageIcon, Wand2,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  DEFAULT_CONFIG,
  type CustomerAppConfig,
  type HeroCard,
  type HeroMotion,
  type HeroPlacement,
  heroCardImage,
} from '@/hooks/useCustomerAppConfig';

type Template = {
  id: string;
  label: string;
  title: string;
  subtitle: string;
  cta_label: string;
  cta_link: string;
  prompt: string;
  placement: HeroPlacement;
  motion: HeroMotion;
  badge: string;
  style: string;
};

const TEMPLATES: Template[] = [
  {
    id: 'welcome',
    label: 'Welcome',
    title: 'Καλωσόρισες — δωρεάν delivery',
    subtitle: 'Η πρώτη σου παραγγελία χωρίς κόστος παράδοσης',
    cta_label: 'Παράγγειλε τώρα',
    cta_link: '/order',
    prompt: 'premium welcome food delivery hero, warm evening light, artisan pizza and salad on marble table, soft bokeh city lights, appetite-appealing, editorial magazine cover',
    placement: 'hero',
    motion: 'kenburns',
    badge: 'Welcome',
    style: 'editorial',
  },
  {
    id: 'pizza-corso',
    label: 'Pizza Corso',
    title: 'Pizza Corso — φούρνος ξύλου',
    subtitle: 'Τραγανή πίτσα με φρέσκα υλικά',
    cta_label: 'Παράγγειλε πίτσα',
    cta_link: '/restaurant/fef56384-7ac0-4a8c-9f9b-6bfa469f7ff0',
    prompt: 'Neapolitan wood-fired pizza with melted mozzarella and basil, warm Italian trattoria light, editorial food photography, appetite-appealing',
    placement: 'hero',
    motion: 'kenburns',
    badge: 'Pizza',
    style: 'editorial',
  },
  {
    id: 'souvlaki',
    label: 'Souvlaki',
    title: 'Souvlaki Center — street classic',
    subtitle: 'Ζεστό σουβλάκι με τζατζίκι',
    cta_label: 'Πάρε σουβλάκι',
    cta_link: '/restaurant/e343d0ce-355a-4a9c-ba03-163d2453960e',
    prompt: 'Greek souvlaki pita with grilled meat tzatziki tomato fries, street food night ambience, cinematic food photography',
    placement: 'hero',
    motion: 'parallax',
    badge: 'Hot',
    style: 'cinematic',
  },
  {
    id: 'cafe-kastro',
    label: 'Café Κάστρο',
    title: 'Café Κάστρο — morning fuel',
    subtitle: 'Καφές & snacks δίπλα στο Κάστρο',
    cta_label: 'Πάρε καφέ',
    cta_link: '/restaurant/f6ceb4d5-0dbf-4cb6-b68c-e72a94c34079',
    prompt: 'artisan flat white latte art croissant, morning cafe window light, castle town atmosphere soft blur, lifestyle still life',
    placement: 'spotlight',
    motion: 'fade',
    badge: 'Coffee',
    style: 'lifestyle',
  },
  {
    id: 'asia-wok',
    label: 'Asia Wok',
    title: 'Asia Wok — spicy noodles',
    subtitle: 'Wok φρεσκοτηγανισμένο',
    cta_label: 'Δες το μενού',
    cta_link: '/restaurant/e42a746a-3e4c-46c7-8cc6-8bb6aa210b51',
    prompt: 'colorful Asian stir-fry noodles shrimp vegetables in black wok steam rising, vibrant chili, premium restaurant lighting',
    placement: 'strip',
    motion: 'slide',
    badge: 'Wok',
    style: 'bold',
  },
  {
    id: 'psitopoleio',
    label: 'Ψητοπωλείο',
    title: 'Ψητοπωλείο Λίμνη — στη σχάρα',
    subtitle: 'Κρέατα στα κάρβουνα δίπλα στη λίμνη',
    cta_label: 'Παράγγειλε ψητά',
    cta_link: '/restaurant/e1dbad50-18a7-4a27-87ae-438f6cceb600',
    prompt: 'Greek charcoal grill meats sausages platter by a lake at golden hour, rustic taverna smoke, editorial food photography',
    placement: 'strip',
    motion: 'kenburns',
    badge: 'Grill',
    style: 'editorial',
  },
  {
    id: 'weekend',
    label: 'Weekend',
    title: 'Weekend specials',
    subtitle: 'Επιλεγμένα μενού για το Σαββατοκύριακο',
    cta_label: 'Δες προσφορές',
    cta_link: '/order',
    prompt: 'weekend brunch feast spread, pancakes coffee fresh juice, golden morning sunlight, lifestyle food photography, clean negative space left',
    placement: 'hero',
    motion: 'parallax',
    badge: 'Weekend',
    style: 'lifestyle',
  },
  {
    id: 'late',
    label: 'Late night',
    title: 'Late night cravings',
    subtitle: 'Ανοιχτά μαγαζιά κοντά σου τώρα',
    cta_label: 'Παράγγειλε αργά',
    cta_link: '/order',
    prompt: 'moody late-night street food, neon reflections, gourmet burger and fries, cinematic contrast, premium dark atmosphere',
    placement: 'spotlight',
    motion: 'fade',
    badge: 'Night',
    style: 'cinematic',
  },
  {
    id: 'healthy',
    label: 'Healthy',
    title: 'Fresh & light',
    subtitle: 'Υγιεινές επιλογές με φρέσκα υλικά',
    cta_label: 'Εξερεύνησε',
    cta_link: '/order',
    prompt: 'bright healthy bowl with greens avocado seeds, soft natural daylight, airy Scandinavian table setting, fresh and clean',
    placement: 'strip',
    motion: 'slide',
    badge: 'Fresh',
    style: 'minimal',
  },
  {
    id: '1plus1',
    label: '1+1',
    title: '1+1 σε αγαπημένα πιάτα',
    subtitle: 'Διπλή απόλαυση στην τιμή του ενός',
    cta_label: 'Κλείδωσε 1+1',
    cta_link: '/order',
    prompt: 'two identical gourmet dishes side by side, twin plating, festive celebration vibe, warm studio lighting, promotional food photography',
    placement: 'hero',
    motion: 'kenburns',
    badge: '1+1',
    style: 'bold',
  },
];

const MOTIONS: { value: HeroMotion; label: string }[] = [
  { value: 'kenburns', label: 'Ken Burns (zoom)' },
  { value: 'parallax', label: 'Parallax hover' },
  { value: 'fade', label: 'Fade in' },
  { value: 'slide', label: 'Slide in' },
  { value: 'none', label: 'Καμία' },
];

const PLACEMENTS: { value: HeroPlacement; label: string }[] = [
  { value: 'hero', label: 'Hero (πάνω)' },
  { value: 'spotlight', label: 'Spotlight (μεσαία)' },
  { value: 'strip', label: 'Strip (οριζόντια)' },
];

const STYLES = [
  { value: 'editorial', label: 'Editorial' },
  { value: 'lifestyle', label: 'Lifestyle' },
  { value: 'cinematic', label: 'Cinematic' },
  { value: 'minimal', label: 'Minimal' },
  { value: 'bold', label: 'Bold promo' },
];

async function uploadHeroPng(b64: string): Promise<string> {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  const blob = new Blob([bytes], { type: 'image/png' });
  const path = `ai-hero-${Date.now()}.png`;
  const { error } = await supabase.storage
    .from('app-branding')
    .upload(path, blob, { contentType: 'image/png', cacheControl: '86400', upsert: false });
  if (error) throw error;
  const { data } = supabase.storage.from('app-branding').getPublicUrl(path);
  return data.publicUrl;
}

export default function AiHeroCardsAdmin() {
  const [config, setConfig] = useState<CustomerAppConfig>(DEFAULT_CONFIG);
  const [loaded, setLoaded] = useState(false);

  const [title, setTitle] = useState('');
  const [subtitle, setSubtitle] = useState('');
  const [ctaLabel, setCtaLabel] = useState('Δες περισσότερα');
  const [ctaLink, setCtaLink] = useState('/order');
  const [badge, setBadge] = useState('AI Pick');
  const [placement, setPlacement] = useState<HeroPlacement>('hero');
  const [motion, setMotion] = useState<HeroMotion>('kenburns');
  const [style, setStyle] = useState('editorial');
  const [prompt, setPrompt] = useState('');
  const [refImage, setRefImage] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [previewB64, setPreviewB64] = useState<string | null>(null);

  const load = async () => {
    const { data } = await (supabase as any)
      .from('customer_app_config')
      .select('published_config')
      .maybeSingle();
    const cfg = data?.published_config ?? {};
    setConfig({
      ...DEFAULT_CONFIG,
      ...cfg,
      branding: { ...DEFAULT_CONFIG.branding, ...(cfg.branding ?? {}) },
      sections: { ...DEFAULT_CONFIG.sections, ...(cfg.sections ?? {}) },
      hero_cards: Array.isArray(cfg.hero_cards) ? cfg.hero_cards : [],
    });
    setLoaded(true);
  };
  useEffect(() => { load(); }, []);

  const updateCards = async (next: HeroCard[]) => {
    const newCfg = { ...config, hero_cards: next };
    setConfig(newCfg);
    const { error } = await (supabase as any)
      .from('customer_app_config')
      .update({
        published_config: newCfg,
        draft_config: newCfg,
        published_at: new Date().toISOString(),
      })
      .eq('id', true);
    if (error) toast.error('Αποτυχία αποθήκευσης: ' + error.message);
  };

  const applyTemplate = (t: Template) => {
    setTitle(t.title);
    setSubtitle(t.subtitle);
    setCtaLabel(t.cta_label);
    setCtaLink(t.cta_link);
    setPrompt(t.prompt);
    setPlacement(t.placement);
    setMotion(t.motion);
    setBadge(t.badge);
    setStyle(t.style);
    setPreviewB64(null);
    toast.message(`Template: ${t.label}`);
  };

  const onRefImage = (file: File | null) => {
    if (!file) { setRefImage(null); return; }
    const reader = new FileReader();
    reader.onload = () => setRefImage(typeof reader.result === 'string' ? reader.result : null);
    reader.readAsDataURL(file);
  };

  const generate = async () => {
    if (!prompt.trim() || !title.trim()) {
      toast.error('Δώσε τίτλο και prompt');
      return;
    }
    setGenerating(true);
    setPreviewB64(null);
    try {
      const { data, error } = await (supabase.functions as any).invoke('generate-hero-card', {
        body: {
          prompt,
          title,
          style,
          placement,
          source_image_url: refImage ?? undefined,
        },
      });
      if (error) throw error;
      if (!data?.b64_json) throw new Error('Δεν επιστράφηκε εικόνα');
      setPreviewB64(data.b64_json);
      toast.success('Εικόνα δημιουργήθηκε');
    } catch (e: any) {
      const msg = e?.message ?? String(e);
      if (msg.includes('429')) toast.error('Πολλά αιτήματα — δοκίμασε σε λίγο');
      else if (msg.includes('402')) toast.error('Τέλειωσαν τα AI credits');
      else toast.error('Αποτυχία: ' + msg);
    } finally {
      setGenerating(false);
    }
  };

  const saveCard = async () => {
    if (!previewB64) return;
    setSaving(true);
    try {
      let imageUrl: string | null = null;
      try {
        imageUrl = await uploadHeroPng(previewB64);
      } catch (err: any) {
        console.warn('Storage upload failed, falling back to data URL', err);
        toast.message('Αποθήκευση ως data URL (storage upload απέτυχε)');
      }
      const card: HeroCard = {
        id: crypto.randomUUID(),
        title: title.trim(),
        subtitle: subtitle.trim() || undefined,
        cta_label: ctaLabel.trim() || undefined,
        cta_link: ctaLink.trim() || undefined,
        badge: badge.trim() || 'AI Pick',
        placement,
        motion,
        image_url: imageUrl,
        image_data_url: imageUrl ? undefined : `data:image/png;base64,${previewB64}`,
        enabled: true,
      };
      await updateCards([card, ...config.hero_cards]);
      toast.success('Η κάρτα δημοσιεύτηκε στο app');
      setTitle(''); setSubtitle(''); setPrompt(''); setRefImage(null); setPreviewB64(null);
      setBadge('AI Pick'); setPlacement('hero'); setMotion('kenburns');
    } catch (e: any) {
      toast.error('Αποτυχία αποθήκευσης: ' + (e?.message ?? e));
    } finally {
      setSaving(false);
    }
  };

  const patchCard = (id: string, patch: Partial<HeroCard>) => {
    updateCards(config.hero_cards.map((c) => (c.id === id ? { ...c, ...patch } : c)));
  };
  const deleteCard = (id: string) => {
    if (!confirm('Διαγραφή κάρτας;')) return;
    updateCards(config.hero_cards.filter((c) => c.id !== id));
  };
  const move = (id: string, dir: -1 | 1) => {
    const idx = config.hero_cards.findIndex((c) => c.id === id);
    if (idx < 0) return;
    const next = [...config.hero_cards];
    const target = idx + dir;
    if (target < 0 || target >= next.length) return;
    [next[idx], next[target]] = [next[target], next[idx]];
    updateCards(next);
  };

  const counts = {
    hero: config.hero_cards.filter((c) => (c.placement ?? 'hero') === 'hero').length,
    spotlight: config.hero_cards.filter((c) => c.placement === 'spotlight').length,
    strip: config.hero_cards.filter((c) => c.placement === 'strip').length,
  };

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h2 className="admin-section-title flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            AI Cards & Animations
          </h2>
          <p className="text-[12px] text-muted-foreground">
            Professional promo cards με AI εικόνες και motion presets · Hero / Spotlight / Strip
          </p>
        </div>
        <div className="flex gap-2 text-[11px]">
          <span className="admin-pill">Hero {counts.hero}</span>
          <span className="admin-pill">Spotlight {counts.spotlight}</span>
          <span className="admin-pill">Strip {counts.strip}</span>
        </div>
      </div>

      {/* Templates */}
      <Card className="admin-card">
        <CardHeader className="pb-2">
          <CardTitle className="text-[14px] flex items-center gap-2">
            <Wand2 className="h-3.5 w-3.5" /> Professional templates
          </CardTitle>
          <CardDescription className="text-[11.5px]">
            Προσυμπλήρωση τίτλου, prompt, placement & animation — μετά Generate
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          {TEMPLATES.map((t) => (
            <Button key={t.id} size="sm" variant="outline" className="h-8 text-[11.5px]" onClick={() => applyTemplate(t)}>
              {t.label}
            </Button>
          ))}
        </CardContent>
      </Card>

      {/* Generator */}
      <Card className="admin-card">
        <CardHeader>
          <CardTitle className="text-[14px]">Νέα AI κάρτα</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <div className="space-y-3">
            <div>
              <Label className="text-[11.5px]">Τίτλος</Label>
              <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="π.χ. Weekend specials" />
            </div>
            <div>
              <Label className="text-[11.5px]">Υπότιτλος</Label>
              <Input value={subtitle} onChange={(e) => setSubtitle(e.target.value)} placeholder="προαιρετικό" />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-[11.5px]">CTA label</Label>
                <Input value={ctaLabel} onChange={(e) => setCtaLabel(e.target.value)} />
              </div>
              <div>
                <Label className="text-[11.5px]">CTA link</Label>
                <Input value={ctaLink} onChange={(e) => setCtaLink(e.target.value)} placeholder="/order" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-[11.5px]">Badge</Label>
                <Input value={badge} onChange={(e) => setBadge(e.target.value)} />
              </div>
              <div>
                <Label className="text-[11.5px]">Style</Label>
                <select
                  className="h-9 w-full rounded-md border bg-background text-xs px-2"
                  value={style}
                  onChange={(e) => setStyle(e.target.value)}
                >
                  {STYLES.map((s) => (
                    <option key={s.value} value={s.value}>{s.label}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-[11.5px]">Placement</Label>
                <select
                  className="h-9 w-full rounded-md border bg-background text-xs px-2"
                  value={placement}
                  onChange={(e) => setPlacement(e.target.value as HeroPlacement)}
                >
                  {PLACEMENTS.map((p) => (
                    <option key={p.value} value={p.value}>{p.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <Label className="text-[11.5px]">Animation</Label>
                <select
                  className="h-9 w-full rounded-md border bg-background text-xs px-2"
                  value={motion}
                  onChange={(e) => setMotion(e.target.value as HeroMotion)}
                >
                  {MOTIONS.map((m) => (
                    <option key={m.value} value={m.value}>{m.label}</option>
                  ))}
                </select>
              </div>
            </div>
            <div>
              <Label className="text-[11.5px]">Prompt εικόνας</Label>
              <Textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                rows={3}
                placeholder="π.χ. editorial food photography, warm light, negative space left…"
              />
            </div>
            <div>
              <Label className="text-[11.5px]">Reference image (προαιρετικό)</Label>
              <label className="mt-1 flex items-center gap-2 cursor-pointer px-3 py-2 rounded-md border border-dashed border-border hover:bg-muted/40 text-[12px]">
                <Upload className="h-3.5 w-3.5" />
                {refImage ? 'Αλλαγή εικόνας' : 'Ανέβασε εικόνα'}
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => onRefImage(e.target.files?.[0] ?? null)}
                />
              </label>
              {refImage && (
                <div className="mt-2 flex items-center gap-2">
                  <img src={refImage} className="h-14 w-14 object-cover rounded" alt="" />
                  <Button size="sm" variant="ghost" onClick={() => setRefImage(null)}>Αφαίρεση</Button>
                </div>
              )}
            </div>
            <Button onClick={generate} disabled={generating} className="w-full">
              {generating ? (
                <><Loader2 className="h-3.5 w-3.5 mr-2 animate-spin" /> Δημιουργία…</>
              ) : (
                <><Sparkles className="h-3.5 w-3.5 mr-2" /> Generate AI image</>
              )}
            </Button>
          </div>

          <div className="space-y-2">
            <Label className="text-[11.5px]">Προεπισκόπηση · {MOTIONS.find((m) => m.value === motion)?.label}</Label>
            <div className="relative aspect-[16/10] rounded-2xl overflow-hidden border border-border bg-muted/20 flex items-center justify-center ai-card-shell">
              {previewB64 ? (
                <>
                  <img
                    src={`data:image/png;base64,${previewB64}`}
                    className={`absolute inset-0 w-full h-full object-cover ${motion === 'kenburns' ? 'animate-kenburns' : ''}`}
                    alt=""
                  />
                  <div className="absolute inset-0 bg-gradient-to-tr from-black/70 via-black/30 to-transparent" />
                  <div className="absolute inset-0 flex flex-col justify-end p-4">
                    <span className="self-start text-[9px] font-black uppercase tracking-wider bg-white/95 rounded-full px-2 py-0.5 mb-1.5">
                      {badge || 'AI Pick'}
                    </span>
                    <h3 className="text-white font-black text-xl drop-shadow animate-ai-text-in">{title || 'Τίτλος'}</h3>
                    {subtitle && <p className="text-white/90 text-xs font-semibold mt-1 animate-ai-text-in">{subtitle}</p>}
                    {ctaLabel && (
                      <span className="mt-2 self-start rounded-full bg-primary text-primary-foreground text-[11px] font-bold px-3 py-1.5">
                        {ctaLabel}
                      </span>
                    )}
                  </div>
                </>
              ) : (
                <div className="text-muted-foreground text-[12px] flex flex-col items-center gap-2">
                  <ImageIcon className="h-8 w-8 opacity-50" />
                  Η εικόνα θα εμφανιστεί εδώ
                </div>
              )}
            </div>
            <p className="text-[10.5px] text-muted-foreground">
              Placement: <strong>{PLACEMENTS.find((p) => p.value === placement)?.label}</strong>
            </p>
            <Button onClick={saveCard} disabled={!previewB64 || saving} className="w-full">
              {saving ? <Loader2 className="h-3.5 w-3.5 mr-2 animate-spin" /> : null}
              Δημοσίευση στο app
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Existing cards */}
      <Card className="admin-card">
        <CardHeader>
          <CardTitle className="text-[14px]">Δημοσιευμένες κάρτες ({config.hero_cards.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {!loaded ? (
            <div className="text-center text-muted-foreground py-6 text-[12px]">Φόρτωση…</div>
          ) : config.hero_cards.length === 0 ? (
            <div className="text-center text-muted-foreground py-8 text-[12px]">
              Δεν υπάρχουν κάρτες ακόμα — διάλεξε template και Generate.
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {config.hero_cards.map((card, idx) => {
                const src = heroCardImage(card);
                return (
                  <div key={card.id} className="rounded-xl border border-border overflow-hidden bg-card">
                    <div className="relative aspect-[16/10]">
                      {src ? (
                        <img src={src} className="absolute inset-0 w-full h-full object-cover" alt="" />
                      ) : (
                        <div className="absolute inset-0 bg-muted" />
                      )}
                      <div className="absolute inset-0 bg-gradient-to-tr from-black/70 via-black/20 to-transparent" />
                      <div className="absolute top-2 left-2 flex gap-1">
                        <span className="text-[9px] font-bold uppercase tracking-wider bg-black/50 text-white rounded-full px-2 py-0.5">
                          {card.placement ?? 'hero'}
                        </span>
                        <span className="text-[9px] font-bold uppercase tracking-wider bg-black/50 text-white rounded-full px-2 py-0.5">
                          {card.motion ?? 'kenburns'}
                        </span>
                      </div>
                      <div className="absolute inset-0 p-3 flex flex-col justify-end">
                        <h4 className="text-white font-black text-base leading-tight drop-shadow">{card.title}</h4>
                        {card.subtitle && <p className="text-white/90 text-[11px] mt-0.5">{card.subtitle}</p>}
                      </div>
                    </div>
                    <div className="p-2 space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 text-[11px]">
                          <Switch checked={card.enabled} onCheckedChange={() => patchCard(card.id, { enabled: !card.enabled })} />
                          <span className={card.enabled ? 'text-foreground' : 'text-muted-foreground'}>
                            {card.enabled ? 'Ενεργή' : 'Ανενεργή'}
                          </span>
                        </div>
                        <div className="flex items-center gap-1">
                          <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => move(card.id, -1)} disabled={idx === 0}>
                            <ArrowUp className="h-3.5 w-3.5" />
                          </Button>
                          <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => move(card.id, +1)} disabled={idx === config.hero_cards.length - 1}>
                            <ArrowDown className="h-3.5 w-3.5" />
                          </Button>
                          <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-destructive" onClick={() => deleteCard(card.id)}>
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-1.5">
                        <select
                          className="h-7 rounded border bg-background text-[10.5px] px-1.5"
                          value={card.placement ?? 'hero'}
                          onChange={(e) => patchCard(card.id, { placement: e.target.value as HeroPlacement })}
                        >
                          {PLACEMENTS.map((p) => (
                            <option key={p.value} value={p.value}>{p.label}</option>
                          ))}
                        </select>
                        <select
                          className="h-7 rounded border bg-background text-[10.5px] px-1.5"
                          value={card.motion ?? 'kenburns'}
                          onChange={(e) => patchCard(card.id, { motion: e.target.value as HeroMotion })}
                        >
                          {MOTIONS.map((m) => (
                            <option key={m.value} value={m.value}>{m.label}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
