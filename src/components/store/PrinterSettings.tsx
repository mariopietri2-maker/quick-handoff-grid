import { useEffect, useMemo, useState } from 'react';
import {
  Printer, Zap, Bluetooth, Usb, Loader2, CheckCircle2, XCircle, Unplug, Monitor,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { getPrinterPrefs, setPrinterPrefs, type PrinterMode, type PrinterPrefs } from '@/lib/printer-prefs';
import {
  BLE_PRESETS, connectBlePrinter, connectUsbPrinter, disconnectPrinter,
  getPrinterState, printerSupport, resolveBleConfig, subscribePrinter,
  tryRestorePrinter, type PrinterState,
} from '@/lib/printer-devices';
import { printOrderSafe } from './PrintOrderTicket';

interface PrinterSettingsProps {
  storeName: string;
}

const BAUD_RATES = [9600, 19200, 38400, 57600, 115200];

function connectionBadge(conn: PrinterState) {
  switch (conn.status) {
    case 'connected':
      return (
        <Badge className="bg-emerald-500/15 text-emerald-600 border-emerald-500/30 gap-1">
          <CheckCircle2 className="h-3 w-3" /> Συνδεδεμένο
        </Badge>
      );
    case 'connecting':
      return (
        <Badge variant="secondary" className="gap-1">
          <Loader2 className="h-3 w-3 animate-spin" /> Σύνδεση…
        </Badge>
      );
    case 'error':
      return (
        <Badge variant="destructive" className="gap-1">
          <XCircle className="h-3 w-3" /> Σφάλμα
        </Badge>
      );
    default:
      return <Badge variant="outline">Χωρίς σύνδεση</Badge>;
  }
}

export function PrinterSettings({ storeName }: PrinterSettingsProps) {
  const [prefs, setPrefs] = useState<PrinterPrefs>(getPrinterPrefs());
  const [conn, setConn] = useState<PrinterState>(getPrinterState());
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<PrinterPrefs>).detail;
      setPrefs(detail);
      if (detail && detail.mode === 'direct' && detail.lastDevice?.kind === 'usb') {
        void tryRestorePrinter();
      }
    };
    window.addEventListener('printer-prefs-changed', handler);
    const unsubscribe = subscribePrinter(setConn);
    return () => {
      window.removeEventListener('printer-prefs-changed', handler);
      unsubscribe();
    };
  }, []);

  const directReady = prefs.mode === 'direct';

  useEffect(() => {
    if (prefs.enabled && directReady && prefs.lastDevice?.kind === 'usb') {
      void tryRestorePrinter();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prefs.enabled, directReady]);

  const update = (patch: Partial<PrinterPrefs>) => {
    setPrinterPrefs(patch);
    setPrefs((prev) => ({ ...prev, ...patch }));
  };

  const handleModeChange = (mode: PrinterMode) => {
    update({ mode });
    if (mode === 'direct') {
      void tryRestorePrinter();
    }
  };

  const testPrint = async () => {
    const testOrder = {
      id: 'test-0001-test',
      store_order_number: 42,
      created_at: new Date().toISOString(),
      total_amount: 12.5,
      delivery_fee: 2.0,
      tip_amount: 1.0,
      payment_method: 'cash',
      notes: 'Δοκιμαστική εκτύπωση',
      delivery_address: 'Δοκιμή 123, Ιωάννινα',
      order_items: [
        { name: 'Δοκιμαστικό Προϊόν', quantity: 2, unit_price: 4.75 },
      ],
    } as never;
    setBusy(true);
    try {
      const res = await printOrderSafe(testOrder as never, storeName, {
        driverCode: 'DRV 7',
        customerName: 'Πελάτης δοκιμής',
        customerPhone: '69xxxxxxx',
      });
      if (res.direct) toast.success('Εκτυπώθηκε στον εκτυπωτή');
      else toast.success('Εστάλη δοκιμαστική εκτύπωση — επέλεξε τον εκτυπωτή στον διάλογο');
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      toast.error(`Αποτυχία εκτύπωσης: ${msg}`);
    } finally {
      setBusy(false);
    }
  };

  const bleConfigPreview = useMemo(
    () => (directReady && printerSupport.ble ? resolveBleConfig(prefs) : null),
    [directReady, prefs],
  );

  return (
    <Card className="shadow-[var(--shadow-md)]">
      <CardContent className="p-4 space-y-4">
        <div className="flex items-center gap-2">
          <Printer className="h-5 w-5 text-primary" />
          <div>
            <h3 className="font-heading font-bold text-foreground">Εκτυπωτής</h3>
            <p className="text-xs text-muted-foreground">
              Ρυθμίσεις εκτύπωσης δελτίων παραγγελίας (αποθηκεύονται σε αυτή τη συσκευή)
            </p>
          </div>
        </div>

        <div className="flex items-center justify-between rounded-lg border border-border p-3">
          <div>
            <p className="font-heading font-semibold text-sm text-foreground">Ενεργοποίηση εκτυπωτή</p>
            <p className="text-xs text-muted-foreground">Ενεργοποίηση κουμπιών εκτύπωσης</p>
          </div>
          <Switch checked={prefs.enabled} onCheckedChange={(v) => update({ enabled: v })} />
        </div>

        <div className={`flex items-center justify-between rounded-lg border p-3 ${prefs.autoPrintOnAccept ? 'border-warning/40 bg-warning/5' : 'border-border'}`}>
          <div className="flex items-center gap-2">
            <Zap className={`h-4 w-4 ${prefs.autoPrintOnAccept ? 'text-warning' : 'text-muted-foreground'}`} />
            <div>
              <p className="font-heading font-semibold text-sm text-foreground">Αυτόματη εκτύπωση</p>
              <p className="text-xs text-muted-foreground">Αυτόματη εκτύπωση όταν η παραγγελία γίνει αποδεκτή</p>
            </div>
          </div>
          <Switch
            checked={prefs.autoPrintOnAccept}
            disabled={!prefs.enabled}
            onCheckedChange={(v) => update({ autoPrintOnAccept: v })}
          />
        </div>

        {prefs.enabled && (
          <div className="space-y-1.5">
            <Label className="font-heading text-xs">Τρόπος εκτύπωσης</Label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => handleModeChange('browser')}
                className={cn(
                  'rounded-lg border p-2.5 text-left transition-colors',
                  !directReady ? 'border-primary bg-primary/5' : 'border-border hover:bg-muted/50',
                )}
              >
                <span className="flex items-center gap-1.5 text-sm font-heading font-semibold text-foreground">
                  <Monitor className="h-4 w-4 text-muted-foreground" />
                  Διάλογος browser
                </span>
                <span className="text-[11px] text-muted-foreground mt-0.5 block">
                  Κλασικός διάλογος εκτύπωσης — δουλεύει παντού
                </span>
              </button>
              <button
                type="button"
                onClick={() => handleModeChange('direct')}
                className={cn(
                  'rounded-lg border p-2.5 text-left transition-colors',
                  directReady ? 'border-primary bg-primary/5' : 'border-border hover:bg-muted/50',
                )}
              >
                <span className="flex items-center gap-1.5 text-sm font-heading font-semibold text-foreground">
                  <Zap className="h-4 w-4 text-primary" />
                  Απευθείας (ESC/POS)
                </span>
                <span className="text-[11px] text-muted-foreground mt-0.5 block">
                  Αθόρυβη εκτύπωση Bluetooth / USB
                </span>
              </button>
            </div>
          </div>
        )}

        {prefs.enabled && directReady && (
          <div className="space-y-3 rounded-lg border bg-muted/20 p-3">
            <div className="flex items-center justify-between gap-2">
              <Label className="font-heading text-xs">Σύνδεση εκτυπωτή</Label>
              {connectionBadge(conn)}
            </div>

            {conn.status === 'connected' && (
              <div className="flex items-center justify-between gap-2 rounded-lg border bg-card p-2.5">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-foreground truncate">{conn.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {conn.kind === 'usb' ? 'USB (Web Serial)' : 'Bluetooth (BLE)'}
                  </p>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-8 shrink-0"
                  onClick={() => void disconnectPrinter()}
                >
                  <Unplug className="h-3.5 w-3.5 mr-1.5" />
                  Αποσύνδεση
                </Button>
              </div>
            )}

            {conn.status === 'error' && (
              <p className="text-xs text-destructive font-heading">{conn.message}</p>
            )}

            {conn.status === 'connecting' && (
              <p className="flex items-center gap-2 text-xs text-muted-foreground">
                <Loader2 className="h-3.5 w-3.5 animate-spin" /> Γίνεται σύνδεση…
              </p>
            )}

            {conn.status !== 'connected' && conn.status !== 'connecting' && (
              <div className="grid grid-cols-2 gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  className="h-9"
                  disabled={!printerSupport.usb}
                  onClick={() => void connectUsbPrinter()}
                >
                  <Usb className="h-3.5 w-3.5 mr-1.5" />
                  {printerSupport.usb ? 'USB' : 'USB n/a'}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-9"
                  disabled={!printerSupport.ble}
                  onClick={() => void connectBlePrinter()}
                >
                  <Bluetooth className="h-3.5 w-3.5 mr-1.5" />
                  {printerSupport.ble ? 'Bluetooth' : 'BT n/a'}
                </Button>
              </div>
            )}

            {conn.status === 'idle' && prefs.lastDevice && (
              <p className="text-[11px] text-muted-foreground">
                Τελευταία συσκευή: <span className="font-semibold text-foreground/80">{prefs.lastDevice.name}</span>
              </p>
            )}

            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1.5">
                <Label className="font-heading text-xs">Χαρτί</Label>
                <Select
                  value={String(prefs.paperWidth)}
                  onValueChange={(v) => update({ paperWidth: Number(v) as 58 | 80 })}
                >
                  <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="80">80mm</SelectItem>
                    <SelectItem value="58">58mm</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {printerSupport.usb && (
                <div className="space-y-1.5">
                  <Label className="font-heading text-xs">Ταχύτητα USB</Label>
                  <Select
                    value={String(prefs.baudRate)}
                    onValueChange={(v) => update({ baudRate: Number(v) })}
                  >
                    <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {BAUD_RATES.map((b) => (
                        <SelectItem key={b} value={String(b)}>{b}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>

            {printerSupport.ble && (
              <div className="space-y-2 border-t border-border pt-2">
                <div className="space-y-1.5">
                  <Label className="font-heading text-xs">Bluetooth προφίλ</Label>
                  <Select
                    value={prefs.blePreset}
                    onValueChange={(v) => update({ blePreset: v })}
                  >
                    <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {Object.entries(BLE_PRESETS).map(([key, p]) => (
                        <SelectItem key={key} value={key}>{p.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <Input
                    value={prefs.bleCustomService}
                    onChange={(e) => update({ bleCustomService: e.target.value })}
                    placeholder="Custom service UUID, π.χ. ff00"
                    className="h-9 text-xs font-mono"
                  />
                  <Input
                    value={prefs.bleCustomChar}
                    onChange={(e) => update({ bleCustomChar: e.target.value })}
                    placeholder="Custom char UUID, π.χ. ff02"
                    className="h-9 text-xs font-mono"
                  />
                </div>
                {bleConfigPreview && (
                  <p className="text-[11px] text-muted-foreground font-mono break-all">
                    θα συνδεθεί: {bleConfigPreview.service} → {bleConfigPreview.char}
                  </p>
                )}
              </div>
            )}

            <p className="text-[11px] text-muted-foreground">
              USB λειτουργεί σε Chrome/Edge desktop. Το Bluetooth λειτουργεί μόνο με εκτυπωτές BLE
              (GATT) — οι θερμικοί με κλασικό SPP Bluetooth δεν συνδέονται από το browser:
              χρησιμοποίησε USB ή τον διάλογο εκτύπωσης.
            </p>
          </div>
        )}

        <div className="space-y-2">
          <Label className="font-heading text-xs">Όνομα εκτυπωτή (προαιρετικό)</Label>
          <Input
            value={prefs.printerName}
            onChange={(e) => update({ printerName: e.target.value })}
            placeholder="π.χ. Κουζίνα — Star TSP100"
            disabled={!prefs.enabled}
          />
          <p className="text-xs text-muted-foreground">
            {directReady && conn.status === 'connected'
              ? 'Η εκτύπωση γίνεται αθόρυβα στον συνδεδεμένο εκτυπωτή.'
              : 'Ο πραγματικός εκτυπωτής επιλέγεται από το διάλογο εκτύπωσης του προγράμματος περιήγησης.'}
            {' '}Για kiosk mode δες <span className="font-mono">docs/STORE_PRINTING.md</span>.
          </p>
        </div>

        <Button onClick={() => void testPrint()} variant="outline" className="w-full" disabled={!prefs.enabled || busy}>
          {busy ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Printer className="h-4 w-4 mr-2" />}
          Δοκιμαστική εκτύπωση
        </Button>
      </CardContent>
    </Card>
  );
}