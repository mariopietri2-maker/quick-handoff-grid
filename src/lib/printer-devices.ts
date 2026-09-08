// Printer device connection for the store app.
//
// Two transports:
//  - USB  -> Web Serial (Chrome/Edge desktop). Best for cheap USB thermal printers.
//  - BLE  -> Web Bluetooth GATT (Chrome desktop + Android WebView). Works only with
//            BLE-capable printers (many cheap BT receipt printers are classic
//            SPP-only and are NOT reachable from browsers — use USB or the browser
//            dialog for those).
//
// The manager is a module-level singleton so every part of the store app (settings,
// order queue auto-print, test print) shares one live connection and state.

import {
  getPrinterPrefs,
  setPrinterPrefs,
  type PrinterPrefs,
  type PrinterLastDevice,
} from '@/lib/printer-prefs';

export type PrinterConnectionType = 'usb' | 'ble';

export type PrinterState =
  | { status: 'unsupported' }
  | { status: 'idle' }
  | { status: 'connecting' }
  | { status: 'connected'; kind: PrinterConnectionType; name: string }
  | { status: 'error'; message: string };

export interface BlePreset {
  label: string;
  service: string;
  char: string;
}

export const BLE_PRESETS: Record<string, BlePreset> = {
  ff00: { label: 'Γενικό (FF00/FF02)', service: '0000ff00-0000-1000-8000-00805f9b34fb', char: '0000ff02-0000-1000-8000-00805f9b34fb' },
  ffe0: { label: 'UART (FFE0/FFE1)', service: '0000ffe0-0000-1000-8000-00805f9b34fb', char: '0000ffe1-0000-1000-8000-00805f9b34fb' },
  star: { label: 'Star (18F0/18F1)', service: '000018f0-0000-1000-8000-00805f9b34fb', char: '000018f1-0000-1000-8000-00805f9b34fb' },
};

const BLE_WRITE_CHUNK = 20; // safest default before MTU negotiation

export const printerSupport = {
  usb: typeof navigator !== 'undefined' && typeof navigator.serial !== 'undefined',
  ble: typeof navigator !== 'undefined' && typeof navigator.bluetooth !== 'undefined',
};

interface ActivePrinter {
  kind: PrinterConnectionType;
  name: string;
  send: (chunks: Uint8Array[]) => Promise<void>;
  close: () => Promise<void>;
}

let active: ActivePrinter | null = null;
let state: PrinterState = { status: 'idle' };
const listeners = new Set<(s: PrinterState) => void>();

function publish(next: PrinterState) {
  state = next;
  for (const l of listeners) {
    try {
      l(next);
    } catch {
      /* listener errors are isolated */
    }
  }
  try {
    window.dispatchEvent(new CustomEvent('printer-state-changed', { detail: next }));
  } catch {
    /* non-browser env */
  }
}

export function getPrinterState(): PrinterState {
  return state;
}

export function subscribePrinter(fn: (s: PrinterState) => void): () => void {
  listeners.add(fn);
  fn(state);
  return () => {
    listeners.delete(fn);
  };
}

function normalizeUuid(raw: string): string | null {
  const s = raw.trim().replace(/[^0-9a-fA-F]/g, '');
  if (s.length === 32) {
    return `${s.slice(0, 8)}-${s.slice(8, 12)}-${s.slice(12, 16)}-${s.slice(16, 20)}-${s.slice(20)}`.toLowerCase();
  }
  if (s.length === 8) {
    return `0000${s}-0000-1000-8000-00805f9b34fb`.toLowerCase();
  }
  return null;
}

export function resolveBleConfig(prefs: PrinterPrefs): { service: string; char: string } {
  const customService = normalizeUuid(prefs.bleCustomService);
  const customChar = normalizeUuid(prefs.bleCustomChar);
  if (customService && customChar) return { service: customService, char: customChar };
  const preset = BLE_PRESETS[prefs.blePreset] ?? BLE_PRESETS.ff00;
  return { service: preset.service, char: preset.char };
}

function describeError(e: unknown): string {
  if (!e) return 'Άγνωστο σφάλμα';
  if (e instanceof DOMException) {
    if (e.name === 'NotFoundError') return 'Δεν επιλέχθηκε συσκευή';
    if (e.name === 'SecurityError') return 'Η σύνδεση μπλοκαρίστηκε από το πρόγραμμα περιήγησης';
    if (e.name === 'NetworkError') return 'Η συσκευή αποσυνδέθηκε — δοκίμασε ξανά';
    return e.message || e.name;
  }
  const msg = e instanceof Error ? e.message : String(e);
  return msg || 'Αποτυχία σύνδεσης';
}

/* ------------------------------- USB (Web Serial) ------------------------------- */

let usbPort: SerialPort | null = null;

function usbDeviceName(port: SerialPort): string {
  try {
    const info = port.getInfo();
    if (info.usbVendorId || info.usbProductId) {
      return `USB ${info.usbVendorId.toString(16).padStart(4, '0')}:${info.usbProductId.toString(16).padStart(4, '0')}`;
    }
  } catch {
    /* fall through */
  }
  return 'USB εκτυπωτής';
}

async function sendUsbWriter(chunks: Uint8Array[]): Promise<void> {
  if (!usbPort?.writable) throw new Error('Δεν υπάρχει ανοικτή USB σύνδεση');
  const writer = usbPort.writable.getWriter();
  try {
    for (const chunk of chunks) {
      await writer.write(chunk);
    }
    await writer.close(); // flush everything to the device
  } catch (e) {
    try {
      writer.releaseLock();
    } catch {
      /* already released */
    }
    throw e;
  }
}

