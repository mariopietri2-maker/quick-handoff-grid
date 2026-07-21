#!/usr/bin/env bash
# Set Supabase Edge secret for FCM from a local gitignored file.
#
# Prefer HTTP v1 (service account):
#   mobile-signing/firebase/firebase-service-account.json
#   → sets FIREBASE_SERVICE_ACCOUNT_JSON (+ FIREBASE_PROJECT_ID if present)
#
# Or legacy server key file:
#   mobile-signing/firebase/fcm-server-key.txt
#   → sets FCM_SERVER_KEY
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DIR="$ROOT/mobile-signing/firebase"
PROJECT_REF="${SUPABASE_PROJECT_REF:-ojkesspghyqmjmupybva}"

SA="$DIR/firebase-service-account.json"
KEYFILE="$DIR/fcm-server-key.txt"

if [ -f "$SA" ]; then
  # Compact JSON into one line for the secrets CLI
  JSON=$(python3 -c 'import json,sys; print(json.dumps(json.load(open(sys.argv[1])), separators=(",",":")))' "$SA")
  PROJECT_ID=$(python3 -c 'import json,sys; print(json.load(open(sys.argv[1])).get("project_id",""))' "$SA")
  npx supabase secrets set --project-ref "$PROJECT_REF" "FIREBASE_SERVICE_ACCOUNT_JSON=$JSON"
  if [ -n "$PROJECT_ID" ]; then
    npx supabase secrets set --project-ref "$PROJECT_REF" "FIREBASE_PROJECT_ID=$PROJECT_ID"
  fi
  echo "Set FIREBASE_SERVICE_ACCOUNT_JSON (+ PROJECT_ID=$PROJECT_ID)"
  exit 0
fi

if [ -f "$KEYFILE" ]; then
  KEY=$(tr -d '\n\r ' < "$KEYFILE")
  npx supabase secrets set --project-ref "$PROJECT_REF" "FCM_SERVER_KEY=$KEY"
  echo "Set FCM_SERVER_KEY"
  exit 0
fi

echo "Missing $SA or $KEYFILE — download from Firebase Console first." >&2
echo "See docs/FIREBASE_PUSH.md" >&2
exit 1
