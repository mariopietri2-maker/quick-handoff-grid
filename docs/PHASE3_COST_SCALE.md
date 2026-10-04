# Phase 3 — Cost & scale

## Implemented
- [x] Web order tracking: **lazy-load** LiveTrackingMap (mapbox-gl only when needed)
- [x] Address autocomplete lazy on customer home
- [x] Directions via route_cache / mapboxDrivingKmWithCache
- [x] Geocode cascade: memory → local → DB → edge
- [x] Residual one-shot CI workflows disabled (phase3-disabled)

## Mapbox free tier (with billing card)
| Product | Free / month |
|---------|----------------|
| Mobile Maps SDK | ~25,000 MAUs |
| Web map loads | ~50,000 |
| Geocoding (temp) | ~100,000 |
| Directions | ~100,000 |

## Watch
- Mapbox console → Account usage
- Supabase → Edge Functions / DB size
- Admin → Cloud usage panel

## MapLibre
Only when free tier is nearly exhausted or an invoice appears.

## Multi-city
Only after Phase 1 smoke is always green in Ioannina.
