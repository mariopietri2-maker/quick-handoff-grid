import { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Loader2, Sparkles, ScanLine, FileText, TrendingUp, Send } from 'lucide-react';
import { geocodeAddress, haversineKm } from '@/lib/geocode';

type Source = 'manual' | 'efood' | 'wolt' | 'box' | 'other';

interface StoreInfo {
  id: string;
  name: string;
  ext_billing_mode: string;
  ext_commission_pct: number;
  ext_flat_fee: number;
  ext_margin_pct: number;
}

interface FormState {
  source: Source;
  total_amount: string;
  delivery_address: string;
  distance_km: string;
  customer_name: string;
  customer_phone: string;
  notes: string;
  external_ref: string;
  items_summary: string;
}

const blankForm: FormState = {
  source: 'efood',
  total_amount: '',
  delivery_address: '',
  distance_km: '',
  customer_name: '',
  customer_phone: '',
  notes: '',
  external_ref: '',
  items_summary: '',
};

interface Props {
  storeId: string;
}

export default function StoreExternalOrderIngest({ storeId }: Props) {
  const [store, setStore] = useState<StoreInfo | null>(null);
  const [form, setForm] = useState<FormState>(blankForm);
  const [submitting, setSubmitting] = useState(false);
  const [pasteText, setPasteText] = useState('');
  const [parsing, setParsing] = useState(false);
  const [scanText, setScanText] = useState('');

  useEffect(() => {
    supabase
      .from('stores')
      .select('id, name, ext_billing_mode, ext_commission_pct, ext_flat_fee, ext_margin_pct' as any)
      .eq('id', storeId)
      .maybeSingle()
      .then(({ data }) => {
        if (data) setStore(data as unknown as StoreInfo);
      });
  }, [storeId]);

  const totalAmount = Number(form.total_amount) || 0;
  const distanceKm = Number(form.distance_km) || 0;

  const preview = useMemo(() => {
    if (!store) return null;
    const driverPay = Math.max(3, 3 + 0.5 * distanceKm);
    let storeCharge: number;
    switch (store.ext_billing_mode) {
      case 'commission':
        storeCharge = +(totalAmount * store.ext_commission_pct / 100).toFixed(2);
        break;
      case 'flat_fee':
        storeCharge = +Number(store.ext_flat_fee).toFixed(2);
        break;
      case 'driver_plus_margin':
        storeCharge = +(driverPay * (1 + store.ext_margin_pct / 100)).toFixed(2);
        break;
      default:
        storeCharge = +(totalAmount * 0.15).toFixed(2);
    }
    return { driverPay: +driverPay.toFixed(2), storeCharge: +storeCharge.toFixed(2) };
  }, [store, totalAmount, distanceKm]);

  const update = <K extends keyof FormState>(k: K, v: FormState[K]) => setForm(p => ({ ...p, [k]: v }));

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

    setSubmitting(true);

    // Auto-geocode address + compute distance from store (best-effort).
    let distanceKm = form.distance_km ? Number(form.distance_km) : null;
    let deliveryLat: number | null = null;
    let deliveryLng: number | null = null;
    try {
      const [geo, storeRow] = await Promise.all([
        geocodeAddress(form.delivery_address),
        supabase.from('stores').select('latitude, longitude').eq('id', storeId).maybeSingle(),
      ]);
      if (geo) {
        deliveryLat = geo.latitude;
        deliveryLng = geo.longitude;
      }
      const sLat = storeRow.data?.latitude;
      const sLng = storeRow.data?.longitude;
      if (geo && sLat != null && sLng != null && distanceKm == null) {
        distanceKm = +haversineKm(
          { latitude: sLat, longitude: sLng },
          { latitude: geo.latitude, longitude: geo.longitude },
        ).toFixed(2);
      }
    } catch {
      /* non-fatal */
    }

    const { error } = await supabase.rpc('create_external_order' as any, {
      p_store_id: storeId,
      p_source: form.source,
      p_total_amount: form.total_amount ? Number(form.total_amount) : 0,
      p_delivery_address: form.delivery_address,
      p_delivery_lat: deliveryLat,
      p_delivery_lng: deliveryLng,
      p_distance_km: distanceKm,
      p_customer_name: form.customer_name || null,
      p_customer_phone: form.customer_phone || null,
      p_notes: form.notes || null,
      p_external_ref: form.external_ref || null,
      p_items_summary: form.items_summary || null,
    });
    setSubmitting(false);
    if (error) {
      toast.error(error.message);
    } else {
      toast.success('Παραγγελία εστάλη στους οδηγούς ✓');
      setForm(blankForm);
      setPasteText('');
      setScanText('');
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <h2 className="font-heading font-bold text-xl text-foreground">Εισαγωγή Παραγγελίας eFood / Wolt / Box</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Στείλε μια παραγγελία από εξωτερική πλατφόρμα στους οδηγούς μας — χειροκίνητα, με AI ή με QR.
        </p>
      </div>

      <div className="grid lg:grid-cols-[1fr,300px] gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="font-heading text-base">Πηγή Παραγγελίας</CardTitle>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="paste">
              <TabsList className="grid grid-cols-3 w-full">
                <TabsTrigger value="paste" className="gap-1.5"><Sparkles className="h-3.5 w-3.5" />Επικόλληση + AI</TabsTrigger>
                <TabsTrigger value="manual" className="gap-1.5"><FileText className="h-3.5 w-3.5" />Χειροκίνητα</TabsTrigger>
                <TabsTrigger value="scan" className="gap-1.5"><ScanLine className="h-3.5 w-3.5" />QR</TabsTrigger>
              </TabsList>

              <TabsContent value="paste" className="mt-4 space-y-3">
                <Label className="text-sm font-heading">Επικόλλησε email/SMS/απόδειξη από eFood / Wolt / Box</Label>
                <Textarea
                  value={pasteText}
                  onChange={e => setPasteText(e.target.value)}
                  placeholder={'Νέα παραγγελία efood #A12345\nΣύνολο: 18.40€\nΔιεύθυνση: Ερμού 12, Αθήνα\nΓιάννης 6912345678\n2x Πίτσα Μαργαρίτα, 1x Κόκα Κόλα'}
                  rows={6}
                  className="text-xs font-mono"
                />
                <Button onClick={handleParse} disabled={parsing} className="w-full gap-2">
                  {parsing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                  Ανάλυση με AI
                </Button>
              </TabsContent>

              <TabsContent value="manual" className="mt-4">
                <p className="text-xs text-muted-foreground">Συμπλήρωσε τα παρακάτω πεδία.</p>
              </TabsContent>

              <TabsContent value="scan" className="mt-4 space-y-3">
                <Label className="text-sm font-heading">Σκανάρισε ή επικόλλησε QR / barcode</Label>
                <Input
                  value={scanText}
                  onChange={e => setScanText(e.target.value)}
                  placeholder='{"source":"efood","total":18.4,"address":"Ερμού 12"}'
                  className="text-xs font-mono"
                />
                <Button onClick={handleScanFill} variant="outline" className="w-full gap-2">
                  <ScanLine className="h-4 w-4" /> Συμπλήρωση από κωδικό
                </Button>
              </TabsContent>
            </Tabs>

            <div className="space-y-3 mt-5 pt-5 border-t">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">Πηγή *</Label>
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
                  <Label className="text-xs">Σύνολο (€)</Label>
                  <Input type="number" step="0.01" min="0" value={form.total_amount} onChange={e => update('total_amount', e.target.value)} placeholder="προαιρετικό" />
                </div>
                <div>
                  <Label className="text-xs">Απόσταση (km)</Label>
                  <Input type="number" step="0.1" min="0" value={form.distance_km} onChange={e => update('distance_km', e.target.value)} placeholder="3.2" />
                </div>
                <div>
                  <Label className="text-xs">External Ref</Label>
                  <Input value={form.external_ref} onChange={e => update('external_ref', e.target.value)} placeholder="A12345" />
                </div>
                <div className="sm:col-span-2">
                  <Label className="text-xs">Διεύθυνση Παράδοσης *</Label>
                  <Input value={form.delivery_address} onChange={e => update('delivery_address', e.target.value)} placeholder="Ερμού 12, Αθήνα" />
                </div>
                <div>
                  <Label className="text-xs">Όνομα πελάτη</Label>
                  <Input value={form.customer_name} onChange={e => update('customer_name', e.target.value)} />
                </div>
                <div>
                  <Label className="text-xs">Τηλέφωνο πελάτη</Label>
                  <Input value={form.customer_phone} onChange={e => update('customer_phone', e.target.value)} placeholder="6912345678" />
                </div>
                <div className="sm:col-span-2">
                  <Label className="text-xs">Σύνοψη προϊόντων</Label>
                  <Input value={form.items_summary} onChange={e => update('items_summary', e.target.value)} placeholder="2x Πίτσα Μαργαρίτα, 1x Κόκα Κόλα" />
                </div>
                <div className="sm:col-span-2">
                  <Label className="text-xs">Σημειώσεις</Label>
                  <Input value={form.notes} onChange={e => update('notes', e.target.value)} placeholder="Χωρίς κρεμμύδι" />
                </div>
              </div>

              <Button onClick={handleSubmit} disabled={submitting} className="w-full h-11 gap-2 gradient-primary text-primary-foreground font-heading">
                {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                Αποστολή στους Οδηγούς
              </Button>
            </div>
          </CardContent>
        </Card>

        <div className="space-y-3">
          <Card className="sticky top-20">
            <CardHeader className="pb-3">
              <CardTitle className="font-heading text-base flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-primary" /> Προεπισκόπηση
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {!store ? (
                <p className="text-xs text-muted-foreground">Φόρτωση…</p>
              ) : (
                <>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">Μοντέλο χρέωσης</span>
                    <Badge variant="outline" className="font-heading text-[10px]">
                      {store.ext_billing_mode === 'commission' && `Προμήθεια ${store.ext_commission_pct}%`}
                      {store.ext_billing_mode === 'flat_fee' && `Σταθερό €${store.ext_flat_fee}`}
                      {store.ext_billing_mode === 'driver_plus_margin' && `Οδηγός + ${store.ext_margin_pct}%`}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Σύνολο παραγγελίας</span>
                    <span className="font-mono">€{totalAmount.toFixed(2)}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Πληρωμή οδηγού</span>
                    <span className="font-mono">€{preview?.driverPay.toFixed(2) ?? '0.00'}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm border-t pt-3">
                    <span className="font-heading font-semibold">Θα χρεωθείτε</span>
                    <span className="font-mono font-bold text-primary">€{preview?.storeCharge.toFixed(2) ?? '0.00'}</span>
                  </div>
                  <p className="text-[11px] text-muted-foreground leading-snug pt-2 border-t">
                    Η χρέωση καθορίζεται από τον admin για το κατάστημά σας. Ο οδηγός θα ειδοποιηθεί αμέσως.
                  </p>
                </>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
