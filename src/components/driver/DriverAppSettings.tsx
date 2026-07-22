import { useEffect, useState } from 'react';
import {
  Settings, Moon, Sun, Monitor, Languages, Navigation as NavIcon,
  Eye, EyeOff, Clock, MapPin, Volume2, VolumeX, Bell, BellOff,
  Smartphone, Play, Ruler, Check, RotateCcw,
} from 'lucide-react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { loadDriverAppPrefs, saveDriverAppPrefs, type DriverAppPrefs } from '@/lib/driver-app-prefs';
import {
  loadDriverSoundPrefs, saveDriverSoundPrefs, playPattern, playOfferAlert,
  type DriverSoundPrefs, type SoundPattern,
} from '@/lib/driver-sound-prefs';
import { requestNotificationPermission } from '@/lib/notifications';
import { useTheme } from '@/hooks/useTheme';
import { useI18n } from '@/lib/i18n';
import { toast } from 'sonner';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type SettingsTab = 'display' | 'map' | 'sound' | 'device';

const TABS: { id: SettingsTab; label: string }[] = [
  { id: 'display', label: 'Εμφάνιση' },
  { id: 'map', label: 'Χάρτης' },
  { id: 'sound', label: 'Ήχος' },
  { id: 'device', label: 'Συσκευή' },
];

const PATTERN_OPTIONS: { value: SoundPattern; label: string; emoji: string }[] = [
  { value: 'random', label: 'Τυχαίο', emoji: '🎲' },
  { value: 'pop', label: 'Pop', emoji: '🎉' },
  { value: 'honk', label: 'Honk', emoji: '📯' },
  { value: 'party', label: 'Party', emoji: '🥳' },
  { value: 'whistle', label: 'Whistle', emoji: '😮‍💨' },
  { value: 'clown', label: 'Clown', emoji: '🤡' },
  { value: 'suspense', label: 'Suspense', emoji: '🎬' },
  { value: 'mystery', label: 'Mystery', emoji: '🔮' },
  { value: 'screech', label: 'Screech', emoji: '🎻' },
  { value: 'nokia', label: 'Nokia', emoji: '📱' },
  { value: 'slip', label: 'Slip', emoji: '🍌' },
];

const DEFAULT_APP: DriverAppPrefs = {
  theme: 'dark',
  language: 'el',
  distanceUnit: 'km',
  navApp: 'google',
  keepScreenOn: false,
  autoAcceptHighValue: false,
  hideEarningsOnHome: false,
  showStorePinsOnMap: true,
  inactivityMinutes: 30,
};

const DEFAULT_SOUND: DriverSoundPrefs = {
  enabled: true,
  volume: 0.85,
  pattern: 'random',
  repeatCount: 2,
  vibrate: true,
};

