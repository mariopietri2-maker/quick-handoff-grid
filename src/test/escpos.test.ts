import { describe, expect, it } from 'vitest';
import {
  encodeCp737, EscPosEncoder, ESCPOS_COLS, splitBytes,
} from '@/lib/escpos';
import { buildOrderEscPosBuffer, buildOrderEscPos } from '@/lib/print-order-escpos';

describe('escpos encoder', () => {
  it('encodes ASCII and CP737 Greek to single bytes', () => {
    const bytes = encodeCp737('ΣΥΝΟΛΟ 12.50 EUR');
    expect(bytes[0]).toBe(0xa2); // Σ
    expect(bytes[1]).toBe(0xa7); // Υ
    expect(bytes.length).toBe('ΣΥΝΟΛΟ 12.50 EUR'.length);
  });

  it('maps unknown glyphs to a safe fallback', () => {
    const bytes = encodeCp737('Ω─😀');
    expect(bytes[0]).toBe(0xaf); // Ω
    expect(bytes[1]).toBe(0x3f); // ─ not in CP737 → '?'
    expect(bytes[2]).toBe(0x3f); // emoji → '?'
  });

  it('starts every job with ESC @ and ends with a cut', () => {
    const enc = new EscPosEncoder(80);
    enc.reset().align('center').text('test').feed(1).cut();
    const bytes = enc.getBytes();
    expect(bytes[0]).toBe(0x1b);
    expect(bytes[1]).toBe(0x40);
    expect(bytes[bytes.length - 4]).toBe(0x1d); // GS V cut marker
  });

  it('splits big text chunks for BLE 20-byte writes without splitting commands', () => {
    const enc = new EscPosEncoder(58);
    enc.reset();
    enc.bold(true);
    enc.text('A'.repeat(60));
    enc.bold(false);
    const chunks = enc.getChunks();
    expect(chunks.length).toBe(4); // init, bold on, text, bold off
    const pieces = splitBytes(chunks[2], 20);
    expect(pieces.length).toBe(3);
    expect([...pieces[0]].every((b) => b === 0x41)).toBe(true);
  });

  it('produces a flat buffer the same length as its chunks', () => {
    const enc = new EscPosEncoder(80);
    enc.reset().double(true).bold(true).text('ΣΥΝΟΛΟ').bold(false).double(false).cut();
    const flat = enc.getBytes();
    const sum = enc.getChunks().reduce((n, c) => n + c.byteLength, 0);
    expect(flat.byteLength).toBe(sum);
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
      { name: 'Γύρος χοιρινός', quantity: 2, unit_price: 4.75 },
    ],
  } as never;

  it('renders a complete ticket (init, content, cut)', () => {
    const chunks = buildOrderEscPos(order as never, 'Κατάστημα', { driverCode: 'DRV 7' }, 80);
    const bytes = buildOrderEscPosBuffer(order as never, 'Κατάστημα', { driverCode: 'DRV 7' }, 80);
    expect(chunks.length).toBeGreaterThan(5);
    expect(bytes[0]).toBe(0x1b);
    expect(bytes[1]).toBe(0x40);
    // ends with the partial-cut sequence GS V B NUL, then a 3-line feed
    expect(bytes[bytes.length - 1]).toBe(0x03); // ESC d 3
    expect(bytes[bytes.length - 2]).toBe(0x64); // 'd'
    const hex = Array.from(bytes).map((b) => b.toString(16).padStart(2, '0')).join('');
    expect(hex).toContain('1d564200');
  });

  it('respects the paper width column chart', () => {
    expect(ESCPOS_COLS[58]).toBe(32);
    expect(ESCPOS_COLS[80]).toBe(42);
  });
});