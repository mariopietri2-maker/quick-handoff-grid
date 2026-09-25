#!/usr/bin/env python3
import base64, pathlib
MAP = {
  "scripts/fix_patches/receipt_print_escpos.b64": "src/lib/print-order-escpos.ts",
  "scripts/fix_patches/receipt_print_html.b64": "src/components/store/PrintOrderTicket.tsx",
  "scripts/fix_patches/receipt_printer_prefs.b64": "src/lib/printer-prefs.ts",
}
for src, dest in MAP.items():
    p = pathlib.Path(src)
    if not p.exists():
        print("skip missing", src)
        continue
    pathlib.Path(dest).write_bytes(base64.b64decode(p.read_text().strip()))
    print("wrote", dest)
