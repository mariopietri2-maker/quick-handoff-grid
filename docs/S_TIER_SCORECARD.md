# Fresh2GO — S-tier scorecard

Updated: 2026-10-04

## Target: S+
Boring releases, no Sev-1 on money path, free-tier under control, structure maintainable.

## Score (engineering)

| Dimension | Grade | Evidence |
|-----------|-------|----------|
| Stability P0 | A− | Live chat prefer-open SQL, store role guards, P0 smoke doc |
| Maintainability | A− | CustomerShell splits: cart, hero, promo, menu row; tests |
| Cost | A− | Lazy Mapbox tracking, geocode cascade, route_cache |
| Ops / release | A− | Phase docs, ordered apply, single APK channel policy |
| Test coverage (unit) | B+ | flavor, role guards, cost, money, category |
| Production proof | B | Needs device smoke every ship |

**Overall engineering: A− → path to S+ is device proof + keep splitting shell + zero Sev-1 for 2 weeks.**

## Must stay green
1. `npm test`
2. `docs/P0_SMOKE_TEST.md` on real devices
3. Mapbox + Supabase free-tier dashboards weekly
