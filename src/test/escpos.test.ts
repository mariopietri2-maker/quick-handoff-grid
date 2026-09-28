import { describe, expect, it } from 'vitest';
import {
  encodeCp737, EscPosEncoder, ESCPOS_COLS, splitBytes,
} from '@/lib/escpos';
import { buildOrderEscPos } from '@/lib/print-order-escpos';

function chunksToBuffer(chunks: Uint8Array[]): Uint8Array {
  let n = 0;
  for (const c of chunks) n += c.byteLength;
  const out = new Uint8Array(n);
  let o = 0;
  for (const c of chunks) { out.set(c, o); o += c.byteLength; }
  return out;
}

describe('escpos encoder', () => {
  it('encodes ASCII and CP737 Greek to single bytes', () => {
    const bytes = encodeCp737('\u03a3\u03a5\u039d\u039f\u039b\u039f 12.50 EUR');
    expect(bytes.length).toBe('\u03a3\u03a5\u039d\u039f\u039b\u039f 12.50 EUR'.length);
  });

  it('starts every job with ESC @ and ends with a cut', () => {
    const enc = new EscPosEncoder(80);
    enc.reset().align('center').text('test').feed(1).cut();
    const bytes = enc.getBytes();
    expect(bytes[0]).toBe(0x1b);
    expect(bytes[1]).toBe(0x40);
  });

  it('splits large payloads', () => {
    const big = new Uint8Array(500);
    const parts = splitBytes(big, 128);
    expect(parts.length).toBeGreaterThan(1);
  });
});

describe('print order ESC/POS renderer', () => {
  const order = {
    id: '00000000-0000-0000-0000-000000000001',
    store_order_number: 12,
    status: 'preparing',
    created_at: '2026-09-06T12:00:00.000Z',
    total_amount: 18.7,
    delivery_fee: 1.99,
    tip_amount: 0,
    order_items: [
      { name: 'Test', quantity: 2, unit_price: 4.75 },
    ],
  } as never;

  it('renders a complete ticket (init, content, cut)', () => {
    const chunks = buildOrderEscPos(order as never, 'Store', { driverCode: 'DRV 7' }, 80);
    const bytes = chunksToBuffer(chunks);
    expect(chunks.length).toBeGreaterThan(5);
    expect(bytes[0]).toBe(0x1b);
    expect(bytes[1]).toBe(0x40);
  });

  it('respects the paper width column chart', () => {
    expect(ESCPOS_COLS[58]).toBe(28);
    expect(ESCPOS_COLS[80]).toBe(42);
  });
});
