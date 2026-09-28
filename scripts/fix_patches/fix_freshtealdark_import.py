#!/usr/bin/env python3
from pathlib import Path
p = Path("native-customer/app/src/main/java/com/freshdelivery/nativecustomer/ui/CustomerShell.kt")
t = p.read_text()
if "import com.freshdelivery.nativecustomer.ui.theme.FreshTealDark" in t:
    print("already")
else:
    t = t.replace(
        "import com.freshdelivery.nativecustomer.ui.theme.FreshSurface",
        "import com.freshdelivery.nativecustomer.ui.theme.FreshSurface\nimport com.freshdelivery.nativecustomer.ui.theme.FreshTealDark",
    )
    p.write_text(t)
    print("added")
