# Native Customer & Driver — Improvements & Roadmap

**Branch:** `native-improvements-2026-08`  
**Updated:** 2026-08-21

## Implemented
- R8 minify + Crashlytics + Analytics (both apps)
- Driver battery-aware GPS (ONLINE/ACTIVE) + setActiveTrip
- OfflineActionQueue + enqueue on network fail + flush when online/refresh
- NavBanner wired on active trip panel (Google Maps)
- SurgeBanner composable (ready; shows when multiplier/wait bonus passed)
- Customer deep links + MainActivity handling + ViewModel openOrderFromDeepLink
- Customer background location permission + allowBackup=false
- Versions: driver 2.7.0-native / customer 2.8.0-native (code 260)

## Still manual / next
- Native Stripe PaymentSheet (customer) — large integration
- GO_LIVE: Stripe live keys, CRON_SECRET rotate, domain DNS
- Play Store internal testing + data-safety forms
- Merge this branch to main so APKs publish to mobile-apks-v1 release
- Post-delivery rating + tip sheet
- Runtime ACCESS_BACKGROUND_LOCATION only while tracking
