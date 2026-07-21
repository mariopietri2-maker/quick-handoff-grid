#!/usr/bin/env bash
# Create Play Console *upload* keystores for customer + driver.
# Run once, then back up mobile-signing/ somewhere safe (1Password, etc.).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DIR="$ROOT/mobile-signing"
mkdir -p "$DIR"

if ! command -v keytool >/dev/null; then
  echo "keytool not found (install a JDK)" >&2
  exit 1
fi

gen_one() {
  local flavor="$1"
  local alias="fresh-${flavor}"
  local jks="$DIR/fresh-${flavor}-upload.jks"
  if [ -f "$jks" ]; then
    echo "exists: $jks (skip)"
    return
  fi
  # Random passwords — written only to local passwords.txt / key.properties
  local store_pw key_pw
  store_pw="$(openssl rand -base64 24 | tr -d '/+=' | head -c 24)"
  key_pw="$store_pw"
  keytool -genkeypair \
    -keystore "$jks" \
    -alias "$alias" \
    -keyalg RSA \
    -keysize 2048 \
    -validity 10000 \
    -storepass "$store_pw" \
    -keypass "$key_pw" \
    -dname "CN=Fresh ${flavor^}, OU=Mobile, O=Fresh Delivery, L=Ioannina, ST=Epirus, C=GR"
  echo "${flavor}|${alias}|${store_pw}|${key_pw}|${jks}" >> "$DIR/passwords.txt"
  echo "created $jks"
}

gen_one customer
gen_one driver

# Write key.properties for Gradle (gitignored)
{
  echo "# Auto-generated $(date -u +%Y-%m-%dT%H:%M:%SZ) — do not commit"
  if [ -f "$DIR/passwords.txt" ]; then
    while IFS='|' read -r flavor alias store_pw key_pw jks; do
      if [ "$flavor" = "customer" ]; then
        echo "customerStoreFile=$jks"
        echo "customerKeyAlias=$alias"
        echo "customerStorePassword=$store_pw"
        echo "customerKeyPassword=$key_pw"
      else
        echo "driverStoreFile=$jks"
        echo "driverKeyAlias=$alias"
        echo "driverStorePassword=$store_pw"
        echo "driverKeyPassword=$key_pw"
      fi
    done < "$DIR/passwords.txt"
  fi
} > "$DIR/key.properties"

echo
echo "==> Upload keys ready in $DIR"
echo "    Back up key.properties + *.jks offline. Losing them blocks Play updates"
echo "    (unless you enroll in Play App Signing and only lose the *upload* key — still painful)."
echo "    Next: ./scripts/build-store-aabs.sh"
