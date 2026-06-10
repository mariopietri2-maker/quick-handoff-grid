import { useEffect, useState } from 'react';
import {
  Settings, Moon, Sun, Languages, Navigation as NavIcon, Eye, EyeOff,
  Clock, MapPin, Volume2, VolumeX, Bell, Smartphone, Play,
} from 'lucide-react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { loadDriverAppPrefs, saveDriverAppPrefs, type DriverAppPrefs } from '@/lib/driver-app-prefs';
import {
  loadDriverSoundPrefs, saveDriverSoundPrefs, playPattern, playOfferAlert,
  type DriverSoundPrefs, type SoundPattern,
} from '@/lib/driver-sound-prefs';
import { requestNotificationPermission } from '@/lib/notifications';
import { useTheme } from '@/hooks/useTheme';
import { useI18n } from '@/lib/i18n';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const PATTERN_OPTIONS: { value: SoundPattern; label: string; emoji: string }[] = [
  { value: 'doordash_real', label: 'DoorDash', emoji: '🔔' },
  { value: 'ios_tritone',   label: 'iOS',      emoji: '📱' },
  { value: 'crystal',       label: 'Crystal',  emoji: '✨' },
  { value: 'tesla',         label: 'Tesla',    emoji: '🚗' },
  { value: 'fanfare',       label: 'Fanfare',  emoji: '🎺' },
  { value: 'zen',           label: 'Zen',      emoji: '🧘' },
  { value: 'wolt',          label: 'Wolt',     emoji: '💙' },
  { value: 'uber',          label: 'Uber',     emoji: '⚡' },
  { value: 'glovo',         label: 'Glovo',    emoji: '🟡' },
  { value: 'kaching',       label: 'Ka-ching', emoji: '💸' },
  { value: 'chime',         label: 'Χτύπος',   emoji: '🔔' },
  { value: 'urgent',        label: 'Επείγον',  emoji: '🚨' },
];

