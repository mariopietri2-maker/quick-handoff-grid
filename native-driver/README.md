# Fresh Driver — Native Android (Kotlin + Jetpack Compose)

True native driver app (no Capacitor WebView). Same Supabase backend and **same application id** as the Capacitor driver (`com.freshdelivery.driver`) so it can replace the hybrid APK / use the same FCM Firebase app.

## Parity with Capacitor driver

| Area | Status |
|------|--------|
| Login + `sync_app_role` | ✅ |
| Tabs: Home / Money / Inbox / Referral / Profile | ✅ |
| Mapbox map | ✅ |
| Online → `driver_state.shift_started_at` + sticky Διαθέσιμος | ✅ |
| GPS heartbeat → `driver_locations` (admin Online requires both) | ✅ |
| Offers + countdown + auto-decline | ✅ |
| Accept / decline / claim | ✅ |
| Active trip + cash confirm + call + Google nav | ✅ |
| Stacked offers | ✅ |
| Break + cash-cap gates | ✅ |
| Money (wallet, earnings, withdraw) | ✅ |
| Inbox + tickets | ✅ |
| Referral code share | ✅ |
| Profile + sound / vibration / screen settings | ✅ |
| FCM → `push_tokens` | ✅ |
| EpirusEats chime | ✅ |
| Turn-by-turn in-app banner | ⏳ later |
| Wait-bonus / surge banners | ⏳ later |

## Online presence (admin panel)

Admin marks a driver **Online** only when:

1. `driver_state.shift_started_at` is set (toggle Διαθέσιμος), and
2. `driver_locations.updated_at` is fresh (< 10 minutes).

The native app writes shift state on toggle, pushes GPS immediately, and heartbeats every **45s** while online so parked drivers stay visible.

## Build

```bash
cd native-driver
echo "sdk.dir=$ANDROID_HOME" > local.properties
./gradlew :app:assembleDebug
```

APK: `app/build/outputs/apk/debug/app-debug.apk` → published as `fresh-driver-native-debug.apk` on release `mobile-apks-v1` (beta download page).

Install **replaces** the Capacitor Fresh Driver debug build (same app id). Uninstall the old APK first if signatures differ.
