import type { CapacitorConfig } from '@capacitor/cli';

/** Set CAPACITOR_DEV=1 for local web debugging / cleartext. */
const isDev = process.env.CAPACITOR_DEV === '1';

const config: CapacitorConfig = {
  appId: 'com.freshdelivery.customer',
  appName: 'fresh2go',
  webDir: 'dist',
  server: {
    // Primary host is Railway (freshdelivery.app); Vercel kept as fallback.
    url: 'https://fresh2go.gr',
    cleartext: isDev,
    androidScheme: 'https',
    allowNavigation: [
      'https://fresh2go.gr/*',
      'https://quick-handoff-grid-8qu8.vercel.app/*',
      'https://freshdelivery.app/*',
      'https://*.vercel.app/*',
      'https://ojkesspghyqmjmupybva.supabase.co/*',
      'https://*.supabase.co/*',
      'https://api.mapbox.com/*',
    ],
  },
  android: {
    backgroundColor: '#F2F7FF',
    webContentsDebuggingEnabled: isDev,
    allowMixedContent: isDev,
  },
  ios: {
    backgroundColor: '#F2F7FF',
    contentInset: 'never',
    scrollEnabled: false,
  },
  plugins: {
    CapacitorHttp: { enabled: true },
    StatusBar: {
      style: 'DARK',
      backgroundColor: '#F2F7FF',
      overlaysWebView: true,
    },
    SplashScreen: {
      backgroundColor: '#1B4BA0',
    },
  },
};

export default config;
