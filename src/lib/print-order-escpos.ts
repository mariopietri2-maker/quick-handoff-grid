// ESC/POS 58mm thermal ticket — Fresh2GO style.
// Restored header + products; safe column width (no clip).

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

function clen(s: string) {
  return [...s].length;
}

function cutText(text: string, width: number): string {
  const short = String(text ?? '').replace(/\s+/g, ' ').trim();
  const chars = [...short];
  return chars.length > width ? chars.slice(0, Math.max(1, width - 1)).join('') + '~' : short;
}

function twoCol(left: string, right: string, cols: number): string {
  let r = String(right ?? '').trim();
  if (clen(r) > 8) r = [...r].slice(0, 8).join('');
  const maxL = Math.max(1, cols - clen(r) - 1);
  let l = cutText(String(left ?? ''), maxL);
  while (clen(l) > maxL) l = [...l].slice(0, maxL - 1).join('') + '~';
  const gap = Math.max(1, cols - clen(l) - clen(r));
  return l + ' '.repeat(gap) + r;
}

function escpad(text: string, width: number, align: 'left' | 'right' | 'center' = 'left'): string {
  const t = cutText(text, width);
  const gap = width - clen(t);
  if (gap <= 0) return t;
  if (align === 'left') return t + ' '.repeat(gap);
  if (align === 'right') return ' '.repeat(gap) + t;
  const left = Math.floor(gap / 2);
  return ' '.repeat(left) + t + ' '.repeat(gap - left);
}

function emitWrapped(
  enc: EscPosEncoder,
  text: string,
  cols: number,
  align: 'left' | 'center' = 'center',
) {
  const words = String(text ?? '')
    .split(/\s+/)
    .filter(Boolean);
  let line = '';
  for (const w of words) {
    const next = line ? `${line} ${w}` : w;
    if (clen(next) > cols && line) {
      enc.text(escpad(line, cols, align));
      enc.line();
      line = w;
    } else {
      line = next;
    }
  }
  if (line) {
    enc.text(escpad(line, cols, align));
    enc.line();
  }
}

export function buildOrderEscPos(
  order: OrderWithItems,
  storeName: string,
  extras: PrintOrderExtras = {},
  width: EscPosWidth = 58,
): Uint8Array[] {
  const cols = ESCPOS_COLS[width] ?? 28;
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

  // Items: support several payload shapes
  const rawItems =
    (order as { order_items?: unknown[] }).order_items ??
    (order as { items?: unknown[] }).items ??
    [];
  const items = Array.isArray(rawItems) ? rawItems : [];

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
  // Always leave tall/bold off at start of body
  enc.tall(false);
  enc.bold(false);
  enc.feed(1);

  // —— TOP / HEADER (always) ——
  enc.align('center');
  enc.bold(true);
  enc.tall(true);
  enc.text(escpad('ΔΕΛΤΙΟ ΠΑΡΑΓΓΕΛΙΑΣ', cols, 'center'));
  enc.tall(false);
  enc.bold(false);
  enc.line();
  enc.bold(true);
  enc.text(escpad('FRESH2GO.GR', cols, 'center'));
  enc.bold(false);
  enc.line();
  enc.bold(true);
  emitWrapped(enc, String(storeName || 'Κατάστημα'), cols, 'center');
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

  enc.feed(1);
  enc.bold(true);
  enc.tall(true);
  enc.text(escpad(String(orderNo), cols, 'center'));
  enc.tall(false);
  enc.bold(false);
  enc.line();
  if (payLabel) {
    enc.bold(true);
    enc.text(escpad(isCash ? 'ΜΕΤΡΗΤΑ' : (payLabel ? `${payLabel} · ΠΛΗΡΩΘΗΚΕ` : 'ΠΛΗΡΩΘΗΚΕ'), cols, 'center'));
    enc.bold(false);
    enc.line();
  }
  enc.text('-'.repeat(cols));
  enc.line();

  // —— PRODUCTS (always list something) ——
  enc.align('left');
  if (items.length === 0) {
    enc.text(escpad('(χωρίς είδη)', cols, 'left'));
    enc.line();
  } else {
    items.forEach((item: any, idx: number) => {
      const qty = Number(item?.quantity ?? item?.qty ?? 1) || 1;
      const unit = parseMoney(item?.unit_price ?? item?.price ?? item?.unitPrice);
      const lineAmt = lineTotal(unit, qty);
      const itemName = String(item?.name ?? item?.product_name ?? item?.title ?? 'Προϊόν').trim();
      enc.text(twoCol(`#${idx + 1} ${qty}x ${itemName}`, `${money(lineAmt)}€`, cols));
      enc.line();
      const modsRaw = item?.order_item_modifiers ?? item?.modifiers ?? [];
      const mods = Array.isArray(modsRaw) ? modsRaw : [];
      for (const m of mods) {
        const label =
          [m?.group_name, m?.option_name].filter(Boolean).join(': ') ||
          m?.option_name ||
          m?.name ||
          '';
        if (!label) continue;
        const delta = Number(m?.price_delta ?? m?.price ?? 0) || 0;
        enc.text(cutText(`  + ${label}${delta ? ` (${money(delta)}€)` : ''}`, cols));
        enc.line();
      }
    });
  }

  enc.text('-'.repeat(cols));
  enc.line();
  enc.text(twoCol('Υποσύνολο', `${money(subAmt)}€`, cols));
  enc.line();
  if (fee > 0) {
    enc.text(twoCol('Παράδοση', `${money(fee)}€`, cols));
    enc.line();
  }
  if (tip > 0) {
    enc.text(twoCol('Φιλοδώρημα', `${money(tip)}€`, cols));
    enc.line();
  }
  enc.bold(true);
  enc.text(twoCol('ΣΥΝΟΛΟ', `${money(totalAmt)}€`, cols));
  enc.bold(false);
  enc.line();

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
  }

  // —— Delivery (no driver) ——
  if (recipientName || recipientPhone || recipientAddr) {
    enc.align('center');
    enc.feed(1);
    enc.text('='.repeat(cols));
    enc.line();
    enc.bold(true);
    enc.text(escpad('ΠΑΡΑΔΟΣΗ', cols, 'center'));
    enc.bold(false);
    enc.line();
    if (recipientName) {
      enc.text(escpad('ΟΝΟΜΑ', cols, 'center'));
      enc.line();
      enc.bold(true);
      emitWrapped(enc, recipientName, cols, 'center');
      enc.bold(false);
    }
    enc.text(escpad('ΔΙΕΥΘΥΝΣΗ', cols, 'center'));
    enc.line();
    if (recipientAddr) {
      enc.bold(true);
      for (const part of recipientAddr.split(/[,\n]+/).map((s) => s.trim()).filter(Boolean)) {
        emitWrapped(enc, part, cols, 'center');
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
    enc.text(escpad(recipientPhone || '-', cols, 'center'));
    enc.tall(false);
    enc.bold(false);
    enc.line();
    enc.text(escpad(isCash ? 'ΜΕΤΡΗΤΑ' : (payLabel || 'ΚΑΡΤΑ'), cols, 'center'));
    enc.line();
    enc.text('='.repeat(cols));
    enc.line();
  }

  enc.align('center');
  enc.feed(1);
  enc.text(escpad('Ευχαριστούμε', cols, 'center'));
  enc.line();
  enc.text(escpad('Fresh2GO.GR', cols, 'center'));
  enc.line();
  enc.text(escpad(`REF ${orderNoPlain}`, cols, 'center'));
  enc.line();
  enc.feed(3);
  enc.cut();

  return enc.getChunks();
}
