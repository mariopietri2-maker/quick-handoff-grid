// Minimal ambient types for the Web Serial API (not included in lib.dom as of TS 5.8).
// Covers only what the store printer layer uses.

interface SerialPortInfo {
  usbVendorId?: number;
  usbProductId?: number;
}

interface SerialPort {
  readonly readable: ReadableStream<Uint8Array> | null;
  readonly writable: WritableStream<Uint8Array> | null;
  open(options: { baudRate: number }): Promise<void>;
  close(): Promise<void>;
  getInfo(): SerialPortInfo;
  forget(): Promise<void>;
  onconnect: ((this: SerialPort, ev: Event) => unknown) | null;
  ondisconnect: ((this: SerialPort, ev: Event) => unknown) | null;
}

interface SerialPortRequestOptions {
  filters?: SerialPortFilter[];
}

interface SerialPortFilter {
  usbVendorId?: number;
  usbProductId?: number;
}

interface SerialPortOptions {
  baudRate: number;
}

interface Serial {
  getPorts(): Promise<SerialPort[]>;
  requestPort(options?: SerialPortRequestOptions): Promise<SerialPort>;
}

interface Navigator {
  serial?: Serial;
}