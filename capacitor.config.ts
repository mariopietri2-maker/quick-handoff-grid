import type { CapacitorConfig } from '@capacitor/cli';

/** Set CAPACITOR_DEV=1 for local web debugging / cleartext. */
const isDev = process.env.CAPACITOR_DEV === '1';

const config: CapacitorConfig = {
  appId: 'com.freshdelivery.customer',
  appName: 'fresh2go',
  webDir: 'dist',
  server: {
    // Primary host is Railway (freshdelivery.app); Vercel kept as fallback.
    url: 'https://fresh2go.gr/order',
    // Always open customer shell — never marketing Index at /
    cleartext: isDev,
    androidScheme: 'https',
    allowNavigation: [
      'https://fresh2go.gr/*',
      'https://quick-handoff-grid-8qu8.vercel.app/*',
      'https://freshdelivery.app/*',
      'https://*.vercel.app/*',
      'https://ojkesspghyqmjmupybva.supabase.co/*',
      'https://*.supabase.co/*',
      'https://api.mapbox.com/*',
    ],
  },
  android: {
    /* Cream = the customer shell's first paint (src/index.css --c-bg / #fff7ec),
       so splash -> status bar -> webview is one seamless surface. */
    backgroundColor: '#fff7ec',
    webContentsDebuggingEnabled: isDev,
    allowMixedContent: isDev,
  },
  ios: {
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
  },
};

export default config;
