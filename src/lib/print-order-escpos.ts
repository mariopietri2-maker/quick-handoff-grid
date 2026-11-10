// ESC/POS receipt — efood-style kitchen ticket (58/80mm).

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
  const r = String(right).trim().slice(0, 10);
  const rLen = [...r].length;
  const maxL = Math.max(1, cols - rLen - 1);
  let l = cutText(String(left), maxL);
  while ([...l].length > maxL) l = [...l].slice(0, maxL - 1).join('') + '~';
  const gap = Math.max(1, cols - [...l].length - rLen);
  return l + ' '.repeat(gap) + r;
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

function wrapCenter(enc: EscPosEncoder, text: string, cols: number, tall = false) {
  const words = text.split(/\s+/).filter(Boolean);
  let line = '';
  for (const w of words) {
    const next = line ? `${line} ${w}` : w;
    if ([...next].length > cols && line) {
      if (tall) enc.tall(true);
      enc.text(escpad(cutText(line, cols), cols, 'center'));
      if (tall) enc.tall(false);
      enc.line();
      line = w;
    } else {
      line = next;
    }
  }
  if (line) {
    if (tall) enc.tall(true);
    enc.text(escpad(cutText(line, cols), cols, 'center'));
    if (tall) enc.tall(false);
    enc.line();
  }
}

