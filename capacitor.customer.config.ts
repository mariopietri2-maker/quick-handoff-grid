import type { CapacitorConfig } from '@capacitor/cli';

/** Offline customer shell — bundles `dist/` (no remote server URL). */
const config: CapacitorConfig = {
  appId: 'com.freshdelivery.customer',
  appName: 'Fresh Customer',
  webDir: 'dist',
  server: {
    androidScheme: 'https',
    hostname: 'localhost',
    allowNavigation: [
      'https://ojkesspghyqmjmupybva.supabase.co/*',
      'https://*.supabase.co/*',
      'https://quick-handoff-grid-production.up.railway.app/*',
      'https://api.mapbox.com/*',
    ],
  },
  android: {
    path: 'android-customer',
    backgroundColor: '#0f172a',
    // Enable only for local debug APKs; store builds omit this via build-store-aabs.sh
    webContentsDebuggingEnabled: process.env.CAPACITOR_DEV === '1',
  },
  ios: {
    path: 'ios-customer',
    backgroundColor: '#0f172a',
    contentInset: 'never',
    scrollEnabled: false,
  },
  plugins: {
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
    PushNotifications: {
      presentationOptions: ['badge', 'sound', 'alert'],
    },
    Geolocation: {},
    BackgroundGeolocation: {
      notificationTitle: 'Fresh Customer — τοποθεσία',
      notificationText: 'Ζωντανή παρακολούθηση παραγγελίας',
    },
  },
};

export default config;
