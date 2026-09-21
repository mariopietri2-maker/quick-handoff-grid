# Fresh2GO — Project map

## What lives where

| Path | Role |
|------|------|
| `src/` | React web app (customer, store, driver, admin, support) |
| `public/` | Static assets, presentation, icons |
| `supabase/` | Migrations, Edge Functions, DB scripts |
| `native-customer/` | Kotlin + Compose customer Android app |
| `native-driver/` | Kotlin + Compose driver Android app |
| `android/`, `android-driver/` | Capacitor Android shells |
| `plugins/` | Capacitor plugins (e.g. Mapbox) |
| `mobile-signing/` | Shared debug keystore for sideload updates |
| `scripts/` | Build, deploy, and maintenance scripts |
| `docs/` | Documentation & marketing assets |
| `e2e/` | Playwright end-to-end tests |
| `archive/` | Old previews, flyers, nested copies — **not used at runtime** |
| `.github/workflows/` | **Active** CI only |
| `.github/workflow-archive/` | One-shot / historical workflows (not run) |

## Product surfaces

| Surface | Entry |
|---------|--------|
| Marketing site | `/` |
| Customer (web) | `/order` |
| Store PWA | `/store` |
| Driver (web) | `/driver` |
| Admin | `/admin` |
| Support | `/support` |
| APK downloads | `/download` |
| Native customer | `com.freshdelivery.customer` |
| Native driver | `com.freshdelivery.driver` |

## Active CI (keep these)

- `ci.yml` — lint / test / web build
- `build-native-apks.yml` — native customer + driver APK/AAB → release
- `build-capacitor-apks.yml` / `build-capacitor-customer.yml` — Capacitor APKs
- `build-native-play-aabs.yml` / `build-release-aabs.yml` — Play Store AABs
- `cleanup-old-apks.yml` / `organize-apk-releases.yml` — release hygiene
- `deploy-all-rebuild.yml` — full rebuild / deploy trigger
- `build-ios-apps.yml` / `build-store-beta-apk.yml` — secondary mobile
- `label-apk-versions.yml` — release labels

## Releases

| Tag | Contents |
|-----|----------|
| `mobile-apks-v1` | **Latest** native APKs only |
| `mobile-apks-archive` | Older APKs |
| `play-store-aabs-v1` | Signed Play AABs |

## Versions (source of truth)

- Customer native: `native-customer/app/build.gradle.kts` → `versionName`
- Driver native: `native-driver/app/build.gradle.kts` → `versionName`
- Website labels: `src/lib/apk-downloads.ts` (must match Gradle)
