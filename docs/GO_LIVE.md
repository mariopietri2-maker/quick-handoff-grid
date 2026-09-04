# Go-Live Checklist — fresh2go

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

**Stripe Tax — required setup (calculation only).** Prices are VAT-inclusive
(menus show final amounts; the order totals are discounted in `place_order`).
`create-checkout` uses `automatic_tax: { enabled: true }` with
`tax_behavior: 'exclusive'`, so Stripe Tax must be in **calculation-only** mode
(Stripe Dashboard → Tax → not enabled to collect/remit). Otherwise Stripe would
add VAT on top of VAT-inclusive prices and the charged amount would mismatch the
order's `expected_charge_cents`, leaving orders stuck in `pending`. A one-off
coupon is created per order so the final charge always equals the discounted
total.

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

### D. Deploy env
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
- `freshdelivery.app` is now the **primary branded origin** (`SITE_ORIGIN` in
  `src/lib/site.ts`, SEO/og URLs, password-reset default, Capacitor
  `allowNavigation`, native deep links). Railway is the only host; Vercel is
  retired from the live path (its `allowNavigation` entries stay so already
  installed APKs keep working).
  Launch wiring (Railway-only):
  1. Railway → service → Settings → Networking → Custom Domain → add
     `freshdelivery.app` (+ `www`), note the DNS target Railway shows;
  2. Registrar → create the record(s) Railway asks for (CNAME for `www`;
     apex via CNAME-flattening/ALIAS or the A record if offered);
  3. Supabase Auth → URL Configuration → Site URL `https://freshdelivery.app`,
     redirect `https://freshdelivery.app/**`;
  4. Verify HTTPS cert is issued and the app loads on the domain.
- Launcher/theme: fresh2go blue palette is applied (`#1B4BA0` / `#2E6FE0`).

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
CRON_SECRET=<random 64-hex value>          # generate with: openssl rand -hex 32
ALERT_WEBHOOK_URL=https://hooks.slack.com/services/T…/B…/…   # Slack or any JSON webhook
```
> ⚠️ **Security note (2026-08-16):** the previous `CRON_SECRET` value was
> committed in this doc, so it must be treated as **compromised and rotated**.
> One-shot tooling makes both halves a single step:
> 1. `supabase/scripts/setup-production-secrets.sh` — sets `CRON_SECRET` (plus the
>    live Stripe/alert secrets) as edge-function secrets via the CLI,
> 2. `supabase/scripts/rotate_cron_secret.sql` — paste the **same** value into the
>    SQL Editor; it rewrites every pg_cron job's `X-Cron-Secret` header.
> And never write the real value into the repo again.

Note: on this project the DB role `postgres` is not a superuser, so the canonical
GUC pattern (`ALTER ROLE postgres SET app.settings.cron_secret …`) fails with a
permissions error. Instead the secret is **baked directly into each HTTP cron
job's command** (`cron.job.command`, `X-Cron-Secret` header), matching the edge
secret. If the crons are ever re-created from the migrations, re-apply the
bake-in, or the drain calls will return 401 again.

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

Customers who self-cancel a paid card order from the app (placed, no driver,
<15 min old) now automatically enqueue the same card refund — no manual step.
Support refunds from a ticket use the support-allowed `refund_order`
(defaults to wallet credit); support wallet top-ups use `credit_customer_wallet`.

### D. Alerting
Ops webhook (Slack) receives alerts for: stuck orders (watchdog every 5 min),
card-refund failures, Stripe webhook errors, and **card payment amount
mismatches** (charged amount ≠ `expected_charge_cents`, which fires a critical
alert so ops can refund/retry instead of the order silently sitting in `pending`).
Data is visible in `alert_outbox`.

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
  terminal (`no_webhook_url`) instead of delivering. Set the secret (see
  `supabase/scripts/setup-production-secrets.sh`), then any new
  alert (stuck order, refund failure, webhook error) posts to Slack/webhook.
- **Stripe keys** — `STRIPE_LIVE_API_KEY` and `PAYMENTS_LIVE_WEBHOOK_SECRET` are
  NOT set; `create-checkout`/`payments-webhook`/`process-refunds` will fail until
  they are. Set them, and register the `payments-webhook` endpoint
  (`…/functions/v1/payments-webhook?env=live`) with `checkout.session.completed`
  + `payment_intent.succeeded` (+ optionally `payment_intent.payment_failed`).
- **Stripe Dashboard → Settings → Payment methods**: enable **Saved payment
  methods / Customer top-up** so the "save this card" checkbox shows in Embedded
  Checkout (1-tap reorder).

### G. Scheduled delivery (2026-08-16)
Previously `scheduled_for` was stored at checkout but ignored end-to-end
(orders were dispatched immediately at placement). Now honored:

- `auto-dispatch` holds scheduled orders until **45 min before the slot**
  (`SCHEDULED_HOLD_MINUTES`), so the meal is cooked fresh and lands near the
  chosen time instead of being delivered immediately.
- `place_order` (migration `20260816140000_scheduled_delivery_validation.sql`)
  validates the slot is in the future and ≤ 6 h out (matches the checkout
  picker's +30 min–~4 h grid).
- `watchdog_check_stuck_orders()` ignores scheduled orders still inside the
  hold window (otherwise every held order would alarm as "stuck/critical").
- Store queue shows a **Προγρ. HH:MM** badge + countdown; customer tracking
  shows **Παράδοση στις HH:MM** instead of an ETA countdown.

**Tradeoff:** a scheduled meal can arrive slightly early or late around the
slot (driver accepts within the 45-min window, then prep + travel ≈ 30–45 min).
Exact-on-the-minute delivery would need a driver-side "wait until slot" step
(not implemented). **Deploy:** apply the migration, redeploy `auto-dispatch`
and `predict-dispatch-time`, rebuild the web/mobile apps.
