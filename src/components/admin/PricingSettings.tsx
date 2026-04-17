import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { DollarSign, Save, Loader2, MapPin, Shield } from 'lucide-react';

interface PricingRow {
  base_pay: number;
  per_km_rate: number;
  min_pay: number;
}

export default function PricingSettings() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [pricing, setPricing] = useState<PricingRow>({
    base_pay: 3,
    per_km_rate: 0.5,
    min_pay: 3,
  });

  useEffect(() => {
    supabase
      .from('platform_settings')
      .select('base_pay, per_km_rate, min_pay')
      .eq('id', 1)
      .maybeSingle()
      .then(({ data }) => {
        if (data) {
          setPricing({
            base_pay: Number((data as any).base_pay ?? 3),
            per_km_rate: Number((data as any).per_km_rate ?? 0.5),
            min_pay: Number((data as any).min_pay ?? 3),
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

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  // Preview calc for a 3km order
  const previewKm = 3;
  const previewPay = Math.max(
    pricing.min_pay,
    pricing.base_pay + pricing.per_km_rate * previewKm
  );

  return (
    <div className="space-y-4 max-w-2xl">
      <div>
        <h2 className="font-heading font-bold text-xl">Τιμολόγηση Παραδόσεων</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Ορίστε τη βασική αμοιβή και την επιπλέον χρέωση ανά χιλιόμετρο για κάθε παράδοση.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="font-heading text-base flex items-center gap-2">
            <DollarSign className="h-4 w-4 text-primary" />
            Αμοιβή Οδηγού
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="base_pay">Βασική Αμοιβή (€)</Label>
              <Input
                id="base_pay"
                type="number"
                step="0.10"
                min="0"
                value={pricing.base_pay}
                onChange={e => setPricing(p => ({ ...p, base_pay: Number(e.target.value) }))}
              />
              <p className="text-[11px] text-muted-foreground mt-1">Σταθερό ποσό ανά παράδοση</p>
            </div>
            <div>
              <Label htmlFor="per_km_rate" className="flex items-center gap-1">
                <MapPin className="h-3 w-3" /> Χρέωση ανά χλμ (€)
              </Label>
              <Input
                id="per_km_rate"
                type="number"
                step="0.05"
                min="0"
                value={pricing.per_km_rate}
                onChange={e => setPricing(p => ({ ...p, per_km_rate: Number(e.target.value) }))}
              />
              <p className="text-[11px] text-muted-foreground mt-1">Επιπλέον €/km απόστασης</p>
            </div>
            <div>
              <Label htmlFor="min_pay" className="flex items-center gap-1">
                <Shield className="h-3 w-3" /> Ελάχιστη Αμοιβή (€)
              </Label>
              <Input
                id="min_pay"
                type="number"
                step="0.10"
                min="0"
                value={pricing.min_pay}
                onChange={e => setPricing(p => ({ ...p, min_pay: Number(e.target.value) }))}
              />
              <p className="text-[11px] text-muted-foreground mt-1">Εγγυημένο ελάχιστο πληρωμής</p>
            </div>
          </div>

          <div className="rounded-lg border border-primary/20 bg-primary/5 p-3">
            <p className="text-xs text-muted-foreground">Προεπισκόπηση</p>
            <p className="font-heading text-sm">
              Παράδοση {previewKm} χλμ ={' '}
              <span className="font-bold text-primary">€{previewPay.toFixed(2)}</span>
              <span className="text-muted-foreground text-xs ml-2">
                (€{pricing.base_pay.toFixed(2)} + {previewKm} × €{pricing.per_km_rate.toFixed(2)})
              </span>
            </p>
          </div>

          <Button
            onClick={handleSave}
            disabled={saving}
            className="w-full sm:w-auto gradient-primary text-primary-foreground font-heading"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
            Αποθήκευση Τιμολόγησης
          </Button>
        </CardContent>
      </Card>

      <Card className="bg-muted/30 border-dashed">
        <CardContent className="p-4 text-xs text-muted-foreground space-y-1">
          <p className="font-heading font-semibold text-foreground">Πώς εφαρμόζεται:</p>
          <p>• Η απόσταση υπολογίζεται αυτόματα μέσω Mapbox κατά την υποβολή της παραγγελίας.</p>
          <p>• Η αμοιβή του οδηγού καταχωρείται με την παράδοση: <code>max(min, base + per_km × km)</code> + φιλοδώρημα.</p>
          <p>• Επηρεάζει μόνο νέες παραγγελίες — όχι ήδη παραδομένες.</p>
        </CardContent>
      </Card>
    </div>
  );
}
