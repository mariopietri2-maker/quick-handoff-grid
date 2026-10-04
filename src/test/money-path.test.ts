import { describe, expect, it } from 'vitest';
import {
  buildOrderLedger,
  splitFoodSubtotal,
  resolveMoneyStage,
  assertLedgerTiesOut,
  DEFAULT_SPLIT,
} from '@/lib/money-path';

describe('money path (marketplace stages)', () => {
  it('splits food so store + pool + admin === subtotal', () => {
    const s = splitFoodSubtotal(20, DEFAULT_SPLIT);
    expect(s.store + s.pool + s.admin).toBeCloseTo(20, 2);
    expect(s.store).toBeCloseTo(17, 2);
  });

  it('builds ledger that ties out for card order', () => {
    const ledger = buildOrderLedger({
      total_amount: 23,
      delivery_fee: 2,
      tip_amount: 1,
      order_items: [{ unit_price: 20, quantity: 1 }],
      payment_method: 'card',
      status: 'placed',
      driver_payout: 2,
    });
    expect(ledger.stage).toBe('in_fulfillment');
    expect(ledger.rail).toBe('card');
    expect(assertLedgerTiesOut(ledger)).toBe(true);
    expect(ledger.driverTotal).toBeCloseTo(3, 2); // 2 base + 1 tip
  });

  it('cash COD stage before delivery', () => {
    expect(
      resolveMoneyStage({ payment_method: 'cash', status: 'placed', total_amount: 10 }),
    ).toBe('cash_cod');
  });

  it('pending card is awaiting_payment', () => {
    expect(
      resolveMoneyStage({ payment_method: 'card', status: 'pending' }),
    ).toBe('awaiting_payment');
  });

  it('settled when commission_settled_at set', () => {
    expect(
      resolveMoneyStage({
        payment_method: 'card',
        status: 'delivered',
        commission_settled_at: '2026-10-04T00:00:00Z',
      }),
    ).toBe('settled');
  });
});
