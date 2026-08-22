#!/usr/bin/env bash
# =============================================================================
# setup-production-secrets.sh
# -----------------------------------------------------------------------------
# One-shot provisioning of the production edge-function secrets via the Supabase
# CLI. Values are read from the environment ONLY — never typed inline and never
# echoed. It refuses to run if any value still looks like a placeholder.
#
# PREREQUISITES
#   - supabase CLI installed and logged in (SUPABASE_ACCESS_TOKEN)
#   - project linked:  supabase link --project-ref ojkesspghyqmjmupybva
#   - the new CRON_SECRET generated with:  openssl rand -hex 32
#
# USAGE
#   CRON_SECRET=<64-hex> \
#   STRIPE_LIVE_API_KEY=sk_live_... \
#   PAYMENTS_LIVE_WEBHOOK_SECRET=whsec_live_... \
#   ALERT_WEBHOOK_URL=https://hooks.slack.com/services/... \
#   ./scripts/setup-production-secrets.sh
#
# AFTER THIS SCRIPT
#   1. Run supabase/scripts/rotate_cron_secret.sql (SQL Editor) with the SAME
#      CRON_SECRET so every pg_cron job's X-Cron-Secret header matches.
#   2. Register the payments-webhook endpoint (Stripe Dashboard → Webhooks):
#      https://<project-ref>.supabase.co/functions/v1/payments-webhook?env=live
#      events: checkout.session.completed, payment_intent.succeeded.
#   3. Run supabase/scripts/verify_cron_and_aade.sql (SQL Editor) → all OK.
# =============================================================================

set -euo pipefail

PROJECT_REF="${PROJECT_REF:-ojkesspghyqmjmupybva}"

is_placeholder() {
  [[ "$1" == *"<"* || "$1" == *"REPLACE"* || "$1" == *"…"* || "$1" == *"?"* || -z "$1" ]]
}

fail=""
[[ "${CRON_SECRET:-}" =~ ^[0-9a-fA-F]{64}$ ]] \
  || fail="$fail\n  - CRON_SECRET must be a 64-char hex value (openssl rand -hex 32)"
for v in STRIPE_LIVE_API_KEY PAYMENTS_LIVE_WEBHOOK_SECRET ALERT_WEBHOOK_URL; do
  is_placeholder "${!v:-}" && fail="$fail\n  - $v is missing or still a placeholder"
done

if [[ -n "$fail" ]]; then
  echo "Refusing to run:"
  printf "$fail\n"
  exit 1
fi

echo "Setting secrets for project $PROJECT_REF (no values are printed)..."
supabase secrets set \
  --project-ref "$PROJECT_REF" \
  "CRON_SECRET=$CRON_SECRET" \
  "STRIPE_LIVE_API_KEY=$STRIPE_LIVE_API_KEY" \
  "PAYMENTS_LIVE_WEBHOOK_SECRET=$PAYMENTS_LIVE_WEBHOOK_SECRET" \
  "ALERT_WEBHOOK_URL=$ALERT_WEBHOOK_URL"

echo
echo "Secrets set. Next steps:"
echo "  1. supabase/scripts/rotate_cron_secret.sql  (SQL Editor, same CRON_SECRET)"
echo "  2. Stripe Dashboard → Webhooks → add endpoint for payments-webhook (env=live)"
echo "  3. supabase/scripts/verify_cron_and_aade.sql → all OK"
