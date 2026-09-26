#!/usr/bin/env python3
"""Fix 58mm receipt amount clipping — prices always visible."""
from pathlib import Path
import re

p = Path("src/lib/escpos.ts")
t = p.read_text()
t = t.replace("58: 32,", "58: 28,")
p.write_text(t)
print("cols", "58: 28" in t)

p = Path("src/lib/print-order-escpos.ts")
t = p.read_text()

TWOCOL = """function twoCol(left: string, right: string, cols: number): string {
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
}"""

if "function amountLine" not in t:
    t = re.sub(
        r"function twoCol\(left: string, right: string, cols: number\): string \{[\s\S]*?\n\}",
        TWOCOL,
        t,
        count=1,
    )

ITEMS = """  for (const item of items) {
    const qty = Number(item.quantity) || 0;
    const unit = parseMoney((item as { unit_price?: unknown }).unit_price);
    const lineAmt = lineTotal(unit, qty);
    itemsSum += lineAmt;
    const name = String(item.name ?? '').trim() || 'Προϊόν';
    const amtStr = money(lineAmt);
    enc.text(cutText(`${qty}x ${name}`, cols));
    enc.line();
    enc.text(amountLine(amtStr, cols));
    enc.line();
  }
  if (items.length === 0)"""

if "amountLine(amtStr" not in t:
    t = re.sub(
        r"  for \(const item of items\) \{[\s\S]*?\n  \}\n  if \(items\.length === 0\)",
        ITEMS,
        t,
        count=1,
    )

TOTALS = """  enc.text(twoCol('Υποσύνολο', money(subAmt), cols));
  enc.line();
  enc.text(twoCol('Παράδοση', money(fee), cols));
  enc.line();
  enc.text(twoCol('Φιλοδώρημα', money(tip), cols));
  enc.line();
  enc.bold(true);
  enc.text(cutText('ΣΥΝΟΛΟ', cols));
  enc.line();
  enc.text(amountLine(money(totalAmt), cols));
  enc.bold(false);
  enc.feed(1);"""

if "amountLine(money(totalAmt)" not in t:
    t = re.sub(
        r"  enc\.text\(twoCol\('Υποσύνολο'[\s\S]*?enc\.bold\(false\);\n  enc\.feed\(1\);",
        TOTALS,
        t,
        count=1,
    )

p.write_text(t)
print("print ok", "amountLine" in t and "amountLine(amtStr" in t)
