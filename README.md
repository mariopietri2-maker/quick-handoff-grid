<div align="center">

# 📦 Fresh Delivery

### 🛵 Real-time food delivery marketplace for **Ιωάννινα**

Customers browse & order · Multi-store owners manage everything · Drivers deliver · One admin & support hub.

[![Status](https://img.shields.io/badge/status-live-success)](https://quick-handoff-grid-production.up.railway.app)
[![Platform](https://img.shields.io/badge/Platform-Web%20%26%20Mobile-blue)](#-mobile-customer--store)
[![Stack](https://img.shields.io/badge/React-18-61dafb?logo=react&logoColor=white)](#-stack)
[![Stack](https://img.shields.io/badge/TypeScript-3178c6?logo=typescript&logoColor=white)](#-stack)
[![Backend](https://img.shields.io/badge/Supabase-3ECF8E?logo=supabase&logoColor=white)](https://supabase.com)

---

🚀 **Live:** [quick-handoff-grid-production.up.railway.app](https://quick-handoff-grid-production.up.railway.app)  
📊 **Product deck:** [quick-handoff-grid-production.up.railway.app/presentation](https://quick-handoff-grid-production.up.railway.app/presentation)  
📲 **Store PWA:** open `/store` in Chrome/Safari → *Install / Add to Home Screen*

</div>

---

## ✨ Highlights

- 📍 Built for **Ioannina**, Greece
- ⚡ **Real-time** order dispatch, live tracking, and kitchen board
- 🏷️ **Multi-store** portal — one account, many restaurants
- 💸 **Stripe** payments with wallet-based refunds
- 🗺️ **Mapbox** navigation for drivers
- 📱 **Capacitor** native apps for Customer & Driver (Play/App Store)
- 🖥️ **PWA** store manager — installable, works offline

---

## 🧩 Apps & routes

| App | Route | Who |
|---|---|---|
| 🛒 Customer | `/order` | Browse, checkout, live tracking |
| 🏪 Store portal | `/store` | Multi-store owner hub (**installable PWA**) |
| 🚚 Driver | `/driver` | Offers, navigation, handoff |
| 🛠️ Admin | `/admin` | Dispatch, finance, users, settings |
| 🎧 Support | `/support` | Tickets |

---

## 🧱 Stack

| Layer | Tech |
|---|---|
| **Frontend** | React 18 · Vite 5 · TypeScript · Tailwind · shadcn/ui |
| **Backend** | Supabase — Postgres, Auth, Realtime, Edge Functions, RLS |
| **Maps** | Mapbox |
| **Payments** | Stripe (set **live** keys in Railway + Supabase secrets for prod) |
| **Mobile** | Capacitor 8 (Customer + Driver native shells); Store = web PWA |
| **Tests** | Vitest (unit) · Playwright (e2e) |
| **Hosting** | Railway (Nixpacks SPA) |

> 📦 **Package manager:** npm (`package-lock.json`) · 🟢 **Node** 20+ (22 recommended)

---

## 🗂️ Repo layout

```
src/                     React SPA (pages, components, hooks)
supabase/migrations/     Canonical DB schema & RPCs
supabase/functions/      Edge functions (dispatch, checkout, webhooks, …)
e2e/                     Playwright flows
scripts/build-apks.sh    Rebuild customer/store debug APKs
public/manifest-store.json   Store PWA manifest
public/sw.js             Service worker (web PWA installability)
android/                 Capacitor Android shell
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

### 🔐 Supabase Auth

- Site URL: `https://quick-handoff-grid-production.up.railway.app`
- Redirects: Railway `/**` + `http://localhost:5173/**` (+ Capacitor localhost)
- Password reset: `/auth` → *«Ξέχασα τον κωδικό»* → email link → `/auth?reset=1` set new password
- `mailer_autoconfirm` is on (signup without email confirm). For reliable reset emails in production, configure **custom SMTP** in Supabase Auth settings.

> 🛡️ `npm run build` forces Supabase keys from `.env.production`, so a stale Railway dashboard `VITE_SUPABASE_*` value can't point at another database.

### 🔔 Push notifications (FCM)

See [`docs/FIREBASE_PUSH.md`](docs/FIREBASE_PUSH.md) — place `google-services.json` under `mobile-signing/firebase/` and run `./scripts/set-fcm-secret.sh` before rebuild.

### 🔑 Edge secrets (Supabase Dashboard → Edge Functions)

`SUPABASE_SERVICE_ROLE_KEY`, `CRON_SECRET`, Stripe live/test keys + webhook secrets, `MAPBOX_PUBLIC_TOKEN`, etc.

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

## 📱 Mobile (Customer / Store)

Customer and store production apps use **Capacitor** shells for Play / App Store. They are **not** marketed as sideload APKs on the public site.

```bash
./scripts/build-apks.sh             # debug APKs (dev sideload only)
./scripts/setup-play-signing.sh    # once: create Play upload keystores
./scripts/build-store-aabs.sh      # signed .aab for Google Play
./scripts/sync-ios-apps.sh         # scaffold ios-customer + ios-driver (archive on a Mac)
```

### 📲 Download the native Driver app (Android)

Scan with your phone to download the latest **Fresh Delivery Driver** APK.

<div align="center">
  <img src="docs/qr-driver-apk.png" width="220" height="220" alt="QR code — Fresh Delivery Driver APK download"/>
  <br/>
  <sub>→ <code>fresh-driver-native-debug.apk</code> from the <a href="https://github.com/mariopietri2-maker/quick-handoff-grid/releases/tag/mobile-apks-v1">mobile-apks-v1</a> release. The URL is stable, so this QR always reflects the newest build.</sub>
</div>

**True native driver (Kotlin + Jetpack Compose)** — Capacitor-parity app in [`native-driver/`](native-driver/):

```bash
cd native-driver && ./gradlew :app:assembleDebug
# app id: com.freshdelivery.driver (replaces Capacitor driver APK)
```

**Store owners:** use the **PWA** at `/store` (Install / Add to Home Screen). Old `/download` URLs redirect there.

**Play Store / App Store:** see [`docs/STORE_PUBLISHING.md`](docs/STORE_PUBLISHING.md).  
Release Android builds: do **not** set `CAPACITOR_DEV=1`. Store AABs omit WebView debugging.

> 🏷️ App IDs: `com.freshdelivery.customer` · `com.freshdelivery.driver` (Capacitor or native Compose)

---

## 💳 Payments note

> ⚠️ **Launch checklist:** Uber green branding is live; test stores are hidden via migration. Before public launch set Stripe **live** `pk_live_…` in Railway (override `.env.production` test key) + matching live edge secrets + webhook endpoint on Supabase.

Repo/client defaults may use Stripe **test** publishable keys. For real orders, override with **live** keys on Railway and matching live secrets + webhook endpoint on Supabase. In-app refunds credit the **customer wallet** (see `/legal/refunds`); original-card Stripe refunds are manual/support only today.

---

## 🧪 Testing

```bash
npm test                 # unit
npx playwright install chromium
# configure .env.e2e — see e2e/README.md
npm run test:e2e
```

---

## 🤝 Contributing

Open a PR against `main`. Railway auto-deploys from `main`.

---

<div align="center">
  Made with ❤️ for the Ioannina community<br/>
  <sub>© Fresh Delivery · maintained by <a href="https://github.com/mariopietri2-maker">mariopietri2-maker</a></sub>
</div>