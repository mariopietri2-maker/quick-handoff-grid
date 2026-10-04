# Phase 4 — Ops readiness

Goal: every release is boring — same checks, same channels, no surprise UI.

## Release channel (single source)
- **Customer native**: `APK_NATIVE_CUSTOMER_VERSION` + GitHub `mobile-apks-v1`
- **Driver native**: `APK_NATIVE_DRIVER_VERSION` + same release tag
- Capacitor APKs: **Legacy** only
- Website `/download` must match those labels

## Before calling a build good
1. Run `docs/P0_SMOKE_TEST.md` on real devices
2. Store login → store UI only
3. Support close → new live chat
4. Admin Ops Assistant opens
5. No open Sev-1 in money path (order → accept → driver)

## Weekly ops
- Mapbox console usage vs free tier
- Supabase DB size + Edge invocations
- Prefer normal git commits over new `fix_patches`

## CI policy
`apply-critical-fixes` runs **only** ordered phase scripts (1→4), not every historical patch.
