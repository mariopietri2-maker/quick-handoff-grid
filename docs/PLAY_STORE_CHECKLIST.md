# Play Store checklist (native apps)

## Package IDs
| App | applicationId | versionName (debug track) | versionCode (approx) |
|-----|---------------|---------------------------|----------------------|
| Customer | `com.freshdelivery.customer` | 2.9.35-fresh2go | 7233071 |
| Driver | `com.freshdelivery.driver` | 2.6.34-fresh2go | 286 |

## Workflow
- Debug APKs: `Build Native APKs` → release `mobile-apks-v1`
- Play AABs (signed): `Build Native Play Store AABs` → needs secrets:
  - `PLAY_CUSTOMER_KEYSTORE_B64`
  - `PLAY_DRIVER_KEYSTORE_B64`
  - `PLAY_STORE_PASSWORD`
  - `PLAY_KEY_PASSWORD`
  - `MAPBOX_DOWNLOADS_TOKEN` (driver)

## Before each Play upload
1. versionCode **higher** than last in Play Console
2. Privacy policy URL live on fresh2go.gr
3. Data safety form (see PLAY_STORE_DATA_SAFETY.md)
4. Screenshots: phone + 7" tablet if required
5. Content rating questionnaire
6. Closed testing track first (Greece / EU)

## Listing copy (short)
- Title: Fresh2GO
- Short: Φρέσκο φαγητό στα Ιωάννινα — γρήγορη παράδοση
- Full: see PLAY_STORE_LISTING.md
