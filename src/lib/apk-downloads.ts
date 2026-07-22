import { SITE_ORIGIN } from '@/lib/site';

/** Public GitHub Release assets for Android debug APKs. */
export const APK_RELEASE_TAG = 'mobile-apks-v1';

/** Bumped when `npm run mobile:apk` publishes a new build to the release. */
export const APK_BUILD_VERSION = '1.0.7220653';

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
  },
  driver: {
    id: 'driver' as const,
    title: 'Οδηγός',
    subtitle: 'Χάρτης, προσφορές & παραδόσεις',
    filename: 'fresh-driver-debug.apk',
    fileUrl: `${RELEASE_BASE}/fresh-driver-debug.apk`,
    sizeLabel: '~8.5 MB',
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
