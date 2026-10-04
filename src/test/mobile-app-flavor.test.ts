import { describe, expect, it } from 'vitest';
import {
  flavorFromAppId,
  isCustomerPath,
  isDriverPath,
  isStorePath,
  mobileAuthAllowedRoles,
  mobileHomePath,
} from '@/lib/mobileApp';

describe('mobileApp flavor routing', () => {
  it('maps package ids to flavors', () => {
    expect(flavorFromAppId('com.freshdelivery.customer')).toBe('customer');
    expect(flavorFromAppId('com.freshdelivery.driver')).toBe('driver');
    expect(flavorFromAppId('com.freshdelivery.store')).toBe('store');
    expect(flavorFromAppId('com.unknown.app')).toBe('shared');
  });

  it('homes match roles', () => {
    expect(mobileHomePath('customer')).toBe('/order');
    expect(mobileHomePath('driver')).toBe('/driver');
    expect(mobileHomePath('store')).toBe('/store');
  });

  it('auth roles are locked per flavor', () => {
    expect(mobileAuthAllowedRoles('store')).toEqual(['store']);
    expect(mobileAuthAllowedRoles('driver')).toEqual(['driver', 'm']);
    expect(mobileAuthAllowedRoles('customer')).toEqual(['customer']);
  });

  it('store paths exclude customer discovery', () => {
    expect(isStorePath('/store')).toBe(true);
    expect(isStorePath('/order')).toBe(false);
    expect(isCustomerPath('/order')).toBe(true);
    expect(isDriverPath('/driver')).toBe(true);
  });
});
