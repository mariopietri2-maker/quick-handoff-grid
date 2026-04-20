import { useEffect, useState } from 'react';
import { Settings, Moon, Sun, Languages, Ruler, Navigation as NavIcon, Eye, EyeOff, Zap, Clock, MapPin } from 'lucide-react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { loadDriverAppPrefs, saveDriverAppPrefs, type DriverAppPrefs } from '@/lib/driver-app-prefs';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function DriverAppSettings({ open, onOpenChange }: Props) {
  const [prefs, setPrefs] = useState<DriverAppPrefs>(() => loadDriverAppPrefs());

  useEffect(() => { if (open) setPrefs(loadDriverAppPrefs()); }, [open]);

  const update = (patch: Partial<DriverAppPrefs>) => {
    const next = { ...prefs, ...patch };
    setPrefs(next);
    saveDriverAppPrefs(next);
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
            <Row icon={Ruler} label="Μονάδα απόστασης">
              <Select value={prefs.distanceUnit} onValueChange={(v) => update({ distanceUnit: v as DriverAppPrefs['distanceUnit'] })}>
                <SelectTrigger className="w-24 h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="km">km</SelectItem>
                  <SelectItem value="mi">mi</SelectItem>
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

          <Section title="Παραγγελίες">
            <Row icon={Zap} label="Auto-accept υψηλής αξίας" desc="Αυτόματη αποδοχή > 10€">
              <Switch
                checked={prefs.autoAcceptHighValue}
                onCheckedChange={(v) => update({ autoAcceptHighValue: v })}
              />
            </Row>
          </Section>

          <Section title="Συσκευή">
            <Row icon={Sun} label="Οθόνη πάντα ενεργή" desc="Αποφυγή κλειδώματος">
              <Switch
                checked={prefs.keepScreenOn}
                onCheckedChange={(v) => update({ keepScreenOn: v })}
              />
            </Row>
            <Row icon={Clock} label="Auto-offline (λεπτά)" desc="0 = ποτέ">
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
