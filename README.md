# Fresh Delivery

Real-time food delivery marketplace for **Ιωάννινα** — customers, multi-store restaurant owners, drivers, admin ops, and support.

**Live (Railway — primary while Vercel is rate-limited):** https://quick-handoff-grid-production.up.railway.app  
**Vercel (may lag during build limits):** https://quick-handoff-grid.vercel.app  
**Android APKs:** https://quick-handoff-grid-production.up.railway.app/download

Vercel and Railway both serve the same SPA against the **same** Supabase project
(`ojkesspghyqmjmupybva`). Production builds force those keys from `.env.production`
so a stale host env cannot point Railway at a different database.

---

## Apps & routes

| App | Route | Who |
|---|---|---|
| Customer | `/order` | Browse, checkout, live tracking |
| Store portal | `/store` | Multi-store owner hub (map + per-store ops) |
| Driver | `/driver` | Offers, navigation, handoff |
| Admin | `/admin` | Dispatch, finance, users, settings |
| Support | `/support` | Tickets |
| Download | `/download` | Android APK landing (QR → page, not auto-download) |

---

## Stack

- **Frontend:** React 18, Vite 5, TypeScript, Tailwind, shadcn/ui
- **Backend:** Supabase (Postgres, Auth, Realtime, Edge Functions, RLS)
- **Maps:** Mapbox
- **Payments:** Stripe (set **live** keys in Vercel + Supabase secrets for production)
- **Mobile:** Capacitor 8 (customer + driver debug APKs)
- **Tests:** Vitest (unit), Playwright (e2e)
- **Host:** Vercel + Railway (`vercel.json` SPA; Railway Nixpacks)

Package manager: **npm** (`package-lock.json`). Node **20+** (22 recommended).

---

## Repo layout

```
src/                     React SPA (pages, components, hooks)
supabase/migrations/     Canonical DB schema & RPCs
supabase/functions/      Edge functions (dispatch, checkout, webhooks, …)
e2e/                     Playwright flows
scripts/build-apks.sh    Rebuild customer/driver debug APKs
public/apk-qr/           Printable QR PNGs → /download landing
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
`.env.production` with public anon/publishable keys so Vercel deploys work
without dashboard env. Override with live Stripe `pk_live_…` on Vercel when ready.

| Variable | Notes |
|---|---|
| `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` | Supabase project (public anon) |
| `VITE_PAYMENTS_CLIENT_TOKEN` | Stripe **publishable** key (`pk_live_…` in prod) |
| `VITE_MAPBOX_TOKEN` | Optional client fallback; prefer edge `get-mapbox-token` |

### Supabase Auth
- Site URL: `https://quick-handoff-grid-production.up.railway.app` (primary)
- Redirects: Railway + Vercel + `http://localhost:5173`
- Disable email confirm until SMTP is configured (otherwise signup looks broken)

Vercel and Railway must use the **same** Supabase project (`ojkesspghyqmjmupybva`).
`npm run build` forces those keys from `.env.production` so stale Railway dashboard
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

## Mobile APKs

```bash
./scripts/build-apks.sh          # debug APKs (sideload / /download)
./scripts/setup-play-signing.sh  # once: create Play upload keystores
./scripts/build-store-aabs.sh    # signed .aab for Google Play
./scripts/sync-ios-apps.sh       # scaffold ios-customer + ios-driver (archive on a Mac)
```

Debug APKs are published on GitHub release `mobile-apks-v1`. The `/download` page never auto-starts an APK download — users tap **Download** or scan a QR that opens the landing page.

**Play Store / App Store:** see [`docs/STORE_PUBLISHING.md`](docs/STORE_PUBLISHING.md).  
Release Android builds: do **not** set `CAPACITOR_DEV=1`. Store AABs omit WebView debugging.

App IDs: `com.freshdelivery.customer` · `com.freshdelivery.driver`
---

## Payments note

Repo/client defaults may use Stripe **test** publishable keys. For real orders, override with live keys on Vercel and matching live secrets + webhook endpoint on Supabase. In-app refunds credit the **customer wallet** (see `/legal/refunds`); original-card Stripe refunds are manual/support only today.

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

1. Branch from `main`
2. Prefer `npm` (do not commit `bun.lock`)
3. Keep secrets out of git — use `.env.example` + host dashboards
4. Open a PR

**Issues:** https://github.com/mariopietri2-maker/quick-handoff-grid/issues

---

Private project. All rights reserved.
