#!/usr/bin/env bash
# Scaffold / sync Capacitor iOS projects for App Store (customer + driver).
# Generating the Xcode projects works on Linux; *archiving/signing* requires macOS + Xcode.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

VERSION_NAME="${IOS_VERSION_NAME:-${APK_VERSION_NAME:-1.0.7231500}}"
# CFBundleVersion must be an integer for App Store Connect.
VERSION_BUILD="${IOS_BUILD_NUMBER:-${APK_VERSION_CODE:-7231500}}"

BACKUP="$ROOT/capacitor.config.ts.storebak"

write_ios_cap_config() {
  local flavor="$1"
  local ios_dir="ios-${flavor}"
  local app_id app_name
  local geo_plugin=''
  if [ "$flavor" = "customer" ]; then
    app_id="com.freshdelivery.customer"
    app_name="Fresh Customer"
    geo_plugin=',
    "Geolocation": {},
    "BackgroundGeolocation": {
      "notificationTitle": "Fresh Customer — location",
      "notificationText": "Live order tracking"
    }'
  else
    app_id="com.freshdelivery.driver"
    app_name="Fresh Driver"
    geo_plugin=',
    "Geolocation": {},
    "BackgroundGeolocation": {
      "notificationTitle": "Διαθέσιμος",
      "notificationText": "Είσαι συνδεδεμένος και σε θέση να δεχτείς παραγγελίες"
    }'
  fi

  local dest
  dest="$(find "$ios_dir" -path '*/App/capacitor.config.json' 2>/dev/null | head -1 || true)"
  if [ -z "$dest" ]; then
    echo "warn: capacitor.config.json missing under $ios_dir" >&2
    return 0
  fi

  cat > "$dest" <<EOF
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
      "https://quick-handoff-grid-production.up.railway.app/*",
      "https://api.mapbox.com/*"
    ]
  },
  "ios": {
    "path": "$ios_dir",
    "backgroundColor": "#0f172a",
    "contentInset": "never",
    "scrollEnabled": false
  },
  "plugins": {
    "CapacitorHttp": { "enabled": true },
    "StatusBar": { "style": "DARK", "backgroundColor": "#0f172a", "overlaysWebView": true },
    "SplashScreen": { "backgroundColor": "#0f172a", "launchAutoHide": true }$geo_plugin,
    "PushNotifications": { "presentationOptions": ["badge", "sound", "alert"] }
  }
}
EOF
  echo "wrote release capacitor.config.json -> $dest"
}

patch_info_plist() {
  local flavor="$1"
  local ios_dir="ios-${flavor}"
  local plist
  plist="$(find "$ios_dir" -name Info.plist -path '*/App/*' 2>/dev/null | head -1 || true)"
  if [ -z "${plist:-}" ] || [ ! -f "$plist" ]; then
    echo "warn: Info.plist not found under $ios_dir" >&2
    return 0
  fi

  python3 - "$plist" "$flavor" <<'PY'
import sys
path, flavor = sys.argv[1], sys.argv[2]
text = open(path).read()

entries = {
  "NSCameraUsageDescription": "Used to take photos for delivery proof when required.",
  "NSPhotoLibraryUsageDescription": "Used to attach photos to support tickets.",
  "NSLocationWhenInUseUsageDescription": (
    "Your location is used while you track an active order so the driver can find you."
    if flavor == "customer" else
    "Your location is used to show you on the map and assign nearby delivery orders while you are online."
  ),
  "NSLocationAlwaysAndWhenInUseUsageDescription": (
    "Background location keeps your order tracking accurate while the app is in the background during an active delivery."
    if flavor == "customer" else
    "Background location keeps dispatch accurate while you are online or on an active delivery."
  ),
}

if flavor == "driver":
  entries["NSMotionUsageDescription"] = "Motion data may improve navigation while delivering."

for key, value in entries.items():
  if f"<key>{key}</key>" in text:
    continue
  snippet = f"\t<key>{key}</key>\n\t<string>{value}</string>\n"
  text = text.replace("</dict>\n</plist>", snippet + "</dict>\n</plist>", 1)

# Background modes: location + remote notifications (push)
if "UIBackgroundModes" not in text:
  bg = """\t<key>UIBackgroundModes</key>
\t<array>
\t\t<string>location</string>
\t\t<string>remote-notification</string>
\t</array>
"""
  text = text.replace("</dict>\n</plist>", bg + "</dict>\n</plist>", 1)

# Portrait-first for delivery apps
if "UIInterfaceOrientationPortrait" in text and "UISupportedInterfaceOrientations</key>" in text:
  # Prefer portrait-only for phone; leave as-is if already customized.
  pass

open(path, "w").write(text)
print(f"privacy + background modes -> {path}")
PY
}

