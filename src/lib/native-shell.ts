import { Capacitor } from '@capacitor/core';
import { App } from '@capacitor/app';

function shouldForceCustomerHome(): boolean {
  try {
    if (Capacitor.isNativePlatform()) return true;
    if (typeof window !== 'undefined' && (window as unknown as { Capacitor?: unknown }).Capacitor) return true;
    const ua = typeof navigator !== 'undefined' ? navigator.userAgent || '' : '';
    if (/;\s*wv\)/i.test(ua)) return true;
  } catch {
    /* ignore */
  }
  return false;
}

export function markNativeDocument() {
  const shell = shouldForceCustomerHome();
  if (!shell && !Capacitor.isNativePlatform()) return;

  const root = document.documentElement;
  root.classList.add('is-native');
  try {
    const platform = Capacitor.getPlatform();
    if (platform === 'android') root.classList.add('is-android');
    if (platform === 'ios') root.classList.add('is-ios');
  } catch {
    root.classList.add('is-android');
  }

  try {
    const path = window.location.pathname || '/';
    if (path !== '/' && path !== '') return;
    if (!shell) return;
    const appId =
      (window as unknown as { Capacitor?: { getConfig?: () => { appId?: string } } }).Capacitor
        ?.getConfig?.()?.appId ?? '';
    const target = appId.includes('driver')
      ? '/driver'
      : appId.includes('store')
        ? '/store'
        : '/order';
    window.location.replace(target);
  } catch {
    /* ignore */
  }
}

async function hideSplash() {
  try {
    const { SplashScreen } = await import('@capacitor/splash-screen');
    await SplashScreen.hide({ fadeOutDuration: 280 });
  } catch {
    /* plugin optional */
  }
}

async function initKeyboard() {
  try {
    const { Keyboard, KeyboardResize } = await import('@capacitor/keyboard');
    await Keyboard.setResizeMode({ mode: KeyboardResize.Body });
    await Keyboard.setScroll({ isDisabled: false });
    if (Capacitor.getPlatform() === 'ios') {
      await Keyboard.setAccessoryBarVisible({ isVisible: true });
    }
  } catch {
    /* ignore */
  }
}

export function initNativeBackButton() {
  if (!Capacitor.isNativePlatform()) return () => {};

  const rootPaths = new Set(['/', '/order', '/driver', '/store', '/auth']);

  const sub = App.addListener('backButton', ({ canGoBack }) => {
    try {
      const path = window.location.pathname;
      const atRoot =
        rootPaths.has(path) || path === '/order/' || path === '/driver/' || path === '/store/';
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

export async function initNativeShell() {
  markNativeDocument();
  if (!Capacitor.isNativePlatform()) return () => {};

  await Promise.all([hideSplash(), initKeyboard()]);
  return initNativeBackButton();
}
