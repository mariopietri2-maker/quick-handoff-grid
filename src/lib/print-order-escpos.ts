// ESC/POS receipt renderer — mirrors the HTML kitchen ticket (PrintOrderTicket)
// so silent printing looks the same as the browser-dialog printout.

import { EscPosEncoder, ESCPOS_COLS, type EscPosWidth } from '@/lib/escpos';
import type { OrderWithItems } from '@/hooks/useOrders';
import { formatOrderNumber } from '@/lib/order-number';

export type PrintOrderExtras = {
  customerName?: string | null;
  customerPhone?: string | null;
  driverCode?: string | null;
  driverName?: string | null;
  /** Fiscal identity from order_invoices (provider-issued). Rendered only when present. */
  fiscal?: {
    number?: string | null;
    mark?: string | null;
    uid?: string | null;
    qrUrl?: string | null;
  } | null;
};

export const PAYMENT_LABELS: Record<string, string> = {
  cash: 'ΜΕΤΡΗΤΑ',
  card: 'ΚΑΡΤΑ',
  online: 'ONLINE',
};

function money(n: number | null | undefined): string {
  return `${Number(n ?? 0).toFixed(2)} EUR`;
}

/** Visual width — CP737 is single-byte, so string length == printed columns. */
function escpad(text: string, width: number, align: 'left' | 'right' | 'center' = 'left'): string {
  const len = text.length;
  if (len >= width) return text.slice(0, width);
  const gap = width - len;
  if (align === 'left') return text + ' '.repeat(gap);
  if (align === 'right') return ' '.repeat(gap) + text;
  const left = Math.floor(gap / 2);
  return ' '.repeat(left) + text + ' '.repeat(gap - left);
}

function cutText(text: string, width: number): string {
  const short = text.replace(/\s+/g, ' ').trim();
  return short.length > width ? short.slice(0, Math.max(1, width - 1)) + '~' : short;
}

