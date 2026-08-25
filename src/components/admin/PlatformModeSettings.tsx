import { useEffect, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Loader2, Save, Truck, Store, Timer, Info } from 'lucide-react';

interface SettingsRow {
  delivery_enabled: boolean;
  eta_min_minutes: number;
  eta_max_minutes: number;
  eta_max_cap_minutes: number;
}

interface StoreRow {
  id: string;
  name: string;
  fulfilment_mode: 'platform' | 'store';
}

export default function PlatformModeSettings() {
  const [settings, setSettings] = useState<SettingsRow>({
    delivery_enabled: true,
    eta_min_minutes: 25,
    eta_max_minutes: 35,
    eta_max_cap_minutes: 50,
  });
  const [stores, setStores] = useState<StoreRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingSettings, setSavingSettings] = useState(false);
  const [savingStoreId, setSavingStoreId] = useState<string | null>(null);
  const [liveEta, setLiveEta] = useState<{ min: number; max: number } | null>(null);

  useEffect(() => {
    supabase
      .from('platform_settings')
      .select('delivery_enabled, eta_min_minutes, eta_max_minutes, eta_max_cap_minutes' as any)
      .eq('id', 1)
      .maybeSingle()
      .then(({ data }: any) => {
        if (data) {
          setSettings({
            delivery_enabled: data.delivery_enabled !== false,
            eta_min_minutes: Number(data.eta_min_minutes) || 25,
            eta_max_minutes: Number(data.eta_max_minutes) || 35,
            eta_max_cap_minutes: Number(data.eta_max_cap_minutes) || 50,
          });
        }
      });

    supabase
      .from('stores')
      .select('id, name, fulfilment_mode' as any)
      .order('name')
      .then(({ data }: any) => {
        setStores((data as unknown as StoreRow[]) ?? []);
        setLoading(false);
      });
  }, []);

  // Live preview of what customers see right now (supply/demand aware)
  useEffect(() => {
    (supabase as any).rpc('get_dynamic_delivery_eta', { p_prep_buffer: 0 }).then(({ data }: any) => {
      const row = Array.isArray(data) ? data[0] : data;
      if (row?.eta_min != null && row?.eta_max != null) {
        setLiveEta({ min: Number(row.eta_min), max: Number(row.eta_max) });
      }
    });
  }, [savingSettings]);

  const saveSettings = async () => {
    if (settings.eta_min_minutes < 5) { toast.error('Ελάχιστο ETA τουλάχιστον 5 λεπτά'); return; }
    if (settings.eta_max_minutes <= settings.eta_min_minutes) { toast.error('Το μέγιστο πρέπει να είναι μεγαλύτερο από το ελάχιστο'); return; }
    const cap = Math.min(settings.eta_max_cap_minutes, 50);
    if (cap < settings.eta_max_minutes) { toast.error('Το όριο (max 50) δεν μπορεί να είναι κάτω από το μέγιστο ETA'); return; }

    setSavingSettings(true);
    const patch = { ...settings, eta_max_cap_minutes: cap };
    const { error } = await (supabase as any)
      .from('platform_settings')
      .update(patch)
      .eq('id', 1);
    setSavingSettings(false);
    if (error) { toast.error(error.message); return; }
    setSettings(patch);
    await (supabase.rpc as any)('log_admin_action', {
      p_action: 'update_platform_mode',
      p_target_type: 'platform',
      p_description: `delivery_enabled=${patch.delivery_enabled}, ETA ${patch.eta_min_minutes}-${patch.eta_max_minutes} λεπτά, όριο ${patch.eta_max_cap_minutes}`,
    });
    toast.success(patch.delivery_enabled ? 'Αποθηκεύτηκε — το delivery είναι ενεργό' : 'Αποθηκεύτηκε — λειτουργία μόνο marketplace');
  };

  const toggleDelivery = async (checked: boolean) => {
    setSettings(s => ({ ...s, delivery_enabled: checked }));
  };

  const saveStoreMode = async (r: StoreRow, mode: 'platform' | 'store') => {
    setSavingStoreId(r.id);
    const { error } = await (supabase as any)
      .from('stores')
      .update({ fulfilment_mode: mode })
      .eq('id', r.id);
    setSavingStoreId(null);
    if (error) { toast.error(error.message); return; }
    setStores(prev => prev.map(s => (s.id === r.id ? { ...s, fulfilment_mode: mode } : s)));
    await (supabase.rpc as any)('log_admin_action', {
      p_action: 'set_store_fulfilment',
      p_target_type: 'store',
      p_target_id: r.id,
      p_description: `${r.name}: ${mode === 'platform' ? 'Delivered by Fresh' : 'store delivery'}`,
    });
    toast.success(`Αποθηκεύτηκε για ${r.name}`);
  };

  return (
    <div className="space-y-4 max-w-3xl">
      {/* Delivery master switch */}
      <Card>
        <CardContent className="p-4 space-y-4">
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-1">
              <h2 className="font-heading font-bold text-base flex items-center gap-2">
                <Truck className="h-4 w-4" />
                Λειτουργία Delivery
              </h2>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Απενεργοποίησε το για να ξεκινήσεις ως marketplace χωρίς παράδοση.
                Οι πελάτες βλέπουν μόνο κατάστημα/παραλαβή — χωρίς χρεώσεις ή χρόνους delivery.
                Μπορείς να το ενεργοποιήσεις ξανά οποιαδήποτε στιγμή.
              </p>
            </div>
            <Switch checked={settings.delivery_enabled} onCheckedChange={toggleDelivery} />
          </div>

          <div className={`rounded-lg border px-3 py-2 text-xs font-semibold flex items-center gap-2 ${
            settings.delivery_enabled
              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-700 dark:text-emerald-400'
              : 'bg-muted border-border text-muted-foreground'
          }`}>
            <Info className="h-3.5 w-3.5 shrink-0" />
            {settings.delivery_enabled
              ? 'Delivery ενεργό σε όλη την πλατφόρμα.'
              : 'Marketplace-only mode: κρυμμένα χρεώση παράδοσης, ETA και "Delivered by Fresh".'}
          </div>
        </CardContent>
      </Card>

      {/* Delivery time configuration */}
      <Card>
        <CardContent className="p-4 space-y-4">
          <div className="space-y-1">
            <h2 className="font-heading font-bold text-base flex items-center gap-2">
              <Timer className="h-4 w-4" />
              Timers / χρόνος παράδοσης (ETA)
            </h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Βασικό εύρος που βλέπουν οι πελάτες. Το σύστημα το προσαρμόζει αυτόματα:
              με αρκετούς διαθέσιμους οδηγούς μένει χαμηλά, με έλλειψη ανεβαίνει —
              ποτέ πάνω από το όριο (μέγιστο 50 λεπτά).
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="eta-min">Ελάχιστα λεπτά</Label>
              <Input
                id="eta-min"
                type="number"
                min={5}
                value={settings.eta_min_minutes}
                onChange={(e) => setSettings(s => ({ ...s, eta_min_minutes: Number(e.target.value) }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="eta-max">Μέγιστα λεπτά</Label>
              <Input
                id="eta-max"
                type="number"
                min={10}
                value={settings.eta_max_minutes}
                onChange={(e) => setSettings(s => ({ ...s, eta_max_minutes: Number(e.target.value) }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="eta-cap">Όριο συστήματος (max 50)</Label>
              <Input
                id="eta-cap"
                type="number"
                min={10}
                max={50}
                value={settings.eta_max_cap_minutes}
                onChange={(e) => setSettings(s => ({ ...s, eta_max_cap_minutes: Number(e.target.value) }))}
              />
            </div>
          </div>

          <div className="text-xs text-muted-foreground flex items-center gap-2">
            <span className="font-semibold">Τώρα οι πελάτες βλέπουν:</span>
            <span className="font-bold tabular-nums">
              {liveEta ? `${liveEta.min}–${liveEta.max} λεπτά` : '…'}
            </span>
            <span>(υπολογισμένο ζωντανά από προσφορά/ζήτηση)</span>
          </div>

          <Button onClick={saveSettings} disabled={savingSettings} className="gap-2">
            {savingSettings ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Αποθήκευση ρυθμίσεων
          </Button>
        </CardContent>
      </Card>

      {/* Per-store fulfilment */}
      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="space-y-1">
            <h2 className="font-heading font-bold text-base flex items-center gap-2">
              <Store className="h-4 w-4" />
              Ποιος παραδίδει ανά κατάστημα
            </h2>
            <p className="text-sm text-muted-foreground">
              Επίλεξε ανά κατάστημα αν η παράδοση γίνεται από οδηγούς Fresh («Delivered by Fresh») ή από το ίδιο το κατάστημα. Μπορείς να το αλλάξεις οποιαδήποτε στιγμή.
            </p>
          </div>

          {loading ? (
            <div className="flex items-center gap-2 py-6 justify-center text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Φόρτωση καταστημάτων…
            </div>
          ) : (
            <div className="divide-y divide-border rounded-lg border border-border overflow-hidden">
              {stores.map((r) => (
                <div key={r.id} className="flex items-center justify-between gap-3 px-3 py-2.5 bg-card">
                  <span className="text-sm font-semibold truncate">{r.name}</span>
                  <div className="flex items-center gap-2 shrink-0">
                    {savingStoreId === r.id && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />}
                    <Select
                      value={r.fulfilment_mode ?? 'platform'}
                      onValueChange={(v) => saveStoreMode(r, v as 'platform' | 'store')}
                    >
                      <SelectTrigger className="w-[170px] h-8 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="platform">Delivered by Fresh</SelectItem>
                        <SelectItem value="store">Παράδοση καταστήματος</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              ))}
              {stores.length === 0 && (
                <p className="px-3 py-6 text-sm text-muted-foreground text-center">Δεν υπάρχουν καταστήματα.</p>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
