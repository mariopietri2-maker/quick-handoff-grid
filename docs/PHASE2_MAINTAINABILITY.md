# Phase 2 — Maintainability

## Done
- [x] Extract `FreshCartBar`, `StoreHeroImage`, `PromoCarousel` from `CustomerShell.kt`
- [x] Vitest: `src/test/mobile-app-flavor.test.ts` (role/path routing)
- [x] Disable one-shot `wire-*` / `sed-*` / `patch-*` workflows (`if: false`)
- [x] Archive notes in `.github/workflows_archived/README.md`

## In progress
- [ ] Further split: `HomeTab`, `MenuScreen`, `CartCheckoutScreen`, `TrackTab`
- [ ] Retire product changes via `scripts/fix_patches` (prefer normal commits/PRs)

## Policy
New product features land as normal source commits, not CI sed scripts.
