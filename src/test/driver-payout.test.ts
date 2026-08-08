import { describe, expect, it } from 'vitest';
import { getDriverPayoutBreakdown } from '@/lib/driver-payout';

describe('getDriverPayoutBreakdown (pre-settlement)', () => {
  it('uses the locked driver_payout quote as base, never customer delivery_fee', () => {
    const b = getDriverPayoutBreakdown({
      driver_payout: 4,
      delivery_fee: 6, // higher — must NOT win
      tip_amount: 1,
    });
    expect(b.basePay).toBe(4);
    expect(b.tipAmount).toBe(1);
    expect(b.total).toBe(5);
  });

  it('falls back to delivery_fee only when the quote is missing', () => {
    const b = getDriverPayoutBreakdown({
      driver_payout: null,
      delivery_fee: 3.5,
      tip_amount: 1.5,
    });
    expect(b.basePay).toBe(3.5);
    expect(b.total).toBe(5);
  });

  it('derives a fallback from distance when neither quote nor fee exists', () => {
    const b = getDriverPayoutBreakdown({
      driver_payout: null,
      delivery_fee: null,
      distance_km: 10,
      tip_amount: 2,
    });
    expect(b.basePay).toBe(7); // 10 * 0.5 + 2
    expect(b.total).toBe(9);
  });

  it('floors the distance fallback at 2 EUR', () => {
    const b = getDriverPayoutBreakdown({
      driver_payout: null,
      delivery_fee: null,
      distance_km: 0,
    });
    expect(b.basePay).toBe(2);
    expect(b.total).toBe(2);
  });

  it('clamps a negative tip to zero', () => {
    const b = getDriverPayoutBreakdown({
      driver_payout: 5,
      tip_amount: -5,
    });
    expect(b.tipAmount).toBe(0);
    expect(b.basePay).toBe(5);
  });

  it('never produces a negative payout on garbage input', () => {
    const b = getDriverPayoutBreakdown({
      driver_payout: -3,
      delivery_fee: -1,
      distance_km: -5,
      tip_amount: -2,
    });
    expect(b.basePay).toBeGreaterThanOrEqual(0);
    expect(b.tipAmount).toBe(0);
    expect(b.total).toBeGreaterThanOrEqual(0);
  });

  it('keeps decimals exact (no float drift)', () => {
    const b = getDriverPayoutBreakdown({
      driver_payout: 3.3,
      tip_amount: 1.1,
    });
    expect(b.total).toBe(4.4);
    expect(b.basePay).toBe(3.3);
  });
});

describe('getDriverPayoutBreakdown (post-settlement)', () => {
  it('splits locked driver_payout into base + tip after settlement', () => {
    const b = getDriverPayoutBreakdown({
      driver_payout: 6.5, // base 5 + tip 1.5
      tip_amount: 1.5,
      commission_settled_at: '2026-08-07T10:00:00Z',
    });
    expect(b.basePay).toBe(5);
    expect(b.tipAmount).toBe(1.5);
    expect(b.total).toBe(6.5);
  });

  it('treats delivered status as settled', () => {
    const b = getDriverPayoutBreakdown({
      driver_payout: 10,
      tip_amount: 2,
      status: 'delivered',
    });
    expect(b.basePay).toBe(8);
    expect(b.total).toBe(10);
  });
});
