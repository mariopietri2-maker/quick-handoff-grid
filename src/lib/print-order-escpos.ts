// ESC/POS receipt renderer — 58mm-safe: amounts never clip on the right edge.

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

function cutText(text: string, width: number): string {
  const short = text.replace(/\s+/g, ' ').trim();
  const chars = [...short];
  return chars.length > width ? chars.slice(0, Math.max(1, width - 1)).join('') + '~' : short;
}

function twoCol(left: string, right: string, cols: number): string {
  const r = String(right).trim().slice(0, 8);
  const rLen = [...r].length;
  const maxL = Math.max(1, cols - rLen - 1);
  let l = cutText(String(left), maxL);
  while ([...l].length > maxL) l = [...l].slice(0, maxL - 1).join('') + '~';
  const gap = Math.max(1, cols - [...l].length - rLen);
  return l + ' '.repeat(gap) + r;
}

function amountLine(amount: string, cols: number): string {
  const r = String(amount).trim().slice(0, 8);
  const gap = Math.max(0, cols - [...r].length);
  return ' '.repeat(gap) + r;
}

function escpad(text: string, width: number, align: 'left' | 'right' | 'center' = 'left'): string {
  const len = [...text].length;
  if (len >= width) return [...text].slice(0, width).join('');
  const gap = width - len;
  if (align === 'left') return text + ' '.repeat(gap);
  if (align === 'right') return ' '.repeat(gap) + text;
  const left = Math.floor(gap / 2);
  return ' '.repeat(left) + text + ' '.repeat(gap - left);
}

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
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  const payKey = String((order as { payment_method?: string | null }).payment_method ?? '').toLowerCase();
  const payLabel = PAYMENT_LABELS[payKey] ?? (payKey ? payKey.toUpperCase() : null);
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

  enc.reset();
  enc.feed(1);

  enc.align('center');
  enc.bold(true);
  enc.text(escpad('FRESH2GO.GR', cols, 'center'));
  enc.bold(false);
  enc.feed(1);
  enc.tall(true);
  enc.bold(true);
  enc.text(escpad(cutText(String(storeName ?? 'Κατάστημα'), cols), cols, 'center').trimEnd());
  enc.bold(false);
  enc.tall(false);
  enc.feed(1);

  enc.align('center');
  enc.text(escpad(created.trim(), cols, 'center').trimEnd());
  enc.feed(1);

  enc.text('-'.repeat(cols));
  enc.feed(1);
  enc.tall(true);
  enc.bold(true);
  enc.text(escpad(cutText(orderNo, cols), cols, 'center'));
  enc.bold(false);
  enc.tall(false);
  enc.feed(1);
  {
    const fulfill =
      String((order as { fulfillment?: string; order_type?: string }).fulfillment ??
        (order as { order_type?: string }).order_type ?? '').toLowerCase() === 'pickup'
        ? 'ΠΑΡΑΛΑΒΗ'
        : 'ΠΑΡΑΔΟΣΗ';
    enc.align('center');
    enc.bold(true);
    enc.text(escpad(fulfill, cols, 'center'));
    enc.bold(false);
    enc.feed(1);
  }
  {
    const scheduled = (order as { scheduled_for?: string | null }).scheduled_for;
    if (scheduled) {
      const s = new Date(scheduled).toLocaleString('el-GR', {
        day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit',
      });
      enc.align('center');
      enc.bold(true);
      enc.text(escpad(cutText(`ΠΡΟΓΡ. ${s}`, cols), cols, 'center'));
      enc.bold(false);
      enc.feed(1);
    }
    const readyMin = Number(
      (order as { prep_minutes?: number; estimated_prep_minutes?: number }).prep_minutes ??
        (order as { estimated_prep_minutes?: number }).estimated_prep_minutes ?? 0,
    ) || 0;
    if (readyMin > 0) {
      enc.align('center');
      enc.text(escpad(cutText(`Ετοιμασία ~${readyMin}'`, cols), cols, 'center'));
      enc.feed(1);
    }
  }

  if (payLabel) {
    enc.align('center');
    enc.bold(true);
    enc.text(escpad(`${payLabel}${!isCash ? ' - ΠΛΗΡΩΘΗΚΕ' : ''}`, cols - 2, 'center').trimEnd());
    enc.bold(false);
    enc.feed(1);
  }

  enc.text('-'.repeat(cols));
  enc.feed(1);

  enc.align('left');
  items.forEach((item, idx) => {
    const qty = Number(item.quantity) || 0;
    const unit = parseMoney(
      (item as { unit_price?: unknown }).unit_price ??
        (item as { price?: unknown }).price,
    );
    const lineAmt = lineTotal(unit, qty);
    const name = String(item.name ?? '').trim() || 'Προϊόν';
    const amtStr = `${money(lineAmt)}E`;
    enc.text(twoCol(`#${idx + 1} ${qty}x ${name}`, amtStr, cols));
    enc.line();
    if (qty > 1 && unit > 0) {
      enc.text(escpad(`  (${money(unit)} x ${qty})`, cols, 'right').trimEnd());
      enc.line();
    }
    const mods = Array.isArray((item as { order_item_modifiers?: unknown }).order_item_modifiers)
      ? ((item as { order_item_modifiers: { option_name?: string; group_name?: string; price_delta?: number }[] }).order_item_modifiers)
      : [];
    for (const m of mods) {
      const label = [m.group_name, m.option_name].filter(Boolean).join(': ') || m.option_name || '';
      if (!label) continue;
      const delta = Number(m.price_delta) || 0;
      enc.text(cutText(`  + ${label}${delta ? ` (${money(delta)}E)` : ''}`, cols));
      enc.line();
    }
  });
  if (items.length === 0) {
    enc.text('-');
    enc.line();
  }
  enc.text('-'.repeat(cols));
  enc.line();

  enc.text(twoCol('Υποσύνολο', `${money(subAmt)}E`, cols));
  enc.line();
  enc.text(twoCol('Παράδοση', `${money(fee)}E`, cols));
  enc.line();
  enc.text(twoCol('Φιλοδώρημα', `${money(tip)}E`, cols));
  enc.line();
  enc.bold(true);
  enc.text(twoCol('ΣΥΝΟΛΟ', `${money(totalAmt)}E`, cols));
  enc.bold(false);
  enc.feed(1);

  if (isCash) {
    enc.align('center');
    enc.bold(true);
    enc.text('*** ΕΙΣΠΡΑΞΗ ΜΕΤΡΗΤΩΝ ***');
    enc.line();
    enc.text(escpad(money(totalAmt), cols, 'center').trimEnd());
    enc.bold(false);
    enc.feed(1);
  }

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

  const recipientName = extras.customerName ? String(extras.customerName).trim() : '';
  const recipientPhone = extras.customerPhone ? String(extras.customerPhone).trim() : '';
  const recipientAddr = order.delivery_address ? String(order.delivery_address).trim() : '';
  if (recipientName || recipientPhone || recipientAddr) {
    enc.align('center');
    enc.feed(1);
    enc.text('='.repeat(cols));
    enc.line();
    enc.bold(true);
    enc.tall(true);
    enc.text(escpad('ΠΑΡΑΛΗΠΤΗΣ', cols, 'center'));
    enc.tall(false);
    enc.bold(false);
    enc.line();
    enc.text('-'.repeat(cols));
    enc.line();
    if (recipientName) {
      enc.bold(true);
      enc.text(escpad(cutText(recipientName, cols), cols, 'center'));
      enc.bold(false);
      enc.line();
    }
    if (recipientPhone) {
      enc.text(escpad(cutText(`Tel ${recipientPhone}`, cols), cols, 'center'));
      enc.line();
    }
    if (recipientAddr) {
      // Wrap address across lines, still centered
      const words = recipientAddr.split(/\s+/).filter(Boolean);
      let line = '';
      for (const w of words) {
        const next = line ? `${line} ${w}` : w;
        if ([...next].length > cols && line) {
          enc.text(escpad(cutText(line, cols), cols, 'center'));
          enc.line();
          line = w;
        } else {
          line = next;
        }
      }
      if (line) {
        enc.text(escpad(cutText(line, cols), cols, 'center'));
        enc.line();
      }
    }
    enc.text('='.repeat(cols));
    enc.line();
  }

  if (extras.driverCode) {
    enc.align('center');
    enc.bold(true);
    enc.text(escpad('ΟΔΗΓΟΣ', cols, 'center'));
    enc.bold(false);
    enc.line();
    enc.text(escpad(cutText(String(extras.driverCode), cols), cols, 'center'));
    enc.line();
  }

  enc.align('center');
  enc.feed(1);
  enc.text(escpad('Ευχαριστούμε', cols, 'center'));
  enc.line();
  enc.text(escpad('Fresh2GO.GR', cols, 'center'));
  enc.line();
  enc.text(escpad(cutText(`REF ${orderNoPlain}`, cols), cols, 'center'));
  enc.feed(4);
  enc.cut();

  return enc.getChunks();
}
