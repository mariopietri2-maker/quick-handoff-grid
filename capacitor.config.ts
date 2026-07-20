import type { CapacitorConfig } from '@capacitor/cli';

/**
 * Default / shared Capacitor config.
 * Prefer flavor configs for store builds:
 *   - capacitor.customer.config.ts
 *   - capacitor.driver.config.ts
 */
const config: CapacitorConfig = {
  appId: 'com.freshdelivery.app',
  appName: 'Fresh Delivery',
  webDir: 'dist',
  server: {
    // Load the live SPA so native shells stay in sync with Vercel deploys.
    // For offline/store builds, remove `server` and ship the bundled `dist/`.
    url: 'https://quick-handoff-grid.vercel.app',
    cleartext: false,
  },
  android: {
    backgroundColor: '#1a1a2e',
    webContentsDebuggingEnabled: true,
    allowMixedContent: false,
  },
  ios: {
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
