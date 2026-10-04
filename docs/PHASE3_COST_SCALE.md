# Phase 3 — Cost & scale

## Goals
- Predictable Mapbox + Supabase spend
- Stay free-tier while Ioannina volume is low
- Clear trigger points for MapLibre / Supabase Pro

## Mapbox (current)
- Customer tracking prefers **Static Images** (not full Maps SDK sessions)
- Address picker lazy-loads mapbox-gl on web
- Directions should go through `route_cache` / `mapboxDrivingKmWithCache`

## Watch
- Mapbox console MAUs (mobile free ~25k) and web map loads (~50k)
- Supabase Edge invocations (cron already throttled)

## Do not start MapLibre until
Free tier is nearly exhausted or invoice appears.

## Multi-city
Only after Ioannina ops are stable (Phase 1 smoke always green).
