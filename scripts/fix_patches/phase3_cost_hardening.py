#!/usr/bin/env python3
"""Phase 3: disable residual one-shot workflows. Map lazy-load applied separately."""
from pathlib import Path
import re

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
    if "phase2-disabled" in wt or "phase3-disabled" in wt:
        print("already", name)
        continue
    wt2 = re.sub(
        r"(jobs:\s*\n\s+\w+:\s*\n)",
        r"\1    if: false # phase3-disabled\n",
        wt,
        count=1,
    )
    if wt2 == wt:
        wt2 = "# phase3-disabled\n" + wt
    fp.write_text(wt2)
    print("disabled", name)

print("phase3 done")
