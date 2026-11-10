// ESC/POS kitchen ticket optimized for 58mm thermal (28 cols).
// Native printer bytes — not a scaled web page.

import { EscPosEncoder, ESCPOS_COLS, type EscPosWidth } from '@/lib/escpos';
import type { OrderWithItems } from '@/hooks/useOrders';
import { formatOrderNumber } from '@/lib/order-number';
import { formatMoneyPlain, lineTotal, orderMoney, parseMoney } from '@/lib/money';

export type PrintOrderExtras = {
  customerName?: string | null;
  customerPhone?: string | null;
  driverCode?: string | null;
  driverName?: string | null;
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
  wallet: 'ΠΟΡΤΟΦΟΛΙ',
};

function money(n: number | null | undefined) {
  return formatMoneyPlain(n);
}

/** Safe character count (Greek = 1 col on CP737). */
function len(s: string) {
  return [...s].length;
}

function cutText(text: string, width: number): string {
  const short = text.replace(/\s+/g, ' ').trim();
  const chars = [...short];
  return chars.length > width ? chars.slice(0, Math.max(1, width - 1)).join('') + '~' : short;
}

/** Left + right columns that always fit `cols` (no right-edge clip). */
function twoCol(left: string, right: string, cols: number): string {
  let r = String(right).trim();
  if (len(r) > 9) r = [...r].slice(0, 9).join('');
  const maxL = Math.max(1, cols - len(r) - 1);
  let l = cutText(String(left), maxL);
  while (len(l) > maxL) l = [...l].slice(0, maxL - 1).join('') + '~';
  const gap = Math.max(1, cols - len(l) - len(r));
  return l + ' '.repeat(gap) + r;
}

function escpad(text: string, width: number, align: 'left' | 'right' | 'center' = 'left'): string {
  const t = cutText(text, width);
  const gap = width - len(t);
  if (gap <= 0) return t;
  if (align === 'left') return t + ' '.repeat(gap);
  if (align === 'right') return ' '.repeat(gap) + t;
  const left = Math.floor(gap / 2);
  return ' '.repeat(left) + t + ' '.repeat(gap - left);
}

function centerLines(enc: EscPosEncoder, text: string, cols: number, opts?: { bold?: boolean; tall?: boolean }) {
  const words = text.split(/\s+/).filter(Boolean);
  let line = '';
  const flush = (s: string) => {
    if (opts?.bold) enc.bold(true);
    if (opts?.tall) enc.tall(true);
    enc.text(escpad(s, cols, 'center'));
    if (opts?.tall) enc.tall(false);
    if (opts?.bold) enc.bold(false);
    enc.line();
  };
  for (const w of words) {
    const next = line ? `${line} ${w}` : w;
    if (len(next) > cols && line) {
      flush(line);
      line = w;
    } else {
      line = next;
    }
  }
  if (line) flush(line);
}

/**
 * Build a 58mm-native thermal ticket (Fresh2GO style).
 * Default width 58 → 28 character columns.
 */
