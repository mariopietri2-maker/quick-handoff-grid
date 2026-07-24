import { Capacitor } from '@capacitor/core';
import { StatusBar, Style } from '@capacitor/status-bar';
import { markNativeDocument } from '@/lib/native-shell';

export async function initNativeStatusBar() {
  markNativeDocument();
  if (!Capacitor.isNativePlatform()) return;

  try {
    // Make WebView draw behind status bar for true full-screen
    await StatusBar.setOverlaysWebView({ overlay: true });
    await StatusBar.setBackgroundColor({ color: '#00000000' });
    // Light content (white icons) — both apps use dark/branded headers.
    await StatusBar.setStyle({ style: Style.Dark });
    await StatusBar.show();
  } catch {
    // Ignore native status bar setup failures.
  }
}