write_entitlements() {
  local flavor="$1"
  local ios_dir="ios-${flavor}"
  local app_dir
  app_dir="$(find "$ios_dir" -type d -path '*/App/App' 2>/dev/null | head -1 || true)"
  if [ -z "$app_dir" ]; then
    echo "warn: App/App dir missing under $ios_dir" >&2
    return 0
  fi
  local ents="$app_dir/App.entitlements"
  cat > "$ents" <<'EOF'
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
	<key>aps-environment</key>
	<string>production</string>
</dict>
</plist>
EOF
  echo "wrote entitlements -> $ents"

  # Point Xcode project at entitlements if not already set.
  local pbx
  pbx="$(find "$ios_dir" -name project.pbxproj 2>/dev/null | head -1 || true)"
  if [ -n "$pbx" ] && ! grep -q 'CODE_SIGN_ENTITLEMENTS' "$pbx"; then
    python3 - "$pbx" <<'PY'
import re, sys
path = sys.argv[1]
text = open(path).read()
# Insert entitlements into both Debug/Release target build settings blocks that have PRODUCT_BUNDLE_IDENTIFIER
needle = "PRODUCT_BUNDLE_IDENTIFIER = "
insert = '\t\t\t\tCODE_SIGN_ENTITLEMENTS = App/App.entitlements;\n'
out = []
for line in text.splitlines(True):
    out.append(line)
    if "PRODUCT_BUNDLE_IDENTIFIER =" in line and "CODE_SIGN_ENTITLEMENTS" not in "".join(out[-5:]):
        # Add after bundle id line inside the same settings block
        out.append(insert)
text2 = "".join(out)
# Avoid duplicates if run twice
while text2.count("CODE_SIGN_ENTITLEMENTS = App/App.entitlements;") > 4:
    text2 = text2.replace("\t\t\t\tCODE_SIGN_ENTITLEMENTS = App/App.entitlements;\n", "", 1)
open(path, "w").write(text2)
print(f"CODE_SIGN_ENTITLEMENTS -> {path}")
PY
  fi
}

bump_ios_versions() {
  local ios_dir="$1"
  local pbx
  pbx="$(find "$ios_dir" -name project.pbxproj 2>/dev/null | head -1 || true)"
  if [ -z "$pbx" ]; then
    return 0
  fi
  python3 - "$pbx" "$VERSION_BUILD" "$VERSION_NAME" <<'PY'
import re, sys
path, build, name = sys.argv[1], sys.argv[2], sys.argv[3]
text = open(path).read()
text = re.sub(r"CURRENT_PROJECT_VERSION = [^;]+;", f"CURRENT_PROJECT_VERSION = {build};", text)
text = re.sub(r"MARKETING_VERSION = [^;]+;", f"MARKETING_VERSION = {name};", text)
open(path, "w").write(text)
print(f"version {name} ({build}) -> {path}")
PY
}

sync_ios() {
  local flavor="$1"
  local config="capacitor.${flavor}.config.ts"
  local ios_dir="ios-${flavor}"

  echo "==> web build ($flavor)"
  VITE_MOBILE_APP="$flavor" npm run build

  cp -f "$ROOT/capacitor.config.ts" "$BACKUP"
  cp -f "$ROOT/$config" "$ROOT/capacitor.config.ts"

  cleanup() {
    if [ -f "$BACKUP" ]; then
      mv -f "$BACKUP" "$ROOT/capacitor.config.ts"
    fi
  }
  trap cleanup EXIT

  if [ ! -d "$ios_dir/App" ]; then
    echo "==> cap add ios ($flavor) → $ios_dir"
    npx cap add ios
  else
    echo "==> cap sync ios ($flavor)"
    CAPACITOR_DEV=0 npx cap sync ios || true
  fi

  cleanup
  trap - EXIT

  write_ios_cap_config "$flavor"
  patch_info_plist "$flavor"
  write_entitlements "$flavor"
  bump_ios_versions "$ios_dir"

  echo "==> $ios_dir ready for Xcode on a Mac"
}

echo "==> iOS versionName=$VERSION_NAME build=$VERSION_BUILD"
sync_ios customer
sync_ios driver

mkdir -p store-bundles
# Zip projects for Mac handoff (CocoaPods install happens on the Mac).
rm -f store-bundles/fresh-customer-ios-xcode.zip store-bundles/fresh-driver-ios-xcode.zip
(
  cd "$ROOT"
  zip -qry store-bundles/fresh-customer-ios-xcode.zip ios-customer \
    -x '*/Pods/*' -x '*/build/*' -x '*/DerivedData/*' -x '*.DS_Store'
  zip -qry store-bundles/fresh-driver-ios-xcode.zip ios-driver \
    -x '*/Pods/*' -x '*/build/*' -x '*/DerivedData/*' -x '*.DS_Store'
)
ls -lah store-bundles/fresh-*-ios-xcode.zip
sha256sum store-bundles/fresh-*-ios-xcode.zip

cat <<EOF

═══════════════════════════════════════════════════════════
iOS projects prepared (v$VERSION_NAME / build $VERSION_BUILD)

  store-bundles/fresh-customer-ios-xcode.zip  →  com.freshdelivery.customer
  store-bundles/fresh-driver-ios-xcode.zip    →  com.freshdelivery.driver

Linux cannot produce a signed App Store IPA (needs macOS + Xcode + your Apple team).

On a Mac:
  1. Unzip each archive
  2. open ios-customer/App/App.xcodeproj
     (Capacitor 8 uses Swift Package Manager — Xcode resolves packages on first open.
      If a Podfile exists instead: pod install && open App.xcworkspace)
  3. Signing & Capabilities → select your Team
     Enable: Push Notifications, Background Modes (Location + Remote notifications)
  4. Product → Archive → Distribute App → App Store Connect
  5. Repeat for ios-driver

Register bundle IDs: https://developer.apple.com/account/resources/identifiers
Create apps: https://appstoreconnect.apple.com
Optional: add GoogleService-Info.plist per app for FCM (see docs/FIREBASE_PUSH.md)
═══════════════════════════════════════════════════════════
EOF
