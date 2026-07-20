#!/usr/bin/env bash
# Rebuild offline customer + driver debug APKs from current web sources.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

write_cap_config() {
  local flavor="$1"
  local app_dir="$2"
  local app_id="$3"
  local app_name="$4"
  local assets="$app_dir/app/src/main/assets"
  local geo_plugin=''
  if [ "$flavor" = "driver" ]; then
    geo_plugin=',
    "Geolocation": {}'
  fi

  cat > "$assets/capacitor.config.json" <<EOF
{
  "appId": "$app_id",
  "appName": "$app_name",
  "webDir": "dist",
  "server": {
    "androidScheme": "https",
    "hostname": "localhost",
    "allowNavigation": [
      "https://ojkesspghyqmjmupybva.supabase.co/*",
      "https://*.supabase.co/*",
      "https://quick-handoff-grid.vercel.app/*",
      "https://api.mapbox.com/*"
    ]
  },
  "android": {
    "path": "$app_dir",
    "backgroundColor": "#0f172a",
    "webContentsDebuggingEnabled": true
  },
  "plugins": {
    "CapacitorHttp": { "enabled": true },
    "StatusBar": { "style": "DARK", "backgroundColor": "#0f172a", "overlaysWebView": true },
    "SplashScreen": { "backgroundColor": "#0f172a", "launchAutoHide": true }$geo_plugin
  }
}
EOF
}

sync_flavor() {
  local flavor="$1"
  local app_dir="$2"
  local app_id="$3"
  local app_name="$4"

  echo "==> web build ($flavor)"
  VITE_MOBILE_APP="$flavor" npm run build

  local assets="$app_dir/app/src/main/assets"
  local public="$assets/public"
  rm -rf "$public"
  mkdir -p "$public"
  cp -a dist/. "$public/"

  write_cap_config "$flavor" "$app_dir" "$app_id" "$app_name"

  echo "==> gradle assembleDebug ($flavor)"
  (cd "$app_dir" && ./gradlew clean assembleDebug)

  mkdir -p mobile-apks
  cp -f "$app_dir/app/build/outputs/apk/debug/app-debug.apk" "mobile-apks/fresh-${flavor}-debug.apk"
  echo "==> wrote mobile-apks/fresh-${flavor}-debug.apk"
}

sync_flavor customer android-customer com.freshdelivery.customer "Fresh Customer"
sync_flavor driver android-driver com.freshdelivery.driver "Fresh Driver"
ls -lah mobile-apks/
