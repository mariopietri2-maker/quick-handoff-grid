import { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Loader2, Save, Layers } from 'lucide-react';
import { toast } from 'sonner';

interface Settings {
  assignment_mode: string;
  distribution_mode: string;
  dist_search_radius_km: number;
  dist_offer_timeout_seconds: number;
  dist_wave_size: number;
  dist_max_waves: number;
  dist_vehicle_rules_enabled: boolean;
  dist_bike_max_km: number;
  dist_motorcycle_max_km: number;
  dist_car_min_value: number;
  dist_min_driver_rating: number;
  dist_min_acceptance_rate: number;
  dist_fairness_weight: number;
  dist_rating_weight: number;
  dist_distance_weight: number;
  max_stacked_orders: number;
  stack_max_detour_minutes: number;
  stacking_enabled: boolean;
}

export default function AssignmentSettings() {
  const qc = useQueryClient();
  const [s, setS] = useState<Settings | null>(null);
  const [saving, setSaving] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['platform-distribution-settings'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('platform_settings')
        .select('assignment_mode, distribution_mode, dist_search_radius_km, dist_offer_timeout_seconds, dist_wave_size, dist_max_waves, dist_vehicle_rules_enabled, dist_bike_max_km, dist_motorcycle_max_km, dist_car_min_value, dist_min_driver_rating, dist_min_acceptance_rate, dist_fairness_weight, dist_rating_weight, dist_distance_weight, max_stacked_orders, stack_max_detour_minutes, stacking_enabled')
        .eq('id', 1)
        .maybeSingle();
      if (error) throw error;
      return data as Settings | null;
    },
  });

  useEffect(() => {
    if (data) setS(data);
  }, [data]);

  if (isLoading || !s) {
    return (
      <Card>
        <CardContent className="p-8 flex items-center justify-center">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  const update = <K extends keyof Settings>(key: K, val: Settings[K]) => setS({ ...s, [key]: val });

  const save = async () => {
    setSaving(true);
    const { error } = await supabase
      .from('platform_settings')
      .update({
        dist_search_radius_km: s.dist_search_radius_km,
        dist_offer_timeout_seconds: s.dist_offer_timeout_seconds,
        dist_wave_size: s.dist_wave_size,
        dist_max_waves: s.dist_max_waves,
        stacking_enabled: s.stacking_enabled,
        max_stacked_orders: s.max_stacked_orders,
      } as any)
      .eq('id', 1);
    setSaving(false);
    if (error) {
      toast.error('Αποτυχία αποθήκευσης: ' + error.message);
    } else {
      toast.success('Οι ρυθμίσεις διανομής αποθηκεύτηκαν');
      qc.invalidateQueries({ queryKey: ['platform-distribution-settings'] });
      qc.invalidateQueries({ queryKey: ['dcc-dispatch-settings'] });
    }
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="font-heading text-base flex items-center gap-2">
            <Layers className="h-4 w-4 text-primary" /> Ρυθμίσεις Auto-Dispatch (κύματα)
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-xs text-muted-foreground">
            Το σύστημα στέλνει προσφορές σε κύματα στους πλησιέστερους διαθέσιμους οδηγούς
            (GPS &lt; 15 λεπτά, ενεργό προφίλ). Το Auto/Manual ελέγχεται πάνω στο Dispatch hub.
          </p>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Timeout προσφοράς (δευτ.)</Label>
              <Input
                type="number"
                min={20}
                max={180}
                value={s.dist_offer_timeout_seconds}
                onChange={(e) => update('dist_offer_timeout_seconds', Number(e.target.value) || 60)}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Μέγεθος κύματος</Label>
              <Input
                type="number"
                min={1}
                max={10}
                value={s.dist_wave_size}
                onChange={(e) => update('dist_wave_size', Number(e.target.value) || 3)}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Μέγιστα κύματα</Label>
              <Input
                type="number"
                min={1}
                max={10}
                value={s.dist_max_waves}
                onChange={(e) => update('dist_max_waves', Number(e.target.value) || 3)}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Ακτίνα αναζήτησης (χλμ)</Label>
              <Input
                type="number"
                min={1}
                max={30}
                step={0.5}
                value={s.dist_search_radius_km}
                onChange={(e) => update('dist_search_radius_km', Number(e.target.value) || 5)}
              />
            </div>
          </div>
          <div className="flex items-center justify-between gap-3 rounded-lg border border-border p-3">
            <div>
              <p className="text-sm font-medium">Stacking παραγγελιών</p>
              <p className="text-xs text-muted-foreground">Επιτρέπεται δεύτερη παραγγελία στον ίδιο οδηγό</p>
            </div>
            <Switch
              checked={!!s.stacking_enabled}
              onCheckedChange={(v) => update('stacking_enabled', v)}
            />
          </div>
          <Button onClick={save} disabled={saving} className="gap-2">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Αποθήκευση
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
