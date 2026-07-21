#!/usr/bin/env bash
# Scaffold / sync Capacitor iOS projects for App Store (customer + driver).
# Generating the Xcode projects works on Linux; *building/signing* requires macOS + Xcode.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

BACKUP="$ROOT/capacitor.config.ts.storebak"

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

  if [ ! -d "$ios_dir" ]; then
    echo "==> cap add ios ($flavor) → $ios_dir"
    # Capacitor reads ios.path from capacitor.config.ts
    npx cap add ios
  else
    echo "==> cap sync ios ($flavor)"
    npx cap sync ios
  fi

  cleanup
  trap - EXIT

  # Privacy strings required for App Store review
  local plist
  plist="$(find "$ios_dir" -name Info.plist -path '*/App/*' 2>/dev/null | head -1 || true)"
  if [ -z "$plist" ]; then
    plist="$(find "$ios_dir" -name Info.plist 2>/dev/null | head -1 || true)"
  fi
  if [ -n "${plist:-}" ] && [ -f "$plist" ]; then
    python3 - "$plist" "$flavor" <<'PY'
import sys
path, flavor = sys.argv[1], sys.argv[2]
text = open(path).read()
entries = {
  "NSCameraUsageDescription": "Used to take photos for delivery proof when required.",
  "NSPhotoLibraryUsageDescription": "Used to attach photos to support tickets.",
}
if flavor == "driver":
    entries["NSLocationWhenInUseUsageDescription"] = (
        "Your location is used to show you on the map and assign nearby delivery orders while you are online."
    )
    entries["NSLocationAlwaysAndWhenInUseUsageDescription"] = (
        "Background location keeps dispatch accurate while you are on an active delivery."
    )
    entries["NSMotionUsageDescription"] = "Motion data may improve navigation while delivering."

for key, value in entries.items():
    if key in text:
        continue
    snippet = f"\t<key>{key}</key>\n\t<string>{value}</string>\n"
    text = text.replace("</dict>\n</plist>", snippet + "</dict>\n</plist>", 1)
open(path, "w").write(text)
print(f"privacy strings -> {path}")
PY
  else
    echo "warn: Info.plist not found under $ios_dir" >&2
  fi

  echo "==> $ios_dir ready for Xcode on a Mac"
}

sync_ios customer
sync_ios driver

cat <<'EOF'

Next (on a Mac with Xcode + Apple Developer account):
  1. Open ios-customer/App/App.xcworkspace (or .xcodeproj)
  2. Signing & Capabilities → your Team, bundle id com.freshdelivery.customer
  3. Product → Archive → Distribute App → App Store Connect
  4. Repeat for ios-driver (com.freshdelivery.driver)
  5. Driver needs Location capability if using background GPS

Register both bundle IDs in https://developer.apple.com/account/resources/identifiers
Create apps in https://appstoreconnect.apple.com
EOF
