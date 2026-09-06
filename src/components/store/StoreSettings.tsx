import { useEffect, useState } from 'react';
import { BellRing, Clock, Play, Volume2, VolumeX, Zap, MapPin, Save, Image as ImageIcon, Phone, Store as StoreIcon, Loader2, Sparkles } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { useStore } from '@/hooks/useStore';
import {
  STORE_SOUND_PREFS_EVENT,
  loadStoreSoundPrefs,
  saveStoreSoundPrefs,
  type StoreSoundPrefs,
} from '@/lib/store-sound-prefs';
import { playOrderSound, unlockAudio } from '@/lib/notifications';

interface StoreSettingsProps {
  storeId: string;
}

type AppearanceDraft = {
  name: string;
  address: string;
  phone: string;
  image_url: string;
  cover_image_url: string;
  tagline: string;
  promo_badge: string;
  highlight_color: string;
};

export function StoreSettings({ storeId }: StoreSettingsProps) {
  const { stores, updateStore, selectStore } = useStore();
  const store = stores.find((s) => s.id === storeId) ?? null;
  const [draft, setDraft] = useState<AppearanceDraft>({
    name: '',
    address: '',
    phone: '',
    image_url: '',
    cover_image_url: '',
    tagline: '',
    promo_badge: '',
    highlight_color: '',
  });
  const [saving, setSaving] = useState(false);
  // Local-device sound preferences (same module the N-store call view uses).
  const [sound, setSound] = useState<StoreSoundPrefs>(() => loadStoreSoundPrefs());

  useEffect(() => {
    const onChange = (e: Event) => {
      const detail = (e as CustomEvent<StoreSoundPrefs>).detail;
      setSound(detail ?? loadStoreSoundPrefs());
    };
    window.addEventListener(STORE_SOUND_PREFS_EVENT, onChange);
    return () => window.removeEventListener(STORE_SOUND_PREFS_EVENT, onChange);
  }, []);

  const updateSound = (patch: Partial<StoreSoundPrefs>) => {
    const next = { ...sound, ...patch };
    setSound(next);
    saveStoreSoundPrefs(next);
  };

  const testOrderSound = () => {
    unlockAudio();
    playOrderSound(sound.orderVolume);
  };

  useEffect(() => {
    if (storeId) selectStore(storeId);
  }, [storeId, selectStore]);

  useEffect(() => {
    if (store) {
      setDraft({
        name: store.name ?? '',
        address: store.address ?? '',
        phone: store.phone ?? '',
        image_url: store.image_url ?? '',
        cover_image_url: (store as any).cover_image_url ?? '',
        tagline: (store as any).tagline ?? '',
        promo_badge: (store as any).promo_badge ?? '',
        highlight_color: (store as any).highlight_color ?? '',
      });
    }
  }, [
    store?.id,
    store?.name,
    store?.address,
    store?.phone,
    store?.image_url,
    (store as any)?.cover_image_url,
    (store as any)?.tagline,
    (store as any)?.promo_badge,
    (store as any)?.highlight_color,
  ]);

  const dirty = !!store && (
    draft.name !== (store.name ?? '') ||
    draft.address !== (store.address ?? '') ||
    draft.phone !== (store.phone ?? '') ||
    draft.image_url !== (store.image_url ?? '') ||
    draft.cover_image_url !== ((store as any).cover_image_url ?? '') ||
    draft.tagline !== ((store as any).tagline ?? '') ||
    draft.promo_badge !== ((store as any).promo_badge ?? '') ||
    draft.highlight_color !== ((store as any).highlight_color ?? '')
  );

  const handleSave = async () => {
    if (!dirty) return;
    setSaving(true);
    await updateStore({
      name: draft.name.trim(),
      address: draft.address.trim(),
      phone: draft.phone.trim() || null,
      image_url: draft.image_url.trim() || null,
      cover_image_url: draft.cover_image_url.trim() || null,
      tagline: draft.tagline.trim() || null,
      promo_badge: draft.promo_badge.trim() || null,
      highlight_color: draft.highlight_color.trim() || null,
    } as any, storeId);
    setSaving(false);
  };

  if (!store) {
    return (
      <Card>
        <CardContent className="p-6 text-sm text-muted-foreground">Φόρτωση καταστήματος…</CardContent>
      </Card>
    );
  }

  const preview = draft.cover_image_url || draft.image_url;

  return (
    <div className="space-y-4">
      <Card className="shadow-[var(--shadow-md)]">
        <CardContent className="p-4 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-heading font-semibold text-foreground">Κατάσταση</h3>
          </div>

          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">Ανοιχτό για παραγγελίες</p>
              <p className="text-xs text-muted-foreground">Απενεργοποίησε για να μην δέχεσαι νέες</p>
            </div>
            <Switch
              checked={!!store.is_active}
              onCheckedChange={(checked) => updateStore({ is_active: checked }, storeId)}
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Zap className="h-4 w-4 text-warning" />
              <div>
                <p className="text-sm font-medium">Busy mode</p>
                <p className="text-xs text-muted-foreground">Εμφανίζει «Πολυάσχολο» στους πελάτες</p>
              </div>
            </div>
            <Switch
              checked={!!store.busy_mode}
              onCheckedChange={(checked) => updateStore({ busy_mode: checked }, storeId)}
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-muted-foreground" />
                <p className="text-sm font-medium">Επιπλέον χρόνος προετοιμασίας</p>
              </div>
              <Badge variant="outline">{store.prep_buffer_minutes ?? 0}΄</Badge>
            </div>
            <Slider
              value={[store.prep_buffer_minutes ?? 0]}
              min={0}
              max={45}
              step={5}
              onValueChange={([val]) => updateStore({ prep_buffer_minutes: val }, storeId)}
            />
          </div>

        </CardContent>
      </Card>

      <Card className="shadow-[var(--shadow-md)]">
        <CardContent className="p-4 space-y-4">
          <h3 className="font-heading font-semibold text-foreground flex items-center gap-2">
            <BellRing className="h-4 w-4 text-primary" /> Ήχοι ειδοποιήσεων
          </h3>
          <p className="text-xs text-muted-foreground -mt-2">
            Αφορούν αυτή τη συσκευή — ο ήχος νέων παραγγελιών και κλήσεων οδηγού.
          </p>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {sound.orderChimeEnabled ? (
                <Volume2 className="h-4 w-4 text-primary" />
              ) : (
                <VolumeX className="h-4 w-4 text-muted-foreground" />
              )}
              <div>
                <p className="text-sm font-medium">Ήχος νέων παραγγελιών</p>
                <p className="text-xs text-muted-foreground">Chime όταν έρχεται νέα παραγγελία</p>
              </div>
            </div>
            <Switch
              checked={sound.orderChimeEnabled}
              onCheckedChange={(checked) => updateSound({ orderChimeEnabled: checked })}
            />
          </div>

          <div className={`space-y-4 ${!sound.orderChimeEnabled ? 'opacity-45 pointer-events-none' : ''}`}>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium">Ένταση</p>
                <Badge variant="outline">{Math.round(sound.orderVolume * 100)}%</Badge>
              </div>
              <Slider
                value={[sound.orderVolume * 100]}
                min={0}
                max={100}
                step={5}
                onValueChange={([val]) => updateSound({ orderVolume: (val ?? 100) / 100 })}
              />
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium">Επαναλήψεις</p>
                <Badge variant="outline">{sound.orderRepeats}×</Badge>
              </div>
              <Slider
                value={[sound.orderRepeats]}
                min={1}
                max={5}
                step={1}
                onValueChange={([val]) => updateSound({ orderRepeats: val ?? 5 })}
              />
              <p className="text-[11px] text-muted-foreground">
                Πόσες φορές παίζει το chime σε κάθε νέα παραγγελία
              </p>
            </div>
          </div>

          <Button
            type="button"
            variant="outline"
            className="w-full font-heading"
            disabled={!sound.orderChimeEnabled}
            onClick={testOrderSound}
          >
            <Play className="h-4 w-4 mr-2" />
            Δοκιμή ήχου
          </Button>
        </CardContent>
      </Card>

      <Card className="shadow-[var(--shadow-md)]">
        <CardContent className="p-4 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-heading font-semibold text-foreground flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" /> Εμφάνιση στο app
            </h3>
            {dirty && <Badge variant="outline" className="text-warning border-warning/40">Μη αποθηκευμένα</Badge>}
          </div>

          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="store-tagline" className="text-xs text-muted-foreground">Tagline</Label>
              <Input
                id="store-tagline"
                value={draft.tagline}
                onChange={(e) => setDraft((p) => ({ ...p, tagline: e.target.value }))}
                maxLength={80}
                placeholder="π.χ. Φρέσκο, ζεστό, τοπικό"
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="store-badge" className="text-xs text-muted-foreground">Promo badge</Label>
                <Input
                  id="store-badge"
                  value={draft.promo_badge}
                  onChange={(e) => setDraft((p) => ({ ...p, promo_badge: e.target.value }))}
                  maxLength={24}
                  placeholder="-20% · Νέο"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="store-highlight" className="text-xs text-muted-foreground">Highlight (HSL)</Label>
                <div className="flex gap-2 items-center">
                  <Input
                    id="store-highlight"
                    value={draft.highlight_color}
                    onChange={(e) => setDraft((p) => ({ ...p, highlight_color: e.target.value }))}
                    placeholder="152 100% 39%"
                  />
                  <div
                    className="h-9 w-9 rounded-md border shrink-0"
                    style={{ background: draft.highlight_color ? `hsl(${draft.highlight_color})` : 'transparent' }}
                  />
                </div>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="store-cover" className="text-xs flex items-center gap-1.5 text-muted-foreground">
                <ImageIcon className="h-3.5 w-3.5" /> Cover εικόνα (URL)
              </Label>
              <Input
                id="store-cover"
                value={draft.cover_image_url}
                onChange={(e) => setDraft((p) => ({ ...p, cover_image_url: e.target.value }))}
                maxLength={500}
                placeholder="Προαιρετικό — αλλιώς χρησιμοποιείται η κύρια εικόνα"
              />
            </div>
            {preview && (
              <div className="relative rounded-lg overflow-hidden border border-border h-28 bg-muted/30">
                <img
                  src={preview}
                  alt="Προεπισκόπηση"
                  className="w-full h-full object-cover"
                  onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
                />
                {draft.promo_badge && (
                  <span className="absolute bottom-2 left-2 text-[10px] font-extrabold uppercase tracking-wide text-white bg-emerald-600 px-2 py-0.5 rounded-md">
                    {draft.promo_badge}
                  </span>
                )}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <Card className="shadow-[var(--shadow-md)]">
        <CardContent className="p-4 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-heading font-semibold text-foreground">Στοιχεία Καταστήματος</h3>
            {dirty && <Badge variant="outline" className="text-warning border-warning/40">Μη αποθηκευμένα</Badge>}
          </div>

          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="store-name" className="text-xs flex items-center gap-1.5 text-muted-foreground">
                <StoreIcon className="h-3.5 w-3.5" /> Όνομα Καταστήματος
              </Label>
              <Input
                id="store-name"
                value={draft.name}
                onChange={(e) => setDraft((p) => ({ ...p, name: e.target.value }))}
                maxLength={120}
                placeholder="π.χ. Pizza Express"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="store-address" className="text-xs flex items-center gap-1.5 text-muted-foreground">
                <MapPin className="h-3.5 w-3.5" /> Διεύθυνση
              </Label>
              <Input
                id="store-address"
                value={draft.address}
                onChange={(e) => setDraft((p) => ({ ...p, address: e.target.value }))}
                maxLength={200}
                placeholder="Οδός 123, Πόλη"
              />
              <p className="text-[11px] text-muted-foreground/80">
                Με την αποθήκευση η διεύθυνση επανατοποθετείται αυτόματα στον χάρτη για οδηγούς & πελάτες.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="store-phone" className="text-xs flex items-center gap-1.5 text-muted-foreground">
                  <Phone className="h-3.5 w-3.5" /> Τηλέφωνο
                </Label>
                <Input
                  id="store-phone"
                  value={draft.phone}
                  onChange={(e) => setDraft((p) => ({ ...p, phone: e.target.value }))}
                  maxLength={32}
                  inputMode="tel"
                  placeholder="+30 210 1234567"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="store-image" className="text-xs flex items-center gap-1.5 text-muted-foreground">
                  <ImageIcon className="h-3.5 w-3.5" /> Εικόνα (URL)
                </Label>
                <Input
                  id="store-image"
                  value={draft.image_url}
                  onChange={(e) => setDraft((p) => ({ ...p, image_url: e.target.value }))}
                  maxLength={500}
                  placeholder="https://..."
                />
              </div>
            </div>

            <Button
              onClick={handleSave}
              disabled={!dirty || saving || !draft.name.trim() || !draft.address.trim()}
              className="w-full"
            >
              {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
              Αποθήκευση Στοιχείων
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
