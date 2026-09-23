#!/usr/bin/env python3
from pathlib import Path
p = Path("native-customer/app/src/main/java/com/freshdelivery/nativecustomer/ui/CustomerShell.kt")
t = p.read_text()
old = ".background(if (!canPlace) FreshChip else FreshGradient)"
new = ".then(if (canPlace) Modifier.background(FreshGradient) else Modifier.background(FreshChip))"
if old not in t:
    if new in t:
        print("already fixed")
        raise SystemExit(0)
    raise SystemExit("pattern not found")
t = t.replace(old, new, 1)
p.write_text(t)
print("fixed place-order background")
