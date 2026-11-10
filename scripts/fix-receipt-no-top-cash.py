#!/usr/bin/env python3
from pathlib import Path
import re

p = Path('src/lib/print-order-escpos.ts')
t = p.read_text()
old = '''  // —— TOP / HEADER (always) ——
  enc.align('center');
  if (isCash) {
    enc.bold(true);
    enc.text(escpad(cutText(`ΜΕΤΡΗΤΑ ${money(totalAmt)}E`, cols), cols, 'center'));
    enc.bold(false);
    enc.line();
  }
  enc.bold(true);
'''
new = '''  // —— TOP / HEADER (always) ——
  enc.align('center');
  enc.bold(true);
'''
if old in t:
    t = t.replace(old, new, 1)
    print('removed top cash line')
else:
    t2, n = re.subn(
        r"\n  if \(isCash\) \{\n    enc\.bold\(true\);\n    enc\.text\(escpad\(cutText\(`ΜΕΤΡΗΤΑ \$\{money\(totalAmt\)\}E`[^\n]+\n    enc\.bold\(false\);\n    enc\.line\(\);\n  \}\n",
        "\n",
        t,
        count=1,
    )
    if n:
        t = t2
        print('removed top cash regex')
    else:
        print('pattern miss')

p.write_text(t)

# HTML: remove cash-top banner if present
h = Path('src/components/store/PrintOrderTicket.tsx')
if h.exists():
    ht = h.read_text()
    ht2 = re.sub(
        r"\s*\$\{isCash \? `<div class=\"cash-top\">[^`]*` : ''\}",
        "",
        ht,
        count=1,
    )
    if ht2 != ht:
        h.write_text(ht2)
        print('html cash-top removed')
    else:
        print('html no cash-top banner')
print('done')
