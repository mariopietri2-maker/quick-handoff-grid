<div align="center">

# ⚡ Fresh2GO.gr

### 🛵 Real-time food delivery marketplace for **Ioannina, Greece**

**Customers** browse & order · **Multi-store owners** manage everything · **Drivers** deliver · One **admin & support** hub.

[![Status](https://img.shields.io/badge/status-live-success)](https://fresh2go.gr)
[![Platform](https://img.shields.io/badge/Platform-Web%20%26%20Mobile-blue)](#-apps)
[![React](https://img.shields.io/badge/React-18-61dafb?logo=react&logoColor=white)](#-stack)
[![TypeScript](https://img.shields.io/badge/TypeScript-3178c6?logo=typescript&logoColor=white)](#-stack)
[![Backend](https://img.shields.io/badge/Supabase-3ECF8E?logo=supabase&logoColor=white)](https://supabase.com)
[![Payments](https://img.shields.io/badge/Stripe-635BFF?logo=stripe&logoColor=white)](#payments)
[![Maps](https://img.shields.io/badge/Mapbox-000000?logo=mapbox&logoColor=white)](#-stack)

</div>

---

## 🚀 Live & links

- 🌐 **Live:** [freshdelivery.app](https://fresh2go.gr)
- 🛣️ **Mirror:** [quick-handoff-grid-production.up.railway.app](https://quick-handoff-grid-production.up.railway.app)
- 📱 **Native apps:** Android APKs via [download page](https://fresh2go.gr/download)
- 🏪 **Store PWA:** installable from `/store`
- 📊 **Product deck:** [freshdelivery.app/presentation](https://fresh2go.gr/presentation)

---

## ✨ Highlights

| | |
|---|---|
| ⚡ **Real-time everything** | Live order dispatch, GPS tracking, kitchen board |
| 🚚 **Smart auto-dispatch** | Nearby/fair-earnings drivers + AI pricing & ETA prediction |
| 🏪 **Multi-store portal** | One account, many restaurants |
| 💳 **Stripe payments** | Wallet, saved cards & automated card refunds |
| 🧾 **Greek tax compliance** | AADE myDATA (Ν.5073/2023) e-invoicing per delivery |
| 🗺️ **Mapbox navigation** | Turn-by-turn directions for drivers |
| 📱 **Native mobile apps** | Customer & Driver — Kotlin + Jetpack Compose |
| 🖥️ **PWA store manager** | Installable, works offline |

---

## 🧩 Apps

| App | Route | Who |
|---|---|---|
| 🛒 Customer | `/order` · `/orders` | Browse, cart, checkout (card/cash), live tracking, reorder |
| 🏪 Store portal | `/store` | Multi-store owner hub (**installable PWA**) |
| 🚚 Driver | `/driver` | Offers, navigation, handoff |
| 📍 Driver monitor | `/m` | Read-only live driver map |
| 🛠️ Admin | `/admin` | Dispatch, finance, users, settings |
| 🎧 Support | `/support` | Tickets, live order editing, card refunds |
| 📄 Public | `/legal/:doc` · `/download` | Refund policy, APK downloads |

---

## 🧱 Stack

| Layer | Tech |
|---|---|
| **Frontend** | React 18 · Vite 5 · TypeScript · Tailwind · shadcn/ui |
| **Backend** | Supabase — Postgres, Auth, Realtime, Edge Functions, RLS |
| **Maps** | Mapbox |
| **Payments** | Stripe — wallet, saved cards, automated refunds |
| **Mobile** | Native Kotlin + Jetpack Compose · Capacitor 8 · store PWA |
| **Tax** | AADE myDATA e-invoicing (auto-submit on delivery) |
| **CI/CD** | GitHub Actions — lint, tests, build, native APK/AAB releases |
| **Hosting** | Railway — auto-deploy from `main` |

> 📦 npm · 🟢 Node 20+ (22 recommended)

---

## 🗂️ Repo layout

```
src/                     React SPA (pages, components, hooks)
supabase/migrations/     Canonical DB schema, triggers & RPCs
supabase/functions/      Edge functions (dispatch, checkout, refunds, myDATA…)
supabase/scripts/        Secrets, cron rotation & verification SQL
native-customer/         Native customer app (Kotlin + Compose)
native-driver/           Native driver app (Kotlin + Compose)
android/ · android-driver/  Capacitor Android shells
plugins/                 Local Capacitor plugins (Mapbox…)
docs/                    Go-live, publishing, push & deck guides
e2e/                     Playwright flows
scripts/                 APK builds, deploy, seed, smoke & stress tools
```

---

## 🚀 Getting started

```bash
git clone https://github.com/mariopietri2-maker/quick-handoff-grid.git
cd quick-handoff-grid

npm install
npm run dev        # http://localhost:5173
```

Optional: `cp .env.example .env.local`. Public keys are already committed via `.env.production`.

| Variable | Notes |
|---|---|
| `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` | Supabase project (public anon) |
| `VITE_PAYMENTS_CLIENT_TOKEN` | Stripe **publishable** key |
| `VITE_MAPBOX_TOKEN` | Optional fallback; prefer edge `get-mapbox-token` |

---

## 🧪 Testing

```bash
npm test                           # unit (Vitest)
npm run test:e2e                   # Playwright (see e2e/README.md)
python3 scripts/smoke-order-lifecycle.py   # full order flow
node scripts/stress-order-burst.mjs        # order burst load
```

---

## 📚 Docs & guides

- 🚀 [`docs/GO_LIVE.md`](docs/GO_LIVE.md) — launch checklist & secret setup
- 📊 [`docs/PRESENTATION.md`](docs/PRESENTATION.md) — product deck
- 📲 [`docs/STORE_PUBLISHING.md`](docs/STORE_PUBLISHING.md) — Play Store / App Store
- 🔔 [`docs/FIREBASE_PUSH.md`](docs/FIREBASE_PUSH.md) — FCM push notifications

---

## 🤝 Contributing

Open a PR against `main` — CI runs lint, unit tests and build. Railway deploys from `main`.

---

<div align="center">

Made with ❤️ for the Ioannina community — maintained by [mariopietri2-maker](https://github.com/mariopietri2-maker)

</div>