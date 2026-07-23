# Fresh Delivery

Real-time food delivery marketplace for **Ιωάννινα** — customers, multi-store restaurant owners, drivers, admin ops, and support.

**Live (Railway):** https://quick-handoff-grid-production.up.railway.app  
**Product deck:** https://quick-handoff-grid-production.up.railway.app/presentation  
**Store PWA:** open `/store` in Chrome/Safari → Install / Add to Home Screen

Production is hosted **only on Railway**. Builds bake Supabase keys from `.env.production`
(`ojkesspghyqmjmupybva`) so a stale host env cannot point at a different database.

---

## Apps & routes

| App | Route | Who |
|---|---|---|
| Customer | `/order` | Browse, checkout, live tracking |
| Store portal | `/store` | Multi-store owner hub (**installable PWA**) |
| Driver | `/driver` | Offers, navigation, handoff |
| Admin | `/admin` | Dispatch, finance, users, settings |
| Support | `/support` | Tickets |

---

## Stack

- **Frontend:** React 18, Vite 5, TypeScript, Tailwind, shadcn/ui
- **Backend:** Supabase (Postgres, Auth, Realtime, Edge Functions, RLS)
- **Maps:** Mapbox
- **Payments:** Stripe (set **live** keys in Railway + Supabase secrets for production)
- **Mobile:** Capacitor 8 (customer + driver native shells for Play/App Store); **store is a web PWA**
- **Tests:** Vitest (unit), Playwright (e2e)
- **Host:** Railway (Nixpacks SPA)

Package manager: **npm** (`package-lock.json`). Node **20+** (22 recommended).

---

## Repo layout

```
src/                     React SPA (pages, components, hooks)
supabase/migrations/     Canonical DB schema & RPCs
supabase/functions/      Edge functions (dispatch, checkout, webhooks, …)
e2e/                     Playwright flows
scripts/build-apks.sh    Rebuild customer/driver debug APKs (dev / Play pipeline)
public/manifest-store.json  Store PWA manifest
public/sw.js             Service worker (web PWA installability)
android/                 Capacitor Android shell
```

Schema changes belong only in `supabase/migrations/`. Old root `batch_*.sql` scratch files are removed and gitignored.

---

## Setup

```bash
git clone https://github.com/mariopietri2-maker/quick-handoff-grid.git
cd quick-handoff-grid
npm install
cp .env.example .env.local   # optional overrides
# Or rely on committed .env.development / .env.production (public client keys only)
```

Vite **bakes** `VITE_*` into the client bundle at build time. This repo keeps
`.env.production` with public anon/publishable keys so Railway deploys work
without dashboard env. Override with live Stripe `pk_live_…` on Railway when ready.

| Variable | Notes |
|---|---|
| `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` | Supabase project (public anon) |
| `VITE_PAYMENTS_CLIENT_TOKEN` | Stripe **publishable** key (`pk_live_…` in prod) |
| `VITE_MAPBOX_TOKEN` | Optional client fallback; prefer edge `get-mapbox-token` |

### Supabase Auth
- Site URL: `https://quick-handoff-grid-production.up.railway.app`
- Redirects: Railway `/**` + `http://localhost:5173/**` (+ Capacitor localhost)
- Password reset: `/auth` → «Ξέχασα τον κωδικό» → email link → `/auth?reset=1` set new password
- `mailer_autoconfirm` is on (signup without email confirm). For reliable reset emails in production, configure custom SMTP in Supabase Auth settings.

`npm run build` forces Supabase keys from `.env.production` so stale Railway dashboard
`VITE_SUPABASE_*` values cannot point at another database.

### Push (FCM)
See [`docs/FIREBASE_PUSH.md`](docs/FIREBASE_PUSH.md) — place `google-services.json` under
`mobile-signing/firebase/` and run `./scripts/set-fcm-secret.sh` before rebuild.

### Edge secrets (Supabase Dashboard → Edge Functions)
`SUPABASE_SERVICE_ROLE_KEY`, `CRON_SECRET`, Stripe live/test keys + webhook secrets, `MAPBOX_PUBLIC_TOKEN`, etc.

```bash
npm run dev      # http://localhost:5173
npm run build
npm test
npm run lint
```

---

## Multi-store owners

`/store` is a **portal**: map of all owned stores → pick one to manage orders, menu, hours, wallet, promos.

Stores need lat/lng to appear on driver/admin maps (Ioannina center ≈ `39.6650, 20.8537`).

---

## Mobile (customer / driver)

Customer and driver use Capacitor native shells for Play / App Store. They are **not** marketed as sideload APKs on the public site.

```bash
./scripts/build-apks.sh          # debug APKs (dev sideload only)
./scripts/setup-play-signing.sh  # once: create Play upload keystores
./scripts/build-store-aabs.sh    # signed .aab for Google Play
./scripts/sync-ios-apps.sh       # scaffold ios-customer + ios-driver (archive on a Mac)
```

**Store owners:** use the **PWA** at `/store` (Install / Add to Home Screen). Old `/download` URLs redirect there.

**Play Store / App Store:** see [`docs/STORE_PUBLISHING.md`](docs/STORE_PUBLISHING.md).  
Release Android builds: do **not** set `CAPACITOR_DEV=1`. Store AABs omit WebView debugging.

App IDs: `com.freshdelivery.customer` · `com.freshdelivery.driver`
---

## Payments note

**Launch checklist:** Uber green branding is live; test stores are hidden via migration. Before public launch set Stripe **live** `pk_live_…` in Railway (override `.env.production` test key) + matching live edge secrets + webhook endpoint on Supabase.

Repo/client defaults may use Stripe **test** publishable keys. For real orders, override with live keys on Railway and matching live secrets + webhook endpoint on Supabase. In-app refunds credit the **customer wallet** (see `/legal/refunds`); original-card Stripe refunds are manual/support only today.

---

## Testing

```bash
npm test                 # unit
npx playwright install chromium
# configure .env.e2e — see e2e/README.md
npm run test:e2e
```

---

## Contributing

Open a PR against `main`. Railway auto-deploys from `main`.
