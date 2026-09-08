// Local printer preferences (per device).
// mode 'browser' = classic browser print dialog; mode 'direct' = silent ESC/POS
// over Bluetooth/USB (when a printer is connected via printer-devices).

const KEY = 'store-printer-prefs';

export type PrinterMode = 'browser' | 'direct';

export interface PrinterLastDevice {
  kind: 'usb' | 'ble';
  name: string;
  baudRate?: number;
  serviceUuid?: string;
  charUuid?: string;
}

export interface PrinterPrefs {
  enabled: boolean;
  autoPrintOnAccept: boolean;
  printerName: string; // Informational only — used as a label in the UI
  mode: PrinterMode;
  paperWidth: 58 | 80;
  baudRate: number;
  blePreset: string;
  bleCustomService: string;
  bleCustomChar: string;
  lastDevice: PrinterLastDevice | null;
}

const DEFAULTS: PrinterPrefs = {
  enabled: false,
  autoPrintOnAccept: false,
  printerName: '',
  mode: 'browser',
  paperWidth: 80,
  baudRate: 9600,
  blePreset: 'ff00',
  bleCustomService: '',
  bleCustomChar: '',
  lastDevice: null,
};

export function getPrinterPrefs(): PrinterPrefs {
  if (typeof window === 'undefined') return DEFAULTS;
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return DEFAULTS;
    return { ...DEFAULTS, ...JSON.parse(raw) };
  } catch {
    return DEFAULTS;
  }
}

export function setPrinterPrefs(prefs: Partial<PrinterPrefs>) {
  if (typeof window === 'undefined') return;
  const current = getPrinterPrefs();
  const next = { ...current, ...prefs };
  localStorage.setItem(KEY, JSON.stringify(next));
  window.dispatchEvent(new CustomEvent('printer-prefs-changed', { detail: next }));
}