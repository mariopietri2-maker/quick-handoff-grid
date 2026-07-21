import type { CapacitorConfig } from '@capacitor/cli';

/** Offline driver shell — bundles `dist/` (no remote server URL). */
const config: CapacitorConfig = {
  appId: 'com.freshdelivery.driver',
  appName: 'Fresh Driver',
  webDir: 'dist',
  server: {
    androidScheme: 'https',
    hostname: 'localhost',
    allowNavigation: [
      'https://ojkesspghyqmjmupybva.supabase.co/*',
      'https://*.supabase.co/*',
      'https://quick-handoff-grid.vercel.app/*',
      'https://api.mapbox.com/*',
    ],
  },
  android: {
    path: 'android-driver',
    backgroundColor: '#0f172a',
    // Enable only for local debug APKs; store builds omit this via build-store-aabs.sh
    webContentsDebuggingEnabled: process.env.CAPACITOR_DEV === '1',
  },
  ios: {
    path: 'ios-driver',
    backgroundColor: '#0f172a',
    contentInset: 'never',
    scrollEnabled: false,
  },
  plugins: {
    // Route fetch/XHR through native HTTP — fixes "Failed to fetch" login in WebView
    CapacitorHttp: { enabled: true },
    StatusBar: {
      style: 'DARK',
      backgroundColor: '#0f172a',
      overlaysWebView: true,
    },
    SplashScreen: {
      backgroundColor: '#0f172a',
      launchAutoHide: true,
    },
    Geolocation: {},
  },
};

export default config;
