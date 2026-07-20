# Fresh Delivery — Mobile Apps (Customer + Driver)

Native **Capacitor** shells wrap the same React SPA as two store apps:

| App | Config | Android folder | App ID | Home |
|-----|--------|----------------|--------|------|
| **Fresh Customer** | `capacitor.customer.config.ts` | `android-customer/` | `com.freshdelivery.customer` | `/order` |
| **Fresh Driver** | `capacitor.driver.config.ts` | `android-driver/` | `com.freshdelivery.driver` | `/driver` |

Apps are **bundled** by default (web assets packed into the APK).  
Optional live WebView mode: `CAP_LIVE_URL=https://… npm run mobile:customer:sync`.

## Prerequisites

- Node 18+
- Android Studio **or** Android SDK (`ANDROID_HOME`) for APK builds
- Xcode on macOS for iOS

## Quick start (Android Studio)

```bash
npm install

npm run mobile:customer:sync
npm run mobile:customer:open   # Android Studio → Run

npm run mobile:driver:sync
npm run mobile:driver:open
```

## Build installable debug APKs

```bash
export ANDROID_HOME=~/android-sdk   # or your SDK path

npm run mobile:customer:apk
npm run mobile:driver:apk

# APKs land in ./mobile-apks/
adb install -r mobile-apks/fresh-customer-debug.apk
adb install -r mobile-apks/fresh-driver-debug.apk
```

## Auth

| App | Sign in as |
|-----|------------|
| Customer | Any customer account (or sign up) |
| Driver | Account with `driver` role (admin grants it) |

`MobileAppGate` keeps each shell on the right routes.

## iOS

```bash
cp capacitor.customer.config.ts capacitor.config.ts
npx cap add ios
npx cap sync ios
npx cap open ios
```

Repeat with the driver config for `ios-driver`.

## Push / location

Plugins in `package.json`:

- `@capacitor/geolocation` — driver GPS for dispatch
- `@capacitor/push-notifications` — offer alerts (add `google-services.json` / APNs)
- `@capacitor/local-notifications`
- `@capacitor/status-bar`

Wire FCM/APNs before production store release.