/** efood-style kitchen receipt */
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
  const createdDate = new Date(order.created_at);
  const timeStr = createdDate.toLocaleTimeString('el-GR', { hour: '2-digit', minute: '2-digit' });
  const dateStr = createdDate.toLocaleDateString('el-GR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  const payKey = String((order as { payment_method?: string | null }).payment_method ?? '').toLowerCase();
  const payLabel = PAYMENT_LABELS[payKey] ?? (payKey ? payKey.toUpperCase() : '—');
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

  const recipientName = extras.customerName ? String(extras.customerName).trim() : '';
  const recipientPhone = String(
    extras.customerPhone || (order as { customer_phone?: string | null }).customer_phone || '',
  ).trim();
  const recipientAddr = order.delivery_address ? String(order.delivery_address).trim() : '';

  enc.reset();
  enc.feed(1);

  // —— Header ——
  enc.align('center');
  enc.bold(true);
  enc.tall(true);
  enc.text(escpad('Fresh2GO', cols, 'center'));
  enc.tall(false);
  enc.bold(false);
  enc.line();
  enc.text(escpad(cutText(String(storeName || 'Κατάστημα'), cols), cols, 'center'));
  enc.line();
  enc.feed(1);

  // —— Status row (like efood icons) ——
  enc.bold(true);
  enc.text(escpad('ΔΙΑΝΟΜΗ', cols, 'center'));
  enc.bold(false);
  enc.line();
  enc.text(escpad(isCash ? 'ΠΛΗΡΩΜΗ ΜΕΤΡΗΤΑ' : 'ΠΛΗΡΩΜΗ ΜΕ ΚΑΡΤΑ', cols, 'center'));
  enc.line();
  if (!isCash) {
    enc.bold(true);
    enc.text(escpad('ΠΛΗΡΩΘΗΚΕ', cols, 'center'));
    enc.bold(false);
    enc.line();
  }
  enc.text(escpad(timeStr, cols, 'center'));
  enc.line();
  enc.feed(1);

  // —— Order # + customer (efood layout) ——
  enc.align('left');
  enc.bold(true);
  enc.tall(true);
  enc.text(cutText(orderNo, cols));
  enc.tall(false);
  enc.bold(false);
  enc.line();
  if (recipientName) {
    enc.bold(true);
    wrapCenter(enc, recipientName.toUpperCase(), cols, true);
    enc.bold(false);
  }
  if (recipientAddr) {
    for (const part of recipientAddr.split(/[,\n]+/).map((s) => s.trim()).filter(Boolean)) {
      wrapCenter(enc, part, cols, false);
    }
  }
  // Phone always
  enc.bold(true);
  enc.tall(true);
  enc.text(escpad(cutText(`ΤΗΛ: ${recipientPhone || '—'}`, cols), cols, 'left'));
  enc.tall(false);
  enc.bold(false);
  enc.line();
  enc.feed(1);

  // —— Tip for driver (efood style, prominent) ——
  enc.align('center');
  enc.bold(true);
  enc.tall(true);
  if (tip > 0) {
    enc.text(escpad(cutText(`ΤΙΠ ΔΙΑΝΟΜΕΑ €${money(tip)}`, cols), cols, 'center'));
  } else {
    enc.text(escpad('ΔΕΝ ΕΧΕΙ ΤΙΠ ΓΙΑ ΤΟΝ', cols, 'center'));
    enc.line();
    enc.text(escpad('ΔΙΑΝΟΜΕΑ', cols, 'center'));
  }
  enc.tall(false);
  enc.bold(false);
  enc.line();
  enc.feed(1);

  enc.text('-'.repeat(cols));
  enc.line();

  // —— Items ——
  enc.align('left');
  items.forEach((item, idx) => {
    const qty = Number(item.quantity) || 0;
    const unit = parseMoney(
      (item as { unit_price?: unknown }).unit_price ?? (item as { price?: unknown }).price,
    );
    const lineAmt = lineTotal(unit, qty);
    const name = String(item.name ?? '').trim() || 'Προϊόν';
    enc.bold(true);
    enc.text(twoCol(`${qty} ${name}`, `€${money(lineAmt)}`, cols));
    enc.bold(false);
    enc.line();
    const modsRaw = (item as { order_item_modifiers?: unknown }).order_item_modifiers;
    const mods = Array.isArray(modsRaw)
      ? (modsRaw as { option_name?: string; group_name?: string; price_delta?: number }[])
      : [];
    for (const m of mods) {
      const label = [m.group_name, m.option_name].filter(Boolean).join(': ') || m.option_name || '';
      if (!label) continue;
      const delta = Number(m.price_delta) || 0;
      enc.text(cutText(`  ${label}${delta ? ` €${money(delta)}` : ''}`, cols));
      enc.line();
    }
    if (idx < items.length - 1) enc.line();
  });
  if (items.length === 0) {
    enc.text('-');
    enc.line();
  }

  enc.text('-'.repeat(cols));
  enc.line();

  // —— Totals (efood labels) ——
  enc.text(twoCol('Μερικό σύνολο', `€${money(subAmt)}`, cols));
  enc.line();
  enc.text(twoCol('ΚΟΣΤΟΣ DELIVERY', `€${money(fee)}`, cols));
  enc.line();
  if (tip > 0) {
    enc.text(twoCol('Φιλοδώρημα', `€${money(tip)}`, cols));
    enc.line();
  }
  enc.bold(true);
  enc.tall(true);
  enc.text(twoCol('Σύνολο', `€${money(totalAmt)}`, cols));
  enc.tall(false);
  enc.bold(false);
  enc.feed(1);

  if (isCash) {
    enc.align('center');
    enc.bold(true);
    enc.text(escpad('*** ΕΙΣΠΡΑΞΗ ΜΕΤΡΗΤΩΝ ***', cols, 'center'));
    enc.line();
    enc.tall(true);
    enc.text(escpad(`€${money(totalAmt)}`, cols, 'center'));
    enc.tall(false);
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

  if (extras.driverCode) {
    enc.align('center');
    enc.text(escpad(cutText(`ΟΔΗΓΟΣ ${extras.driverCode}`, cols), cols, 'center'));
    enc.line();
  }

  // —— Footer ——
  enc.align('center');
  enc.feed(1);
  enc.text(escpad(dateStr, cols, 'center'));
  enc.line();
  enc.text(escpad(`ΚΩΔΙΚΟΣ: ${orderNoPlain}`, cols, 'center'));
  enc.line();
  enc.feed(1);
  enc.bold(true);
  enc.text(escpad('Ευχαριστούμε', cols, 'center'));
  enc.bold(false);
  enc.line();
  enc.text(escpad('για την παραγγελία σας', cols, 'center'));
  enc.line();
  enc.text(escpad('Fresh2GO.GR', cols, 'center'));
  enc.line();
  enc.feed(3);
  enc.cut();

  return enc.getChunks();
}
