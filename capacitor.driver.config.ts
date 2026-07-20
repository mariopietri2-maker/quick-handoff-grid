import type { CapacitorConfig } from '@capacitor/cli';

/** Offline driver shell — bundles `dist/` (no remote server URL). */
const config: CapacitorConfig = {
  appId: 'com.freshdelivery.driver',
  appName: 'Fresh Driver',
  webDir: 'dist',
  android: {
    path: 'android-driver',
    backgroundColor: '#0f172a',
    webContentsDebuggingEnabled: true,
  },
  ios: {
    path: 'ios-driver',
    backgroundColor: '#0f172a',
    contentInset: 'never',
    scrollEnabled: false,
  },
  plugins: {
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
