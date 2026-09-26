#!/usr/bin/env python3
import base64
from pathlib import Path
MAP = {
  "scripts/fix_patches/receipt_escpos_cols.b64": "src/lib/escpos.ts",
  "scripts/fix_patches/receipt_print_amounts.b64": "src/lib/print-order-escpos.ts",
}
for src, dest in MAP.items():
    p = Path(src)
    if not p.exists():
        print("skip", src)
        continue
    Path(dest).write_bytes(base64.b64decode(p.read_text().strip()))
    print("wrote", dest, Path(dest).stat().st_size)
