import type { CapacitorConfig } from '@capacitor/cli';

/** Set CAPACITOR_DEV=1 for local web debugging / cleartext. */
const isDev = process.env.CAPACITOR_DEV === '1';

const config: CapacitorConfig = {
  // Matches native-customer applicationId (see native-customer/app/build.gradle.kts)
  appId: 'com.freshdelivery.customer',
  appName: 'Fresh',
  webDir: 'dist',
  server: {
    url: 'https://quick-handoff-grid-production.up.railway.app',
    cleartext: isDev,
    androidScheme: 'https',
    allowNavigation: [
      'https://freshdelivery.app/*',
      'https://ojkesspghyqmjmupybva.supabase.co/*',
      'https://*.supabase.co/*',
      'https://quick-handoff-grid-production.up.railway.app/*',
      'https://fresh-delivery-rho.vercel.app/*',
      'https://api.mapbox.com/*',
    ],
  },
  android: {
    // Emerald v2 brand (native-customer Theme.kt): mint bg, emerald primary
    backgroundColor: '#F2F8F4',
    // Debug APKs only — release builds must keep these false
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
