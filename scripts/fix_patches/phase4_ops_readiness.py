#!/usr/bin/env python3
"""Phase 4: ops readiness — docs + light deploy stamp."""
from pathlib import Path

Path("docs").mkdir(exist_ok=True)
Path("docs/PHASE4_OPS_READINESS.md").write_text(
    """# Phase 4 — Ops readiness\n\n"""
    "Goal: every release is boring — same checks, same channels, no surprise UI.\n\n"
    "## Release channel (single source)\n"
    "- **Customer native**: version in `APK_NATIVE_CUSTOMER_VERSION` + GitHub `mobile-apks-v1`\n"
    "- **Driver native**: version in `APK_NATIVE_DRIVER_VERSION` + same release tag\n"
    "- Capacitor APKs: **Legacy** only\n"
    "- Website `/download` must match those labels\n\n"
    "## Before calling a build good\n"
    "1. Run `docs/P0_SMOKE_TEST.md` on real devices\n"
    "2. Store login → store UI only\n"
    "3. Support close → new live chat\n"
    "4. Admin Ops Assistant opens\n"
    "5. No open Sev-1 in money path (order → accept → driver)\n\n"
    "## Weekly ops\n"
    "- Mapbox console usage vs free tier\n"
    "- Supabase DB size + Edge invocations\n"
    "- Disable/delete dead workflows (already phase2/3 disabled)\n"
    "- Prefer normal git commits over new `fix_patches`\n\n"
    "## CI policy\n"
    "`apply-critical-fixes` runs **only** ordered phase scripts, not every historical patch.\n"
)
print("PHASE4 docs written")

main = Path("src/main.tsx")
if main.exists():
    mt = main.read_text()
    if "phase4-ops-2026-10-04" not in mt:
        main.write_text("/* phase4-ops-2026-10-04 */\n" + mt)
        print("main stamped")
print("phase4 done")
