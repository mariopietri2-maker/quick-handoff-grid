# Fresh Customer — Native Android (Kotlin + Jetpack Compose)

True native customer app (no Capacitor WebView). Same Supabase backend and **same application id** as the Capacitor customer (`com.freshdelivery.customer`).

## Scope (Capacitor parity)

| Area | Status |
|------|--------|
| Login + signup + `sync_app_role` | ✅ |
| Nearby stores list + search | ✅ |
| Category tiles + promo banners (admin `customer_app_config`) | ✅ |
| Filters: Open / Top rated / Fast | ✅ |
| Real store ratings (`store_ratings_public`) | ✅ |
| Favorites (❤️ toggle → `customer_favorites`) | ✅ |
| Order again row (recent stores) | ✅ |
| Active order banner → live track | ✅ |
| Menu + cart + qty | ✅ |
| Checkout via `place_order` (cash + promo code) | ✅ |
| Address: GPS + Geocoder (no autocomplete) | ✅ |
| Dynamic delivery fee (base + per-km) | ✅ |
| Last delivery address remembered | ✅ |
| Active / recent orders + cancel | ✅ |
| Live tracking map (Mapbox GL) | ✅ |
| Customer wallet / coupons on Profile | ✅ |
| FCM push (`push_tokens`, app=`customer`) | ✅ |
| Card / Stripe PaymentSheet | ✅ native
| Menu modifiers + address autocomplete + ratings | ✅

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
