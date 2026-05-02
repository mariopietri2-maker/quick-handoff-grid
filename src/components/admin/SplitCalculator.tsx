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
import { Calculator, Loader2, MapPin, Navigation, Send, RefreshCw, TrendingUp, Wallet, Building2, Bike } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

/**
 * Admin Split Calculator
 * - Pickup is the selected store (auto lat/lng).
 * - Dropoff via AddressAutocomplete (Mapbox geocoding).
 * - Distance is computed via Mapbox Directions API (real driving km).
 * - Live preview of the locked 85/10/5 split (store keeps 85%, driver pool 10%, admin 5%).
 * - Optional: create an order via create_custom_order RPC with computed values.
 */
export default function SplitCalculator() {
  const { token: mapboxToken } = useMapboxToken();

  const [storeId, setStoreId] = useState('');
  const [orderValue, setOrderValue] = useState('');
  const [driverPay, setDriverPay] = useState('');
  const [pickup, setPickup] = useState<{ address: string; lat?: number; lng?: number } | null>(null);
  const [dropoff, setDropoff] = useState<{ address: string; lat?: number; lng?: number } | null>(null);
  const [km, setKm] = useState<number | null>(null);
  const [routing, setRouting] = useState(false);
  const [creating, setCreating] = useState(false);

  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'card'>('cash');

  const { data: stores } = useQuery({
    queryKey: ['stores-split-calc'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('stores')
        .select('id, name, address, latitude, longitude')
        .eq('is_active', true)
        .order('name');
      if (error) throw error;
      return data ?? [];
    },
  });

  // Auto-set pickup whenever a store is chosen
  useEffect(() => {
    if (!storeId || !stores) return;
    const s = stores.find((x: any) => x.id === storeId);
    if (s) {
      setPickup({
        address: s.address || s.name,
        lat: s.latitude ?? undefined,
        lng: s.longitude ?? undefined,
      });
    }
  }, [storeId, stores]);

  // Compute driving distance via Mapbox Directions
  useEffect(() => {
    if (!mapboxToken || !pickup?.lat || !pickup?.lng || !dropoff?.lat || !dropoff?.lng) {
      return;
    }
    let cancelled = false;
    setRouting(true);
    const url = `https://api.mapbox.com/directions/v5/mapbox/driving/${pickup.lng},${pickup.lat};${dropoff.lng},${dropoff.lat}?access_token=${mapboxToken}&overview=false`;
    fetch(url)
      .then((r) => r.json())
      .then((d) => {
        if (cancelled) return;
        const meters = d?.routes?.[0]?.distance;
        if (typeof meters === 'number') {
          setKm(Math.round((meters / 1000) * 10) / 10);
        }
      })
      .catch(() => { /* ignore */ })
      .finally(() => { if (!cancelled) setRouting(false); });
    return () => { cancelled = true; };
  }, [pickup, dropoff, mapboxToken]);

  // Locked split: 85 / 10 / 5
  const split = useMemo(() => {
    const v = Number(orderValue) || 0;
    const store = +(v * 0.85).toFixed(2);
    const driverPool = +(v * 0.10).toFixed(2);
    const admin = +(v * 0.05).toFixed(2);
    return { v, store, driverPool, admin };
  }, [orderValue]);

  const driverPayoutNum = Number(driverPay) || 0;
  const storeChargeTotal = +(split.driverPool + split.admin + driverPayoutNum).toFixed(2);
  const ready = !!storeId && split.v > 0 && !!dropoff?.address;

  const handleCreate = async () => {
    if (!ready) {
      toast.error('Συμπλήρωσε κατάστημα, αξία και διεύθυνση παράδοσης');
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
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success('Παραγγελία δημιουργήθηκε με τον υπολογισμένο διαχωρισμό');
    setOrderValue('');
    setDriverPay('');
    setDropoff(null);
    setKm(null);
    setCustomerName('');
    setCustomerPhone('');
  };

  const reset = () => {
    setStoreId(''); setOrderValue(''); setDriverPay('');
    setPickup(null); setDropoff(null); setKm(null);
    setCustomerName(''); setCustomerPhone(''); setPaymentMethod('cash');
  };

  return (
    <div className="space-y-4 max-w-5xl">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h2 className="font-heading font-bold text-xl flex items-center gap-2">
            <Calculator className="h-5 w-5 text-primary" />
            Υπολογιστής Διαχωρισμού
          </h2>
          <p className="text-sm text-muted-foreground mt-1 max-w-xl">
            Διάλεξε κατάστημα, βάλε αξία παραγγελίας και διεύθυνση παράδοσης. Τα χιλιόμετρα υπολογίζονται αυτόματα από τον χάρτη και η κατανομή <strong>85% / 10% / 5%</strong> εφαρμόζεται στο κλείσιμο.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={reset} className="gap-2 shrink-0">
          <RefreshCw className="h-3.5 w-3.5" /> Καθαρισμός
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Input column */}
        <Card>
          <CardContent className="p-5 space-y-4">
            <div>
              <Label className="text-xs">Κατάστημα (παραλαβή)</Label>
              <Select value={storeId} onValueChange={setStoreId}>
                <SelectTrigger><SelectValue placeholder="Διάλεξε κατάστημα…" /></SelectTrigger>
                <SelectContent>
                  {stores?.map((s: any) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name}{s.latitude == null && ' (χωρίς συντεταγμένες)'}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {pickup && (
                <p className="text-[11px] text-muted-foreground mt-1.5 flex items-center gap-1">
                  <MapPin className="h-3 w-3" /> {pickup.address}
                </p>
              )}
            </div>

            <div>
              <Label className="text-xs">Διεύθυνση παράδοσης</Label>
              <AddressAutocomplete
                value={dropoff?.address ?? ''}
                onChange={(addr, lat, lon) =>
                  setDropoff({ address: addr, lat, lng: lon })
                }
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

        {/* Live preview column */}
        <div className="space-y-3">
          <Card className="overflow-hidden border-primary/20 bg-gradient-to-br from-primary/5 via-card to-card">
            <CardContent className="p-5 space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">Απόσταση διαδρομής</p>
                {routing && <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />}
              </div>
              <div className="flex items-baseline gap-2">
                <Navigation className="h-5 w-5 text-primary" />
                <span className="text-4xl font-heading font-bold tabular-nums">
                  {km ?? '—'}
                </span>
                <span className="text-base text-muted-foreground">km</span>
                {km != null && (
                  <Badge variant="outline" className="ml-auto text-[10px] gap-1">
                    <MapPin className="h-2.5 w-2.5" /> Mapbox driving
                  </Badge>
                )}
              </div>
              {!km && (pickup || dropoff) && (
                <p className="text-[11px] text-muted-foreground">
                  Χρειάζονται και τα δύο σημεία με συντεταγμένες για να μετρηθεί η διαδρομή.
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

              <SplitRow
                icon={Building2}
                label="Κατάστημα κρατά"
                pct="85%"
                amount={split.store}
                tone="text-foreground"
              />
              <SplitRow
                icon={Bike}
                label="Driver pool (10%)"
                pct="10%"
                amount={split.driverPool}
                tone="text-info"
              />
              <SplitRow
                icon={TrendingUp}
                label="Admin (5%)"
                pct="5%"
                amount={split.admin}
                tone="text-success"
              />

              <Separator />

              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground flex items-center gap-1.5">
                    <Wallet className="h-3.5 w-3.5" /> Driver παίρνει
                  </span>
                  <span className="font-bold tabular-nums">€{driverPayoutNum.toFixed(2)}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Κατάστημα χρεώνεται (commission + driver)</span>
                  <span className="font-bold tabular-nums text-primary">€{storeChargeTotal.toFixed(2)}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          <Button
            size="lg"
            className="w-full gap-2"
            onClick={handleCreate}
            disabled={!ready || creating}
          >
            {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            {creating ? 'Δημιουργία…' : 'Δημιουργία παραγγελίας με αυτό το split'}
          </Button>
          {!ready && (
            <p className="text-[11px] text-muted-foreground text-center">
              Συμπλήρωσε κατάστημα, αξία και διεύθυνση παράδοσης για να συνεχίσεις.
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
