import type { CapacitorConfig } from '@capacitor/cli';

/** Set CAPACITOR_DEV=1 for local web debugging / cleartext. */
const isDev = process.env.CAPACITOR_DEV === '1';

const config: CapacitorConfig = {
  appId: 'com.freshdelivery.customer',
  appName: 'Fresh',
  webDir: 'dist',
  server: {
    url: 'https://quick-handoff-grid-8qu8.vercel.app',
    cleartext: isDev,
    androidScheme: 'https',
    allowNavigation: [
      'https://quick-handoff-grid-8qu8.vercel.app/*',
      'https://freshdelivery.app/*',
      'https://*.vercel.app/*',
      'https://ojkesspghyqmjmupybva.supabase.co/*',
      'https://*.supabase.co/*',
      'https://api.mapbox.com/*',
    ],
  },
  android: {
    backgroundColor: '#F2F8F4',
    webContentsDebuggingEnabled: isDev,
    allowMixedContent: isDev,
  },
  ios: {
    backgroundColor: '#F2F8F4',
    contentInset: 'never',
    scrollEnabled: false,
  },
  plugins: {
    CapacitorHttp: { enabled: true },
    StatusBar: {
      style: 'DARK',
      backgroundColor: '#F2F8F4',
      overlaysWebView: true,
    },
    SplashScreen: {
      backgroundColor: '#0FB876',
    },
  },
};

export default config;
