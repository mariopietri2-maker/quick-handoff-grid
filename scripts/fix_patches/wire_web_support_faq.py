#!/usr/bin/env python3
from pathlib import Path

def wire(path: str, mode: str):
    p = Path(path)
    t = p.read_text()
    if "SupportFaqPanel" in t:
        print(path, "already")
        return
    if "from '@/lib/support-phone'" in t:
        t = t.replace(
            "import { hasSupportPhone, SUPPORT_PHONE } from '@/lib/support-phone';",
            "import { hasSupportPhone, SUPPORT_PHONE } from '@/lib/support-phone';\nimport { SupportFaqPanel } from '@/components/support/SupportFaqPanel';",
        )
    idx = t.find("{view === 'menu' && (")
    if idx < 0:
        print(path, "menu miss")
        return
    pos = t.find("{tickets.length > 0 && (", idx)
    if pos < 0:
        print(path, "tickets miss")
        return
    insert = f'<div className="mb-3"><SupportFaqPanel mode="{mode}" /></div>\n\n                '
    t = t[:pos] + insert + t[pos:]
    p.write_text(t)
    print(path, "ok")

wire("src/components/customer/CustomerSupportButton.tsx", "customer")
wire("src/components/store/StoreSupportButton.tsx", "store")
