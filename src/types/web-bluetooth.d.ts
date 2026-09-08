// Minimal ambient types for the Web Bluetooth API (not included in lib.dom as of TS 5.8).
// Covers only what the store printer layer uses.

type BluetoothServiceUUID = string | number;
type BluetoothCharacteristicUUID = string | number;

interface BluetoothRequestDeviceFilter {
  services?: BluetoothServiceUUID[];
  name?: string;
  namePrefix?: string;
}

interface RequestDeviceOptions {
  filters?: BluetoothRequestDeviceFilter[];
  acceptAllDevices?: boolean;
  optionalServices?: BluetoothServiceUUID[];
}

interface BluetoothRemoteGATTCharacteristic {
  readonly uuid: string;
  writeValue(value: BufferSource): Promise<void>;
  writeValueWithoutResponse(value: BufferSource): Promise<void>;
}

interface BluetoothRemoteGATTService {
  getCharacteristic(characteristic: BluetoothCharacteristicUUID): Promise<BluetoothRemoteGATTCharacteristic>;
}

interface BluetoothRemoteGATTServer {
  readonly connected: boolean;
  connect(): Promise<BluetoothRemoteGATTServer>;
  disconnect(): void;
  getPrimaryService(service: BluetoothServiceUUID): Promise<BluetoothRemoteGATTService>;
}

interface BluetoothDevice {
  readonly name?: string;
  readonly gatt: BluetoothRemoteGATTServer | null;
}

interface Bluetooth {
  requestDevice(options?: RequestDeviceOptions): Promise<BluetoothDevice>;
}

interface Navigator {
  bluetooth?: Bluetooth;
}