export async function connectUsbPrinter(): Promise<void> {
  if (!printerSupport.usb) {
    publish({ status: 'error', message: 'Το Web Serial δεν υποστηρίζεται σε αυτό το πρόγραμμα περιήγησης (χρειάζεται Chrome/Edge desktop).' });
    return;
  }
  publish({ status: 'connecting' });
  try {
    if (usbPort) {
      try {
        await usbPort.close();
      } catch {
        /* ignore */
      }
      usbPort = null;
    }
    const port = await navigator.serial!.requestPort();
    const prefs = getPrinterPrefs();
    await port.open({ baudRate: prefs.baudRate ?? 9600 });
    usbPort = port;
    const name = usbDeviceName(port);
    active = {
      kind: 'usb',
      name,
      send: sendUsbWriter,
      close: async () => {
        try {
          await usbPort?.close();
        } catch {
          /* ignore */
        }
        usbPort = null;
      },
    };
    const last: PrinterLastDevice = { kind: 'usb', name, baudRate: prefs.baudRate ?? 9600 };
    setPrinterPrefs({ mode: 'direct', lastDevice: last });
    publish({ status: 'connected', kind: 'usb', name });
  } catch (e) {
    publish({ status: 'error', message: describeError(e) });
  }
}

/* ------------------------------- BLE (Web Bluetooth) ------------------------------- */

let bleDevice: BluetoothDevice | null = null;
let bleChar: BluetoothRemoteGATTCharacteristic | null = null;

async function bleWrite(bytes: Uint8Array): Promise<void> {
  if (!bleChar) throw new Error('Δεν υπάρχει Bluetooth σύνδεση');
  for (const piece of splitForBle(bytes)) {
    const buf = piece.buffer.slice(piece.byteOffset, piece.byteOffset + piece.byteLength);
    try {
      await bleChar.writeValueWithoutResponse(buf);
    } catch {
      await bleChar.writeValue(buf);
    }
  }
}

function splitForBle(bytes: Uint8Array): Uint8Array[] {
  const chunks: Uint8Array[] = [];
  for (let i = 0; i < bytes.byteLength; i += BLE_WRITE_CHUNK) {
    chunks.push(bytes.slice(i, i + BLE_WRITE_CHUNK));
  }
  return chunks;
}

export async function connectBlePrinter(): Promise<void> {
  if (!printerSupport.ble) {
    publish({ status: 'error', message: 'Το Web Bluetooth δεν υποστηρίζεται σε αυτό το πρόγραμμα περιήγησης.' });
    return;
  }
  publish({ status: 'connecting' });
  try {
    if (bleDevice?.gatt?.connected) {
      bleDevice.gatt.disconnect();
    }
    bleDevice = null;
    bleChar = null;

    const prefs = getPrinterPrefs();
    const cfg = resolveBleConfig(prefs);
    const device = await navigator.bluetooth!.requestDevice({
      acceptAllDevices: true,
      optionalServices: [cfg.service],
    });
    const name = device.name ?? 'Bluetooth εκτυπωτής';
    const gatt = await device.gatt!.connect();
    const service = await gatt.getPrimaryService(cfg.service);
    const char = await service.getCharacteristic(cfg.char);
    bleDevice = device;
    bleChar = char;
    active = {
      kind: 'ble',
      name,
      send: async (chunks) => {
        for (const c of chunks) await bleWrite(c);
      },
      close: async () => {
        try {
          if (bleDevice?.gatt?.connected) bleDevice.gatt.disconnect();
        } catch {
          /* ignore */
        }
        bleDevice = null;
        bleChar = null;
      },
    };
    const last: PrinterLastDevice = {
      kind: 'ble',
      name,
      serviceUuid: cfg.service,
      charUuid: cfg.char,
    };
    setPrinterPrefs({ mode: 'direct', lastDevice: last });
    publish({ status: 'connected', kind: 'ble', name });
  } catch (e) {
    publish({ status: 'error', message: describeError(e) });
  }
}

/* ---------------------------------- shared ---------------------------------- */

export async function disconnectPrinter(): Promise<void> {
  try {
    await active?.close();
  } catch {
    /* ignore */
  }
  active = null;
  usbPort = null;
  bleDevice = null;
  bleChar = null;
  publish({ status: 'idle' });
}

/** Send ESC/POS chunks to the currently connected printer (no-op if not connected). */
export async function sendToActivePrinter(chunks: Uint8Array[]): Promise<void> {
  if (state.status !== 'connected' || !active) {
    throw new Error('Δεν υπάρχει ενεργή σύνδεση εκτυπωτή');
  }
  await active.send(chunks);
}

/** Best-effort restore of a previously connected USB printer (granted ports only). */
export async function tryRestorePrinter(): Promise<void> {
  const prefs = getPrinterPrefs();
  if (prefs.mode !== 'direct' || !prefs.lastDevice) return;
  const last = prefs.lastDevice;
  if (last.kind !== 'usb' || !printerSupport.usb) return;
  try {
    const ports = await navigator.serial!.getPorts();
    const port = ports.find((p) => {
      try {
        const info = p.getInfo();
        return info.usbVendorId || info.usbProductId;
      } catch {
        return false;
      }
    }) ?? ports[0];
    if (!port) return;
    await port.open({ baudRate: last.baudRate ?? 9600 });
    usbPort = port;
    const name = usbDeviceName(port);
    active = {
      kind: 'usb',
      name,
      send: sendUsbWriter,
      close: async () => {
        try {
          await usbPort?.close();
        } catch {
          /* ignore */
        }
        usbPort = null;
      },
    };
    publish({ status: 'connected', kind: 'usb', name });
  } catch {
    // Silent — user can connect manually from settings.
  }
}