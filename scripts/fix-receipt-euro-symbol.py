#!/usr/bin/env python3
from pathlib import Path
import re

# ESC/POS amounts: E -> €
p = Path('src/lib/print-order-escpos.ts')
t = p.read_text()
# only currency suffix E after money()
t = t.replace("${money(lineAmt)}E", "${money(lineAmt)}€")
t = t.replace("${money(subAmt)}E", "${money(subAmt)}€")
t = t.replace("${money(fee)}E", "${money(fee)}€")
t = t.replace("${money(tip)}E", "${money(tip)}€")
t = t.replace("${money(totalAmt)}E", "${money(totalAmt)}€")
t = t.replace("${money(delta)}E", "${money(delta)}€")
t = t.replace("`ΜΕΤΡΗΤΑ ${money(totalAmt)}E`", "`ΜΕΤΡΗΤΑ ${money(totalAmt)}€`")
# any remaining money(...)}E
t = re.sub(r"(\$\{money\([^}]+\)\})E", r"\1€", t)
p.write_text(t)
print('escpos euro suffixes')

# Encoder: map € so it does not become '?'
e = Path('src/lib/escpos.ts')
et = e.read_text()
if '0x20AC' not in et:
    # Insert into CP737 map — many 58mm firmwares print euro at 0xD5 (CP858)
    # Also try common Greek printer euro slot 0xEE
    needle = 'const CP737: Record<number, number> = {'
    if needle in et:
        et = et.replace(
            needle,
            needle + '\n  // Euro (not in classic CP737; 0xD5 works on many ESC/POS heads)\n  0x20AC: 0xd5,',
            1,
        )
        e.write_text(et)
        print('encoder euro map added')
    else:
        print('CP737 map miss')
else:
    print('encoder already has euro')
print('done')
