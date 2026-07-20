/** Public GitHub Release assets for Android debug APKs. */
export const APK_RELEASE_TAG = 'mobile-apks-v1';

const RELEASE_BASE =
  'https://github.com/mariopietri2-maker/quick-handoff-grid/releases/download/mobile-apks-v1';

export const APK_DOWNLOADS = {
  customer: {
    id: 'customer' as const,
    title: 'Πελάτης',
    subtitle: 'Παραγγελίες & παρακολούθηση',
    filename: 'fresh-customer-debug.apk',
    url: `${RELEASE_BASE}/fresh-customer-debug.apk`,
    sizeLabel: '~7.6 MB',
  },
  driver: {
    id: 'driver' as const,
    title: 'Οδηγός',
    subtitle: 'Χάρτης, προσφορές & παραδόσεις',
    filename: 'fresh-driver-debug.apk',
    url: `${RELEASE_BASE}/fresh-driver-debug.apk`,
    sizeLabel: '~7.6 MB',
  },
} as const;

export type ApkFlavor = keyof typeof APK_DOWNLOADS;
