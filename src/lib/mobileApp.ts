/**
 * Mobile app flavor helpers (Capacitor customer / driver / store shells).
 *
 * Build-time: set VITE_MOBILE_APP=customer|driver|store when bundling offline APKs.
 * Runtime: Capacitor App.getInfo().id is com.freshdelivery.customer|driver|store.
 */

import { useEffect, useState } from 'react';
import { Capacitor } from '@capacitor/core';
import { App as CapApp } from '@capacitor/app';

export type MobileAppFlavor = 'customer' | 'driver' | 'store' | 'shared';

const ENV_FLAVOR = (import.meta.env.VITE_MOBILE_APP as string | undefined)?.toLowerCase();

let cachedFlavor: MobileAppFlavor | null = null;
let resolvePromise: Promise<MobileAppFlavor> | null = null;

export function flavorFromAppId(appId: string | undefined | null): MobileAppFlavor {
  if (!appId) return 'shared';
  const id = appId.toLowerCase();
  if (id.includes('driver')) return 'driver';
  if (id.includes('store')) return 'store';
  if (id.includes('customer')) return 'customer';
  return 'shared';
}

function isKnownEnvFlavor(v: string | undefined | null): v is MobileAppFlavor {
  return v === 'customer' || v === 'driver' || v === 'store';
}

export function envMobileFlavor(): MobileAppFlavor {
  if (isKnownEnvFlavor(ENV_FLAVOR)) return ENV_FLAVOR;
  return cachedFlavor ?? 'shared';
}

export function mobileHomePath(flavor: MobileAppFlavor): string {
  if (flavor === 'driver') return '/driver';
  if (flavor === 'store') return '/store';
  if (flavor === 'customer') return '/order';
  return '/';
}

export function mobileAuthAllowedRoles(flavor: MobileAppFlavor): string[] | null {
  if (flavor === 'driver') return ['driver', 'm'];
  if (flavor === 'store') return ['store'];
  if (flavor === 'customer') return ['customer'];
  return null;
}

export function isCustomerPath(path: string): boolean {
  return (
    path.startsWith('/order') ||
    path.startsWith('/restaurant') ||
    path.startsWith('/checkout') ||
    path.startsWith('/orders') ||
    path.startsWith('/profile') ||
    path.startsWith('/auth') ||
    path.startsWith('/legal') ||
    path.startsWith('/presentation') ||
    path.startsWith('/download')
  );
}

export function isDriverPath(path: string): boolean {
  return (
    path.startsWith('/driver') ||
    path.startsWith('/m') ||
    path.startsWith('/auth') ||
    path.startsWith('/legal') ||
    path.startsWith('/presentation') ||
    path.startsWith('/download')
  );
}

export function isStorePath(path: string): boolean {
  return (
    path.startsWith('/store') ||
    path.startsWith('/auth') ||
    path.startsWith('/legal') ||
    path.startsWith('/presentation') ||
    path.startsWith('/download')
  );
}

export async function resolveMobileFlavor(): Promise<MobileAppFlavor> {
  if (cachedFlavor) return cachedFlavor;
  if (isKnownEnvFlavor(ENV_FLAVOR)) {
    cachedFlavor = ENV_FLAVOR;
    return cachedFlavor;
  }
  if (!resolvePromise) {
    resolvePromise = (async () => {
      if (Capacitor.isNativePlatform()) {
        try {
          const info = await CapApp.getInfo();
          cachedFlavor = flavorFromAppId(info.id);
          if (cachedFlavor !== 'shared') return cachedFlavor;
        } catch {
          /* fall through */
        }
        try {
          const cfgId =
            (window as unknown as { Capacitor?: { getConfig?: () => { appId?: string }; config?: { appId?: string } } })
              .Capacitor?.getConfig?.()?.appId ||
            (window as unknown as { Capacitor?: { config?: { appId?: string } } }).Capacitor?.config?.appId;
          const fromCfg = flavorFromAppId(cfgId);
          if (fromCfg !== 'shared') {
            cachedFlavor = fromCfg;
            return cachedFlavor;
          }
        } catch {
          /* ignore */
        }
        const ua = typeof navigator !== 'undefined' ? navigator.userAgent : '';
        if (/Fresh2GO-Driver|com\.freshdelivery\.driver/i.test(ua)) {
          cachedFlavor = 'driver';
          return cachedFlavor;
        }
        if (/Fresh2GO-Store|com\.freshdelivery\.store/i.test(ua)) {
          cachedFlavor = 'store';
          return cachedFlavor;
        }
        try {
          const path = window.location.pathname || '/';
          if (path.startsWith('/store')) {
            cachedFlavor = 'store';
            return cachedFlavor;
          }
          if (path.startsWith('/driver')) {
            cachedFlavor = 'driver';
            return cachedFlavor;
          }
          if (path.startsWith('/order')) {
            cachedFlavor = 'customer';
            return cachedFlavor;
          }
        } catch {
          /* ignore */
        }
        cachedFlavor = 'customer';
        return cachedFlavor;
      }
      cachedFlavor = 'shared';
      return cachedFlavor;
    })();
  }
  return resolvePromise;
}

export function useMobileFlavor(): { flavor: MobileAppFlavor; ready: boolean } {
  const env = isKnownEnvFlavor(ENV_FLAVOR) ? ENV_FLAVOR : null;
  const [flavor, setFlavor] = useState<MobileAppFlavor>(env ?? cachedFlavor ?? 'shared');
  const [ready, setReady] = useState(() => !!env || !!cachedFlavor || !Capacitor.isNativePlatform());

  useEffect(() => {
    let cancelled = false;
    resolveMobileFlavor().then((f) => {
      if (!cancelled) {
        setFlavor(f);
        setReady(true);
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return { flavor, ready };
}
