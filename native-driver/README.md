# Fresh Driver — Native Android (Kotlin + Jetpack Compose)

True native driver app (no WebView / Capacitor). Same Supabase backend as the hybrid driver.

**Application id:** `com.freshdelivery.nativedriver`  
(Installs side-by-side with the Capacitor `com.freshdelivery.driver` APK.)

## MVP (this folder)

- Email/password login via Supabase Auth + `sync_app_role('driver')`
- Online / offline toggle with foreground location service → `driver_locations`
- Pending offers (`pending_offers` + orders/stores)
- Accept / decline via `accept-offer` / `decline-offer` edge functions
- Active trip status steps via `transition_order_status`
- Fresh Delivery offer chime (`res/raw/fresh_delivery.mp3`)
- Notification channels matching hybrid (`driver-offers-v3`, `driver-online-v2`)

## Not yet (roadmap)

| Phase | Features |
|------|----------|
| 2 | Mapbox map, turn-by-turn / external nav, stacked orders |
| 3 | Money tab (wallet, earnings, cash cap, withdrawals) |
| 4 | Inbox + support tickets + FCM deep links |
| 5 | Break mode, referrals, profile editing, wait-bonus UI |
| 6 | iOS SwiftUI twin (shared backend) |

The Capacitor driver remains production until this app reaches parity.

## Build

```bash
cd native-driver
# Ensure local.properties has sdk.dir=...
./gradlew :app:assembleDebug
```

APK: `app/build/outputs/apk/debug/app-debug.apk`

## Open in Android Studio

Open the `native-driver/` folder (not the repo root).
