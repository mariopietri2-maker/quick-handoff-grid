#!/usr/bin/env python3
from pathlib import Path
p = Path("native-customer/app/src/main/java/com/freshdelivery/nativecustomer/ui/CustomerViewModel.kt")
t = p.read_text()
old = "val pool = cur.stores.filter { it.is_open != false }"
new = "val pool = cur.stores.filter { it.is_active != false && it.status_override != \"closed\" }"
if old not in t:
    raise SystemExit("pattern not found")
p.write_text(t.replace(old, new, 1))
print("fixed is_open")
