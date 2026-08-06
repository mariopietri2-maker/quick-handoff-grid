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

- Events: **`checkout.session.completed`** (minimum) → copy signing secret `whsec_live_…`

### B. Supabase Dashboard → project `ojkesspghyqmjmupybva` → Project Settings → Edge Functions → Secrets
```
STRIPE_LIVE_API_KEY=sk_live_…
PAYMENTS_LIVE_WEBHOOK_SECRET=whsec_live_…
```
(`STRIPE_SANDBOX_API_KEY` / `PAYMENTS_SANDBOX_WEBHOOK_SECRET` already in place.)

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
