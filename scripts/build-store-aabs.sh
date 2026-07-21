#!/usr/bin/env bash
# Build signed Play Store Android App Bundles (.aab) for customer + driver.
# Requires: ./scripts/setup-play-signing.sh (once) and JDK + Android SDK.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

PROPS="$ROOT/mobile-signing/key.properties"
if [ ! -f "$PROPS" ]; then
  echo "Missing $PROPS — run ./scripts/setup-play-signing.sh first" >&2
  exit 1
fi

# shellcheck disable=SC1090
source <(grep -E '^[a-zA-Z]+=' "$PROPS" | sed 's/^/export /')

VERSION_CODE="${APK_VERSION_CODE:-$(date -u +%y%m%d%H)}"
VERSION_NAME="${APK_VERSION_NAME:-1.0.${VERSION_CODE}}"

bump_version() {
  local gradle="$1/app/build.gradle"
  python3 - "$gradle" "$VERSION_CODE" "$VERSION_NAME" <<'PY'
import re, sys
path, code, name = sys.argv[1], sys.argv[2], sys.argv[3]
text = open(path).read()
text2 = re.sub(r"versionCode\s+\d+", f"versionCode {code}", text, count=1)
text2 = re.sub(r'versionName\s+"[^"]*"', f'versionName "{name}"', text2, count=1)
open(path, "w").write(text2)
print(f"versionCode={code} versionName={name} -> {path}")
PY
}

inject_signing() {
  local flavor="$1"
  local app_dir="$2"
  local gradle="$app_dir/app/build.gradle"
  local store_file key_alias store_pw key_pw
  if [ "$flavor" = "customer" ]; then
    store_file="$customerStoreFile"
    key_alias="$customerKeyAlias"
    store_pw="$customerStorePassword"
    key_pw="$customerKeyPassword"
  else
    store_file="$driverStoreFile"
    key_alias="$driverKeyAlias"
    store_pw="$driverStorePassword"
    key_pw="$driverKeyPassword"
  fi
  if [ ! -f "$store_file" ]; then
    echo "keystore missing: $store_file" >&2
    exit 1
  fi

  # Write per-app key.properties (paths relative to app/)
  cat > "$app_dir/app/key.properties" <<EOF
storeFile=$store_file
keyAlias=$key_alias
storePassword=$store_pw
keyPassword=$key_pw
EOF

  python3 - "$gradle" <<'PY'
import sys, re
path = sys.argv[1]
text = open(path).read()
if "signingConfigs" in text and "key.properties" in text:
    print(f"signing already present -> {path}")
    sys.exit(0)

block = '''
def keystorePropertiesFile = rootProject.file("app/key.properties")
def keystoreProperties = new Properties()
if (keystorePropertiesFile.exists()) {
    keystoreProperties.load(new FileInputStream(keystorePropertiesFile))
}

android {
'''
# Capacitor template already has `android {` — inject signing inside it.
needle = "android {"
idx = text.find(needle)
if idx < 0:
    raise SystemExit(f"no android {{ in {path}")

# Prefer inserting after defaultConfig block's closing, before buildTypes
insert = '''
    signingConfigs {
        release {
            if (keystorePropertiesFile.exists()) {
                keyAlias keystoreProperties['keyAlias']
                keyPassword keystoreProperties['keyPassword']
                storeFile file(keystoreProperties['storeFile'])
                storePassword keystoreProperties['storePassword']
            }
        }
    }
'''
# Load props at top of file once
header = '''def keystorePropertiesFile = rootProject.file("app/key.properties")
def keystoreProperties = new Properties()
if (keystorePropertiesFile.exists()) {
    keystoreProperties.load(new FileInputStream(keystorePropertiesFile))
}

'''
if "keystorePropertiesFile" not in text:
    text = header + text

# Make release use signingConfig
if "signingConfig signingConfigs.release" not in text:
    text = text.replace(
        """    buildTypes {
        release {
            minifyEnabled false
            proguardFiles getDefaultProguardFile('proguard-android.txt'), 'proguard-rules.pro'
        }
    }""",
        """    buildTypes {
        release {
            minifyEnabled false
            proguardFiles getDefaultProguardFile('proguard-android.txt'), 'proguard-rules.pro'
            signingConfig signingConfigs.release
        }
    }""",
    )

# Insert signingConfigs before buildTypes if missing
if "signingConfigs {" not in text:
    text = text.replace(
        "    buildTypes {",
        insert + "    buildTypes {",
        1,
    )

open(path, "w").write(text)
print(f"injected signingConfigs -> {path}")
PY
}

write_release_cap_config() {
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
  mkdir -p "$assets"
  # Store builds: no webContentsDebuggingEnabled
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
    "backgroundColor": "#0f172a"
  },
  "plugins": {
    "CapacitorHttp": { "enabled": true },
    "StatusBar": { "style": "DARK", "backgroundColor": "#0f172a", "overlaysWebView": true },
    "SplashScreen": { "backgroundColor": "#0f172a", "launchAutoHide": true }$geo_plugin
  }
}
EOF
}

sync_aab() {
  local flavor="$1"
  local app_dir="$2"
  local app_id="$3"
  local app_name="$4"

  echo "==> web build ($flavor)"
  VITE_MOBILE_APP="$flavor" npm run build

  local public="$app_dir/app/src/main/assets/public"
  rm -rf "$public"
  mkdir -p "$public"
  cp -a dist/. "$public/"

  write_release_cap_config "$flavor" "$app_dir" "$app_id" "$app_name"
  bump_version "$app_dir"
  inject_signing "$flavor" "$app_dir"

  echo "==> gradle bundleRelease ($flavor)"
  (cd "$app_dir" && ./gradlew clean bundleRelease)

  mkdir -p store-bundles
  local out="$app_dir/app/build/outputs/bundle/release/app-release.aab"
  cp -f "$out" "store-bundles/fresh-${flavor}-release.aab"
  echo "==> wrote store-bundles/fresh-${flavor}-release.aab"
}

echo "==> Store AAB versionCode=$VERSION_CODE versionName=$VERSION_NAME"
sync_aab customer android-customer com.freshdelivery.customer "Fresh Customer"
sync_aab driver android-driver com.freshdelivery.driver "Fresh Driver"
ls -lah store-bundles/
sha256sum store-bundles/*.aab
echo
echo "Upload each .aab in Play Console → Create app → Production/Testing → Create release"
echo "  customer: com.freshdelivery.customer"
echo "  driver:   com.freshdelivery.driver"
echo "Enroll in Play App Signing on first upload (recommended)."
