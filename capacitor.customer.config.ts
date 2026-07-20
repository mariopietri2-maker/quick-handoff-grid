import type { CapacitorConfig } from '@capacitor/cli';

/**
 * Customer mobile app — orders, tracking, checkout.
 * Bundled by default (loads local `dist/`). For live WebView mode, set:
 *   CAP_LIVE_URL=https://quick-handoff-grid.vercel.app/order
 */
const liveUrl = process.env.CAP_LIVE_URL;

const config: CapacitorConfig = {
  appId: 'com.freshdelivery.customer',
  appName: 'Fresh Customer',
  webDir: 'dist',
  ...(liveUrl
    ? { server: { url: liveUrl, cleartext: false } }
    : {}),
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
