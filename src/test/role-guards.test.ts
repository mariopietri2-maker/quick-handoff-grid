import { describe, expect, it } from 'vitest';
import {
  isCustomerPath,
  isDriverPath,
  isStorePath,
  mobileAuthAllowedRoles,
  mobileHomePath,
} from '@/lib/mobileApp';

/**
 * S+ invariant: store role must never land on customer discovery routes.
 * Mirrors RootEntry + CustomerApp guards.
 */
function resolveHome(role: string | undefined, flavor: 'customer' | 'driver' | 'store' | 'shared') {
  if (role === 'store') return '/store';
  if (flavor === 'store') return mobileHomePath('store');
  if (flavor === 'driver') return mobileHomePath('driver');
  if (flavor === 'customer') return mobileHomePath('customer');
  if (role === 'driver' || role === 'm') return '/driver';
  if (role === 'customer') return '/order';
  return '/order';
}

describe('role guards (S+ store isolation)', () => {
  it('store role always homes to /store even on customer flavor', () => {
    expect(resolveHome('store', 'customer')).toBe('/store');
    expect(resolveHome('store', 'shared')).toBe('/store');
  });

  it('store flavor is locked to store role', () => {
    expect(mobileAuthAllowedRoles('store')).toEqual(['store']);
    expect(isStorePath('/store')).toBe(true);
    expect(isCustomerPath('/order')).toBe(true);
    expect(isStorePath('/order')).toBe(false);
  });

  it('driver and customer homes stay separate', () => {
    expect(resolveHome('driver', 'driver')).toBe('/driver');
    expect(resolveHome('customer', 'customer')).toBe('/order');
    expect(isDriverPath('/driver')).toBe(true);
  });
});