export function DriverAppSettings({ open, onOpenChange }: Props) {
  const [prefs, setPrefs] = useState<DriverAppPrefs>(() => loadDriverAppPrefs());
  const [sound, setSound] = useState<DriverSoundPrefs>(() => loadDriverSoundPrefs());
  const { setTheme } = useTheme();
  const { setLang } = useI18n();
  const [notif, setNotif] = useState<NotificationPermission>(
    typeof window !== 'undefined' && 'Notification' in window ? Notification.permission : 'denied'
  );

  useEffect(() => {
    if (open) {
      setPrefs(loadDriverAppPrefs());
      setSound(loadDriverSoundPrefs());
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

  const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
    <div className="space-y-3">
      <p className="text-[10px] font-heading uppercase tracking-[0.15em] text-muted-foreground">{title}</p>
      <div className="space-y-2">{children}</div>
    </div>
  );

  const Row = ({ icon: Icon, label, children, desc }: { icon: React.ElementType; label: string; children: React.ReactNode; desc?: string }) => (
    <div className="flex items-center justify-between gap-3 p-3 rounded-xl bg-muted/40 border border-border">
      <div className="flex items-start gap-3 min-w-0">
        <div className="h-8 w-8 rounded-lg bg-card border border-border flex items-center justify-center shrink-0">
          <Icon className="h-4 w-4 text-foreground" />
        </div>
        <div className="min-w-0">
          <Label className="text-sm font-heading font-semibold text-foreground block">{label}</Label>
          {desc && <p className="text-[11px] text-muted-foreground mt-0.5">{desc}</p>}
        </div>
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="bg-background border-t border-border rounded-t-3xl max-h-[88vh] overflow-y-auto text-foreground">
        <SheetHeader className="text-left mb-4">
          <SheetTitle className="font-heading text-foreground flex items-center gap-2">
            <Settings className="h-5 w-5 text-primary" />
            Ρυθμίσεις Εφαρμογής
          </SheetTitle>
        </SheetHeader>

        <div className="space-y-6 pb-6">
          <Section title="Εμφάνιση">
            <Row icon={Moon} label="Θέμα" desc="Σκοτεινό, φωτεινό ή σύστημα">
              <Select value={prefs.theme} onValueChange={(v) => update({ theme: v as DriverAppPrefs['theme'] })}>
                <SelectTrigger className="w-32 h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="dark">🌙 Σκοτεινό</SelectItem>
                  <SelectItem value="light">☀️ Φωτεινό</SelectItem>
                  <SelectItem value="system">⚙️ Σύστημα</SelectItem>
                </SelectContent>
              </Select>
            </Row>
            <Row icon={Languages} label="Γλώσσα">
              <Select value={prefs.language} onValueChange={(v) => update({ language: v as DriverAppPrefs['language'] })}>
                <SelectTrigger className="w-32 h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="el">🇬🇷 Ελληνικά</SelectItem>
                  <SelectItem value="en">🇬🇧 English</SelectItem>
                </SelectContent>
              </Select>
            </Row>
            <Row icon={prefs.hideEarningsOnHome ? EyeOff : Eye} label="Απόκρυψη κερδών" desc="Κρύψτε ποσά από οθόνη">
              <Switch
                checked={prefs.hideEarningsOnHome}
                onCheckedChange={(v) => update({ hideEarningsOnHome: v })}
              />
            </Row>
          </Section>

          <Section title="Πλοήγηση & Χάρτης">
            <Row icon={NavIcon} label="Εφαρμογή πλοήγησης">
              <Select value={prefs.navApp} onValueChange={(v) => update({ navApp: v as DriverAppPrefs['navApp'] })}>
                <SelectTrigger className="w-32 h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="google">Google Maps</SelectItem>
                  <SelectItem value="apple">Apple Maps</SelectItem>
                  <SelectItem value="waze">Waze</SelectItem>
                </SelectContent>
              </Select>
            </Row>
            <Row icon={MapPin} label="Pins καταστημάτων" desc="Εμφάνιση στον χάρτη">
              <Switch
                checked={prefs.showStorePinsOnMap}
                onCheckedChange={(v) => update({ showStorePinsOnMap: v })}
              />
            </Row>
          </Section>

          <Section title="Ήχος Ειδοποιήσεων">
            <Row icon={sound.enabled ? Volume2 : VolumeX} label="Ήχος για νέες παραγγελίες" desc="Παίζει όταν φτάνει προσφορά">
              <Switch checked={sound.enabled} onCheckedChange={(v) => updateSound({ enabled: v })} />
            </Row>
            <Row icon={Smartphone} label="Δόνηση" desc="Δονείται στην προσφορά">
              <Switch checked={sound.vibrate} onCheckedChange={(v) => updateSound({ vibrate: v })} />
            </Row>
            <div className={`space-y-3 p-3 rounded-xl bg-muted/40 border border-border ${!sound.enabled ? 'opacity-50 pointer-events-none' : ''}`}>
              <div className="flex justify-between">
                <Label className="font-heading text-sm text-foreground">Ένταση</Label>
                <span className="text-xs font-heading text-primary">{Math.round(sound.volume * 100)}%</span>
              </div>
              <Slider
                value={[sound.volume * 100]}
                onValueChange={([v]) => updateSound({ volume: v / 100 })}
                max={100} step={5}
              />
              <div className="flex justify-between pt-2">
                <Label className="font-heading text-sm text-foreground">Επαναλήψεις</Label>
                <span className="text-xs font-heading text-primary">{sound.repeatCount}×</span>
              </div>
              <Slider
                value={[sound.repeatCount]}
                onValueChange={([v]) => updateSound({ repeatCount: v })}
                min={1} max={5} step={1}
              />
            </div>
            <div className={`grid grid-cols-3 gap-2 ${!sound.enabled ? 'opacity-50 pointer-events-none' : ''}`}>
              {PATTERN_OPTIONS.map(opt => (
                <button
                  key={opt.value}
                  onClick={() => { updateSound({ pattern: opt.value }); playPattern(opt.value, sound.volume); }}
                  className={`flex flex-col items-center justify-center gap-1 p-2 rounded-xl border-2 transition-all ${
                    sound.pattern === opt.value ? 'border-primary bg-primary/10' : 'border-border bg-muted/40'
                  }`}
                >
                  <span className="text-base">{opt.emoji}</span>
                  <span className="font-heading text-[10px] font-semibold text-foreground">{opt.label}</span>
                </button>
              ))}
            </div>
            {notif !== 'granted' && (
              <Button
                onClick={async () => {
                  const ok = await requestNotificationPermission();
                  setNotif(ok ? 'granted' : 'denied');
                }}
                variant="outline" size="sm" className="w-full font-heading"
              >
                <Bell className="h-4 w-4 mr-2" />
                Ενεργοποίηση ειδοποιήσεων
              </Button>
            )}
            <Button
              onClick={() => playOfferAlert(sound)}
              size="sm" className="w-full font-heading"
              disabled={!sound.enabled}
            >
              <Play className="h-4 w-4 mr-2" />
              Δοκιμή ήχου
            </Button>
          </Section>

          <Section title="Συσκευή">
            <Row icon={Sun} label="Οθόνη πάντα ενεργή" desc="Αποφυγή κλειδώματος">
              <Switch
                checked={prefs.keepScreenOn}
                onCheckedChange={(v) => update({ keepScreenOn: v })}
              />
            </Row>
            <Row icon={Clock} label="Auto-offline (λεπτά)" desc="Όταν είσαι αδρανής">
              <Select value={String(prefs.inactivityMinutes)} onValueChange={(v) => update({ inactivityMinutes: Number(v) })}>
                <SelectTrigger className="w-24 h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="0">Ποτέ</SelectItem>
                  <SelectItem value="15">15</SelectItem>
                  <SelectItem value="30">30</SelectItem>
                  <SelectItem value="60">60</SelectItem>
                  <SelectItem value="120">120</SelectItem>
                </SelectContent>
              </Select>
            </Row>
          </Section>

          <p className="text-[10px] text-center text-muted-foreground pt-2">
            Οι ρυθμίσεις αποθηκεύονται σε αυτή τη συσκευή
          </p>
        </div>
      </SheetContent>
    </Sheet>
  );
}
