#!/usr/bin/env bash
# Copy Firebase Android configs into Capacitor app folders before APK build.
# Expected inputs (gitignored):
#   mobile-signing/firebase/google-services.customer.json
#   mobile-signing/firebase/google-services.driver.json
# Optional single file used for both:
#   mobile-signing/firebase/google-services.json
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SRC="$ROOT/mobile-signing/firebase"

copy_one() {
  local flavor="$1"
  local dest_dir="$ROOT/android-${flavor}/app"
  local named="$SRC/google-services.${flavor}.json"
  local shared="$SRC/google-services.json"
  mkdir -p "$dest_dir"
  if [ -f "$named" ]; then
    cp -f "$named" "$dest_dir/google-services.json"
    echo "applied $named -> android-${flavor}/app/google-services.json"
  elif [ -f "$shared" ]; then
    cp -f "$shared" "$dest_dir/google-services.json"
    echo "applied $shared -> android-${flavor}/app/google-services.json (shared)"
  else
    echo "WARN: no google-services for ${flavor} (push FCM disabled until file is placed in mobile-signing/firebase/)" >&2
    return 1
  fi
  return 0
}

ok=0
copy_one customer && ok=$((ok + 1)) || true
copy_one driver && ok=$((ok + 1)) || true
if [ "$ok" -eq 0 ]; then
  echo "Firebase google-services.json missing — APK will build without FCM." >&2
  exit 0
fi
echo "Firebase configs applied ($ok/2)."
