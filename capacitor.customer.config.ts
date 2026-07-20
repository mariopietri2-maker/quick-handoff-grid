import type { CapacitorConfig } from '@capacitor/cli';

/** Offline customer shell — bundles `dist/` (no remote server URL). */
const config: CapacitorConfig = {
  appId: 'com.freshdelivery.customer',
  appName: 'Fresh Customer',
  webDir: 'dist',
  android: {
    path: 'android-customer',
    backgroundColor: '#0f172a',
    webContentsDebuggingEnabled: true,
  },
  ios: {
    path: 'ios-customer',
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
  },
};

export default config;
