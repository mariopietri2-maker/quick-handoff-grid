# Fresh Delivery

**A modern, real-time food delivery marketplace platform** connecting customers, restaurants, and drivers through seamless order management and live tracking.

---

## 🎯 Overview

Fresh Delivery is a comprehensive food delivery solution built with modern web technologies. The platform enables restaurants to manage menus and orders in real-time, empowers customers to browse, order, and track deliveries, and provides drivers with intelligent order acceptance and navigation workflows.

**Demo:** https://quick-handoff-grid.vercel.app

---

## 🏗️ Architecture

### Core Applications

| Application | Purpose | Route |
|---|---|---|
| **Customer** | Browse restaurants, place orders, real-time delivery tracking | `/order` |
| **Driver** | Accept delivery offers, navigate to pickup/dropoff, handoff management | `/driver` |
| **Store** | Menu management, order fulfillment, ticket printing, operations | `/store` |
| **Admin** | Real-time operations, financial analytics, fraud detection | `/admin` |
| **Support** | Ticket management, customer/driver support tools | `/support` |

---

## 🛠️ Technology Stack

### Frontend
- **React 18** — Modern UI component library
- **Vite** — Next-generation build tool (sub-second HMR)
- **TypeScript** — Type-safe application code
- **Tailwind CSS + shadcn/ui** — Professional, accessible UI components

### Backend & Services
- **Supabase (Lovable Cloud)** — PostgreSQL database, real-time subscriptions, authentication
- **Mapbox** — Maps, geolocation, route optimization
- **Stripe** — Payment processing

### Mobile
- **Capacitor 8** — Cross-platform iOS & Android via web code

### Quality Assurance
- **Playwright** — End-to-end testing (order lifecycle scenarios)
- **Vitest** — Unit testing framework
- **ESLint + TypeScript** — Code quality & type safety

---

## 📂 Project Structure

```
├── src/                    Frontend application code
│   ├── /order             Customer app (React components, pages)
│   ├── /driver            Driver app
│   ├── /store             Store/restaurant app
│   ├── /admin             Admin dashboard
│   ├── /support           Support portal
│   └── /shared            Reusable components, utilities
├── supabase/              Database migrations, Postgres functions
├── e2e/                   End-to-end test suite (Playwright)
├── android/ & ios/        Capacitor native builds
├── public/                Static assets
└── [config files]         Vite, TypeScript, Tailwind, ESLint configs
```

---

## 🚀 Getting Started

### Prerequisites
- **Node.js** 16+ or **Bun** 1.0+
- **Supabase account** with project credentials
- **Mapbox API key**
- **Stripe API keys** (for payments)

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/mariopietri2-maker/quick-handoff-grid.git
   cd quick-handoff-grid
   ```

2. **Install dependencies**
   ```bash
   bun install
   # or
   npm install
   ```

3. **Configure environment variables**
   ```bash
   cp .env.development .env.local
   ```
   Set the following:
   ```env
   VITE_SUPABASE_URL=https://ajkefntritjjynzofprq.supabase.co
   VITE_SUPABASE_ANON_KEY=your_anon_key
   VITE_PAYMENTS_CLIENT_TOKEN=your_stripe_publishable_key
   # Optional client-side Mapbox fallback (preferred: edge function get-mapbox-token)
   VITE_MAPBOX_TOKEN=your_mapbox_token
   ```

   Edge function secrets (Supabase dashboard):
   - `CRON_SECRET` — required for `auto-dispatch` scheduler (anon JWT is no longer accepted)
   - `SUPABASE_SERVICE_ROLE_KEY`, Stripe webhook secrets, Mapbox/Google keys as used by functions


4. **Start the development server**
   ```bash
   bun run dev
   # Runs on http://localhost:5173
   ```

---

## 📋 Available Commands

```bash
# Development
bun run dev              # Start dev server (Vite)
bun run preview          # Build & preview production bundle

# Build
bun run build            # Production build
bun run build:dev        # Development build

# Quality
bun run lint             # Run ESLint
bun run test             # Run unit tests (Vitest)
bun run test:watch       # Watch mode for tests
bun run test:e2e         # Run end-to-end tests (Playwright)
bun run test:e2e:ui      # Run e2e tests in UI mode
```

---

## 🧪 Testing

### End-to-End Tests

The project includes comprehensive Playwright tests covering critical user flows:

- **Happy Path:** Complete order lifecycle (customer → store → driver → delivery)
- **Cancellation Flow:** Customer cancels before store acceptance
- **Conflict Resolution:** Two drivers race to accept same order

#### Setup E2E Tests

1. Install browsers:
   ```bash
   bunx playwright install chromium
   ```

2. Create test accounts in Supabase:
   - 1 customer account
   - 1 store owner with at least 1 published menu item
   - 2 active drivers (`driver_profiles.is_active = true`)

3. Create `.env.e2e`:
   ```bash
   E2E_BASE_URL=https://your-preview-url
   E2E_STORE_ID=<store-uuid>
   E2E_CUSTOMER_EMAIL=customer@test.local
   E2E_CUSTOMER_PASSWORD=...
   E2E_STORE_EMAIL=store@test.local
   E2E_STORE_PASSWORD=...
   E2E_DRIVER_EMAIL=driver1@test.local
   E2E_DRIVER_PASSWORD=...
   E2E_DRIVER2_EMAIL=driver2@test.local
   E2E_DRIVER2_PASSWORD=...
   ```

4. Run tests:
   ```bash
   set -a && source .env.e2e && set +a
   bunx playwright test
   bunx playwright show-report
   ```

---

## 🔑 Key Features

- ✅ **Real-time Order Management** — WebSocket-based live updates across all stakeholders
- ✅ **Multi-Role Authentication** — Secure role-based access (customer, driver, store, admin)
- ✅ **Live Delivery Tracking** — GPS tracking with Mapbox integration
- ✅ **Payment Processing** — Stripe integration for seamless payments
- ✅ **Mobile-Ready** — Responsive design + native mobile apps via Capacitor
- ✅ **Analytics & Operations** — Admin dashboard with KPIs and fraud detection
- ✅ **Comprehensive Testing** — Unit + E2E test coverage

---

## 📱 Mobile Apps

Native builds are available for iOS and Android via Capacitor:

```bash
# Build native apps
npx cap sync

# Open in native IDE
npx cap open ios
npx cap open android
```

---

## 🤝 Contributing

Contributions are welcome! Please follow these guidelines:

1. Create a feature branch: `git checkout -b feature/your-feature`
2. Commit changes: `git commit -m 'Add your feature'`
3. Push to branch: `git push origin feature/your-feature`
4. Open a Pull Request

---

## 📞 Support

For issues and questions:
- **GitHub Issues:** [Report a bug](https://github.com/mariopietri2-maker/quick-handoff-grid/issues)
- **Documentation:** Check our [e2e test suite](./e2e/README.md) for implementation examples

---

## 📄 License

This project is private. All rights reserved.

---

## 👨‍💼 About

Fresh Delivery showcases modern full-stack web development practices with a focus on real-time collaboration, scalability, and user experience across multiple platforms.

**Stack Highlights:**
- Type-safe end-to-end development with TypeScript
- Real-time database with Supabase
- Production-ready testing strategy
- Cross-platform mobile deployment
