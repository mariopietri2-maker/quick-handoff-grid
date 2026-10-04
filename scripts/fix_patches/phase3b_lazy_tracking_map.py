#!/usr/bin/env python3
from pathlib import Path

nl = chr(10)
p = Path("src/pages/OrderTrackingPage.tsx")
if not p.exists():
    print("skip")
    raise SystemExit(0)

t = p.read_text()
t = t.replace("import LiveTrackingMap from '@/components/customer/LiveTrackingMap';" + nl, "")
if "const LiveTrackingMap = lazy" not in t:
    needle = "import { useCustomerAppConfig } from '@/hooks/useCustomerAppConfig';" + nl
    insert = needle + nl + "const LiveTrackingMap = lazy(() => import('@/components/customer/LiveTrackingMap'));" + nl
    if needle in t:
        t = t.replace(needle, insert, 1)

if "bg-muted animate-pulse" not in t and "<LiveTrackingMap" in t:
    open_tag = (
        "<Suspense fallback={<div className='absolute inset-0 bg-muted animate-pulse' />}>"
        + nl
        + "        <LiveTrackingMap"
        + nl
    )
    t = t.replace("<LiveTrackingMap" + nl, open_tag, 1)
    close_old = "onDriverPos={setLiveDriverPos}" + nl + "        />" + nl
    close_new = "onDriverPos={setLiveDriverPos}" + nl + "        />" + nl + "        </Suspense>" + nl
    if close_old in t:
        t = t.replace(close_old, close_new, 1)

p.write_text(t)
print("OrderTrackingPage lazy map applied")