export function buildOrderEscPos(
  order: OrderWithItems,
  storeName: string,
  extras: PrintOrderExtras = {},
  width: EscPosWidth = 58,
): Uint8Array[] {
  const cols = ESCPOS_COLS[width];
  const enc = new EscPosEncoder(width);

  const orderNo = formatOrderNumber(order);
  const orderNoPlain = formatOrderNumber(order, { hash: false });
  const created = new Date(order.created_at).toLocaleString('el-GR', {
    day: '2-digit',
    month: '2-digit',
    year: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });

  const payKey = String((order as { payment_method?: string | null }).payment_method ?? '').toLowerCase();
  const isCash = payKey === 'cash';

  const items = order.order_items ?? [];
  const om = orderMoney({
    total_amount: order.total_amount,
    delivery_fee: order.delivery_fee,
    tip_amount: order.tip_amount,
    order_items: items as never,
  });
  const totalAmt = om.total;
  const fee = om.deliveryFee;
  const tip = om.tip;
  const subAmt = om.subtotal;

  const name = extras.customerName ? String(extras.customerName).trim() : '';
  const phone = String(
    extras.customerPhone || (order as { customer_phone?: string | null }).customer_phone || '',
  ).trim();
  const addr = order.delivery_address ? String(order.delivery_address).trim() : '';

  enc.reset();
  enc.feed(1);
  enc.align('center');

  // Cash once — top only
  if (isCash) {
    enc.bold(true);
    centerLines(enc, `ΜΕΤΡΗΤΑ ${money(totalAmt)}E`, cols, { bold: true });
    enc.bold(false);
  }

  enc.bold(true);
  enc.text(escpad('ΔΕΛΤΙΟ ΠΑΡΑΓΓΕΛΙΑΣ', cols, 'center'));
  enc.bold(false);
  enc.line();
  enc.text(escpad('FRESH2GO.GR', cols, 'center'));
  enc.line();
  enc.bold(true);
  centerLines(enc, String(storeName || 'Κατάστημα'), cols, { bold: true });
  enc.bold(false);
  enc.text(escpad(created, cols, 'center'));
  enc.line();

  const readyMin =
    Number(
      (order as { prep_minutes?: number }).prep_minutes ??
        (order as { estimated_prep_minutes?: number }).estimated_prep_minutes ??
        0,
    ) || 0;
  if (readyMin > 0) {
    enc.text(escpad(`Ετοιμασία ~${readyMin}'`, cols, 'center'));
    enc.line();
  }

  // Order number — double height
  enc.feed(1);
  enc.bold(true);
  enc.tall(true);
  enc.text(escpad(orderNo, cols, 'center'));
  enc.tall(false);
  enc.bold(false);
  enc.line();
  enc.text(escpad(isCash ? 'ΜΕΤΡΗΤΑ' : 'ΠΛΗΡΩΘΗΚΕ', cols, 'center'));
  enc.line();
  enc.text('-'.repeat(cols));
  enc.line();

  // Items
  enc.align('left');
  items.forEach((item, idx) => {
    const qty = Number(item.quantity) || 0;
    const unit = parseMoney(
      (item as { unit_price?: unknown }).unit_price ?? (item as { price?: unknown }).price,
    );
    const lineAmt = lineTotal(unit, qty);
    const itemName = String(item.name ?? '').trim() || 'Προϊόν';
    enc.text(twoCol(`${qty}x ${itemName}`, `${money(lineAmt)}E`, cols));
    enc.line();
    const modsRaw = (item as { order_item_modifiers?: unknown }).order_item_modifiers;
    const mods = Array.isArray(modsRaw)
      ? (modsRaw as { option_name?: string; group_name?: string; price_delta?: number }[])
      : [];
    for (const m of mods) {
      const label = [m.group_name, m.option_name].filter(Boolean).join(': ') || m.option_name || '';
      if (!label) continue;
      const delta = Number(m.price_delta) || 0;
      enc.text(cutText(` +${label}${delta ? ` ${money(delta)}E` : ''}`, cols));
      enc.line();
    }
  });
  if (!items.length) {
    enc.text('-');
    enc.line();
  }

  enc.text('-'.repeat(cols));
  enc.line();
  enc.text(twoCol('Υποσυνολο', `${money(subAmt)}E`, cols));
  enc.line();
  if (fee > 0) {
    enc.text(twoCol('Παραδοση', `${money(fee)}E`, cols));
    enc.line();
  }
  if (tip > 0) {
    enc.text(twoCol('Φιλοδωρημα', `${money(tip)}E`, cols));
    enc.line();
  }
  enc.bold(true);
  enc.text(twoCol('ΣΥΝΟΛΟ', `${money(totalAmt)}E`, cols));
  enc.bold(false);
  enc.line();

  if (order.notes) {
    enc.text(escpad('ΣΗΜΕΙΩΣΗ', cols, 'center'));
    enc.line();
    for (const ln of String(order.notes).split('\n')) {
      centerLines(enc, ln, cols);
    }
  }

  // Delivery block — compact, no driver
  if (name || phone || addr) {
    enc.align('center');
    enc.text('='.repeat(cols));
    enc.line();
    enc.bold(true);
    enc.text(escpad('ΠΑΡΑΔΟΣΗ', cols, 'center'));
    enc.bold(false);
    enc.line();
    if (name) {
      enc.text(escpad('ΟΝΟΜΑ', cols, 'center'));
      enc.line();
      enc.bold(true);
      centerLines(enc, name, cols, { bold: true });
      enc.bold(false);
    }
    enc.text(escpad('ΔΙΕΥΘΥΝΣΗ', cols, 'center'));
    enc.line();
    if (addr) {
      enc.bold(true);
      for (const part of addr.split(/[,\n]+/).map((s) => s.trim()).filter(Boolean)) {
        centerLines(enc, part, cols, { bold: true });
      }
      enc.bold(false);
    } else {
      enc.text(escpad('-', cols, 'center'));
      enc.line();
    }
    enc.text(escpad('ΤΗΛΕΦΩΝΟ', cols, 'center'));
    enc.line();
    enc.bold(true);
    enc.tall(true);
    enc.text(escpad(phone || '-', cols, 'center'));
    enc.tall(false);
    enc.bold(false);
    enc.line();
    enc.text(escpad(isCash ? 'ΜΕΤΡΗΤΑ' : 'ΠΛΗΡΩΘΗΚΕ', cols, 'center'));
    enc.line();
    enc.text('='.repeat(cols));
    enc.line();
  }

  enc.align('center');
  enc.feed(1);
  enc.text(escpad('Ευχαριστουμε', cols, 'center'));
  enc.line();
  enc.text(escpad('Fresh2GO.GR', cols, 'center'));
  enc.line();
  enc.text(escpad(`REF ${orderNoPlain}`, cols, 'center'));
  enc.line();
  enc.feed(3);
  enc.cut();

  return enc.getChunks();
}