/** Build the atomic ESC/POS chunk list for an order ticket. */
export function buildOrderEscPos(
  order: OrderWithItems,
  storeName: string,
  extras: PrintOrderExtras = {},
  width: EscPosWidth = 80,
): Uint8Array[] {
  const cols = ESCPOS_COLS[width];
  const enc = new EscPosEncoder(width);

  const orderNo = formatOrderNumber(order);
  const orderNoPlain = formatOrderNumber(order, { hash: false });
  const created = new Date(order.created_at).toLocaleString('el-GR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  const subtotal =
    Number(order.total_amount ?? 0) -
    Number(order.delivery_fee ?? 0) -
    Number(order.tip_amount ?? 0);
  const payKey = String((order as any).payment_method ?? '').toLowerCase();
  const payLabel = PAYMENT_LABELS[payKey] ?? (payKey ? payKey.toUpperCase() : null);
  const isCash = payKey === 'cash';
  const fee = Number(order.delivery_fee ?? 0);
  const tip = Number(order.tip_amount ?? 0);

  enc.reset();
  enc.feed(1);

  // Brand + store
  enc.align('center');
  enc.bold(true);
  enc.text(escpad('FRESH2GO.GR', cols, 'center'));
  enc.bold(false);
  enc.feed(1);
  enc.double(true);
  enc.bold(true);
  enc.text(escpad(cutText(String(storeName ?? 'Κατάστημα'), cols), cols, 'center').trimEnd());
  enc.bold(false);
  enc.double(false);
  enc.feed(1);

  // Meta line (date / time)
  enc.align('center');
  enc.text(escpad(created.trim(), cols, 'center').trimEnd());
  enc.feed(1);

  // Ticket number
  enc.text('-'.repeat(cols));
  enc.feed(1);
  enc.double(true);
  enc.bold(true);
  enc.text(escpad(cutText(orderNo, cols), cols, 'center'));
  enc.bold(false);
  enc.double(false);
  enc.feed(1);

  // Payment badge
  if (payLabel) {
    enc.align('center');
    enc.bold(true);
    enc.text(escpad(`${payLabel}${!isCash ? ' - ΠΛΗΡΩΘΗΚΕ' : ''}`, cols - 4, 'center').trimEnd()); 
    enc.bold(false);
    enc.feed(1);
  }

  enc.text('─'.repeat(cols));
  enc.feed(1);

  // Items
  enc.align('left');
  enc.bold(false);
  const items = order.order_items ?? [];
  for (const item of items) {
    const qty = Number(item.quantity) || 0;
    const unit = Number(item.unit_price) || 0;
    const amt = money(qty * unit);
    const left = cutText(`${qty}× ${String(item.name ?? '')}`, cols - amt.length - 1);
    enc.text(left + ' '.repeat(Math.max(1, cols - amt.length - left.length)) + amt);
    enc.line();
  }
  if (items.length === 0) {
    enc.text('-');
    enc.line();
  }
  enc.text('─'.repeat(cols));
  enc.line();

  // Totals
  enc.text(escpad('Υποσύνολο', cols - 10, 'left') + ' '.repeat(2) + escpad(money(subtotal), 8, 'right'));
  enc.line();
  if (fee > 0) {
    enc.text(escpad('Παράδοση', cols - 10, 'left') + ' '.repeat(2) + escpad(money(fee), 8, 'right'));
    enc.line();
  }
  if (tip > 0) {
    enc.text(escpad('Φιλοδώρημα', cols - 10, 'left') + ' '.repeat(2) + escpad(money(tip), 8, 'right'));
    enc.line();
  }
  enc.bold(true);
  enc.double(true);
  enc.text(escpad('ΣΥΝΟΛΟ', cols - 10, 'left') + ' '.repeat(2) + escpad(money(order.total_amount), 8, 'right'));
  enc.double(false);
  enc.bold(false);
  enc.feed(1);

  // Cash collection note
  if (isCash) {
    enc.align('center');
    enc.bold(true);
    enc.text('*** ΕΙΣΠΡΑΞΗ ΜΕΤΡΗΤΩΝ ***');
    enc.text(escpad(money(order.total_amount), cols, 'center').trimEnd());
    enc.bold(false);
    enc.feed(1);
  }

  // Notes
  if (order.notes) {
    enc.align('left');
    enc.bold(true);
    enc.text('ΣΗΜΕΙΩΣΗ:');
    enc.bold(false);
    enc.line();
    for (const ln of String(order.notes).split('\n')) {
      enc.text(cutText(ln, cols));
      enc.line();
    }
    enc.feed(1);
  }

  // Customer / driver
  const custName = extras.customerName;
  const custPhone = extras.customerPhone;
  const drv = extras.driverCode ?? extras.driverName;
  if (custName || custPhone || drv) {
    enc.align('left');
    enc.text('─'.repeat(cols));
    enc.line();
    if (custName) {
      enc.bold(true);
      enc.text('Πελάτης:');
      enc.bold(false);
      enc.line();
      enc.text(cutText(custName, cols));
      enc.line();
    }
    if (custPhone) {
      enc.text(cutText(`Τηλ. ${custPhone}`, cols));
      enc.line();
    }
    if (drv) {
      enc.text(cutText(`Οδηγός: ${drv}`, cols));
      enc.line();
    }
  }

  // Fiscal block
  const fiscal = extras.fiscal;
  if (fiscal && (fiscal.mark || fiscal.uid || fiscal.number)) {
    enc.feed(1);
    enc.align('center');
    enc.bold(true);
    enc.text('ΤΙΜΟΛΟΓΙΟ' + (fiscal.number ? ` ${fiscal.number}` : ''));
    enc.bold(false);
    if (fiscal.mark) {
      enc.text(cutText(`ΜΑΡΚ ${fiscal.mark}`, cols));
      enc.line();
    }
    if (fiscal.uid) {
      enc.text(cutText(`UID ${fiscal.uid}`, cols - 6));
      enc.line();
    }
    enc.feed(1);
  }

  // Footer ref
  enc.align('center');
  enc.text(escpad('Ευχαριστούμε — FRESH2GO.GR', cols, 'center').trimEnd());
  enc.text(escpad(`REF ${orderNoPlain}`, cols, 'center').trimEnd());
  enc.text(escpad(String(order.id ?? '').slice(0, 8).toUpperCase(), cols, 'center').trimEnd());
  enc.feed(2);
  enc.cut();

  return enc.getChunks();
}

/** Assemble a single flat byte buffer (for USB writes / debugging). */
export function buildOrderEscPosBuffer(
  order: OrderWithItems,
  storeName: string,
  extras: PrintOrderExtras = {},
  width: EscPosWidth = 80,
): Uint8Array {
  const enc = new EscPosEncoder(width);
  for (const c of buildOrderEscPos(order, storeName, extras, width)) enc.raw(c);
  return enc.getBytes();
}