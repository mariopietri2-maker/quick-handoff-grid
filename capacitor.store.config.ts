import type { CapacitorConfig } from '@capacitor/cli';

/**
 * Store owner beta APK — loads the live Store PWA at /store on Railway (primary host).
 */
const config: CapacitorConfig = {
  appId: 'com.freshdelivery.store',
  appName: 'Fresh Meal Store',
  webDir: 'dist',
  server: {
    url: 'https://freshdelivery.app/store',
    cleartext: false,
    androidScheme: 'https',
    allowNavigation: [
      'https://quick-handoff-grid-8qu8.vercel.app/*',
      'https://*.vercel.app/*',
      'https://quick-handoff-grid-production.up.railway.app/*',
      'https://freshdelivery.app/*',
      'https://ojkesspghyqmjmupybva.supabase.co/*',
      'https://*.supabase.co/*',
      'https://api.mapbox.com/*',
      'https://js.stripe.com/*',
      'https://*.stripe.com/*',
    ],
  },
  android: {
    path: 'android-store',
    backgroundColor: '#1B4BA0',
    webContentsDebuggingEnabled: true,
  },
  plugins: {
    CapacitorHttp: { enabled: true },
    StatusBar: {
      style: 'LIGHT',
      backgroundColor: '#1B4BA0',
      overlaysWebView: true,
    },
    SplashScreen: {
      backgroundColor: '#1B4BA0',
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
  },
};

export default config;
