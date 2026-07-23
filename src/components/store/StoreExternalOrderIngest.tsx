import { useEffect, useMemo, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import {
  Loader2, Sparkles, ScanLine, FileText, Send,
  MapPin, Navigation, Building2, Wallet, Lock,
} from 'lucide-react';
import { AddressAutocomplete } from '@/components/AddressAutocomplete';
import { useMapboxToken } from '@/hooks/useMapboxToken';
import { cn } from '@/lib/utils';
import { isWithinIoanninaServiceArea, OUT_OF_ZONE_MESSAGE } from '@/lib/geo-defaults';

type Source = 'manual' | 'efood' | 'wolt' | 'box' | 'other';
type PaymentMethod = 'cash' | 'card';

interface StoreInfo {
  id: string;
  name: string;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
  commission_pct?: number | null;
}

interface FormState {
  source: Source;
  total_amount: string;
  delivery_address: string;
  delivery_lat: number | null;
  delivery_lng: number | null;
  customer_name: string;
  customer_phone: string;
  notes: string;
  external_ref: string;
  items_summary: string;
  payment_method: PaymentMethod;
}

const blankForm: FormState = {
  source: 'manual',
  total_amount: '',
  delivery_address: '',
  delivery_lat: null,
  delivery_lng: null,
  customer_name: '',
  customer_phone: '',
  notes: '',
  external_ref: '',
  items_summary: '',
  payment_method: 'cash',
};

interface Props {
  storeId: string;
}

/**
 * Store Custom Order — same lifecycle as in-app:
 * placed → kitchen accept/prep/ready → auto-dispatch offers → deliver.
 * Fees/payouts use the same formulas as place_order.
 */
export default function StoreExternalOrderIngest({ storeId }: Props) {
  const { token: mapboxToken } = useMapboxToken();
  const [store, setStore] = useState<StoreInfo | null>(null);
  const [form, setForm] = useState<FormState>(blankForm);
  const [km, setKm] = useState<number | null>(null);
  const [routing, setRouting] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [pasteText, setPasteText] = useState('');
  const [parsing, setParsing] = useState(false);
  const [scanText, setScanText] = useState('');

  const [customerFee, setCustomerFee] = useState({ base: 1.5, perKm: 0.5 });
  const [driverPay, setDriverPay] = useState(0);
  const [storeCommPct, setStoreCommPct] = useState(15);

  useEffect(() => {
    supabase
      .from('stores')
      .select('id, name, address, latitude, longitude')
      .eq('id', storeId)
      .maybeSingle()
      .then(({ data }) => {
        if (data) setStore(data as unknown as StoreInfo);
      });
  }, [storeId]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data: ps } = await supabase
        .from('platform_settings')
        .select('customer_base_fee, customer_per_km_fee, default_commission_pct' as any)
        .eq('id', 1)
        .maybeSingle() as any;
      if (cancelled || !ps) return;
      setCustomerFee({
        base: Number(ps.customer_base_fee ?? 1.5),
        perKm: Number(ps.customer_per_km_fee ?? 0.5),
      });
      const d = Number(ps.default_commission_pct);
      if (d > 0) setStoreCommPct(d);
    })();
    return () => { cancelled = true; };
  }, []);

  // Mapbox Directions: real driving km from store → dropoff.
  useEffect(() => {
    if (!mapboxToken || !store?.latitude || !store?.longitude || !form.delivery_lat || !form.delivery_lng) {
      setKm(null);
      return;
    }
    let cancelled = false;
    setRouting(true);
    const url = `https://api.mapbox.com/directions/v5/mapbox/driving/${store.longitude},${store.latitude};${form.delivery_lng},${form.delivery_lat}?access_token=${mapboxToken}&overview=false`;
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
  }, [store, form.delivery_lat, form.delivery_lng, mapboxToken]);

  const totalAmount = Number(form.total_amount) || 0;
  const distanceKm = km ?? 0;

  const deliveryFee = useMemo(
    () => +Math.max(0, customerFee.base + customerFee.perKm * distanceKm).toFixed(2),
    [customerFee, distanceKm],
  );

  // Same driver quote as in-app
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await supabase.rpc('quote_driver_payout', {
        p_store_id: storeId,
        p_distance_km: distanceKm,
      });
      if (!cancelled && data != null) setDriverPay(Number(data));
    })();
    return () => { cancelled = true; };
  }, [storeId, distanceKm]);

  const storeKeeps = useMemo(
    () => +(totalAmount * (100 - storeCommPct) / 100).toFixed(2),
    [totalAmount, storeCommPct],
  );

  const update = <K extends keyof FormState>(k: K, v: FormState[K]) =>
    setForm(p => ({ ...p, [k]: v }));

  const handleParse = async () => {
    if (!pasteText.trim()) return toast.error('Επικόλλησε κείμενο πρώτα');
    setParsing(true);
    try {
      const { data, error } = await supabase.functions.invoke('parse-receipt', { body: { text: pasteText } });
      if (error) throw error;
      const d = data?.data ?? {};
      setForm(p => ({
        ...p,
        source: (d.source as Source) || 'other',
        total_amount: d.total_amount != null ? String(d.total_amount) : p.total_amount,
        delivery_address: d.delivery_address || p.delivery_address,
        customer_name: d.customer_name || p.customer_name,
        customer_phone: d.customer_phone || p.customer_phone,
        items_summary: d.items_summary || p.items_summary,
        external_ref: d.external_ref || p.external_ref,
        notes: d.notes || p.notes,
      }));
      toast.success('Στοιχεία εξήχθησαν — έλεγξε & υποβάλε');
    } catch (e: any) {
      toast.error(e?.message ?? 'Αποτυχία ανάλυσης');
    } finally {
      setParsing(false);
    }
  };

  const handleScanFill = () => {
    const txt = scanText.trim();
    if (!txt) return toast.error('Σκάναρε ή επικόλλησε κωδικό');
    try {
      const parsed = JSON.parse(txt);
      setForm(p => ({
        ...p,
        source: parsed.source || 'other',
        total_amount: parsed.total != null ? String(parsed.total) : p.total_amount,
        delivery_address: parsed.address || p.delivery_address,
        customer_phone: parsed.phone || p.customer_phone,
        external_ref: parsed.ref || p.external_ref,
        items_summary: parsed.items || p.items_summary,
      }));
      toast.success('QR αναγνωρίστηκε');
    } catch {
      update('external_ref', txt);
      toast.success('Κωδικός καταγράφηκε');
    }
  };

  const handleSubmit = async () => {
    if (!form.delivery_address.trim()) return toast.error('Συμπλήρωσε διεύθυνση');
    if (!totalAmount) return toast.error('Συμπλήρωσε αξία παραγγελίας');
    if (form.delivery_lat == null || form.delivery_lng == null) {
      return toast.error('Επίλεξε διεύθυνση από τη λίστα ή σημείωσέ την στον χάρτη.');
    }
    if (!isWithinIoanninaServiceArea(form.delivery_lat, form.delivery_lng)) {
      return toast.error(OUT_OF_ZONE_MESSAGE);
    }

    setSubmitting(true);
    // Do NOT pass payout/charge overrides — RPC rejects them for store owners
    // and computes driver_payout + store_charge server-side from rates/km/billing mode.
    const { error } = await supabase.rpc('create_external_order' as any, {
      p_store_id: storeId,
      p_source: form.source,
      p_total_amount: totalAmount,
      p_delivery_address: form.delivery_address,
      p_delivery_lat: form.delivery_lat,
      p_delivery_lng: form.delivery_lng,
      p_distance_km: km,
      p_customer_name: form.customer_name || null,
      p_customer_phone: form.customer_phone || null,
      p_notes: form.notes || null,
      p_external_ref: form.external_ref || null,
      p_items_summary: form.items_summary || null,
      p_payment_method: form.payment_method,
    } as any);
    setSubmitting(false);
    if (error) {
      const msg = String(error.message || '');
      if (/store_charge|platform_profit|not-null|null value/i.test(msg)) {
        toast.error('Αποτυχία δημιουργίας παραγγελίας — δοκίμασε ξανά σε λίγο.');
      } else {
        toast.error(msg || 'Αποτυχία δημιουργίας παραγγελίας');
      }
    } else {
      toast.success('Η παραγγελία δημιουργήθηκε — εμφανίζεται στην κουζίνα ✓');
      setForm(blankForm);
      setKm(null);
      setPasteText('');
      setScanText('');
    }
  };

  const ready =
    !!form.delivery_address.trim() &&
    totalAmount > 0 &&
    form.delivery_lat != null &&
    form.delivery_lng != null &&
    isWithinIoanninaServiceArea(form.delivery_lat, form.delivery_lng);
  const noStoreCoords = !store?.latitude || !store?.longitude;

  return (
    <div className="space-y-4">
      <div>
        <h2 className="font-heading font-bold text-xl text-foreground">Νέα Custom Order</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Ίδια ροή με in-app: μπαίνει στην κουζίνα → Έτοιμη → προσφορά σε οδηγούς μέσω auto-dispatch.
          Έξοδα παράδοσης & αμοιβή οδηγού υπολογίζονται όπως στις κανονικές παραγγελίες.
        </p>
      </div>

      {noStoreCoords && (
        <div className="rounded-lg border border-warning/40 bg-warning/10 px-3 py-2 text-xs">
          Το κατάστημα δεν έχει συντεταγμένες — τα km δεν θα υπολογιστούν αυτόματα. Ενημέρωσε τη διεύθυνση στις Ρυθμίσεις.
        </div>
      )}

      <div className="grid lg:grid-cols-[1fr,320px] gap-4">
        {/* Form column */}
        <Card>
          <CardContent className="p-4 sm:p-5 space-y-4">
            {/* Pickup pinned card */}
            <div className="rounded-lg border bg-muted/30 px-3 py-2.5">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Παραλαβή</p>
              <p className="text-sm font-heading mt-0.5 flex items-center gap-1.5">
                <MapPin className="h-3.5 w-3.5 text-primary" />
                {store?.name ?? 'Το κατάστημά μου'}
              </p>
              {store?.address && (
                <p className="text-[11px] text-muted-foreground mt-0.5 truncate">{store.address}</p>
              )}
            </div>

            {/* Import helpers */}
            <Tabs defaultValue="paste">
              <TabsList className="grid grid-cols-3 w-full">
                <TabsTrigger value="paste" className="gap-1.5 text-xs"><Sparkles className="h-3.5 w-3.5" />AI</TabsTrigger>
                <TabsTrigger value="manual" className="gap-1.5 text-xs"><FileText className="h-3.5 w-3.5" />Χειροκίνητα</TabsTrigger>
                <TabsTrigger value="scan" className="gap-1.5 text-xs"><ScanLine className="h-3.5 w-3.5" />QR</TabsTrigger>
              </TabsList>

              <TabsContent value="paste" className="mt-3 space-y-2">
                <Textarea
                  value={pasteText}
                  onChange={e => setPasteText(e.target.value)}
                  placeholder={'Επικόλλησε email/SMS/απόδειξη eFood / Wolt / Box…'}
                  rows={4}
                  className="text-xs font-mono"
                />
                <Button onClick={handleParse} disabled={parsing} className="w-full gap-2" size="sm">
                  {parsing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                  Ανάλυση με AI
                </Button>
              </TabsContent>

              <TabsContent value="manual" className="mt-3">
                <p className="text-[11px] text-muted-foreground">Συμπλήρωσε τα πεδία παρακάτω.</p>
              </TabsContent>

              <TabsContent value="scan" className="mt-3 space-y-2">
                <Input
                  value={scanText}
                  onChange={e => setScanText(e.target.value)}
                  placeholder='{"source":"efood","total":18.4,"address":"Ερμού 12"}'
                  className="text-xs font-mono"
                />
                <Button onClick={handleScanFill} variant="outline" size="sm" className="w-full gap-2">
                  <ScanLine className="h-4 w-4" /> Συμπλήρωση από QR
                </Button>
              </TabsContent>
            </Tabs>

            <Separator />

            {/* Editable fields */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Πηγή</Label>
                <Select value={form.source} onValueChange={v => update('source', v as Source)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="efood">eFood</SelectItem>
                    <SelectItem value="wolt">Wolt</SelectItem>
                    <SelectItem value="box">Box</SelectItem>
                    <SelectItem value="manual">Χειροκίνητη</SelectItem>
                    <SelectItem value="other">Άλλη</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Αξία παραγγελίας (€) *</Label>
                <Input
                  type="number" step="0.01" min="0"
                  value={form.total_amount}
                  onChange={e => update('total_amount', e.target.value)}
                  placeholder="0.00"
                  className="font-semibold tabular-nums"
                />
              </div>

              <div className="sm:col-span-2">
                <Label className="text-xs">Τρόπος πληρωμής</Label>
                <div className="grid grid-cols-2 gap-2 mt-1">
                  <button
                    type="button"
                    onClick={() => update('payment_method', 'card')}
                    className={cn(
                      'rounded-lg border px-3 py-2 text-sm font-heading transition',
                      form.payment_method === 'card'
                        ? 'border-primary bg-primary/10 text-primary'
                        : 'border-border bg-background text-muted-foreground hover:border-primary/50',
                    )}
                  >
                    💳 Κάρτα
                  </button>
                  <button
                    type="button"
                    onClick={() => update('payment_method', 'cash')}
                    className={cn(
                      'rounded-lg border px-3 py-2 text-sm font-heading transition',
                      form.payment_method === 'cash'
                        ? 'border-accent bg-accent/10 text-accent-foreground'
                        : 'border-border bg-background text-muted-foreground hover:border-accent/50',
                    )}
                  >
                    💶 Μετρητά
                  </button>
                </div>
                {form.payment_method === 'cash' && (
                  <p className="text-[11px] text-muted-foreground mt-1.5 leading-snug">
                    Ο οδηγός θα εισπράξει €{totalAmount.toFixed(2)} από τον πελάτη.
                  </p>
                )}
              </div>

              <div className="sm:col-span-2">
                <Label className="text-xs">Διεύθυνση παράδοσης *</Label>
                <AddressAutocomplete
                  value={form.delivery_address}
                  onChange={(addr, lat, lon) => setForm(p => ({
                    ...p,
                    delivery_address: addr,
                    delivery_lat: lat ?? null,
                    delivery_lng: lon ?? null,
                  }))}
                  placeholder="Που πάει το delivery;"
                  initialCenter={
                    store?.latitude && store?.longitude
                      ? [Number(store.longitude), Number(store.latitude)]
                      : undefined
                  }
                />
              </div>

              <div>
                <Label className="text-xs">Όνομα πελάτη</Label>
                <Input value={form.customer_name} onChange={e => update('customer_name', e.target.value)} />
              </div>
              <div>
                <Label className="text-xs">Τηλέφωνο</Label>
                <Input value={form.customer_phone} onChange={e => update('customer_phone', e.target.value)} placeholder="6912345678" />
              </div>

              <div className="sm:col-span-2">
                <Label className="text-xs">Σύνοψη προϊόντων</Label>
                <Input value={form.items_summary} onChange={e => update('items_summary', e.target.value)} placeholder="2x Πίτσα Μαργαρίτα, 1x Κόκα Κόλα" />
              </div>

              <div>
                <Label className="text-xs">External ref</Label>
                <Input value={form.external_ref} onChange={e => update('external_ref', e.target.value)} placeholder="A12345" />
              </div>
              <div>
                <Label className="text-xs">Σημειώσεις</Label>
                <Input value={form.notes} onChange={e => update('notes', e.target.value)} placeholder="Χωρίς κρεμμύδι" />
              </div>
            </div>

            <Button
              onClick={handleSubmit}
              disabled={submitting || !ready}
              className="w-full h-11 gap-2 gradient-primary text-primary-foreground font-heading"
            >
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              Αποστολή παραγγελίας
            </Button>
          </CardContent>
        </Card>

        {/* Simplified summary — auto-calculated, nothing to edit */}
        <div className="space-y-3">
          <Card className="overflow-hidden border-primary/20 bg-gradient-to-br from-primary/5 via-card to-card lg:sticky lg:top-20">
            <CardContent className="p-5 space-y-4">
              {/* Distance — small chip on top */}
              <div className="flex items-center justify-between text-xs">
                <span className="flex items-center gap-1.5 text-muted-foreground">
                  <Navigation className="h-3.5 w-3.5 text-primary" />
                  Απόσταση
                </span>
                <span className="flex items-center gap-1.5 font-heading font-bold tabular-nums">
                  {routing ? <Loader2 className="h-3 w-3 animate-spin text-primary" /> : null}
                  {km ?? '—'} km
                </span>
              </div>

              <Separator />

              {/* In-app style summary */}
              <div className="space-y-2">
                <div className="rounded-lg border border-border/60 bg-background px-3 py-3 flex items-center justify-between">
                  <span className="text-xs text-muted-foreground flex items-center gap-1.5">
                    <Wallet className="h-3.5 w-3.5" /> Κρατάς (~{storeCommPct}%)
                  </span>
                  <span className="font-heading font-bold text-xl tabular-nums text-success">
                    €{storeKeeps.toFixed(2)}
                  </span>
                </div>

                <div className="rounded-lg border border-border/60 bg-background px-3 py-2.5 flex items-center justify-between">
                  <span className="text-xs text-muted-foreground flex items-center gap-1.5">
                    <Building2 className="h-3.5 w-3.5" /> Έξοδα παράδοσης
                  </span>
                  <span className="font-heading font-bold text-sm tabular-nums">
                    €{deliveryFee.toFixed(2)}
                  </span>
                </div>

                <div className="rounded-lg border border-primary/30 bg-primary/5 px-3 py-2.5 flex items-center justify-between">
                  <span className="text-xs text-muted-foreground flex items-center gap-1.5">
                    <Navigation className="h-3.5 w-3.5 text-primary" /> Αμοιβή οδηγού
                  </span>
                  <span className="font-heading font-bold text-sm tabular-nums text-primary">
                    €{driverPay.toFixed(2)}
                  </span>
                </div>
              </div>

              <p className="text-[10px] text-muted-foreground leading-snug flex items-center gap-1 pt-1 border-t">
                <Lock className="h-2.5 w-2.5" />
                Ίδια χρέωση με in-app · ο οδηγός εισπράττει μετρητά όταν επιλέξεις μετρητά.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
