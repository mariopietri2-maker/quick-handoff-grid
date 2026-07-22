import type { CapacitorConfig } from '@capacitor/cli';

/** Set CAPACITOR_DEV=1 for local web debugging / cleartext. */
const isDev = process.env.CAPACITOR_DEV === '1';

const config: CapacitorConfig = {
  appId: 'app.lovable.a8538a5288f34701a1b9d56a6120ba4c',
  appName: 'Fresh Delivery',
  webDir: 'dist',
  server: {
    url: 'https://quick-handoff-grid-production.up.railway.app',
    cleartext: isDev,
    androidScheme: 'https',
    allowNavigation: [
      'https://ojkesspghyqmjmupybva.supabase.co/*',
      'https://*.supabase.co/*',
      'https://quick-handoff-grid-production.up.railway.app/*',
      'https://api.mapbox.com/*',
    ],
  },
  android: {
    backgroundColor: '#1a1a2e',
    // Debug APKs only — release builds must keep these false
    webContentsDebuggingEnabled: isDev,
    allowMixedContent: isDev,
  },
  ios: {
    backgroundColor: '#1a1a2e',
    contentInset: 'never',
    scrollEnabled: false,
  },
  plugins: {
    CapacitorHttp: { enabled: true },
    StatusBar: {
      style: 'DARK',
      backgroundColor: '#1a1a2e',
      overlaysWebView: true,
    },
    SplashScreen: {
      backgroundColor: '#1a1a2e',
    },
  },
};

export default config;
