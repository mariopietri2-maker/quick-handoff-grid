/**
 * Mobile app flavor helpers (Capacitor customer / driver shells).
 *
 * Build-time: set VITE_MOBILE_APP=customer|driver when bundling offline APKs.
 * Runtime: Capacitor App.getInfo().id is com.freshdelivery.customer|driver.
 */

export type MobileAppFlavor = 'customer' | 'driver' | 'shared';

const ENV_FLAVOR = (import.meta.env.VITE_MOBILE_APP as string | undefined)?.toLowerCase();

export function flavorFromAppId(appId: string | undefined | null): MobileAppFlavor {
  if (!appId) return 'shared';
  if (appId.includes('driver')) return 'driver';
  if (appId.includes('customer')) return 'customer';
  return 'shared';
}

export function envMobileFlavor(): MobileAppFlavor {
  if (ENV_FLAVOR === 'customer' || ENV_FLAVOR === 'driver') return ENV_FLAVOR;
  return 'shared';
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
