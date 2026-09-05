import { SITE_ORIGIN } from '@/lib/site';

/** Public GitHub Release assets for Android debug APKs. */
export const APK_RELEASE_TAG = 'mobile-apks-v1';

/** Bumped when `npm run mobile:apk` publishes a new Capacitor build to the release.
 *  Source of truth for /download AND dist/native-versions.json (self-update
 *  channel polled by sideloaded native apps — stamped by run-vite-build.mjs). */
export const APK_BUILD_VERSION = '1.0.9051235';

/** Native Kotlin/Compose driver (replaces Capacitor driver when installed). */
export const APK_NATIVE_DRIVER_VERSION = '2.6.15-native';

/** Native Kotlin/Compose customer. */
export const APK_NATIVE_CUSTOMER_VERSION = '2.7.3-native';

const RELEASE_BASE =
  'https://github.com/mariopietri2-maker/quick-handoff-grid/releases/download/mobile-apks-v1';

export { SITE_ORIGIN };

/** Latest native builds listed first. */
export const APK_DOWNLOADS = {
  driverNative: {
    id: 'driverNative' as const,
    title: 'Οδηγός Native',
    subtitle: 'Kotlin + Compose · Mapbox · FCM · background ring',
    filename: 'fresh2go-driver-native-debug.apk',
    fileUrl: `${RELEASE_BASE}/fresh2go-driver-native-debug.apk`,
    sizeLabel: '~87 MB',
    versionLabel: APK_NATIVE_DRIVER_VERSION,
    badge: 'Native',
  },
  customerNative: {
    id: 'customerNative' as const,
    title: 'Πελάτης Native',
    subtitle: 'Καλάθι · Mapbox · FCM',
    filename: 'fresh2go-customer-native-debug.apk',
    fileUrl: `${RELEASE_BASE}/fresh2go-customer-native-debug.apk`,
    sizeLabel: '~21 MB',
    versionLabel: APK_NATIVE_CUSTOMER_VERSION,
    badge: 'Native',
  },
  driver: {
    id: 'driver' as const,
    title: 'Οδηγός',
    subtitle: 'Capacitor · χάρτης, προσφορές & παραδόσεις',
    filename: 'fresh2go-driver-debug.apk',
    fileUrl: `${RELEASE_BASE}/fresh2go-driver-debug.apk`,
    sizeLabel: '~8.5 MB',
    versionLabel: APK_BUILD_VERSION,
    badge: null as string | null,
  },
  customer: {
    id: 'customer' as const,
    title: 'Πελάτης',
    subtitle: 'Capacitor · παραγγελίες & παρακολούθηση',
    filename: 'fresh2go-customer-debug.apk',
    /** Direct file URL — never put this in an <a href> on page load (Android auto-downloads). */
    fileUrl: `${RELEASE_BASE}/fresh2go-customer-debug.apk`,
    sizeLabel: '~8.5 MB',
    versionLabel: APK_BUILD_VERSION,
    badge: null as string | null,
  },
} as const;

export type ApkFlavor = keyof typeof APK_DOWNLOADS;

/** Landing URL encoded into QR codes (opens chooser page, does not start a download). */
export function apkLandingUrl(flavor: ApkFlavor, origin: string = SITE_ORIGIN): string {
  return `${origin.replace(/\/$/, '')}/download?app=${flavor}`;
}

/** Cache-bust so Android/Chrome does not reuse a half-finished download. */
export function apkFileUrl(flavor: ApkFlavor): string {
  const apk = APK_DOWNLOADS[flavor];
  const v = encodeURIComponent(apk.versionLabel || String(Date.now()));
  const sep = apk.fileUrl.includes('?') ? '&' : '?';
  return `${apk.fileUrl}${sep}v=${v}`;
}

/**
 * Start an APK download only after an explicit user gesture.
 * On mobile, navigate in the same tab — target=_blank often leaves the
 * system download stuck at 100% / "opening" without install.
 */
export function startApkDownload(flavor: ApkFlavor) {
  const url = apkFileUrl(flavor);
  const isMobile = typeof navigator !== 'undefined' &&
    /Android|iPhone|iPad|Mobile/i.test(navigator.userAgent);

  if (isMobile) {
    window.location.assign(url);
    return;
  }

  const a = document.createElement('a');
  a.href = url;
  a.rel = 'noopener noreferrer';
  a.target = '_blank';
  document.body.appendChild(a);
  a.click();
  a.remove();
}

export function resolveApkFlavor(raw: string | null | undefined): ApkFlavor | null {
  if (!raw) return null;
  const v = raw.trim().toLowerCase();
  if (v === 'customer') return 'customer';
  if (v === 'driver') return 'driver';
  if (v === 'customernative' || v === 'customer-native' || v === 'native-customer') return 'customerNative';
  if (v === 'drivernative' || v === 'driver-native' || v === 'native-driver') return 'driverNative';
  if (raw === 'customer-native' || raw === 'native-customer') return 'customerNative';
  return null;
}
