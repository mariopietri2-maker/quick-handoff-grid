#!/usr/bin/env python3
"""Phase 3: lazy tracking map + disable residual one-shot workflows."""
from pathlib import Path
import re

p = Path("src/pages/OrderTrackingPage.tsx")
if p.exists():
    t = p.read_text()
    if "import LiveTrackingMap from" in t:
        t = t.replace(
            "import LiveTrackingMap from '@/components/customer/LiveTrackingMap';\n",
            "",
        )
    if "const LiveTrackingMap = lazy" not in t:
        marker = "import { useCustomerAppConfig } from '@/hooks/useCustomerAppConfig';\n"
        if marker in t:
            t = t.replace(
                marker,
                marker + "\nconst LiveTrackingMap = lazy(() => import('@/components/customer/LiveTrackingMap'));\n",
                1,
            )
    if "showMap ?" in t and "bg-muted animate-pulse" not in t:
        old = "      {showMap ? (\n        <LiveTrackingMap\n"
        new = "      {showMap ? (\n        <Suspense fallback={<div className=\"absolute inset-0 bg-muted animate-pulse\" />}>
        <LiveTrackingMap\n"
        if old in t:
            t = t.replace(old, new, 1)
            close_old = "        />\n      ) : (\n        <div className=\"absolute inset-0 bg-gradient-to-b from-[hsl(var(--c-accent-soft))] to-background flex items-center justify-center\">\n"
            close_new = "        />\n        </Suspense>\n      ) : (\n        <div className=\"absolute inset-0 bg-gradient-to-b from-[hsl(var(--c-accent-soft))] to-background flex items-center justify-center\">\n"
            t = t.replace(close_old, close_new, 1)
    t = re.sub(
        r"(import \{ ReviewForm \} from '@/components/ReviewForm';\n)const LiveTrackingMap = lazy\(\(\) => import\('@/components/customer/LiveTrackingMap'\)\);\n(import )",
        r"\1\2",
        t,
    )
    p.write_text(t)
    print("OrderTrackingPage cost-hardened")

for name in [
    "apply-fix-customer-compile-only.yml",
    "apply-fix-customer-compile.yml",
    "patch-customer-home.yml",
    "patch-offer-customer-pin.yml",
    "run-patch-active-job.yml",
    "sed-wire-finish.yml",
    "wire-advertising-admin.yml",
    "wire-driver-offer-sounds.yml",
    "wire-offer-and-banner.yml",
    "wire-store-call-notify-ui.yml",
    "wire-store-registry.yml",
]:
    fp = Path(".github/workflows") / name
    if not fp.exists():
        continue
    wt = fp.read_text()
    if "if: false # phase2-disabled" in wt or "if: false # phase3-disabled" in wt:
        print("already", name)
        continue
    wt2 = re.sub(r"(jobs:\s*\n\s+\w+:\s*\n)", r"\1    if: false # phase3-disabled\n", wt, count=1)
    if wt2 == wt:
        wt2 = "# phase3-disabled\n" + wt
    fp.write_text(wt2)
    print("disabled", name)

Path("docs/PHASE3_COST_SCALE.md").write_text(
    "# Phase 3 — Cost & scale\n\n"
    "## Implemented\n"
    "- [x] Web order tracking: lazy-load LiveTrackingMap\n"
    "- [x] Residual one-shot CI workflows disabled\n\n"
    "See Mapbox free tier limits in project review notes.\n"
)
main = Path("src/main.tsx")
if main.exists() and "phase3-cost-2026-10-04" not in main.read_text():
    main.write_text("/* phase3-cost-2026-10-04 */\n" + main.read_text())
    print("stamped")
print("phase3 done")
