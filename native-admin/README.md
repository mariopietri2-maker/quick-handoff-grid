# Fresh2GO Native Admin

Android (Kotlin + Compose) **operations console** for platform admins.

## Features (v1)
- Admin-only login (rejects non-admin accounts)
- Live overview: open orders, online drivers, active stores
- Driver list: online / on break / force end shift / deactivate
- Orders list: force status, assign context
- Pull-to-refresh + auto poll every 8s

## Build
```bash
cd native-admin
./gradlew :app:assembleDebug
```
APK: `app/build/outputs/apk/debug/app-debug.apk`

## Security
Uses the same Supabase anon key + RLS; all mutations go through existing `admin_*` RPCs that require admin role.
