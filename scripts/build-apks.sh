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
  # Driver: no foreground OS sound — in-app fresh2go chime owns it.
  # Customer / others: keep badge+sound+alert for order updates.
  local push_presentation='["badge", "sound", "alert"]'
  if [ "$flavor" = "driver" ]; then
    push_presentation='["badge", "alert"]'
    geo_plugin=',
    "Geolocation": {},
    "BackgroundGeolocation": {
      "notificationTitle": "Διαθέσιμος",
      "notificationText": "Είσαι συνδεδεμένος και σε θέση να δεχτείς παραγγελίες"
    }'
  elif [ "$flavor" = "customer" ]; then
    geo_plugin=',
    "Geolocation": {},
    "BackgroundGeolocation": {
      "notificationTitle": "fresh2go — τοποθεσία",
      "notificationText": "Ζωντανή παρακολούθηση παραγγελίας"
    }'
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
      "https://freshdelivery.app/*",
      "https://ojkesspghyqmjmupybva.supabase.co/*",
      "https://*.supabase.co/*",
      "https://quick-handoff-grid-production.up.railway.app/*",
      "https://fresh-delivery-rho.vercel.app/*",
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
    "SplashScreen": { "backgroundColor": "#0f172a", "launchAutoHide": true, "launchShowDuration": 400, "launchFadeOutDuration": 280 },
    "Keyboard": { "resize": "body", "resizeOnFullScreen": true }$geo_plugin,
    "PushNotifications": { "presentationOptions": $push_presentation }
  }
}
EOF
}

# Inject Mapbox downloads token so the capacitor-mapbox-maps plugin can resolve
# com.mapbox.maps:android from api.mapbox.com/downloads Maven.
patch_mapbox_token() {
  local app_dir="$1"
  local token="${MAPBOX_DOWNLOADS_TOKEN:-}"
  if [ -z "$token" ] && [ -f "$ROOT/.env.development" ]; then
    token=$(grep -E '^MAPBOX_DOWNLOADS_TOKEN=' "$ROOT/.env.development" | cut -d= -f2- | tr -d '"' | tr -d "'" || true)
  fi
  if [ -z "$token" ] && [ -f "$ROOT/.env" ]; then
    token=$(grep -E '^MAPBOX_DOWNLOADS_TOKEN=' "$ROOT/.env" | cut -d= -f2- | tr -d '"' | tr -d "'" || true)
  fi
  if [ -z "$token" ]; then
    echo "WARN: MAPBOX_DOWNLOADS_TOKEN not set — Mapbox Maps SDK resolve may fail for driver"
    return 0
  fi
  local gp="$app_dir/gradle.properties"
  mkdir -p "$app_dir"
  touch "$gp"
  if grep -q 'MAPBOX_DOWNLOADS_TOKEN' "$gp" 2>/dev/null; then
    sed -i "s|^MAPBOX_DOWNLOADS_TOKEN=.*|MAPBOX_DOWNLOADS_TOKEN=$token|" "$gp" || true
  else
    echo "MAPBOX_DOWNLOADS_TOKEN=$token" >> "$gp"
  fi
  if grep -q 'systemProp.mapboxDownloadsToken' "$gp" 2>/dev/null; then
    sed -i "s|^systemProp.mapboxDownloadsToken=.*|systemProp.mapboxDownloadsToken=$token|" "$gp" || true
  else
    echo "systemProp.mapboxDownloadsToken=$token" >> "$gp"
  fi
  echo "==> patched Mapbox downloads token into $gp"
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

  # Keep Capacitor native plugins in sync (android-* dirs are gitignored).
  if [ "$flavor" = "driver" ] || [ "$flavor" = "customer" ]; then
    echo "==> cap sync android ($flavor)"
    local backup="$ROOT/capacitor.config.ts.apkbak"
    cp -f "$ROOT/capacitor.config.ts" "$backup"
    cp -f "$ROOT/capacitor.${flavor}.config.ts" "$ROOT/capacitor.config.ts"
    npx cap sync android || true
    mv -f "$backup" "$ROOT/capacitor.config.ts"
    # Re-apply our assets config + custom sounds after sync overwrites public/
    write_cap_config "$flavor" "$app_dir" "$app_id" "$app_name"
    mkdir -p "$app_dir/app/src/main/res/raw"
    if [ "$flavor" = "driver" ]; then
      cp -f "$ROOT/src/assets/sounds/fresh_delivery.mp3" "$app_dir/app/src/main/res/raw/fresh_delivery.mp3" 2>/dev/null || true
    fi
    if [ "$flavor" = "customer" ]; then
      cp -f "$ROOT/src/assets/sounds/customer_notify.mp3" "$app_dir/app/src/main/res/raw/customer_notify.mp3" 2>/dev/null || true
    fi
    if [ "$flavor" = "driver" ] || [ "$flavor" = "customer" ]; then
      # Ensure BG location + FG service permissions survive fresh capacitor scaffolds.
      python3 - "$app_dir/app/src/main/AndroidManifest.xml" <<'PY'
from pathlib import Path
import sys
path = Path(sys.argv[1])
text = path.read_text()
perms = [
  'android.permission.ACCESS_BACKGROUND_LOCATION',
  'android.permission.FOREGROUND_SERVICE_LOCATION',
  'android.permission.WAKE_LOCK',
  'android.permission.VIBRATE',
  'android.permission.POST_NOTIFICATIONS',
]
for p in perms:
    tag = f'<uses-permission android:name="{p}" />'
    if tag not in text:
        text = text.replace('</manifest>', f'    {tag}\n</manifest>')
path.write_text(text)
print(f'patched permissions -> {path}')
PY
    fi
    # Mapbox SDK Maven token for driver (native Maps plugin)
    if [ "$flavor" = "driver" ]; then
      patch_mapbox_token "$app_dir"
    fi
  fi

  bump_version "$app_dir"

  echo "==> gradle assembleDebug ($flavor)"
  local gradle_cmd="./gradlew"
  if [ ! -f "$app_dir/gradlew" ] && [ -f "$app_dir/gradlew.bat" ]; then
    gradle_cmd="./gradlew.bat"
  fi
  chmod +x "$app_dir/gradlew" 2>/dev/null || true
  (cd "$app_dir" && "$gradle_cmd" clean assembleDebug)

  mkdir -p mobile-apks
  cp -f "$app_dir/app/build/outputs/apk/debug/app-debug.apk" "mobile-apks/fresh-${flavor}-debug.apk"
  echo "==> wrote mobile-apks/fresh-${flavor}-debug.apk"
}

echo "==> APK versionCode=$VERSION_CODE versionName=$VERSION_NAME"
# Apply Firebase google-services.json when the owner has dropped files in
# mobile-signing/firebase/ (see docs/FIREBASE_PUSH.md). Missing files are OK —
# APKs still build; killed-app FCM simply won't register.
if [ -x "$ROOT/scripts/apply-firebase-android.sh" ] || [ -f "$ROOT/scripts/apply-firebase-android.sh" ]; then
  bash "$ROOT/scripts/apply-firebase-android.sh" || true
fi
sync_flavor customer android-customer com.freshdelivery.customer "fresh2go"
sync_flavor driver android-driver com.freshdelivery.driver "fresh2go Driver"
ls -lah mobile-apks/
sha256sum mobile-apks/*.apk
