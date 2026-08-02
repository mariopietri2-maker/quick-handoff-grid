#!/usr/bin/env bash
# Apply pending migrations + deploy edge functions needed for AI support / pricing / address cache.
# Requires: SUPABASE_ACCESS_TOKEN (https://supabase.com/dashboard/account/tokens)
set -euo pipefail
REF="${SUPABASE_PROJECT_REF:-ojkesspghyqmjmupybva}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if [[ -z "${SUPABASE_ACCESS_TOKEN:-}" ]]; then
  echo "Set SUPABASE_ACCESS_TOKEN first (Supabase account access token)."
  exit 1
fi

npx supabase link --project-ref "$REF"

echo "→ Pushing DB migrations..."
npx supabase db push --linked

echo "→ Deploying edge functions..."
npx supabase functions deploy support-ai --project-ref "$REF" --no-verify-jwt
npx supabase functions deploy ai-dynamic-pricing --project-ref "$REF" --no-verify-jwt
npx supabase functions deploy google-geocode --project-ref "$REF"

echo "Done. In Admin → AI Dynamic Pricing: enable → dry-run → Εφαρμογή τώρα."
echo "Ensure secrets AI_GATEWAY_API_KEY and CRON_SECRET are set on the project."
