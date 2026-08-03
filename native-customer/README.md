# Fresh Customer — Native Android (Kotlin + Jetpack Compose)

True native customer app (no Capacitor WebView). Same Supabase backend and **same application id** as the Capacitor customer (`com.freshdelivery.customer`).

## Scope

| Area | Status |
|------|--------|
| Login + signup + `sync_app_role` | ✅ |
| Nearby stores list + search | ✅ |
| Menu + cart + qty | ✅ |
| Checkout via `place_order` (cash) | ✅ |
| Address: GPS + Geocoder autocomplete suggestions | ✅ |
| Dynamic delivery fee (base + per-km when coords known) | ✅ |
| Last delivery address remembered (SharedPreferences) | ✅ |
| Active / recent orders + cancel | ✅ |
| Live tracking map (Mapbox GL) | ✅ |
| FCM push (`push_tokens`, app=`customer`) | ✅ |
| Card / Stripe in-app | ⏳ use web/Capacitor checkout; native stays cash |

## Build

```bash
cd native-customer
# first time: copy gradle wrapper from native-driver
cp -R ../native-driver/gradle .
cp ../native-driver/gradlew ../native-driver/gradlew.bat .
echo "sdk.dir=$ANDROID_HOME" > local.properties
./gradlew :app:assembleDebug
```

APK: `app/build/outputs/apk/debug/app-debug.apk` → publish as `fresh-customer-native-debug.apk` on release `mobile-apks-v1`.
