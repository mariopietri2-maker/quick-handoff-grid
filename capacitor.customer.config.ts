import type { CapacitorConfig } from '@capacitor/cli';

/** Customer mobile app — orders, tracking, checkout */
const config: CapacitorConfig = {
  appId: 'com.freshdelivery.customer',
  appName: 'Fresh Customer',
  webDir: 'dist',
  server: {
    url: 'https://quick-handoff-grid.vercel.app/order',
    cleartext: false,
  },
  android: {
    path: 'android-customer',
    backgroundColor: '#1a1a2e',
    webContentsDebuggingEnabled: true,
  },
  ios: {
    path: 'ios-customer',
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
