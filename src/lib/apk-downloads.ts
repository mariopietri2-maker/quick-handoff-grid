/** Central APK download URLs + version stamps for the web download page / QR codes. */
export const APK_BUILD_VERSION = '1.0.7232800';
export const APK_NATIVE_DRIVER_VERSION = '2.6.0-native';

/** Native Kotlin/Compose customer (Uber Eats–style UI). */
export const APK_NATIVE_CUSTOMER_VERSION = '2.7.1-native';

const RELEASE_BASE =
  'https://github.com/mariopietri2-maker/quick-handoff-grid/releases/download/mobile-apks-v1';

export const APK_URLS = {
  customerCapacitor: `${RELEASE_BASE}/fresh-customer-debug.apk`,
  driverCapacitor: `${RELEASE_BASE}/fresh-driver-debug.apk`,
  customerNative: `${RELEASE_BASE}/fresh-customer-native-debug.apk`,
  driverNative: `${RELEASE_BASE}/fresh-driver-native-debug.apk`,
} as const;

export type ApkKind = keyof typeof APK_URLS;
