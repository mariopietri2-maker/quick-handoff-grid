import { Capacitor } from '@capacitor/core';

const MANIFEST_SELECTOR = 'link[rel="manifest"]';

export type PwaManifestKind = 'default' | 'store' | 'customer' | 'driver';

const MANIFEST_HREF: Record<PwaManifestKind, string> = {
  default: '/manifest.json',
  store: '/manifest-store.json',
  customer: '/manifest-customer.json',
  driver: '/manifest-driver.json',
};

const THEME: Record<PwaManifestKind, string> = {
  default: '#FF8A3D',
  store: '#EA580C',
  customer: '#FF8A3D',
  driver: '#FF8A3D',
};

const APPLE_TITLE: Record<PwaManifestKind, string> = {
  default: 'Fresh2GO',
  store: 'Fresh2GO Store',
  customer: 'Fresh2GO',
  driver: 'Fresh2GO Driver',
};

const APPLE_ICON: Record<PwaManifestKind, string> = {
  default: '/icons/app-192.png',
  store: '/icons/store-192.png',
  customer: '/icons/app-192.png',
  driver: '/icons/app-192.png',
};

export function setPwaManifest(kind: PwaManifestKind) {
  if (typeof document === 'undefined') return;
  const href = MANIFEST_HREF[kind] || MANIFEST_HREF.default;
  let link = document.querySelector(MANIFEST_SELECTOR) as HTMLLinkElement | null;
  if (!link) {
    link = document.createElement('link');
    link.rel = 'manifest';
    document.head.appendChild(link);
  }
  if (link.getAttribute('href') !== href) {
    link.setAttribute('href', href);
  }

  const themeMeta = document.querySelector('meta[name="theme-color"]') as HTMLMetaElement | null;
  if (themeMeta) themeMeta.content = THEME[kind] || THEME.default;

  const appleTitle = document.querySelector('meta[name="apple-mobile-web-app-title"]') as HTMLMetaElement | null;
  if (appleTitle) {
    appleTitle.content = APPLE_TITLE[kind] || APPLE_TITLE.default;
  }

  const appleIcon = document.querySelector('link[rel="apple-touch-icon"]') as HTMLLinkElement | null;
  if (appleIcon) {
    appleIcon.href = APPLE_ICON[kind] || APPLE_ICON.default;
  }
}

export function isNativeShell(): boolean {
  try {
    return Capacitor.isNativePlatform();
  } catch {
    return false;
  }
}

export async function registerStorePwa(): Promise<ServiceWorkerRegistration | null> {
  if (typeof window === 'undefined') return null;
  if (isNativeShell()) return null;
  if (!('serviceWorker' in navigator)) return null;
  try {
    const reg = await navigator.serviceWorker.register('/sw.js', { scope: '/' });
    return reg;
  } catch (e) {
    console.warn('PWA service worker registration failed', e);
    return null;
  }
}

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
};

let deferredPrompt: BeforeInstallPromptEvent | null = null;
const listeners = new Set<() => void>();

function notifyInstallListeners() {
  listeners.forEach((fn) => {
    try {
      fn();
    } catch {
      /* noop */
    }
  });
}

export function initPwaInstallCapture() {
  if (typeof window === 'undefined' || isNativeShell()) return;
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e as BeforeInstallPromptEvent;
    notifyInstallListeners();
  });
  window.addEventListener('appinstalled', () => {
    deferredPrompt = null;
    notifyInstallListeners();
  });
}

export function canPromptPwaInstall(): boolean {
  return !!deferredPrompt;
}

export function isRunningAsPwa(): boolean {
  if (typeof window === 'undefined') return false;
  const mq = window.matchMedia?.('(display-mode: standalone)')?.matches;
  const ios = (navigator as any).standalone === true;
  return !!(mq || ios);
}

export async function promptPwaInstall(): Promise<'accepted' | 'dismissed' | 'unavailable'> {
  if (!deferredPrompt) return 'unavailable';
  const ev = deferredPrompt;
  deferredPrompt = null;
  try {
    await ev.prompt();
    const { outcome } = await ev.userChoice;
    notifyInstallListeners();
    return outcome;
  } catch {
    notifyInstallListeners();
    return 'unavailable';
  }
}

export function subscribePwaInstallAvailability(cb: () => void): () => void {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}
