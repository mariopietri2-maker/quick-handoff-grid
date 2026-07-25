import { SITE_ORIGIN } from '@/lib/site';

/** Public GitHub Release assets for Android debug APKs. */
export const APK_RELEASE_TAG = 'mobile-apks-v1';

/** Bumped when `npm run mobile:apk` publishes a new Capacitor build to the release. */
export const APK_BUILD_VERSION = '1.0.7232800';

/** Native Kotlin/Compose driver (replaces Capacitor driver when installed). */
export const APK_NATIVE_DRIVER_VERSION = '2.0.0-native';

const RELEASE_BASE =
  'https://github.com/mariopietri2-maker/quick-handoff-grid/releases/download/mobile-apks-v1';

export { SITE_ORIGIN };

export const APK_DOWNLOADS = {
  customer: {
    id: 'customer' as const,
    title: 'Πελάτης',
    subtitle: 'Παραγγελίες & παρακολούθηση',
    filename: 'fresh-customer-debug.apk',
    /** Direct file URL — never put this in an <a href> on page load (Android auto-downloads). */
    fileUrl: `${RELEASE_BASE}/fresh-customer-debug.apk`,
    sizeLabel: '~8.5 MB',
    versionLabel: APK_BUILD_VERSION,
    badge: null as string | null,
  },
  driver: {
    id: 'driver' as const,
    title: 'Οδηγός',
    subtitle: 'Capacitor · χάρτης, προσφορές & παραδόσεις',
    filename: 'fresh-driver-debug.apk',
    fileUrl: `${RELEASE_BASE}/fresh-driver-debug.apk`,
    sizeLabel: '~8.5 MB',
    versionLabel: APK_BUILD_VERSION,
    badge: null as string | null,
  },
  driverNative: {
    id: 'driverNative' as const,
    title: 'Οδηγός Native',
    subtitle: 'Kotlin + Compose · ίδια ροή με Capacitor',
    filename: 'fresh-driver-native-debug.apk',
    fileUrl: `${RELEASE_BASE}/fresh-driver-native-debug.apk`,
    sizeLabel: '~21 MB',
    versionLabel: APK_NATIVE_DRIVER_VERSION,
    badge: 'Native',
  },
} as const;

export type ApkFlavor = keyof typeof APK_DOWNLOADS;

/** Landing URL encoded into QR codes (opens chooser page, does not start a download). */
export function apkLandingUrl(flavor: ApkFlavor, origin = SITE_ORIGIN): string {
  return `${origin.replace(/\/$/, '')}/download?app=${flavor}`;
}

/** Start an APK download only after an explicit user gesture. */
export function startApkDownload(flavor: ApkFlavor) {
  const apk = APK_DOWNLOADS[flavor];
  const a = document.createElement('a');
  a.href = apk.fileUrl;
  a.rel = 'noopener noreferrer';
  a.target = '_blank';
  // Do NOT set download= — cross-origin APKs ignore it and some browsers
  // treat download+apk href as an immediate install prompt.
  document.body.appendChild(a);
  a.click();
  a.remove();
}

/** Parse `?app=` query — accepts legacy aliases. */
export function parseApkFocus(raw: string | null): ApkFlavor | null {
  if (!raw) return null;
  if (raw === 'customer' || raw === 'driver' || raw === 'driverNative') return raw;
  if (raw === 'driver-native' || raw === 'native' || raw === 'native-driver') return 'driverNative';
  return null;
}
