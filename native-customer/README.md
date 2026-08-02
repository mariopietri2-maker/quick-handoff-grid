# Fresh Customer — Native Android (Kotlin + Jetpack Compose)

True native customer app (no Capacitor WebView). Same Supabase backend and **same application id** as the Capacitor customer (`com.freshdelivery.customer`).

## MVP scope

| Area | Status |
|------|--------|
| Login + `sync_app_role` | ✅ |
| Nearby stores list | ✅ |
| Active / recent orders | ✅ |
| Live tracking map (Mapbox GL) | ✅ |
| Profile + sign out | ✅ |
| Full menu / cart / checkout | ⏳ later (use Capacitor until parity) |
| Push (FCM) | ⏳ later |

## Build

```bash
cd native-customer
echo "sdk.dir=$ANDROID_HOME" > local.properties
./gradlew :app:assembleDebug
```

APK: `app/build/outputs/apk/debug/app-debug.apk`

Publish to the beta download page as `fresh-customer-native-debug.apk` on the `mobile-apks-v1` GitHub Release.
