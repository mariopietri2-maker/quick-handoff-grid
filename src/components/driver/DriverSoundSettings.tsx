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
  { value: 'chime',  label: 'Χτύπος (κλασικό)', emoji: '🔔' },
  { value: 'bell',   label: 'Καμπάνα',          emoji: '🛎️' },
  { value: 'urgent', label: 'Επείγον',          emoji: '🚨' },
  { value: 'cash',   label: 'Ταμείο',           emoji: '💰' },
  { value: 'pulse',  label: 'Παλμός',           emoji: '💫' },
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
      <SheetContent side="bottom" className="bg-[hsl(var(--driver-surface))] border-t border-[hsl(var(--driver-border))] rounded-t-3xl max-h-[88vh] overflow-y-auto">
        <SheetHeader className="text-left">
          <SheetTitle className="font-heading text-[hsl(var(--driver-text))] flex items-center gap-2">
            <Bell className="h-5 w-5 text-[hsl(var(--driver-accent))]" />
            Ειδοποιήσεις Παραγγελιών
          </SheetTitle>
        </SheetHeader>

        <div className="mt-6 space-y-6 pb-6">
          {/* Master toggle */}
          <div className="flex items-center justify-between p-4 rounded-2xl bg-[hsl(var(--driver-bg))] border border-[hsl(var(--driver-border))]">
            <div className="flex items-center gap-3">
              {prefs.enabled
                ? <Volume2 className="h-5 w-5 text-[hsl(var(--driver-accent))]" />
                : <VolumeX className="h-5 w-5 text-[hsl(var(--driver-text-muted))]" />}
              <div>
                <p className="font-heading font-semibold text-sm text-[hsl(var(--driver-text))]">Ήχος για νέες παραγγελίες</p>
                <p className="text-xs text-[hsl(var(--driver-text-muted))]">Παίζει όταν φτάνει νέα προσφορά</p>
              </div>
            </div>
            <Switch checked={prefs.enabled} onCheckedChange={(v) => update({ enabled: v })} />
          </div>

          {/* Volume */}
          <div className={`space-y-3 p-4 rounded-2xl bg-[hsl(var(--driver-bg))] border border-[hsl(var(--driver-border))] transition-opacity ${!prefs.enabled ? 'opacity-50 pointer-events-none' : ''}`}>
            <div className="flex justify-between">
              <Label className="font-heading text-sm text-[hsl(var(--driver-text))]">Ένταση</Label>
              <span className="text-xs font-heading text-[hsl(var(--driver-accent))]">{Math.round(prefs.volume * 100)}%</span>
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
            <Label className="font-heading text-sm text-[hsl(var(--driver-text))] px-1">Ήχος</Label>
            <div className="grid grid-cols-2 gap-2">
              {PATTERN_OPTIONS.map(opt => (
                <button
                  key={opt.value}
                  onClick={() => { update({ pattern: opt.value }); playPattern(opt.value, prefs.volume); }}
                  className={`flex items-center justify-between p-3 rounded-xl border-2 transition-all ${
                    prefs.pattern === opt.value
                      ? 'border-[hsl(var(--driver-accent))] bg-[hsl(var(--driver-accent))]/10'
                      : 'border-[hsl(var(--driver-border))] bg-[hsl(var(--driver-bg))]'
                  }`}
                >
                  <span className="flex items-center gap-2">
                    <span className="text-lg">{opt.emoji}</span>
                    <span className="font-heading text-xs font-semibold text-[hsl(var(--driver-text))]">{opt.label}</span>
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Repeat count */}
          <div className={`space-y-3 p-4 rounded-2xl bg-[hsl(var(--driver-bg))] border border-[hsl(var(--driver-border))] ${!prefs.enabled ? 'opacity-50 pointer-events-none' : ''}`}>
            <div className="flex justify-between">
              <Label className="font-heading text-sm text-[hsl(var(--driver-text))]">Επαναλήψεις</Label>
              <span className="text-xs font-heading text-[hsl(var(--driver-accent))]">{prefs.repeatCount}×</span>
            </div>
            <Slider
              value={[prefs.repeatCount]}
              onValueChange={([v]) => update({ repeatCount: v })}
              min={1} max={5} step={1}
            />
          </div>

          {/* Vibrate */}
          <div className="flex items-center justify-between p-4 rounded-2xl bg-[hsl(var(--driver-bg))] border border-[hsl(var(--driver-border))]">
            <div className="flex items-center gap-3">
              <Smartphone className="h-5 w-5 text-[hsl(var(--driver-text-muted))]" />
              <div>
                <p className="font-heading font-semibold text-sm text-[hsl(var(--driver-text))]">Δόνηση</p>
                <p className="text-xs text-[hsl(var(--driver-text-muted))]">Δονείται όταν φτάνει παραγγελία</p>
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
            className="w-full font-heading bg-[hsl(var(--driver-accent))] hover:bg-[hsl(var(--driver-accent))]/90"
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
