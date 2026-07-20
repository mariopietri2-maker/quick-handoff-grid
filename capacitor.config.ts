/**
 * Default / shared Capacitor config.
 * Prefer flavor configs for store builds:
 *   - capacitor.customer.config.ts  → npm run mobile:customer:sync
 *   - capacitor.driver.config.ts    → npm run mobile:driver:sync
 */
import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.freshdelivery.app',
  appName: 'Fresh Delivery',
  webDir: 'dist',
  android: {
    backgroundColor: '#0f172a',
    webContentsDebuggingEnabled: true,
    allowMixedContent: false,
  },
  ios: {
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
    },
  },
};

export default config;
