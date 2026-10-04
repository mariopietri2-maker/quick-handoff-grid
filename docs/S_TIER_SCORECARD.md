# Fresh2GO — S-tier scorecard

Updated: 2026-10-04 (ongoing push)

## Definition of S+
- No Sev-1 on order → accept → driver → deliver for 14 days
- `npm test` + P0 device smoke green every release
- CustomerShell modular (no 4k-line god file)
- Mapbox/Supabase under free tier with headroom
- One clear download channel (native primary)

## Engineering score (now)

| Dimension | Grade | Notes |
|-----------|-------|--------|
| Stability P0 | **A−** | Chat prefer-open, store guards, smoke + S+ gate |
| Maintainability | **A−** | Extracts: FreshCartBar, StoreHeroImage, PromoCarousel, FreshMenuRow, StoreGeo |
| Cost | **A−** | Lazy LiveTrackingMap, geocode cascade, route_cache |
| Ops | **A−** | Phase docs, ordered apply, PAT push path |
| Unit tests | **B+** | flavor, role-guards, cost, money, category |
| Production proof | **B** | Device smoke still required for S+ |

**Overall: A−** — not S+ until production proof holds.

## CustomerShell size
Track after each extract (lines): started ~4200 → ~3700 after StoreGeo/FreshMenuRow.

## Next automatic work
1. Keep extracting TrackTab / MenuScreen when safe
2. Native APK build on every meaningful main commit
3. CI must run `npm test` (already in ci.yml)
4. You: run P0 smoke on phone after APK ready
