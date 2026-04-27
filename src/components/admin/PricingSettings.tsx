import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { DollarSign, Save, Loader2, MapPin, Shield, Flame, Bike, Car, Percent } from 'lucide-react';
import StorePricingOverrides from './StorePricingOverrides';

interface PricingRow {
  base_pay: number;
  per_km_rate: number;
  min_pay: number;
  customer_base_fee: number;
  customer_per_km_fee: number;
  peak_multiplier: number;
  peak_start_hour: number;
  peak_end_hour: number;
  peak_weekdays: number[];
  bike_multiplier: number;
  motorcycle_multiplier: number;
  car_multiplier: number;
  default_commission_pct: number;
  admin_share_pct: number;
}

const DAYS = [
  { n: 1, label: 'Δευ' }, { n: 2, label: 'Τρι' }, { n: 3, label: 'Τετ' },
  { n: 4, label: 'Πεμ' }, { n: 5, label: 'Παρ' }, { n: 6, label: 'Σαβ' }, { n: 7, label: 'Κυρ' },
];

export default function PricingSettings() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [pricing, setPricing] = useState<PricingRow>({
    base_pay: 3, per_km_rate: 0.5, min_pay: 3,
    customer_base_fee: 1.5, customer_per_km_fee: 0.8,
    peak_multiplier: 1.0, peak_start_hour: 19, peak_end_hour: 22,
    peak_weekdays: [1, 2, 3, 4, 5, 6, 7],
    bike_multiplier: 1.0, motorcycle_multiplier: 1.0, car_multiplier: 1.0,
    default_commission_pct: 15, admin_share_pct: 33.33,
  });

  useEffect(() => {
    supabase.from('platform_settings').select('*').eq('id', 1).maybeSingle()
      .then(({ data }) => {
        if (data) {
          const d = data as any;
          setPricing({
            base_pay: Number(d.base_pay ?? 3),
            per_km_rate: Number(d.per_km_rate ?? 0.5),
            min_pay: Number(d.min_pay ?? 3),
            customer_base_fee: Number(d.customer_base_fee ?? 1.5),
            customer_per_km_fee: Number(d.customer_per_km_fee ?? 0.8),
            peak_multiplier: Number(d.peak_multiplier ?? 1),
            peak_start_hour: Number(d.peak_start_hour ?? 19),
            peak_end_hour: Number(d.peak_end_hour ?? 22),
            peak_weekdays: (d.peak_weekdays ?? [1,2,3,4,5,6,7]) as number[],
            bike_multiplier: Number(d.bike_multiplier ?? 1),
            motorcycle_multiplier: Number(d.motorcycle_multiplier ?? 1),
            car_multiplier: Number(d.car_multiplier ?? 1),
            default_commission_pct: Number(d.default_commission_pct ?? 15),
            admin_share_pct: Number(d.admin_share_pct ?? 33.33),
          });
        }
        setLoading(false);
      });
  }, []);

  const handleSave = async () => {
    setSaving(true);
    const { error } = await supabase
      .from('platform_settings')
      .upsert({ id: 1, ...pricing } as any, { onConflict: 'id' });
    setSaving(false);
    if (error) toast.error('Αποτυχία αποθήκευσης');
    else toast.success('Οι τιμές ενημερώθηκαν');
  };

  const toggleDay = (n: number) => {
    setPricing(p => ({
      ...p,
      peak_weekdays: p.peak_weekdays.includes(n)
        ? p.peak_weekdays.filter(x => x !== n)
        : [...p.peak_weekdays, n].sort(),
    }));
  };

  if (loading) {
    return <div className="flex items-center justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;
  }

  const previewKm = 3;
  const driverPay = Math.max(pricing.min_pay, pricing.base_pay + pricing.per_km_rate * previewKm);
  const customerFee = pricing.customer_base_fee + pricing.customer_per_km_fee * previewKm;

  return (
    <div className="space-y-4 max-w-4xl">
      <div>
        <h2 className="font-heading font-bold text-xl">Τιμολόγηση Πλατφόρμας</h2>
        <p className="text-sm text-muted-foreground mt-1">Πλήρης έλεγχος αμοιβών οδηγών, χρεώσεων πελατών και προμηθειών.</p>
      </div>

      <Tabs defaultValue="driver">
        <TabsList className="grid grid-cols-2 sm:grid-cols-5 w-full">
          <TabsTrigger value="driver">Οδηγός</TabsTrigger>
          <TabsTrigger value="customer">Πελάτης</TabsTrigger>
          <TabsTrigger value="peak">Peak Hours</TabsTrigger>
          <TabsTrigger value="vehicle">Όχημα</TabsTrigger>
          <TabsTrigger value="stores">Καταστήματα</TabsTrigger>
        </TabsList>

        <TabsContent value="driver" className="space-y-4 mt-4">
          <Card>
            <CardHeader><CardTitle className="font-heading text-base flex items-center gap-2"><DollarSign className="h-4 w-4 text-primary" />Αμοιβή Οδηγού</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <Field label="Βασική Αμοιβή (€)" value={pricing.base_pay} onChange={v => setPricing(p => ({ ...p, base_pay: v }))} hint="Σταθερό ανά παράδοση" />
                <Field label="Χρέωση ανά χλμ (€)" value={pricing.per_km_rate} onChange={v => setPricing(p => ({ ...p, per_km_rate: v }))} hint="Επιπλέον €/km" icon={MapPin} />
                <Field label="Ελάχιστη Αμοιβή (€)" value={pricing.min_pay} onChange={v => setPricing(p => ({ ...p, min_pay: v }))} hint="Εγγυημένο ελάχιστο" icon={Shield} />
              </div>
              <Preview label={`Παράδοση ${previewKm} χλμ`} amount={driverPay} note={`€${pricing.base_pay.toFixed(2)} + ${previewKm} × €${pricing.per_km_rate.toFixed(2)}`} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="customer" className="space-y-4 mt-4">
          <Card>
            <CardHeader><CardTitle className="font-heading text-base flex items-center gap-2"><DollarSign className="h-4 w-4 text-primary" />Χρέωση Παράδοσης Πελάτη</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Field label="Βασική Χρέωση (€)" value={pricing.customer_base_fee} onChange={v => setPricing(p => ({ ...p, customer_base_fee: v }))} hint="Πληρώνει ο πελάτης" />
                <Field label="Χρέωση ανά χλμ (€)" value={pricing.customer_per_km_fee} onChange={v => setPricing(p => ({ ...p, customer_per_km_fee: v }))} hint="Επιπλέον €/km" icon={MapPin} />
              </div>
              <Preview label={`Παράδοση ${previewKm} χλμ`} amount={customerFee} note={`€${pricing.customer_base_fee.toFixed(2)} + ${previewKm} × €${pricing.customer_per_km_fee.toFixed(2)}`} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="font-heading text-base flex items-center gap-2"><Percent className="h-4 w-4 text-primary" />Προμήθεια Πλατφόρμας</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Field label="Συνολική Προμήθεια %" value={pricing.default_commission_pct} onChange={v => setPricing(p => ({ ...p, default_commission_pct: v }))} hint="Default για όλα τα stores" icon={Percent} />
                <Field label="Μερίδιο Admin %" value={pricing.admin_share_pct} onChange={v => setPricing(p => ({ ...p, admin_share_pct: v }))} hint="% της προμήθειας στο admin bag" icon={Percent} />
              </div>
              <div className="rounded-lg border border-primary/20 bg-primary/5 p-3 text-sm">
                <p className="text-xs text-muted-foreground mb-1">Διαχωρισμός σε παραγγελία €100</p>
                <p>Store: <span className="font-bold">€{(100 - pricing.default_commission_pct).toFixed(2)}</span></p>
                <p>Admin bag: <span className="font-bold">€{(pricing.default_commission_pct * pricing.admin_share_pct / 100).toFixed(2)}</span></p>
                <p>Platform pool: <span className="font-bold">€{(pricing.default_commission_pct * (100 - pricing.admin_share_pct) / 100).toFixed(2)}</span></p>
              </div>
              <p className="text-[11px] text-muted-foreground">
                Μπορείς να ορίσεις διαφορετικό % ανά κατάστημα στην καρτέλα <strong>Καταστήματα</strong>.
              </p>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="peak" className="space-y-4 mt-4">
          <Card>
            <CardHeader><CardTitle className="font-heading text-base flex items-center gap-2"><Flame className="h-4 w-4 text-orange-500" />Peak-Hour Bonus</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <Field label="Πολλαπλασιαστής" value={pricing.peak_multiplier} onChange={v => setPricing(p => ({ ...p, peak_multiplier: v }))} hint="π.χ. 1.3 = +30%" step="0.05" />
                <Field label="Από ώρα" value={pricing.peak_start_hour} onChange={v => setPricing(p => ({ ...p, peak_start_hour: Math.round(v) }))} hint="0-23" step="1" />
                <Field label="Έως ώρα" value={pricing.peak_end_hour} onChange={v => setPricing(p => ({ ...p, peak_end_hour: Math.round(v) }))} hint="0-23" step="1" />
              </div>
              <div>
                <Label className="text-sm">Ενεργές Ημέρες</Label>
                <div className="flex flex-wrap gap-2 mt-2">
                  {DAYS.map(d => (
                    <Button key={d.n} type="button" size="sm" variant={pricing.peak_weekdays.includes(d.n) ? 'default' : 'outline'} onClick={() => toggleDay(d.n)}>
                      {d.label}
                    </Button>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="vehicle" className="space-y-4 mt-4">
          <Card>
            <CardHeader><CardTitle className="font-heading text-base">Πολλαπλασιαστές Οχήματος</CardTitle></CardHeader>
            <CardContent className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <Field label="Ποδήλατο ×" value={pricing.bike_multiplier} onChange={v => setPricing(p => ({ ...p, bike_multiplier: v }))} hint="Bonus για bike" step="0.05" icon={Bike} />
              <Field label="Μηχανή ×" value={pricing.motorcycle_multiplier} onChange={v => setPricing(p => ({ ...p, motorcycle_multiplier: v }))} hint="Default" step="0.05" />
              <Field label="Αυτοκίνητο ×" value={pricing.car_multiplier} onChange={v => setPricing(p => ({ ...p, car_multiplier: v }))} hint="Bonus για car" step="0.05" icon={Car} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="stores" className="mt-4">
          <StorePricingOverrides defaultCommission={pricing.default_commission_pct} />
        </TabsContent>
      </Tabs>

      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={saving} className="gradient-primary text-primary-foreground font-heading">
          {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
          Αποθήκευση Όλων
        </Button>
      </div>
    </div>
  );
}

function Field({ label, value, onChange, hint, step = '0.10', icon: Icon }: any) {
  return (
    <div>
      <Label className="flex items-center gap-1 text-sm">{Icon && <Icon className="h-3 w-3" />}{label}</Label>
      <Input type="number" step={step} min="0" value={value} onChange={e => onChange(Number(e.target.value))} />
      {hint && <p className="text-[11px] text-muted-foreground mt-1">{hint}</p>}
    </div>
  );
}

function Preview({ label, amount, note }: { label: string; amount: number; note: string }) {
  return (
    <div className="rounded-lg border border-primary/20 bg-primary/5 p-3">
      <p className="text-xs text-muted-foreground">Προεπισκόπηση</p>
      <p className="font-heading text-sm">
        {label} = <span className="font-bold text-primary">€{amount.toFixed(2)}</span>
        <span className="text-muted-foreground text-xs ml-2">({note})</span>
      </p>
    </div>
  );
}
