import { useEffect, useState } from 'react';
import { Volume2, VolumeX, Bell, Smartphone, Play } from 'lucide-react';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import {
  loadDriverSoundPrefs, saveDriverSoundPrefs, playPattern, playOfferAlert,
  type DriverSoundPrefs, type SoundPattern,
} from '@/lib/driver-sound-prefs';
import { requestNotificationPermission } from '@/lib/notifications';

const PATTERN_OPTIONS: { value: SoundPattern; label: string; emoji: string }[] = [
  { value: 'doordash_real', label: 'DoorDash (real)', emoji: '🔔' },
  { value: 'ios_tritone',   label: 'iOS Tritone',     emoji: '📱' },
  { value: 'crystal',       label: 'Crystal',         emoji: '✨' },
  { value: 'tesla',         label: 'Tesla',           emoji: '🚗' },
  { value: 'fanfare',       label: 'Fanfare',         emoji: '🎺' },
  { value: 'zen',           label: 'Zen',             emoji: '🧘' },
  { value: 'wolt',          label: 'Wolt-style',     emoji: '💙' },
  { value: 'uber',          label: 'Uber-style',     emoji: '⚡' },
  { value: 'doordash',      label: 'DoorDash-style', emoji: '🛵' },
  { value: 'glovo',         label: 'Glovo-style',    emoji: '🟡' },
  { value: 'kaching',       label: 'Ka-ching',       emoji: '💸' },
  { value: 'cash',          label: 'Ταμείο',         emoji: '💰' },
  { value: 'arcade',        label: 'Arcade Coin',    emoji: '🎮' },
  { value: 'marimba',       label: 'Marimba',        emoji: '🎵' },
  { value: 'chime',         label: 'Χτύπος',         emoji: '🔔' },
  { value: 'bell',          label: 'Καμπάνα',        emoji: '🛎️' },
  { value: 'classic_phone', label: 'Τηλέφωνο',       emoji: '☎️' },
  { value: 'pulse',         label: 'Παλμός',         emoji: '💫' },
  { value: 'urgent',        label: 'Επείγον',        emoji: '🚨' },
  { value: 'siren',         label: 'Σειρήνα',        emoji: '🚓' },
];

interface DriverSoundSettingsProps {
  trigger?: React.ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export function DriverSoundSettings({ trigger, open: controlledOpen, onOpenChange }: DriverSoundSettingsProps) {
  const [internalOpen, setInternalOpen] = useState(false);
  const open = controlledOpen ?? internalOpen;
  const setOpen = onOpenChange ?? setInternalOpen;
  const [prefs, setPrefs] = useState<DriverSoundPrefs>(() => loadDriverSoundPrefs());
  const [notif, setNotif] = useState<NotificationPermission>(
    typeof window !== 'undefined' && 'Notification' in window ? Notification.permission : 'denied'
  );

  useEffect(() => { if (open) setPrefs(loadDriverSoundPrefs()); }, [open]);

  const update = (patch: Partial<DriverSoundPrefs>) => {
    const next = { ...prefs, ...patch };
    setPrefs(next);
    saveDriverSoundPrefs(next);
  };

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      {trigger && <SheetTrigger asChild>{trigger}</SheetTrigger>}
      <SheetContent side="bottom" className="bg-background border-t border-border rounded-t-3xl max-h-[88vh] overflow-y-auto text-foreground">
        <SheetHeader className="text-left">
          <SheetTitle className="font-heading text-foreground flex items-center gap-2">
            <Bell className="h-5 w-5 text-primary" />
            Ειδοποιήσεις Παραγγελιών
          </SheetTitle>
        </SheetHeader>

        <div className="mt-6 space-y-6 pb-6">
          {/* Master toggle */}
          <div className="flex items-center justify-between p-4 rounded-2xl bg-muted/40 border border-border">
            <div className="flex items-center gap-3">
              {prefs.enabled
                ? <Volume2 className="h-5 w-5 text-primary" />
                : <VolumeX className="h-5 w-5 text-muted-foreground" />}
              <div>
                <p className="font-heading font-semibold text-sm text-foreground">Ήχος για νέες παραγγελίες</p>
                <p className="text-xs text-muted-foreground">Παίζει όταν φτάνει νέα προσφορά</p>
              </div>
            </div>
            <Switch checked={prefs.enabled} onCheckedChange={(v) => update({ enabled: v })} />
          </div>

          {/* Volume */}
          <div className={`space-y-3 p-4 rounded-2xl bg-muted/40 border border-border transition-opacity ${!prefs.enabled ? 'opacity-50 pointer-events-none' : ''}`}>
            <div className="flex justify-between">
              <Label className="font-heading text-sm text-foreground">Ένταση</Label>
              <span className="text-xs font-heading text-primary">{Math.round(prefs.volume * 100)}%</span>
            </div>
            <Slider
              value={[prefs.volume * 100]}
              onValueChange={([v]) => update({ volume: v / 100 })}
              max={100}
              step={5}
            />
          </div>

          {/* Pattern */}
          <div className={`space-y-2 ${!prefs.enabled ? 'opacity-50 pointer-events-none' : ''}`}>
            <Label className="font-heading text-sm text-foreground px-1">Ήχος</Label>
            <div className="grid grid-cols-2 gap-2">
              {PATTERN_OPTIONS.map(opt => (
                <button
                  key={opt.value}
                  onClick={() => { update({ pattern: opt.value }); playPattern(opt.value, prefs.volume); }}
                  className={`flex items-center justify-between p-3 rounded-xl border-2 transition-all ${
                    prefs.pattern === opt.value
                      ? 'border-primary bg-primary/10'
                      : 'border-border bg-muted/40'
                  }`}
                >
                  <span className="flex items-center gap-2">
                    <span className="text-lg">{opt.emoji}</span>
                    <span className="font-heading text-xs font-semibold text-foreground">{opt.label}</span>
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Repeat count */}
          <div className={`space-y-3 p-4 rounded-2xl bg-muted/40 border border-border ${!prefs.enabled ? 'opacity-50 pointer-events-none' : ''}`}>
            <div className="flex justify-between">
              <Label className="font-heading text-sm text-foreground">Επαναλήψεις</Label>
              <span className="text-xs font-heading text-primary">{prefs.repeatCount}×</span>
            </div>
            <Slider
              value={[prefs.repeatCount]}
              onValueChange={([v]) => update({ repeatCount: v })}
              min={1} max={5} step={1}
            />
          </div>

          {/* Vibrate */}
          <div className="flex items-center justify-between p-4 rounded-2xl bg-muted/40 border border-border">
            <div className="flex items-center gap-3">
              <Smartphone className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="font-heading font-semibold text-sm text-foreground">Δόνηση</p>
                <p className="text-xs text-muted-foreground">Δονείται όταν φτάνει παραγγελία</p>
              </div>
            </div>
            <Switch checked={prefs.vibrate} onCheckedChange={(v) => update({ vibrate: v })} />
          </div>

          {/* Browser notifications */}
          {notif !== 'granted' && (
            <Button
              onClick={async () => {
                const ok = await requestNotificationPermission();
                setNotif(ok ? 'granted' : 'denied');
              }}
              variant="outline"
              className="w-full font-heading"
            >
              <Bell className="h-4 w-4 mr-2" />
              Ενεργοποίηση ειδοποιήσεων browser
            </Button>
          )}

          {/* Test button */}
          <Button
            onClick={() => playOfferAlert(prefs)}
            className="w-full font-heading"
            disabled={!prefs.enabled}
          >
            <Play className="h-4 w-4 mr-2" />
            Δοκιμή ήχου
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
