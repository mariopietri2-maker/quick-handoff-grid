# Fresh Delivery — Mobile Apps (Customer + Driver)

The web SPA already contains both experiences (`/order`, `/driver`).  
Native shells are **Capacitor** wrappers with separate app IDs so you can publish two store apps.

| App | Config | Android folder | App ID | Opens |
|-----|--------|----------------|--------|-------|
| **Customer** | `capacitor.customer.config.ts` | `android-customer/` | `com.freshdelivery.customer` | `/order` |
| **Driver** | `capacitor.driver.config.ts` | `android-driver/` | `com.freshdelivery.driver` | `/driver` |

Both load the live site (`https://quick-handoff-grid.vercel.app`) by default so native builds stay current after Vercel deploys. Remove the `server` block in the flavor config to ship a fully offline/bundled APK from `dist/`.

## Prerequisites

- Node 18+
- Android Studio (Android builds)
- Xcode on macOS (iOS — run `npx cap add ios` after selecting a flavor config)

## Quick start (Android)

```bash
# Install deps once
npm install

# Customer app
npm run mobile:customer:sync
npm run mobile:customer:open
# In Android Studio: Run ▶ on a device/emulator

# Driver app
npm run mobile:driver:sync
npm run mobile:driver:open
```

## Bundled (offline) builds

```bash
VITE_MOBILE_APP=customer npm run build
# Edit capacitor.customer.config.ts — remove `server: { url: ... }`
npm run mobile:customer:sync
```

Same for driver with `VITE_MOBILE_APP=driver`.

## iOS

```bash
cp capacitor.customer.config.ts capacitor.config.ts
npx cap add ios          # creates ios-customer per config
npx cap sync ios
npx cap open ios
```

Repeat with the driver config for `ios-driver`.

## Auth roles

- Customer app: sign up / sign in as **customer** → `/order`
- Driver app: sign in as **driver** (admin must grant `driver` role) → `/driver`

`MobileAppGate` keeps each shell on the right routes if a user deep-links elsewhere.

## Push / location

Plugins already in `package.json`:

- `@capacitor/geolocation` — driver GPS for dispatch
- `@capacitor/push-notifications` — offer alerts (configure FCM / APNs in store consoles)
- `@capacitor/local-notifications`

Wire FCM/APNs keys in Android/iOS project settings before production release.
