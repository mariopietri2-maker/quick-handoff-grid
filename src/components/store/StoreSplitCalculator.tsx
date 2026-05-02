import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { AddressAutocomplete } from '@/components/AddressAutocomplete';
import { useMapboxToken } from '@/hooks/useMapboxToken';
import {
  Calculator, Loader2, MapPin, Navigation, Send, RefreshCw,
  TrendingUp, Wallet, Building2, Bike,
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

/**
 * Store-side Split Calculator
 * - Pickup is locked to this store (lat/lng auto from stores row).
 * - Dropoff via AddressAutocomplete + Mapbox Directions for real driving km.
 * - Shows the locked 85/10/5 split and the driver payout.
 * - Creates the order through create_custom_order with the computed values.
 */
interface Props {
  storeId: string;
}

export default function StoreSplitCalculator({ storeId }: Props) {
  const { token: mapboxToken } = useMapboxToken();

  const { data: store } = useQuery({
    queryKey: ['store-for-split', storeId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('stores')
        .select('id, name, address, latitude, longitude')
        .eq('id', storeId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const [orderValue, setOrderValue] = useState('');
  const [driverPay, setDriverPay] = useState('');
  const [dropoff, setDropoff] = useState<{ address: string; lat?: number; lng?: number } | null>(null);
  const [km, setKm] = useState<number | null>(null);
  const [routing, setRouting] = useState(false);
  const [creating, setCreating] = useState(false);

  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'card'>('cash');

  // Compute driving distance via Mapbox Directions
  useEffect(() => {
    if (!mapboxToken || !store?.latitude || !store?.longitude || !dropoff?.lat || !dropoff?.lng) return;
    let cancelled = false;
    setRouting(true);
    const url = `https://api.mapbox.com/directions/v5/mapbox/driving/${store.longitude},${store.latitude};${dropoff.lng},${dropoff.lat}?access_token=${mapboxToken}&overview=false`;
    fetch(url)
      .then((r) => r.json())
      .then((d) => {
        if (cancelled) return;
        const meters = d?.routes?.[0]?.distance;
        if (typeof meters === 'number') setKm(Math.round((meters / 1000) * 10) / 10);
      })
      .catch(() => {})
      .finally(() => { if (!cancelled) setRouting(false); });
    return () => { cancelled = true; };
  }, [store, dropoff, mapboxToken]);

  // Locked split 85 / 10 / 5
  const split = useMemo(() => {
    const v = Number(orderValue) || 0;
    return {
      v,
      store: +(v * 0.85).toFixed(2),
      driverPool: +(v * 0.10).toFixed(2),
      admin: +(v * 0.05).toFixed(2),
    };
  }, [orderValue]);

  const driverPayoutNum = Number(driverPay) || 0;
  const storeChargeTotal = +(split.driverPool + split.admin + driverPayoutNum).toFixed(2);
  const ready = split.v > 0 && !!dropoff?.address;

  const handleCreate = async () => {
    if (!ready) {
      toast.error('Συμπλήρωσε αξία και διεύθυνση παράδοσης');
      return;
    }
    setCreating(true);
    const { error } = await (supabase as any).rpc('create_custom_order', {
      p_store_id: storeId,
      p_total_amount: split.v,
      p_delivery_address: dropoff!.address,
      p_distance_km: km ?? null,
      p_customer_name: customerName || null,
      p_customer_phone: customerPhone || null,
      p_payment_method: paymentMethod,
      p_notes: `Split Calculator · driver €${driverPayoutNum.toFixed(2)} · ${km ?? '?'}km`,
      p_items_summary: null,
      p_delivery_fee_override: null,
      p_driver_payout_override: driverPayoutNum > 0 ? driverPayoutNum : null,
      p_store_charge_override: null,
    });
    setCreating(false);
    if (error) { toast.error(error.message); return; }
    toast.success('Παραγγελία δημιουργήθηκε με τον υπολογισμένο διαχωρισμό');
    setOrderValue(''); setDriverPay(''); setDropoff(null); setKm(null);
    setCustomerName(''); setCustomerPhone('');
  };

  const reset = () => {
    setOrderValue(''); setDriverPay(''); setDropoff(null); setKm(null);
    setCustomerName(''); setCustomerPhone(''); setPaymentMethod('cash');
  };

  const noCoords = !store?.latitude || !store?.longitude;

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h3 className="font-heading font-bold text-lg flex items-center gap-2">
            <Calculator className="h-5 w-5 text-primary" />
            Υπολογιστής Διαχωρισμού
          </h3>
          <p className="text-sm text-muted-foreground mt-1 max-w-xl">
            Βάλε αξία παραγγελίας και διεύθυνση παράδοσης. Τα χιλιόμετρα μετριούνται με Mapbox από το κατάστημά σου και η κατανομή <strong>85% / 10% / 5%</strong> εφαρμόζεται αυτόματα.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={reset} className="gap-2 shrink-0">
          <RefreshCw className="h-3.5 w-3.5" /> Καθαρισμός
        </Button>
      </div>

      {noCoords && (
        <div className="rounded-lg border border-warning/40 bg-warning/10 px-3 py-2 text-xs text-warning-foreground">
          Το κατάστημα δεν έχει συντεταγμένες, οπότε τα χιλιόμετρα δεν θα υπολογιστούν αυτόματα. Ενημέρωσε τη διεύθυνση στις Ρυθμίσεις.
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Inputs */}
        <Card>
          <CardContent className="p-5 space-y-4">
            <div className="rounded-lg border bg-muted/30 px-3 py-2.5">
              <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">Παραλαβή</p>
              <p className="text-sm font-heading mt-0.5 flex items-center gap-1.5">
                <MapPin className="h-3.5 w-3.5 text-primary" />
                {store?.name ?? 'Κατάστημα'}
              </p>
              {store?.address && (
                <p className="text-[11px] text-muted-foreground mt-0.5">{store.address}</p>
              )}
            </div>

            <div>
              <Label className="text-xs">Διεύθυνση παράδοσης</Label>
              <AddressAutocomplete
                value={dropoff?.address ?? ''}
                onChange={(addr, lat, lon) => setDropoff({ address: addr, lat, lng: lon })}
                placeholder="Που πάει το delivery;"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Αξία παραγγελίας (€)</Label>
                <Input
                  type="number" step="0.01" min="0"
                  value={orderValue}
                  onChange={(e) => setOrderValue(e.target.value)}
                  placeholder="0.00"
                  className="font-semibold tabular-nums"
                />
              </div>
              <div>
                <Label className="text-xs">Πληρωμή οδηγού (€)</Label>
                <Input
                  type="number" step="0.01" min="0" max="50"
                  value={driverPay}
                  onChange={(e) => setDriverPay(e.target.value)}
                  placeholder="auto από km"
                  className="tabular-nums"
                />
              </div>
            </div>

            <Separator />

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Όνομα πελάτη</Label>
                <Input value={customerName} onChange={(e) => setCustomerName(e.target.value)} />
              </div>
              <div>
                <Label className="text-xs">Τηλέφωνο</Label>
                <Input value={customerPhone} onChange={(e) => setCustomerPhone(e.target.value)} />
              </div>
            </div>

            <div>
              <Label className="text-xs">Τρόπος πληρωμής</Label>
              <Select value={paymentMethod} onValueChange={(v) => setPaymentMethod(v as any)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="cash">Μετρητά</SelectItem>
                  <SelectItem value="card">Κάρτα</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Live preview */}
        <div className="space-y-3">
          <Card className="overflow-hidden border-primary/20 bg-gradient-to-br from-primary/5 via-card to-card">
            <CardContent className="p-5 space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">Απόσταση διαδρομής</p>
                {routing && <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />}
              </div>
              <div className="flex items-baseline gap-2">
                <Navigation className="h-5 w-5 text-primary" />
                <span className="text-4xl font-heading font-bold tabular-nums">{km ?? '—'}</span>
                <span className="text-base text-muted-foreground">km</span>
                {km != null && (
                  <Badge variant="outline" className="ml-auto text-[10px] gap-1">
                    <MapPin className="h-2.5 w-2.5" /> Mapbox driving
                  </Badge>
                )}
              </div>
              {!km && dropoff && (
                <p className="text-[11px] text-muted-foreground">
                  Επίλεξε διεύθυνση από τις προτάσεις για να μετρηθεί η διαδρομή.
                </p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-5 space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">Κατανομή 85 / 10 / 5</p>
                <Badge className="text-[10px]" variant="secondary">κλειδωμένο</Badge>
              </div>

              <SplitRow icon={Building2} label="Κρατάς (85%)" pct="85%" amount={split.store} tone="text-foreground" />
              <SplitRow icon={Bike} label="Driver pool (10%)" pct="10%" amount={split.driverPool} tone="text-info" />
              <SplitRow icon={TrendingUp} label="Admin (5%)" pct="5%" amount={split.admin} tone="text-success" />

              <Separator />

              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground flex items-center gap-1.5">
                    <Wallet className="h-3.5 w-3.5" /> Driver παίρνει
                  </span>
                  <span className="font-bold tabular-nums">€{driverPayoutNum.toFixed(2)}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Συνολική χρέωση καταστήματος</span>
                  <span className="font-bold tabular-nums text-primary">€{storeChargeTotal.toFixed(2)}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          <Button size="lg" className="w-full gap-2" onClick={handleCreate} disabled={!ready || creating}>
            {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            {creating ? 'Δημιουργία…' : 'Δημιουργία παραγγελίας'}
          </Button>
          {!ready && (
            <p className="text-[11px] text-muted-foreground text-center">
              Συμπλήρωσε αξία και διεύθυνση παράδοσης για να συνεχίσεις.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

function SplitRow({
  icon: Icon, label, pct, amount, tone,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string; pct: string; amount: number; tone: string;
}) {
  return (
    <div className="flex items-center justify-between rounded-lg border border-border/60 bg-muted/30 px-3 py-2.5">
      <div className="flex items-center gap-2.5 min-w-0">
        <span className={cn('h-7 w-7 rounded-md bg-background flex items-center justify-center shrink-0', tone)}>
          <Icon className="h-3.5 w-3.5" />
        </span>
        <div className="min-w-0">
          <p className="text-xs font-medium truncate">{label}</p>
          <p className="text-[10px] text-muted-foreground">{pct}</p>
        </div>
      </div>
      <span className={cn('font-heading font-bold text-base tabular-nums', tone)}>
        €{amount.toFixed(2)}
      </span>
    </div>
  );
}
