import { describe, it, expect } from 'vitest';

/**
 * Money-math invariants for configurable store / driver / admin food split.
 * Default example remains 85/10/5 but any triple summing to 100 is valid.
 */

const round2 = (n: number) => Math.round(n * 100) / 100;

function split(
  subtotal: number,
  deliveryFee: number,
  tip: number,
  surge = 1,
  storePct = 85,
  basketPct = 10,
) {
  const store  = round2(subtotal * storePct / 100);
  const basket = round2(subtotal * basketPct / 100);
  const admin  = round2(subtotal - store - basket); // residual cent → admin
  const driver = round2(deliveryFee * surge + tip);
  return { store, basket, admin, driver, total: round2(store + basket + admin + driver) };
}

describe('commission split (configurable 3-way)', () => {
  it('ties out exactly on whole-euro orders (default 85/10/5)', () => {
    const s = split(20, 2, 1);
    expect(s.store + s.basket + s.admin).toBeCloseTo(20, 2);
    expect(s.total).toBeCloseTo(23, 2);
  });

  it('supports custom store/driver/admin percentages', () => {
    const s = split(100, 0, 0, 1, 56.67, 10);
    expect(s.store).toBeCloseTo(56.67, 2);
    expect(s.basket).toBeCloseTo(10, 2);
    expect(s.admin).toBeCloseTo(33.33, 2);
  });

  it('absorbs rounding into admin (never loses a cent)', () => {
    const s = split(13.37, 1.99, 0);
    const subtotalParts = round2(s.store + s.basket + s.admin);
    expect(subtotalParts).toBeCloseTo(13.37, 2);
  });

  it('basket gets configured % (within 1 cent)', () => {
    for (const sub of [9.99, 15.5, 23.4, 47.85, 100, 0.5]) {
      const s = split(sub, 0, 0);
      expect(Math.abs(s.basket - sub * 0.10)).toBeLessThanOrEqual(0.01);
    }
  });

  it('store gets configured % (within 1 cent)', () => {
    for (const sub of [9.99, 15.5, 23.4, 47.85, 100]) {
      const s = split(sub, 0, 0);
      expect(Math.abs(s.store - sub * 0.85)).toBeLessThanOrEqual(0.01);
    }
  });

  it('surge multiplier scales driver pay only, not store/admin/basket', () => {
    const a = split(20, 3, 0, 1);
    const b = split(20, 3, 0, 1.5);
    expect(b.store).toBe(a.store);
    expect(b.basket).toBe(a.basket);
    expect(b.admin).toBe(a.admin);
    expect(b.driver).toBeCloseTo(round2(3 * 1.5), 2);
  });

  it('tips pass through 100% to driver', () => {
    const s = split(20, 2, 5);
    expect(s.driver).toBeCloseTo(2 + 5, 2);
  });
});

describe('Driver Basket invariants', () => {
  it('only grows from order inflows (cannot shrink without distribution)', () => {
    let basket = 0;
    const orders = [10, 23.5, 7.2, 100];
    for (const sub of orders) basket = round2(basket + sub * 0.10);
    expect(basket).toBeGreaterThan(0);
    const distribute = (amount: number) => {
      if (amount > basket) throw new Error('Basket cannot go negative');
      basket = round2(basket - amount);
    };
    distribute(round2(basket * 0.5));
    expect(basket).toBeGreaterThanOrEqual(0);
    expect(() => distribute(basket + 1)).toThrow();
  });
});
