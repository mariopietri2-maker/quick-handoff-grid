#!/usr/bin/env bash
# Rebuild offline customer + driver debug APKs from current web sources.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

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

  if [ "$flavor" = "driver" ]; then
    cat > "$assets/capacitor.config.json" <<EOF
{
  "appId": "$app_id",
  "appName": "$app_name",
  "webDir": "dist",
  "android": {
    "path": "$app_dir",
    "backgroundColor": "#0f172a",
    "webContentsDebuggingEnabled": true
  },
  "plugins": {
    "StatusBar": { "style": "DARK", "backgroundColor": "#0f172a", "overlaysWebView": true },
    "SplashScreen": { "backgroundColor": "#0f172a", "launchAutoHide": true },
    "Geolocation": {}
  }
}
EOF
  else
    cat > "$assets/capacitor.config.json" <<EOF
{
  "appId": "$app_id",
  "appName": "$app_name",
  "webDir": "dist",
  "android": {
    "path": "$app_dir",
    "backgroundColor": "#0f172a",
    "webContentsDebuggingEnabled": true
  },
  "plugins": {
    "StatusBar": { "style": "DARK", "backgroundColor": "#0f172a", "overlaysWebView": true },
    "SplashScreen": { "backgroundColor": "#0f172a", "launchAutoHide": true }
  }
}
EOF
  fi

  echo "==> gradle assembleDebug ($flavor)"
  (cd "$app_dir" && ./gradlew clean assembleDebug)

  mkdir -p mobile-apks
  cp -f "$app_dir/app/build/outputs/apk/debug/app-debug.apk" "mobile-apks/fresh-${flavor}-debug.apk"
  echo "==> wrote mobile-apks/fresh-${flavor}-debug.apk"
}

sync_flavor customer android-customer com.freshdelivery.customer "Fresh Customer"
sync_flavor driver android-driver com.freshdelivery.driver "Fresh Driver"
ls -lah mobile-apks/
