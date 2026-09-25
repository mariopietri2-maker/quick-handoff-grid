#!/usr/bin/env python3
"""Fix thermal receipt: show prices on 58mm, center recipient via hardware align."""
from pathlib import Path

# --- ESC/POS ---
p = Path('src/lib/print-order-escpos.ts')
t = p.read_text()

t = t.replace(
    '''function money(n: number | null | undefined) {
  // EUR prefix — euro glyph missing on many thermal fonts
  return `EUR ${Number(n ?? 0).toFixed(2)}`;
}''',
    '''function money(n: number | null | undefined) {
  // Compact ASCII so 58mm paper does not clip the amount column
  return Number(n ?? 0).toFixed(2);
}

function twoCol(left: string, right: string, cols: number): string {
  const r = cutText(String(right), Math.min(10, Math.max(6, Math.floor(cols * 0.35))));
  const maxL = Math.max(4, cols - r.length - 1);
  const l = cutText(String(left), maxL);
  const gap = Math.max(1, cols - [...l].length - [...r].length);
  return l + ' '.repeat(gap) + r;
}''',
)

t = t.replace(
    'width: EscPosWidth = 80,\n): Uint8Array[] {',
    'width: EscPosWidth = 58,\n): Uint8Array[] {',
)

old_items = '''  enc.align('left');
  enc.bold(false);
  const items = order.order_items ?? [];
  for (const item of items) {
    const qty = Number(item.quantity) || 0;
    const unit = Number(item.unit_price) || 0;
    const amt = money(qty * unit);
    const left = cutText(`${qty}x ${String(item.name ?? '')}`, cols - amt.length - 1);
    enc.text(left + ' '.repeat(Math.max(1, cols - amt.length - left.length)) + amt);
    enc.line();
  }
  if (items.length === 0) {
    enc.text('-');
    enc.line();
  }
  enc.text('-'.repeat(cols));
  enc.line();

  enc.text(escpad('Υποσύνολο', cols - 12, 'left') + ' '.repeat(2) + escpad(money(subtotal), 10, 'right'));
  enc.line();
  if (fee > 0) {
    enc.text(escpad('Παράδοση', cols - 12, 'left') + ' '.repeat(2) + escpad(money(fee), 10, 'right'));
    enc.line();
  }
  if (tip > 0) {
    enc.text(escpad('Φιλοδώρημα', cols - 12, 'left') + ' '.repeat(2) + escpad(money(tip), 10, 'right'));
    enc.line();
  }
  enc.bold(true);
  enc.text(escpad('ΣΥΝΟΛΟ', cols - 12, 'left') + ' '.repeat(2) + escpad(money(order.total_amount), 10, 'right'));
  enc.bold(false);
  enc.feed(1);

  if (isCash) {
    enc.align('center');
    enc.bold(true);
    enc.text('*** ΕΙΣΠΡΑΞΗ ΜΕΤΡΗΤΩΝ ***');
    enc.text(escpad(money(order.total_amount), cols, 'center').trimEnd());'''

new_items = '''  enc.align('left');
  enc.bold(false);
  const items = order.order_items ?? [];
  let itemsSum = 0;
  for (const item of items) {
    const qty = Number(item.quantity) || 0;
    const unit = Number((item as { unit_price?: number | null }).unit_price) || 0;
    const lineAmt = qty * unit;
    itemsSum += lineAmt;
    const name = String(item.name ?? '').trim() || 'Προϊόν';
    const amtStr = money(lineAmt);
    const header = cutText(`${qty}x ${name}`, cols);
    if ([...header].length + [...amtStr].length + 1 <= cols) {
      enc.text(twoCol(header, amtStr, cols));
      enc.line();
    } else {
      enc.text(header);
      enc.line();
      enc.text(twoCol('', amtStr, cols));
      enc.line();
    }
  }
  if (items.length === 0) {
    enc.text('-');
    enc.line();
  }
  enc.text('-'.repeat(cols));
  enc.line();

  const totalAmt = Number(order.total_amount) || itemsSum || 0;
  const subAmt = Number.isFinite(subtotal) && subtotal > 0 ? subtotal : Math.max(0, totalAmt - fee - tip);

  enc.text(twoCol('Υποσύνολο', money(subAmt), cols));
  enc.line();
  if (fee > 0) {
    enc.text(twoCol('Παράδοση', money(fee), cols));
    enc.line();
  }
  if (tip > 0) {
    enc.text(twoCol('Φιλοδώρημα', money(tip), cols));
    enc.line();
  }
  enc.bold(true);
  enc.text(twoCol('ΣΥΝΟΛΟ', money(totalAmt), cols));
  enc.bold(false);
  enc.feed(1);

  if (isCash) {
    enc.align('center');
    enc.bold(true);
    enc.text('*** ΕΙΣΠΡΑΞΗ ΜΕΤΡΗΤΩΝ ***');
    enc.line();
    enc.text(escpad(money(totalAmt), cols, 'center').trimEnd());'''

if old_items in t:
    t = t.replace(old_items, new_items, 1)
    print('items/totals patched')
else:
    print('items pattern miss')

old_rec = "enc.text(escpad('ΠΑΡΑΛΗΠΤΗΣ', cols, 'center').trimEnd());"
if old_rec in t:
    # Switch recipient block to hardware center without space-padding
    t = t.replace(
        "enc.text(escpad('ΠΑΡΑΛΗΠΤΗΣ', cols, 'center').trimEnd());",
        "enc.text('ΠΑΡΑΛΗΠΤΗΣ');",
        1,
    )
    t = t.replace(
        "enc.text(escpad(cutText(custName, cols), cols, 'center').trimEnd());",
        "enc.text(cutText(custName, cols));",
        1,
    )
    t = t.replace(
        "enc.text(escpad(cutText(custPhone, cols), cols, 'center').trimEnd());",
        "enc.text(cutText(custPhone, cols));",
        1,
    )
    t = t.replace(
        "enc.text(escpad(cutText(line, cols), cols, 'center').trimEnd());",
        "enc.text(cutText(line, cols));",
    )
    t = t.replace(
        "enc.text(escpad(cutText(`Οδηγός: ${drv}`, cols), cols, 'center').trimEnd());",
        "enc.text(cutText(`Οδηγός: ${drv}`, cols));",
        1,
    )
    print('recipient centering patched')
else:
    print('recipient pattern miss or already done')

p.write_text(t)

# Default paper 58mm
prefs = Path('src/lib/printer-prefs.ts')
pt = prefs.read_text()
if 'paperWidth: 80,' in pt:
    prefs.write_text(pt.replace('paperWidth: 80,', 'paperWidth: 58,', 1))
    print('default paper 58mm')

# HTML: stronger center on recipient block
html = Path('src/components/store/PrintOrderTicket.tsx')
ht = html.read_text()
ht2 = ht.replace(
    '''        .block {
          margin: 12px auto 0;
          width: 100%;
          box-sizing: border-box;
          font-size: 13px;
          text-align: center;
          border: 2px solid #000;
          border-radius: 8px;
          padding: 10px 8px 12px;
        }''',
    '''        .block {
          margin: 14px auto 0;
          width: 100%;
          max-width: 100%;
          box-sizing: border-box;
          font-size: 13px;
          text-align: center !important;
          border: 2px solid #000;
          border-radius: 8px;
          padding: 12px 6px 14px;
        }
        .block * { text-align: center !important; }''',
)
# Pass paper width default 58 when calling escpos
ht2 = ht2.replace('prefs.paperWidth ?? 80', 'prefs.paperWidth ?? 58')
if ht2 != ht:
    html.write_text(ht2)
    print('html patched')
print('done')
