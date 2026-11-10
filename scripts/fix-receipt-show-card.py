#!/usr/bin/env python3
from pathlib import Path
import re

p = Path('src/lib/print-order-escpos.ts')
t = p.read_text()

# Near order number: already uses payLabel — force clear strings
old = "enc.text(escpad(isCash ? 'ΜΕΤΡΗΤΑ' : `${payLabel} ΠΛΗΡΩΘΗΚΕ`, cols, 'center'));"
new = "enc.text(escpad(isCash ? 'ΜΕΤΡΗΤΑ' : (payLabel ? `${payLabel} · ΠΛΗΡΩΘΗΚΕ` : 'ΠΛΗΡΩΘΗΚΕ'), cols, 'center'));"
if old in t:
    t = t.replace(old, new, 1)
    print('order badge OK')
else:
    print('order badge pattern miss')

# Delivery block payment line: show ΚΑΡΤΑ not only ΠΛΗΡΩΘΗΚΕ
old2 = "enc.text(escpad(isCash ? 'ΜΕΤΡΗΤΑ' : 'ΠΛΗΡΩΘΗΚΕ', cols, 'center'));"
new2 = "enc.text(escpad(isCash ? 'ΜΕΤΡΗΤΑ' : (payLabel || 'ΚΑΡΤΑ'), cols, 'center'));"
if old2 in t:
    t = t.replace(old2, new2, 1)
    print('delivery pay OK')
else:
    # may appear once only
    print('delivery pay miss or already')

# Remove top cash amount if still present
t2, n = re.subn(
    r"\n  if \(isCash\) \{\n    enc\.bold\(true\);\n    enc\.text\(escpad\(cutText\(`ΜΕΤΡΗΤΑ[^\n]+\n    enc\.bold\(false\);\n    enc\.line\(\);\n  \}\n",
    "\n",
    t,
    count=1,
)
if n:
    t = t2
    print('top cash removed')

p.write_text(t)

# HTML badge already has payLabel — ensure bottom says ΚΑΡΤΑ
h = Path('src/components/store/PrintOrderTicket.tsx')
if h.exists():
    ht = h.read_text()
    # bottom payment already uses isCash ? ΜΕΤΡΗΤΑ : payLabel + ΠΛΗΡΩΘΗΚΕ — good if payLabel is ΚΑΡΤΑ
    if "PAYMENT_LABELS" in ht and "card:" in ht:
        print('html labels present')
    # ensure card maps
    if "card: 'ΚΑΡΤΑ'" in ht or 'card: "ΚΑΡΤΑ"' in ht or "card: 'ΚΑΡΤΑ'" in ht:
        print('html card label OK')
print('done')
