// Local printer preferences (per device / per store).
// mode 'browser' = classic browser print dialog; mode 'direct' = silent ESC/POS
// over Bluetooth/USB (when a printer is connected via printer-devices).
// Each store can have its own paper width (58mm vs 80mm) and connection settings.

const GLOBAL_KEY = 'store-printer-prefs';

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
  printerName: string;
  mode: PrinterMode;
  /** Physical paper width of THIS store's printer */
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

function storageKey(storeId?: string | null): string {
  if (storeId && storeId.trim()) return `${GLOBAL_KEY}:${storeId.trim()}`;
  return GLOBAL_KEY;
}

export function getPrinterPrefs(storeId?: string | null): PrinterPrefs {
  if (typeof window === 'undefined') return { ...DEFAULTS };
  try {
    const key = storageKey(storeId);
    let raw = localStorage.getItem(key);
    if (!raw && storeId) {
      const legacy = localStorage.getItem(GLOBAL_KEY);
      if (legacy) {
        localStorage.setItem(key, legacy);
        raw = legacy;
      }
    }
    if (!raw) return { ...DEFAULTS };
    return { ...DEFAULTS, ...JSON.parse(raw) };
  } catch {
    return { ...DEFAULTS };
  }
}

export function setPrinterPrefs(prefs: Partial<PrinterPrefs>, storeId?: string | null) {
  if (typeof window === 'undefined') return;
  const current = getPrinterPrefs(storeId);
  const next = { ...current, ...prefs };
  localStorage.setItem(storageKey(storeId), JSON.stringify(next));
  window.dispatchEvent(
    new CustomEvent('printer-prefs-changed', { detail: { ...next, storeId: storeId ?? null } }),
  );
}
