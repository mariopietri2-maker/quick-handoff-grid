#!/usr/bin/env python3
from pathlib import Path
import re

# HTML
p = Path('src/components/store/PrintOrderTicket.tsx')
t = p.read_text()

# Remove middle cash notes block
old_mid = '''        isCash
          ? `<div class="notes">⚠ ΕΙΣΠΡΑΞΗ ΜΕΤΡΗΤΩΝ · ${money(displayTotal)}€</div>`
          : ''
'''
# try variants
if 'ΕΙΣΠΡΑΞΗ ΜΕΤΡΗΤΩΝ' in t:
    t2, n = re.subn(
        r"\$\{\s*isCash\s*\?[\s\S]*?ΕΙΣΠΡΑΞΗ ΜΕΤΡΗΤΩΝ[\s\S]*?:\s*''\s*\}",
        "",
        t,
        count=1,
    )
    if n:
        t = t2
        print('removed middle cash notes')
    else:
        # line-based
        t = t.replace(
            '`<div class="notes">⚠ ΕΙΣΠΡΑΞΗ ΜΕΤΡΗΤΩΝ · ${money(displayTotal)}€</div>`',
            "''",
            1,
        )
        print('removed middle cash notes v2')

# Bottom payment: just ΜΕΤΡΗΤΑ (no amount repeat)
old_bot = "${isCash ? `ΜΕΤΡΗΤΑ · ΕΙΣΠΡΑΞΗ ${money(displayTotal)}€` : (payLabel ? e(payLabel) + ' · ΠΛΗΡΩΘΗΚΕ' : '—')}"
new_bot = "${isCash ? `ΜΕΤΡΗΤΑ` : (payLabel ? e(payLabel) + ' · ΠΛΗΡΩΘΗΚΕ' : '—')}"
if old_bot in t:
    t = t.replace(old_bot, new_bot, 1)
    print('bottom payment simplified')
else:
    t = t.replace(
        'ΜΕΤΡΗΤΑ · ΕΙΣΠΡΑΞΗ ${money(displayTotal)}€',
        'ΜΕΤΡΗΤΑ',
        1,
    )
    # might hit top too - restore top if needed
    if t.count('cash-top') and 'ΜΕΤΡΗΤΑ · ΕΙΣΠΡΑΞΗ' not in t:
        t = t.replace(
            'class="cash-top">⚠ ΜΕΤΡΗΤΑ',
            'class="cash-top">⚠ ΜΕΤΡΗΤΑ · ΕΙΣΠΡΑΞΗ ${money(displayTotal)}€',
            1,
        )
    print('bottom simplified fallback')

# Ensure top still has full banner once
if 'cash-top' in t and 'ΜΕΤΡΗΤΑ · ΕΙΣΠΡΑΞΗ' not in t:
    t = t.replace(
        '${isCash ? `<div class="cash-top">⚠ ΜΕΤΡΗΤΑ</div>` : ''}',
        '${isCash ? `<div class="cash-top">⚠ ΜΕΤΡΗΤΑ · ΕΙΣΠΡΑΞΗ ${money(displayTotal)}€</div>` : ''}',
        1,
    )

p.write_text(t)
print('html ok')

# ESC/POS: keep top banner only; remove *** ΕΙΣΠΡΑΞΗ *** and bottom repeat amount
e = Path('src/lib/print-order-escpos.ts')
et = e.read_text()

# Remove middle cash block
old = '''  if (isCash) {
    enc.align('center');
    enc.bold(true);
    enc.text('*** ΕΙΣΠΡΑΞΗ ΜΕΤΡΗΤΩΝ ***');
    enc.line();
    enc.text(escpad(money(totalAmt), cols, 'center').trimEnd());
    enc.bold(false);
    enc.feed(1);
  }
'''
if old in et:
    et = et.replace(old, '', 1)
    print('escpos mid removed')
else:
    et2, n = re.subn(
        r"\n  if \(isCash\) \{\n    enc\.align\('center'\);\n    enc\.bold\(true\);\n    enc\.text\('\*\*\* ΕΙΣΠΡΑΞΗ ΜΕΤΡΗΤΩΝ \*\*\*'\);[\s\S]*?enc\.feed\(1\);\n  \}\n",
        "\n",
        et,
        count=1,
    )
    if n:
        et = et2
        print('escpos mid regex')
    else:
        print('escpos mid miss')

# Bottom payment label only ΜΕΤΡΗΤΑ
et = et.replace(
    "isCash ? `ΜΕΤΡΗΤΑ · ΕΙΣΠΡΑΞΗ ${money(totalAmt)}E` : 'ΠΛΗΡΩΘΗΚΕ'",
    "isCash ? 'ΜΕΤΡΗΤΑ' : 'ΠΛΗΡΩΘΗΚΕ'",
    1,
)
e.write_text(et)
print('escpos ok')
print('DONE')