export function DriverAppSettings({ open, onOpenChange }: Props) {
  const [tab, setTab] = useState<SettingsTab>('display');
  const [prefs, setPrefs] = useState<DriverAppPrefs>(() => loadDriverAppPrefs());
  const [sound, setSound] = useState<DriverSoundPrefs>(() => loadDriverSoundPrefs());
  const { setTheme } = useTheme();
  const { setLang } = useI18n();
  const [notif, setNotif] = useState<NotificationPermission>(
    typeof window !== 'undefined' && 'Notification' in window ? Notification.permission : 'denied',
  );

  useEffect(() => {
    if (!open) return;
    setPrefs(loadDriverAppPrefs());
    setSound(loadDriverSoundPrefs());
    setTab('display');
    if (typeof window !== 'undefined' && 'Notification' in window) {
      setNotif(Notification.permission);
    }
  }, [open]);

  const update = (patch: Partial<DriverAppPrefs>) => {
    const next = { ...prefs, ...patch };
    setPrefs(next);
    saveDriverAppPrefs(next);
    if (patch.theme) setTheme(patch.theme);
    if (patch.language) setLang(patch.language);
  };

  const updateSound = (patch: Partial<DriverSoundPrefs>) => {
    const next = { ...sound, ...patch };
    setSound(next);
    saveDriverSoundPrefs(next);
  };

  const resetAll = () => {
    setPrefs(DEFAULT_APP);
    saveDriverAppPrefs(DEFAULT_APP);
    setTheme(DEFAULT_APP.theme);
    setLang(DEFAULT_APP.language);
    setSound(DEFAULT_SOUND);
    saveDriverSoundPrefs(DEFAULT_SOUND);
    toast.success('Επαναφορά προεπιλογών');
  };

  const Segment = <T extends string>({
    options,
    value,
    onChange,
  }: {
    options: { value: T; label: string; icon?: React.ElementType }[];
    value: T;
    onChange: (v: T) => void;
  }) => (
    <div className="inline-flex rounded-xl bg-[hsl(var(--driver-surface-muted))] p-1 gap-0.5 border border-[hsl(var(--driver-border))]">
      {options.map((opt) => {
        const active = value === opt.value;
        const Icon = opt.icon;
        return (
          <button
            key={opt.value}
            type="button"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={() => onChange(opt.value)}
            className={`min-h-9 px-3 rounded-lg text-xs font-heading font-bold transition-all inline-flex items-center gap-1.5 ${
              active
                ? 'bg-[hsl(var(--driver-surface))] text-[hsl(var(--driver-text))] shadow-sm'
                : 'text-[hsl(var(--driver-text-muted))] hover:text-[hsl(var(--driver-text))]'
            }`}
          >
            {Icon && <Icon className="h-3.5 w-3.5" />}
            {opt.label}
          </button>
        );
      })}
    </div>
  );

  const Row = ({
    icon: Icon,
    label,
    desc,
    children,
  }: {
    icon: React.ElementType;
    label: string;
    desc?: string;
    children: React.ReactNode;
  }) => (
    <div className="flex items-center justify-between gap-3 p-3.5 rounded-2xl bg-[hsl(var(--driver-surface))] border border-[hsl(var(--driver-border))] shadow-[0_1px_2px_hsl(220_18%_14%/0.04)]">
      <div className="flex items-start gap-3 min-w-0">
        <div className="h-9 w-9 rounded-xl bg-[hsl(var(--driver-surface-muted))] border border-[hsl(var(--driver-border))] flex items-center justify-center shrink-0">
          <Icon className="h-4 w-4 text-[hsl(var(--driver-text))]" />
        </div>
        <div className="min-w-0">
          <Label className="text-sm font-heading font-bold text-[hsl(var(--driver-text))] block leading-tight">
            {label}
          </Label>
          {desc && <p className="text-[11px] text-[hsl(var(--driver-text-muted))] mt-0.5 leading-snug">{desc}</p>}
        </div>
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="driver-shell bg-[hsl(var(--driver-bg))] border-t border-[hsl(var(--driver-border))] rounded-t-3xl max-h-[92vh] overflow-hidden flex flex-col p-0 text-[hsl(var(--driver-text))]"
      >
        {/* Drag handle + header */}
        <div className="px-4 pt-3 pb-2 border-b border-[hsl(var(--driver-border))] bg-[hsl(var(--driver-surface))]/90 backdrop-blur sticky top-0 z-10">
          <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-[hsl(var(--driver-text-muted))]/35" />
          <SheetHeader className="text-left space-y-0">
            <div className="flex items-center justify-between gap-2">
              <SheetTitle className="font-heading text-[hsl(var(--driver-text))] flex items-center gap-2 text-base">
                <span className="h-8 w-8 rounded-xl driver-gradient-earn text-white flex items-center justify-center">
                  <Settings className="h-4 w-4" />
                </span>
                Ρυθμίσεις οδηγού
              </SheetTitle>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className="h-9 px-3 font-heading font-bold text-[hsl(var(--driver-accent))]"
                onClick={() => onOpenChange(false)}
              >
                <Check className="h-4 w-4 mr-1" />
                Έτοιμο
              </Button>
            </div>
          </SheetHeader>

          {/* Section tabs */}
          <div className="mt-3 flex gap-1 overflow-x-auto scrollbar-thin pb-0.5">
            {TABS.map((t) => {
              const active = tab === t.id;
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setTab(t.id)}
                  className={`shrink-0 rounded-full px-3.5 py-1.5 text-xs font-heading font-bold transition-colors border ${
                    active
                      ? 'bg-[hsl(var(--driver-text))] text-[hsl(var(--driver-bg))] border-[hsl(var(--driver-text))]'
                      : 'bg-[hsl(var(--driver-surface))] text-[hsl(var(--driver-text-muted))] border-[hsl(var(--driver-border))]'
                  }`}
                >
                  {t.label}
                </button>
              );
            })}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto overscroll-contain px-4 py-4 space-y-3 pb-8">
          {tab === 'display' && (
            <>
              <Row icon={prefs.theme === 'light' ? Sun : prefs.theme === 'dark' ? Moon : Monitor} label="Θέμα" desc="Εμφάνιση εφαρμογής">
                <Segment
                  value={prefs.theme}
                  onChange={(theme) => update({ theme })}
                  options={[
                    { value: 'dark', label: 'Σκούρο', icon: Moon },
                    { value: 'light', label: 'Φωτεινό', icon: Sun },
                    { value: 'system', label: 'Αυτόματο', icon: Monitor },
                  ]}
                />
              </Row>
              <Row icon={Languages} label="Γλώσσα" desc="Κείμενα εφαρμογής">
                <Segment
                  value={prefs.language}
                  onChange={(language) => update({ language })}
                  options={[
                    { value: 'el', label: 'Ελληνικά' },
                    { value: 'en', label: 'English' },
                  ]}
                />
              </Row>
              <Row
                icon={prefs.hideEarningsOnHome ? EyeOff : Eye}
                label="Απόκρυψη κερδών"
                desc="Κρύβει ποσά στην οθόνη κερδών"
              >
                <Switch
                  checked={prefs.hideEarningsOnHome}
                  onCheckedChange={(v) => update({ hideEarningsOnHome: v })}
                />
              </Row>
              <Row icon={Ruler} label="Μονάδα απόστασης" desc="Χιλιόμετρα ή μίλια">
                <Segment
                  value={prefs.distanceUnit}
                  onChange={(distanceUnit) => update({ distanceUnit })}
                  options={[
                    { value: 'km', label: 'km' },
                    { value: 'mi', label: 'mi' },
                  ]}
                />
              </Row>
            </>
          )}

          {tab === 'map' && (
            <>
              <Row icon={NavIcon} label="Εφαρμογή πλοήγησης" desc="Άνοιγμα διαδρομής εξωτερικά">
                <Segment
                  value={prefs.navApp}
                  onChange={(navApp) => update({ navApp })}
                  options={[
                    { value: 'google', label: 'Google' },
                    { value: 'apple', label: 'Apple' },
                    { value: 'waze', label: 'Waze' },
                  ]}
                />
              </Row>
              <Row icon={MapPin} label="Pins καταστημάτων" desc="Εμφάνιση κοντινών stores στον χάρτη">
                <Switch
                  checked={prefs.showStorePinsOnMap}
                  onCheckedChange={(v) => update({ showStorePinsOnMap: v })}
                />
              </Row>
              <div className="rounded-2xl border border-[hsl(var(--driver-border))] bg-[hsl(var(--driver-surface))] p-3.5">
                <p className="text-xs font-heading font-bold text-[hsl(var(--driver-text))] mb-1">Συμβουλή χάρτη</p>
                <p className="text-[11px] text-[hsl(var(--driver-text-muted))] leading-relaxed">
                  Στο χάρτη μπορείς να συμπτύξεις το κάτω πάνελ και να πατήσεις το κουμπί προβολής για να δεις όλη τη διαδρομή.
                </p>
              </div>
            </>
          )}

          {tab === 'sound' && (
            <>
              <Row
                icon={sound.enabled ? Volume2 : VolumeX}
                label="Ήχος ειδοποιήσεων"
                desc="Προσφορές & μηνύματα — τυχαίο effect by default"
              >
                <Switch checked={sound.enabled} onCheckedChange={(v) => updateSound({ enabled: v })} />
              </Row>
              <Row icon={Smartphone} label="Δόνηση" desc="Δονείται μαζί με τον ήχο">
                <Switch checked={sound.vibrate} onCheckedChange={(v) => updateSound({ vibrate: v })} />
              </Row>

              <div className={`rounded-2xl border border-[hsl(var(--driver-border))] bg-[hsl(var(--driver-surface))] p-3.5 space-y-4 ${!sound.enabled ? 'opacity-45 pointer-events-none' : ''}`}>
                <div>
                  <div className="flex justify-between mb-2">
                    <Label className="font-heading text-sm font-bold">Ένταση</Label>
                    <span className="text-xs font-heading font-bold text-[hsl(var(--driver-accent))]">
                      {Math.round(sound.volume * 100)}%
                    </span>
                  </div>
                  <Slider
                    value={[sound.volume * 100]}
                    onValueChange={([v]) => updateSound({ volume: v / 100 })}
                    max={100}
                    step={5}
                  />
                </div>
                <div>
                  <div className="flex justify-between mb-2">
                    <Label className="font-heading text-sm font-bold">Επαναλήψεις</Label>
                    <span className="text-xs font-heading font-bold text-[hsl(var(--driver-accent))]">
                      {sound.repeatCount}×
                    </span>
                  </div>
                  <Slider
                    value={[sound.repeatCount]}
                    onValueChange={([v]) => updateSound({ repeatCount: v })}
                    min={1}
                    max={5}
                    step={1}
                  />
                </div>
              </div>

              <div className={!sound.enabled ? 'opacity-45 pointer-events-none' : ''}>
                <p className="text-[10px] font-heading uppercase tracking-[0.14em] text-[hsl(var(--driver-text-muted))] mb-2 px-0.5">
                  Ήχος ειδοποίησης
                </p>
                <div className="grid grid-cols-5 gap-2">
                  {PATTERN_OPTIONS.map((opt) => {
                    const active = sound.pattern === opt.value;
                    return (
                      <button
                        type="button"
                        key={opt.value}
                        onClick={() => {
                          const next = { ...sound, pattern: opt.value };
                          setSound(next);
                          saveDriverSoundPrefs(next);
                          // Preview: resolve random to a concrete sample each tap.
                          playPattern(next.pattern, next.volume);
                        }}
                        className={`flex flex-col items-center justify-center gap-1 p-2 rounded-xl border-2 transition-all min-h-[64px] ${
                          active
                            ? 'border-[hsl(var(--driver-accent))] bg-[hsl(var(--driver-accent))]/10 shadow-sm'
                            : 'border-[hsl(var(--driver-border))] bg-[hsl(var(--driver-surface))]'
                        }`}
                      >
                        <span className="text-base leading-none">{opt.emoji}</span>
                        <span className="font-heading text-[9px] font-bold text-[hsl(var(--driver-text))]">{opt.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="grid grid-cols-1 gap-2">
                {notif !== 'granted' ? (
                  <Button
                    onClick={async () => {
                      const ok = await requestNotificationPermission();
                      setNotif(ok ? 'granted' : 'denied');
                      toast[ok ? 'success' : 'error'](ok ? 'Ειδοποιήσεις ενεργές' : 'Δεν δόθηκε άδεια');
                    }}
                    variant="outline"
                    className="h-11 font-heading font-bold border-[hsl(var(--driver-border))]"
                  >
                    <Bell className="h-4 w-4 mr-2" />
                    Ενεργοποίηση ειδοποιήσεων OS
                  </Button>
                ) : (
                  <div className="flex items-center gap-2 rounded-xl border border-emerald-500/25 bg-emerald-500/10 px-3 py-2.5 text-xs font-heading font-semibold text-emerald-700">
                    <Bell className="h-4 w-4" />
                    Ειδοποιήσεις συστήματος ενεργές
                  </div>
                )}
                {notif === 'denied' && (
                  <div className="flex items-start gap-2 rounded-xl border border-amber-500/25 bg-amber-500/10 px-3 py-2.5 text-[11px] text-amber-800">
                    <BellOff className="h-4 w-4 shrink-0 mt-0.5" />
                    Οι ειδοποιήσεις είναι απενεργοποιημένες στις ρυθμίσεις του browser/συσκευής.
                  </div>
                )}
                <Button
                  onClick={() => playOfferAlert(sound)}
                  disabled={!sound.enabled}
                  className="h-11 font-heading font-bold driver-gradient-earn text-white border-0"
                >
                  <Play className="h-4 w-4 mr-2" />
                  Δοκιμή ήχου προσφοράς
                </Button>
              </div>
            </>
          )}

          {tab === 'device' && (
            <>
              <Row icon={Sun} label="Οθόνη πάντα ενεργή" desc="Wake lock όσο είσαι online">
                <Switch
                  checked={prefs.keepScreenOn}
                  onCheckedChange={(v) => update({ keepScreenOn: v })}
                />
              </Row>
              <Row icon={Clock} label="Auto-offline" desc="Αυτόματο offline μετά από αδράνεια">
                <Segment
                  value={String(prefs.inactivityMinutes)}
                  onChange={(value) => update({ inactivityMinutes: Number(value) })}
                  options={[
                    { value: '0', label: 'Ποτέ' },
                    { value: '15', label: '15λ' },
                    { value: '30', label: '30λ' },
                    { value: '60', label: '60λ' },
                    { value: '120', label: '2ώ' },
                  ]}
                />
              </Row>

              <div className="pt-2">
                <Button
                  type="button"
                  variant="outline"
                  className="w-full h-11 font-heading font-bold border-[hsl(var(--driver-border))] text-[hsl(var(--driver-text-muted))]"
                  onClick={resetAll}
                >
                  <RotateCcw className="h-4 w-4 mr-2" />
                  Επαναφορά προεπιλογών
                </Button>
                <p className="text-[10px] text-center text-[hsl(var(--driver-text-muted))] mt-3">
                  Οι ρυθμίσεις αποθηκεύονται μόνο σε αυτή τη συσκευή
                </p>
              </div>
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
