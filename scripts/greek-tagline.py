#!/usr/bin/env python3
"""Replace English brand tagline with Greek across native customer (and defaults)."""
from pathlib import Path

OLD = "Fresh Meals. Fast Delivery."
NEW = "Φρέσκο φαγητό. Γρήγορη παράδοση."

files = [
    Path("native-customer/app/src/main/java/com/freshdelivery/nativecustomer/ui/SplashScreen.kt"),
    Path("native-customer/app/src/main/java/com/freshdelivery/nativecustomer/MainActivity.kt"),
    Path("native-customer/app/src/main/java/com/freshdelivery/nativecustomer/data/Models.kt"),
    Path("native-customer/app/src/main/java/com/freshdelivery/nativecustomer/ui/CustomerShell.kt"),
    Path("src/hooks/useCustomerAppConfig.ts"),
]
for p in files:
    if not p.exists():
        print("skip", p)
        continue
    t = p.read_text()
    if OLD not in t:
        print("no match", p)
        continue
    p.write_text(t.replace(OLD, NEW))
    print("updated", p, t.count(OLD))
print("TAGLINE_OK")
