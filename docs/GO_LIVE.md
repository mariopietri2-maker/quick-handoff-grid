# Go-Live Checklist — Fresh Delivery

Before public launch. Verified against the current codebase (Aug 2026).

## 1. Stripe — live card payments

Client key lives in `VITE_PAYMENTS_CLIENT_TOKEN` (`.env.production` currently `pk_test_…`).
The 4 server secrets live in Supabase Edge Function secrets. The admin panel can switch
the publishable key at runtime without a redeploy.

### A. Stripe Dashboard (live mode) → Developers → API keys
- Copy publishable key `pk_live_…`
- Copy secret key `sk_live_…` (shown only once)
- Developers → Webhooks → **Add endpoint** → URL:

```
https://ojkesspghyqmjmupybva.supabase.co/functions/v1/payments-webhook?env=live
```

- Events: **`checkout.session.completed`** + **`payment_intent.succeeded`**
  (+ `payment_intent.payment_failed` if you want failed orders auto-cancelled)
  → copy signing secret `whsec_live_…`

`payment_intent.succeeded` is required for **saved cards**: the webhook mirrors
cards the customer chose to save, and stores `stripe_payment_intent_id` on the
order (which automated card refunds depend on).

### B. Supabase Dashboard → project `ojkesspghyqmjmupybva` → Project Settings → Edge Functions → Secrets
```
STRIPE_LIVE_API_KEY=sk_live_…
PAYMENTS_LIVE_WEBHOOK_SECRET=whsec_live_…
```
(Also add the sandbox equivalents `STRIPE_SANDBOX_API_KEY` / `PAYMENTS_SANDBOX_WEBHOOK_SECRET`
if the admin panel is ever switched to sandbox mode.)

### C. Site → Admin → Settings → Stripe
Paste `pk_live_…` → Save. Status chips should read **Λειτουργία = Live**.
Source of the key: Admin (DB) — no redeploy needed.

### D. Railway → env
`VITE_PAYMENTS_CLIENT_TOKEN=pk_live_…` (for future builds).
Do **not** put live keys in `.env.production` — never commit real secrets.

### E. Verify
Place a real test order (small amount): confirm the charge in Stripe, the webhook
delivered 200, and the order leaves `pending`.

## 2. Native APK rebuild (GitHub Actions)

- The `build-native-apks.yml` workflow builds `native-driver` + `native-customer`
  debug APKs/AABs and publishes to the `mobile-apks-v1` release (stable URL).
- Customer is on `2.6.0-native` (versionCode 251). Trigger: push touching
  `native-*/**` or **Actions → Build Native APKs → Run workflow** on `main`.
- README QR codes (`docs/qr-driver-apk.png`, `docs/qr-customer-apk.png`) point to
  that release, so they reflect the newest build automatically.
- Note: GitHub Actions was in a **major outage** while writing this — a queued
  dispatch (`main @ 97885cb0`) was waiting to start. Re-dispatch if it gets cancelled.

## 3. Minor checks
- `freshdelivery.app` DNS does not resolve — fix at the registrar if it should be a
  real domain; otherwise it is only an unused fallback origin
  (`SITE_FALLBACK_ORIGINS`).
- Launcher/theme: modern-fresh palette is applied (`#10B981` / `#7C6CFF`).

## 4. Automated card refunds, saved cards & alerting

**Deployment status (2026-08-12):** the three migrations (`20260812130000`,
`20260812140000`, `20260812150000` + the `20260812120000` cron/trigger fix) are all
applied to `ojkesspghyqmjmupybva` and recorded in `supabase_migrations`. The edge
functions `process-refunds`, `send-alerts`, `delete-card` are deployed (new), and
`create-checkout` / `payments-webhook` are re-deployed (updated). The cron→function
auth secret is working (see §A). What remains: supply the missing secrets and
flip on Stripe's saved-payment-methods setting (§A, §B).

### A. Edge Function secrets (Project Settings → Edge Functions → Secrets)
```
CRON_SECRET=799f94939d6009d0fc98c5982a247b71953550a515bf1a04d295661bb6349932
ALERT_WEBHOOK_URL=https://hooks.slack.com/services/T…/B…/…   # Slack or any JSON webhook
```
`CRON_SECRET` is **already set** to the value above. Note: on this project the DB
role `postgres` is not a superuser, so the canonical GUC pattern
(`ALTER ROLE postgres SET app.settings.cron_secret …`) fails with a permissions
error. Instead the secret has been **baked directly into each HTTP cron job's
command** (`cron.job.command`, `X-Cron-Secret` header), matching the edge secret.
If the crons are ever re-created from the migrations, re-apply the bake-in, or the
drain calls will return 401 again.

### B. Saved cards (1-tap reorder)
No config needed. `create-checkout` now creates/links a Stripe Customer per user,
and Embedded Checkout shows a "save this card" checkbox automatically. When the
customer saves a card, `payments-webhook` mirrors it into `customer_payment_methods`
(visible under Profile → Κάρτες). Reordering keeps the same customer, so the saved
card is offered again in checkout.

Requires "Saved payment methods" to be enabled in Stripe Dashboard
(Settings → Payment methods → Customer top-up / saved methods → On).

### C. Card refunds
Admin/Support → cancel a paid card order → choose **Στην κάρτα**. This enqueues a
`pending` refund row; the `process-refunds` cron (every 20s) executes the Stripe
refund idempotently and records the result on the `refunds` row. Failures retry up
to 5 times then stay `failed` and fire an alert. The customer is notified by
push on both outcomes («Επιστροφή χρημάτων» / «Η επιστροφή απέτυχε»). Admin →
Οικονομικά → **Επιστροφές** shows every refund (status/amount/method), and a
**Retry** button on failed card refunds calls `retry_failed_card_refund`.

### D. Alerting
Ops webhook (Slack) receives alerts for: stuck orders (watchdog every 5 min),
card-refund failures, and Stripe webhook errors. Data is visible in
`alert_outbox`.

### E. Verify
Run the read-only diagnostic in `supabase/scripts/verify_refunds_alerts_cards.sql`
(Supabase Dashboard → SQL Editor). Every row should show **OK**; it checks the
new columns/tables/RPCs/grants/indexes and that the `process-refunds-20s`,
`send-alerts-30s`, `watchdog-stuck-orders-5m` crons hit the real project with
`X-Cron-Secret`. Then place a small card order, save the card, cancel it with
**Στην κάρτα**, and confirm the Stripe refund appears in the Dashboard and the
`refunds` row flips to `succeeded`.

### F. Remaining items (not yet done on prod)
- **ALERT_WEBHOOK_URL** — not set; `send-alerts` currently marks queued alerts as
  terminal (`no_webhook_url`) instead of delivering. Set the secret, then any new
  alert (stuck order, refund failure, webhook error) posts to Slack/webhook.
- **Stripe keys** — `STRIPE_LIVE_API_KEY` and `PAYMENTS_LIVE_WEBHOOK_SECRET` are
  NOT set; `create-checkout`/`payments-webhook`/`process-refunds` will fail until
  they are. Set them, and register the `payments-webhook` endpoint
  (`…/functions/v1/payments-webhook?env=live`) with `checkout.session.completed`
  + `payment_intent.succeeded` (+ optionally `payment_intent.payment_failed`).
- **Stripe Dashboard → Settings → Payment methods**: enable **Saved payment
  methods / Customer top-up** so the "save this card" checkbox shows in Embedded
  Checkout (1-tap reorder).
