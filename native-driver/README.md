# Fresh Driver — Native Android (Kotlin + Jetpack Compose)

True native driver app (no Capacitor WebView). Same Supabase backend and **same application id** as the Capacitor driver (`com.freshdelivery.driver`) so it can replace the hybrid APK / use the same FCM Firebase app.

## Parity with Capacitor driver

| Area | Status |
|------|--------|
| Login + `sync_app_role` | ✅ |
| Tabs: Home / Money / Inbox / Referral / Profile | ✅ |
| Mapbox map (GL JS in map surface) | ✅ |
| Online + FG location + sticky Διαθέσιμος | ✅ |
| Offers + countdown + auto-decline | ✅ |
| Accept / decline / claim | ✅ |
| Active trip + cash confirm + call + Google nav | ✅ |
| Stacked offers | ✅ |
| Break + cash-cap gates | ✅ |
| Money (wallet, earnings, withdraw) | ✅ |
| Inbox + tickets | ✅ |
| Referral code share | ✅ |
| Profile edit | ✅ |
| FCM → `push_tokens` | ✅ |
| Fresh Delivery chime | ✅ |
| In-app nav guidance banner (distance + heading to next stop) | ✅ |
| Unread ops announcements strip on Home | ✅ |
| Wait-bonus / surge live multipliers | ⏳ server-side; UI shows pool bonus on offers |

## Build

```bash
cd native-driver
echo "sdk.dir=\$ANDROID_HOME" > local.properties
./gradlew :app:assembleDebug
```

APK: `app/build/outputs/apk/debug/app-debug.apk`

Install **replaces** the Capacitor Fresh Driver debug build (same app id). Uninstall the old APK first if signatures differ.
