import type { CapacitorConfig } from '@capacitor/cli';

/**
 * Driver mobile app — offers, navigation, delivery handoff.
 * Bundled by default (loads local `dist/`). For live WebView mode, set:
 *   CAP_LIVE_URL=https://quick-handoff-grid.vercel.app/driver
 */
const liveUrl = process.env.CAP_LIVE_URL;

const config: CapacitorConfig = {
  appId: 'com.freshdelivery.driver',
  appName: 'Fresh Driver',
  webDir: 'dist',
  ...(liveUrl
    ? { server: { url: liveUrl, cleartext: false } }
    : {}),
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
    Geolocation: {
      // Request precise location for dispatch matching
    },
  },
};

export default config;
