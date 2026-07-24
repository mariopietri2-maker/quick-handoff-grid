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
      'https://quick-handoff-grid-production.up.railway.app/*',
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
      launchShowDuration: 400,
      launchFadeOutDuration: 280,
    },
    Keyboard: {
      resize: 'body',
      resizeOnFullScreen: true,
    },
    Geolocation: {},
    BackgroundGeolocation: {
      // Shown on the Android FG-service notification while the driver is online.
      // Runtime copy is set in useDriverLocation via start() — keep in sync.
      notificationTitle: 'Διαθέσιμος',
      notificationText: 'Είσαι συνδεδεμένος και σε θέση να δεχτείς παραγγελίες',
    },
    PushNotifications: {
      presentationOptions: ['badge', 'sound', 'alert'],
    },
  },
};

export default config;
