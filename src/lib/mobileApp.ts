/**
 * Mobile app flavor helpers (Capacitor customer / driver shells).
 *
 * Build-time: set VITE_MOBILE_APP=customer|driver when bundling offline APKs.
 * Runtime: Capacitor App.getInfo().id is com.freshdelivery.customer|driver.
 *
 * Production APKs load the shared Vercel URL, so VITE_MOBILE_APP is often unset —
 * always resolve via Capacitor appId on native.
 */

import { useEffect, useState } from 'react';
import { Capacitor } from '@capacitor/core';
import { App as CapApp } from '@capacitor/app';

export type MobileAppFlavor = 'customer' | 'driver' | 'shared';

const ENV_FLAVOR = (import.meta.env.VITE_MOBILE_APP as string | undefined)?.toLowerCase();

let cachedFlavor: MobileAppFlavor | null = null;
let resolvePromise: Promise<MobileAppFlavor> | null = null;

export function flavorFromAppId(appId: string | undefined | null): MobileAppFlavor {
  if (!appId) return 'shared';
  if (appId.includes('driver')) return 'driver';
  if (appId.includes('customer')) return 'customer';
  return 'shared';
}

/** Sync build-time flavor only (may be 'shared' on remote-loaded APKs). */
export function envMobileFlavor(): MobileAppFlavor {
  if (ENV_FLAVOR === 'customer' || ENV_FLAVOR === 'driver') return ENV_FLAVOR;
  return cachedFlavor ?? 'shared';
}

/** Preferred landing path for this mobile shell (skips marketing Index). */
export function mobileHomePath(flavor: MobileAppFlavor): string {
  if (flavor === 'driver') return '/driver';
  if (flavor === 'customer') return '/order';
  return '/';
}

export function mobileAuthAllowedRoles(flavor: MobileAppFlavor): string[] | null {
  if (flavor === 'driver') return ['driver', 'm'];
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
    path.startsWith('/legal')
  );
}

export function isDriverPath(path: string): boolean {
  return (
    path.startsWith('/driver') ||
    path.startsWith('/m') ||
    path.startsWith('/auth') ||
    path.startsWith('/legal')
  );
}

/**
 * Resolve the effective shell flavor (env → Capacitor appId → shared).
 * Result is cached for the session.
 */
export async function resolveMobileFlavor(): Promise<MobileAppFlavor> {
  if (cachedFlavor) return cachedFlavor;
  if (ENV_FLAVOR === 'customer' || ENV_FLAVOR === 'driver') {
    cachedFlavor = ENV_FLAVOR;
    return cachedFlavor;
  }
  if (!resolvePromise) {
    resolvePromise = (async () => {
      if (Capacitor.isNativePlatform()) {
        try {
          const info = await CapApp.getInfo();
          cachedFlavor = flavorFromAppId(info.id);
          return cachedFlavor;
        } catch {
          cachedFlavor = 'shared';
          return cachedFlavor;
        }
      }
      cachedFlavor = 'shared';
      return cachedFlavor;
    })();
  }
  return resolvePromise;
}

/** React hook — waits for Capacitor appId when env flavor is shared. */
export function useMobileFlavor(): { flavor: MobileAppFlavor; ready: boolean } {
  const env = (ENV_FLAVOR === 'customer' || ENV_FLAVOR === 'driver') ? ENV_FLAVOR : null;
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
