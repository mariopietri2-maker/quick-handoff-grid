# Native Customer & Driver — Improvements & Roadmap

**Branch:** `native-improvements-2026-08`  
**Date:** 2026-08-21  

## Implemented
- R8 minify + resource shrink (release) both apps
- Firebase Crashlytics + Analytics both apps
- ProGuard keep rules strengthened
- Version: driver 2.7.0-native (260), customer 2.8.0-native (260)
- Driver battery-aware GPS (ONLINE vs ACTIVE) + setActiveTrip wiring
- OfflineActionQueue for accept/decline
- NavBanner (Google Maps) + SurgeBanner composables
- Customer deep links + background location permission + allowBackup=false

## Next
- Mount NavBanner/SurgeBanner in HomeScreen
- Flush OfflineActionQueue on reconnect
- Native Stripe PaymentSheet (customer)
- Runtime background location request while tracking
- Post-delivery rating + tip
- Saved addresses UI
- GO_LIVE operational checklist (Stripe live, CRON_SECRET, domain, Play Store)
