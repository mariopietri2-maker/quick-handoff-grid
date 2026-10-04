#!/usr/bin/env python3
"""Lazy-load mapbox LiveTrackingMap on order tracking page."""
from pathlib import Path

p = Path("src/pages/OrderTrackingPage.tsx")
if not p.exists():
    print("skip no OrderTrackingPage")
    raise SystemExit(0)

t = p.read_text()
t = t.replace(
    "import LiveTrackingMap from '@/components/customer/LiveTrackingMap';\n",
    "",
)
if "const LiveTrackingMap = lazy" not in t:
    needle = "import { useCustomerAppConfig } from '@/hooks/useCustomerAppConfig';\n"
    insert = (
        needle
        + "\nconst LiveTrackingMap = lazy(() => import('@/components/customer/LiveTrackingMap'));\n"
    )
    if needle in t:
        t = t.replace(needle, insert, 1)

if "bg-muted animate-pulse" not in t and "<LiveTrackingMap" in t:
    t = t.replace(
        "<LiveTrackingMap\n",
        "<Suspense fallback={<div className='absolute inset-0 bg-muted animate-pulse' />}>
        <LiveTrackingMap\n",
        1,
    )
    marker = "onDriverPos={setLiveDriverPos}\n        />\n"
    if marker in t and "</Suspense>" not in t[t.find("onDriverPos={setLiveDriverPos}") : t.find("onDriverPos={setLiveDriverPos}") + 120]:
        t = t.replace(
            marker,
            "onDriverPos={setLiveDriverPos}\n        />\n        </Suspense>\n",
            1,
        )

p.write_text(t)
print("OrderTrackingPage lazy map applied")
