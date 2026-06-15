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
  { value: 'fresh',    label: 'Fresh',    emoji: '🛵' },
  { value: 'bell',     label: 'Bell',     emoji: '✨' },
  { value: 'pulse',    label: 'Pulse',    emoji: '💫' },
  { value: 'cash',     label: 'Cash',     emoji: '💰' },
  { value: 'zen',      label: 'Zen',      emoji: '🧘' },
  { value: 'alert',    label: 'Alert',    emoji: '🚨' },
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

  const selectClassName = "h-9 rounded-md border border-input bg-background px-3 text-sm font-heading text-foreground outline-none focus:ring-2 focus:ring-ring";

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
              <select className={`${selectClassName} w-36`} value={prefs.theme} onChange={(e) => update({ theme: e.target.value as DriverAppPrefs['theme'] })}>
                <option value="dark">🌙 Σκοτεινό</option>
                <option value="light">☀️ Φωτεινό</option>
                <option value="system">⚙️ Σύστημα</option>
              </select>
            </Row>
            <Row icon={Languages} label="Γλώσσα">
              <select className={`${selectClassName} w-36`} value={prefs.language} onChange={(e) => update({ language: e.target.value as DriverAppPrefs['language'] })}>
                <option value="el">🇬🇷 Ελληνικά</option>
                <option value="en">🇬🇧 English</option>
              </select>
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
              <select className={`${selectClassName} w-36`} value={prefs.navApp} onChange={(e) => update({ navApp: e.target.value as DriverAppPrefs['navApp'] })}>
                <option value="google">Google Maps</option>
                <option value="apple">Apple Maps</option>
                <option value="waze">Waze</option>
              </select>
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
              <select className={`${selectClassName} w-24`} value={String(prefs.inactivityMinutes)} onChange={(e) => update({ inactivityMinutes: Number(e.target.value) })}>
                <option value="0">Ποτέ</option>
                <option value="15">15</option>
                <option value="30">30</option>
                <option value="60">60</option>
                <option value="120">120</option>
              </select>
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
