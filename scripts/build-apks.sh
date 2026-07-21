#!/usr/bin/env bash
# Rebuild offline customer + driver debug APKs from current web sources.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

# MMDDHHMM — unique per minute. Strip leading zeros so Groovy doesn't treat
# it as an invalid octal (e.g. July → 0721… fails). Always fits 32-bit int.
VERSION_CODE="${APK_VERSION_CODE:-$(date -u +%-m%d%H%M)}"
VERSION_NAME="${APK_VERSION_NAME:-1.0.${VERSION_CODE}}"

bump_version() {
  local app_dir="$1"
  local gradle="$app_dir/app/build.gradle"
  if [ ! -f "$gradle" ]; then
    echo "missing $gradle" >&2
    exit 1
  fi
  # Portable in-place edit for versionCode / versionName in defaultConfig
  python3 - "$gradle" "$VERSION_CODE" "$VERSION_NAME" <<'PY'
import re, sys
path, code, name = sys.argv[1], sys.argv[2], sys.argv[3]
text = open(path).read()
text2 = re.sub(r"versionCode\s+\d+", f"versionCode {code}", text, count=1)
text2 = re.sub(r'versionName\s+"[^"]*"', f'versionName "{name}"', text2, count=1)
if text2 == text:
    # Already at this version (rebuild same minute) — bump +1 so install still updates
    try:
        code_i = int(code) + 1
        name2 = re.sub(r"\d+$", str(code_i), name)
        text2 = re.sub(r"versionCode\s+\d+", f"versionCode {code_i}", text, count=1)
        text2 = re.sub(r'versionName\s+"[^"]*"', f'versionName "{name2}"', text2, count=1)
        code, name = str(code_i), name2
    except Exception as e:
        raise SystemExit(f"failed to bump versions in {path}: {e}")
open(path, "w").write(text2)
print(f"versionCode={code} versionName={name} -> {path}")
PY
}

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
    "SplashScreen": { "backgroundColor": "#0f172a", "launchAutoHide": true }$geo_plugin,
    "PushNotifications": { "presentationOptions": ["badge", "sound", "alert"] }
  }
}
EOF
}

sync_flavor() {
  local flavor="$1"
  local app_dir="$2"
  local app_id="$3"
  local app_name="$4"

  if [ ! -d "$app_dir" ]; then
    echo "missing $app_dir - run npx cap add android with flavor configs first" >&2
    exit 1
  fi

  echo "==> web build ($flavor)"
  VITE_MOBILE_APP="$flavor" npm run build

  local assets="$app_dir/app/src/main/assets"
  local public="$assets/public"
  rm -rf "$public"
  mkdir -p "$public"
  cp -a dist/. "$public/"

  write_cap_config "$flavor" "$app_dir" "$app_id" "$app_name"
  bump_version "$app_dir"

  echo "==> gradle assembleDebug ($flavor)"
  (cd "$app_dir" && ./gradlew clean assembleDebug)

  mkdir -p mobile-apks
  cp -f "$app_dir/app/build/outputs/apk/debug/app-debug.apk" "mobile-apks/fresh-${flavor}-debug.apk"
  echo "==> wrote mobile-apks/fresh-${flavor}-debug.apk"
}

echo "==> APK versionCode=$VERSION_CODE versionName=$VERSION_NAME"
sync_flavor customer android-customer com.freshdelivery.customer "Fresh Customer"
sync_flavor driver android-driver com.freshdelivery.driver "Fresh Driver"
ls -lah mobile-apks/
sha256sum mobile-apks/*.apk

