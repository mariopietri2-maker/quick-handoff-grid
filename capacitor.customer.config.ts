import type { CapacitorConfig } from '@capacitor/cli';

/** Offline customer shell — bundles `dist/` (no remote server URL). */
const config: CapacitorConfig = {
  appId: 'com.freshdelivery.customer',
  appName: 'fresh2go',
  webDir: 'dist',
  server: {
    androidScheme: 'https',
    hostname: 'localhost',
    allowNavigation: [
      'https://fresh2go.gr/*',
      'https://freshdelivery.app/*',
      'https://ojkesspghyqmjmupybva.supabase.co/*',
      'https://*.supabase.co/*',
      'https://quick-handoff-grid-8qu8.vercel.app/*',
      'https://*.vercel.app/*',
      'https://quick-handoff-grid-production.up.railway.app/*',
      'https://api.mapbox.com/*',
    ],
  },
  android: {
    path: 'android-customer',
    backgroundColor: '#fff7ec',
    webContentsDebuggingEnabled: process.env.CAPACITOR_DEV === '1',
  },
  ios: {
    path: 'ios-customer',
    backgroundColor: '#fff7ec',
    contentInset: 'never',
    scrollEnabled: false,
  },
  plugins: {
    CapacitorHttp: { enabled: true },
    StatusBar: {
      style: 'DARK',
      backgroundColor: '#fff7ec',
      overlaysWebView: true,
    },
    SplashScreen: {
      backgroundColor: '#fff7ec',
      launchAutoHide: true,
      launchShowDuration: 400,
      launchFadeOutDuration: 280,
    },
    Keyboard: {
      resize: 'body',
      resizeOnFullScreen: true,
    },
    PushNotifications: {
      presentationOptions: ['badge', 'sound', 'alert'],
    },
    Geolocation: {},
    BackgroundGeolocation: {
      notificationTitle: 'fresh2go — τοποθεσία',
      notificationText: 'Ζωντανή παρακολούθηση παραγγελίας',
    },
  },
};

export default config;
