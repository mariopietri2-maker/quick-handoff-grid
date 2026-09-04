<div align="center">

# 📦 Fresh Meal

### 🛵 Real-time food delivery marketplace for **Ιωάννινα**

Customers browse & order · Multi-store owners manage everything · Drivers deliver · One admin & support hub.

[![Status](https://img.shields.io/badge/status-live-success)](https://freshdelivery.app)
[![Platform](https://img.shields.io/badge/Platform-Web%20%26%20Mobile-blue)](#-mobile-customer--store)
[![Stack](https://img.shields.io/badge/React-18-61dafb?logo=react&logoColor=white)](#-stack)
[![Stack](https://img.shields.io/badge/TypeScript-3178c6?logo=typescript&logoColor=white)](#-stack)
[![Backend](https://img.shields.io/badge/Supabase-3ECF8E?logo=supabase&logoColor=white)](https://supabase.com)

---

🚀 **Live:** [freshdelivery.app](https://freshdelivery.app) · 🛣️ **Mirror:** [quick-handoff-grid-production.up.railway.app](https://quick-handoff-grid-production.up.railway.app)
📊 **Product deck:** [freshdelivery.app/presentation](https://freshdelivery.app/presentation)  
📲 **Store PWA:** open `/store` in Chrome/Safari → *Install / Add to Home Screen*

</div>

---

## ✨ Highlights

- 📍 Built for **Ioannina**, Greece
- ⚡ **Real-time** order dispatch, live tracking, and kitchen board
- 🚚 **Auto-dispatch** to nearby drivers with AI dynamic pricing & ETA prediction
- 🏷️ **Multi-store** portal — one account, many restaurants
- 💳 **Stripe** payments — wallet **and** automated card refunds, saved cards
- 🧾 **AADE myDATA** (Ν.5073/2023) e-invoicing on every delivered order
- 🗺️ **Mapbox** navigation for drivers
- 📱 **Native** Customer & Driver apps (Kotlin + Jetpack Compose), store PWA
- 🖥️ **PWA** store manager — installable, works offline

---

## 📊 Tech Composition

| Language | Percentage |
|----------|-----------|
| TypeScript | 55.6% |
| PLpgSQL | 27.9% |
| Kotlin | 11.5% |
| HTML | 3.2% |
| Shell | 0.7% |
| CSS | 0.5% |
| Other | 0.6% |

---

## 🧩 Apps & routes

| App | Route | Who |
|---|---|---|
| 🛒 Customer | `/order` | Browse, cart, checkout (card/cash), live tracking |
| 🛒 My orders | `/orders` | Order history, reorder, saved cards |
| 🏪 Store portal | `/store` | Multi-store owner hub (**installable PWA**) |
| 🚚 Driver | `/driver` | Offers, navigation, handoff |
| 📍 Driver monitor | `/m` | Role **M** — watch-only live driver map (no money) |
| 🛠️ Admin | `/admin` | Dispatch, finance, users, settings |
| 🎧 Support | `/support` | Tickets, live order editing, card refunds |
| 📄 Public | `/legal/:doc` · `/download` · `/presentation` | Legal/refund pages, APK downloads, product deck |

Sub-routes: `/auth` · `/restaurant/:id` · `/checkout` · `/order-tracking/:id` · `/driver/profile` · `/store/profile`

---

## 🧱 Stack

| Layer | Tech |
|---|---|
| **Frontend** | React 18 · Vite 5 · TypeScript · Tailwind · shadcn/ui |
| **Backend** | Supabase — Postgres, Auth, Realtime, Edge Functions, RLS |
| **Maps** | Mapbox |
| **Payments** | Stripe (set **live** keys in Railway env + Supabase secrets for prod) |
| **Mobile** | Native Kotlin + Jetpack Compose (Customer/Driver) · Capacitor 8 shells · Store = web PWA |
| **Tax compliance** | AADE myDATA (Greek e-invoicing) — auto-submits every delivery |
| **CI/CD** | GitHub Actions — lint, unit, build on PR/push; native APK/AAB releases |
| **Tests** | Vitest (unit) · Playwright (e2e) · smoke/stress scripts |
| **Hosting** | Railway — `freshdelivery.app` (custom domain) + `quick-handoff-grid-production.up.railway.app` mirror, auto-deploy from `main` |

> 📦 **Package manager:** npm (`package-lock.json`) · 🟢 **Node** 20+ (22 recommended)

---

## 🗂️ Repo layout

```
src/                     React SPA (pages, components, hooks)
supabase/migrations/     Canonical DB schema, triggers & RPCs
supabase/functions/      Edge functions (dispatch, checkout, refunds, myDATA, …)
supabase/scripts/        Production secrets, cron rotation & verification SQL
native-customer/         Native customer app (Kotlin + Jetpack Compose)
native-driver/           Native driver app (Kotlin + Jetpack Compose)
android/ android-driver/ Capacitor Android shells (Customer / Driver)
plugins/                 Local Capacitor plugins (Mapbox maps, …)
docs/                    Go-live, store publishing, push & presentation guides
e2e/                     Playwright flows
scripts/                 APK builds, live deploy, seed, smoke & stress tools
.github/workflows/       CI + native APK/AAB release builds
public/                  PWA manifests, service worker, sitemap/robots
```

> 🚧 Schema changes belong **only** in `supabase/migrations/`. Old root `batch_*.sql` scratch files are removed and gitignored.

---

## 🚀 Getting started

```bash
# 1. Clone
git clone https://github.com/mariopietri2-maker/quick-handoff-grid.git
cd quick-handoff-grid

# 2. Install dependencies
npm install

# 3. Optional overrides
cp .env.example .env.local
# …or rely on committed .env.development / .env.production (public client keys only)
```

Vite **bakes** `VITE_*` into the client bundle at build time. The repo keeps `.env.production` with public anon/publishable keys so Railway deploys work without dashboard env.

| Variable | Notes |
|---|---|
| `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` | Supabase project (public anon) |
| `VITE_PAYMENTS_CLIENT_TOKEN` | Stripe **publishable** key (`pk_live_…` in prod) |
| `VITE_MAPBOX_TOKEN` | Optional client fallback; prefer edge `get-mapbox-token` |

📚 **Guides:** [`docs/GO_LIVE.md`](docs/GO_LIVE.md) (launch checklist) · [`docs/PRESENTATION.md`](docs/PRESENTATION.md) (product deck) · [`docs/STORE_PUBLISHING.md`](docs/STORE_PUBLISHING.md)

### 🔐 Supabase Auth

- Site URL: `https://freshdelivery.app` (mirror also allowed: `https://quick-handoff-grid-production.up.railway.app`)
- Redirects: freshdelivery.app + Railway `/**` + `http://localhost:5173/**` (+ Capacitor localhost)
- Password reset: `/auth` → *«Ξέχασα τον κωδικό»* → email link → `/auth?reset=1` set new password
- `mailer_autoconfirm` is on (signup without email confirm). For reliable reset emails in production, configure **custom SMTP** in Supabase Auth settings.

> 🛡️ `npm run build` forces Supabase keys from `.env.production`, so a stale host `VITE_SUPABASE_*` value can't point at another database.

### 🔔 Push notifications (FCM)

See [`docs/FIREBASE_PUSH.md`](docs/FIREBASE_PUSH.md) — place `google-services.json` under `mobile-signing/firebase/` and run `./scripts/set-fcm-secret.sh` before rebuild.

### 🔑 Edge secrets (Supabase Dashboard → Edge Functions)

`SUPABASE_SERVICE_ROLE_KEY`, `CRON_SECRET`, Stripe live/test keys + webhook secrets, `MAPBOX_PUBLIC_TOKEN`, `ALERT_WEBHOOK_URL`, AADE myDATA credentials — see [`docs/GO_LIVE.md`](docs/GO_LIVE.md). Seed with `supabase/scripts/setup-production-secrets.sh`, rotate with `supabase/scripts/rotate_cron_secret.sql`, and verify with `supabase/scripts/verify_cron_and_aade.sql`.

```bash
npm run dev      # http://localhost:5173
npm run build
npm test
npm run lint
```

---

## 🏪 Multi-store owners

`/store` is a **portal**: a map of all owned stores → pick one to manage orders, menu, hours, wallet, promos.

📍 Stores need lat/lng to appear on driver/admin maps (Ioannina town center ≈ `39.6650, 20.8537`).

---

## 🚚 Dispatch & driver lead monitor

- **Auto-dispatch** offers each order to nearby / fair-earnings drivers (`auto-dispatch` edge function + `accept-offer` / `decline-offer`).
- AI helpers: dynamic pricing (`ai-dynamic-pricing`), ETA prediction (`predict-dispatch-time`), route optimization (`optimize-route`).
- Role **M** (driver lead) watches the live driver map at `/m` — read-only, no wallet/money access.

---

## 📱 Mobile (Customer / Driver)

Native **Kotlin + Jetpack Compose** apps live in [`native-customer/`](native-customer/) and [`native-driver/`](native-driver/). Capacitor shells remain in `android/` (Customer) and `android-driver/`. Store owners use the **PWA** at `/store` (Install / Add to Home Screen).

```bash
./scripts/build-apks.sh             # debug APKs (dev sideload only)
./scripts/setup-play-signing.sh     # once: create Play upload keystores
./scripts/build-store-aabs.sh       # signed .aab for Google Play
./scripts/sync-ios-apps.sh          # scaffold ios-customer + ios-driver (archive on a Mac)
cd native-customer && ./gradlew :app:assembleDebug   # native customer (com.freshdelivery.customer)
cd native-driver  && ./gradlew :app:assembleDebug   # native driver  (com.freshdelivery.driver)
```

GitHub Actions (`build-native-apks.yml`) rebuilds native debug APKs/AABs and publishes them to the [`mobile-apks-v1`](https://github.com/mariopietri2-maker/quick-handoff-grid/releases/tag/mobile-apks-v1) release.

### 📲 Download the native Customer app (Android)

Scan with your phone to download the latest **Fresh Meal Customer** APK.

<div align="center">
  <img src="docs/qr-customer-apk.png" width="220" height="220" alt="QR code — Fresh Meal Customer APK download"/>
  <br/>
  <sub>→ opens the <a href="https://freshdelivery.app/download?app=customerNative">Fresh Meal Customer download page</a> (chooses the newest APK from the <a href=[...]
</div>

### 📲 Download the native Driver app (Android)

Scan with your phone to download the latest **Fresh Meal Driver** APK.

<div align="center">
  <img src="docs/qr-driver-apk.png" width="220" height="220" alt="QR code — Fresh Meal Driver APK download"/>
  <br/>
  <sub>→ opens the <a href="https://freshdelivery.app/download?app=driverNative">Fresh Meal Driver download page</a> (chooses the newest APK from the <a href="htt[...]
</div>

**Store owners:** use the **PWA** at `/store` (Install / Add to Home Screen). Old `/download` URLs redirect there.

**Play Store / App Store:** see [`docs/STORE_PUBLISHING.md`](docs/STORE_PUBLISHING.md).  
Release Android builds: do **not** set `CAPACITOR_DEV=1`. Store AABs omit WebView debugging.

> 🏷️ App IDs: `com.freshdelivery.customer` · `com.freshdelivery.driver` (Capacitor or native Compose)

---

## 💳 Payments

Repo/client defaults may use Stripe **test** publishable keys. For real orders, override with **live** keys on Railway and matching live secrets + webhook endpoint on Supabase.

- **Wallet refunds** credit the customer wallet (see `/legal/refunds`).
- **Card refunds** are automated: canceling a paid card order enqueues a refund that the `process-refunds` cron executes idempotently (retries, then alerts on failure).
- **Saved cards** are mirrored by the `payments-webhook` for 1-tap reorder at checkout.
- **Cash orders** are reconciled per delivery: the driver's collected cash is tracked in `driver_cash_debts`, and admins acknowledge receipts via `settle_driver_cash` (moves each share into the correct treasury/store bags). Driver withdrawals net outstanding debts — `request_wallet_withdrawal` caps payouts at `available_balance − unsettled cash debts`.

> ⚠️ **Launch checklist:** set Stripe **live** `pk_live_…` + matching edge secrets + webhook, then enable myDATA and FCM secrets — see [`docs/GO_LIVE.md`](docs/GO_LIVE.md).

---

## 🧾 Greek tax compliance (AADE myDATA)

Per-delivery e-invoices (`aade-submit-delivery` edge function). The DB trigger `orders_aade_autosubmit` auto-submits each **delivered** order to myDATA; results land in `aade_delivery_reports` (idempotent, admin-retryable).

---

## 🧪 Testing

```bash
npm test                 # unit (Vitest)
npx playwright install chromium
# configure .env.e2e — see e2e/README.md
npm run test:e2e

# smoke & stress (optional)
python3 scripts/smoke-order-lifecycle.py    # full order flow against a project
node scripts/stress-order-burst.mjs          # order burst load
node scripts/stress-read-probe.mjs           # read-path probe
node scripts/stress-live-market.mjs          # 10 drivers + 10 orders/min for 30 min (live map)
```

---

## 🤝 Contributing

Open a PR against `main`. GitHub Actions runs lint + unit tests + build; Railway deploys from `main`.

---

<div align="center">
  Made with ❤️ for the Ioannina community<br/>
  <sub>© Fresh Meal · maintained by <a href="https://github.com/mariopietri2-maker">mariopietri2-maker</a></sub>
</div>
