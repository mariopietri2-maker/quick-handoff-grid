import type { CapacitorConfig } from '@capacitor/cli';

/** Offline driver shell — bundles `dist/` (no remote server URL). */
const config: CapacitorConfig = {
  appId: 'com.freshdelivery.driver',
  appName: 'fresh2go Driver',
  webDir: 'dist',
  server: {
    androidScheme: 'https',
    hostname: 'localhost',
    allowNavigation: [
      'https://freshdelivery.app/*',
      'https://www.fresh2go.gr/*',
      'https://fresh2go.gr/*',
      'https://ojkesspghyqmjmupybva.supabase.co/*',
      'https://*.supabase.co/*',
      'https://quick-handoff-grid-8qu8.vercel.app/*',
      'https://*.vercel.app/*',
      'https://quick-handoff-grid-production.up.railway.app/*',
      'https://api.mapbox.com/*',
    ],
  },
  android: {
    path: 'android-driver',
    backgroundColor: '#0f172a',
    webContentsDebuggingEnabled: process.env.CAPACITOR_DEV === '1',
  },
  ios: {
    path: 'ios-driver',
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
      launchShowDuration: 400,
      launchFadeOutDuration: 280,
    },
    Keyboard: {
      resize: 'body',
      resizeOnFullScreen: true,
    },
    Geolocation: {},
    BackgroundGeolocation: {
      notificationTitle: 'Διαθέσιμος',
      notificationText: 'Είσαι συνδεδεμένος και σε θέση να δεχτείς παραγγελίες',
    },
    PushNotifications: {
      presentationOptions: ['badge', 'alert'],
    },
  },
};

export default config;
