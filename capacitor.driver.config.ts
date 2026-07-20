import type { CapacitorConfig } from '@capacitor/cli';

/** Driver mobile app — offers, navigation, delivery handoff */
const config: CapacitorConfig = {
  appId: 'com.freshdelivery.driver',
  appName: 'Fresh Driver',
  webDir: 'dist',
  server: {
    url: 'https://quick-handoff-grid.vercel.app/driver',
    cleartext: false,
  },
  android: {
    path: 'android-driver',
    backgroundColor: '#1a1a2e',
    webContentsDebuggingEnabled: true,
  },
  ios: {
    path: 'ios-driver',
    backgroundColor: '#1a1a2e',
    contentInset: 'never',
    scrollEnabled: false,
  },
  plugins: {
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
