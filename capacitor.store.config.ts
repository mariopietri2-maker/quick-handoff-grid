import type { CapacitorConfig } from '@capacitor/cli';

/** Set CAPACITOR_DEV=1 for local web debugging / cleartext. */
const isDev = process.env.CAPACITOR_DEV === '1';

const config: CapacitorConfig = {
  appId: 'com.freshdelivery.store',
  appName: 'fresh2go Store',
  webDir: 'dist',
  server: {
    // Store panel lives under /store on the same Railway host.
    url: 'https://freshdelivery.app/store',
    cleartext: isDev,
    androidScheme: 'https',
    allowNavigation: [
      'https://quick-handoff-grid-8qu8.vercel.app/*',
      'https://*.vercel.app/*',
      'https://freshdelivery.app/*',
      'https://www.fresh2go.gr/*',
      'https://fresh2go.gr/*',
      'https://ojkesspghyqmjmupybva.supabase.co/*',
      'https://*.supabase.co/*',
      'https://api.mapbox.com/*',
    ],
  },
  android: {
    backgroundColor: '#0B1220',
    webContentsDebuggingEnabled: isDev,
    allowMixedContent: isDev,
  },
  ios: {
    backgroundColor: '#0B1220',
    contentInset: 'never',
    scrollEnabled: true,
  },
  plugins: {
    CapacitorHttp: { enabled: true },
    StatusBar: {
      style: 'LIGHT',
      backgroundColor: '#0B1220',
      overlaysWebView: false,
    },
    SplashScreen: {
      backgroundColor: '#0B1220',
    },
  },
};

export default config;
