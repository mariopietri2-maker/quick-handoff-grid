import { Capacitor } from '@capacitor/core';
import { App } from '@capacitor/app';

/** Sync class markers so native CSS applies before first paint. */
export function markNativeDocument() {
  if (!Capacitor.isNativePlatform()) return;
  const root = document.documentElement;
  root.classList.add('is-native');
  const platform = Capacitor.getPlatform();
  if (platform === 'android') root.classList.add('is-android');
  if (platform === 'ios') root.classList.add('is-ios');
}

async function hideSplash() {
  try {
    const { SplashScreen } = await import('@capacitor/splash-screen');
    await SplashScreen.hide({ fadeOutDuration: 280 });
  } catch {
    /* plugin optional / already hidden */
  }
}

async function initKeyboard() {
  try {
    const { Keyboard, KeyboardResize } = await import('@capacitor/keyboard');
    await Keyboard.setResizeMode({ mode: KeyboardResize.Body });
    await Keyboard.setScroll({ isDisabled: false });
    // Keep accessory bar on iOS so "Done" is available.
    if (Capacitor.getPlatform() === 'ios') {
      await Keyboard.setAccessoryBarVisible({ isVisible: true });
    }
  } catch {
    /* ignore */
  }
}

/**
 * Android system back:
 * - pop in-app history when possible
 * - minimize on root customer/driver homes
 */
export function initNativeBackButton() {
  if (!Capacitor.isNativePlatform()) return () => {};

  const rootPaths = new Set(['/', '/order', '/driver', '/auth']);

  const sub = App.addListener('backButton', ({ canGoBack }) => {
    try {
      const path = window.location.pathname;
      const atRoot = rootPaths.has(path) || path === '/order/' || path === '/driver/';
      if (!atRoot && (canGoBack || window.history.length > 1)) {
        window.history.back();
        return;
      }
      void App.minimizeApp().catch(() => {
        void App.exitApp();
      });
    } catch {
      void App.minimizeApp().catch(() => {});
    }
  });

  return () => {
    void sub.then((h) => h.remove());
  };
}

/** Boot native chrome: classes, splash, keyboard, back. Status bar is separate. */
export async function initNativeShell() {
  markNativeDocument();
  if (!Capacitor.isNativePlatform()) return () => {};

  await Promise.all([hideSplash(), initKeyboard()]);
  return initNativeBackButton();
}
