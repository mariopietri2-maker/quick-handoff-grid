# Fresh Delivery

Real-time food delivery marketplace (React SPA + Supabase). See `README.md` for the full product/architecture overview and `e2e/README.md` / `e2e/TESTING.md` for e2e details.

## Cursor Cloud specific instructions

- This is a **frontend-only local setup**: the app talks to a **remote hosted Supabase** project (Postgres, Auth, Realtime, Edge Functions). There is no local backend to start — public anon/publishable keys are committed in `.env.development`, so `npm run dev` works out of the box without extra secrets.
- Dev server runs on **port 8080** (see `vite.config.ts`), not the `5173` mentioned in the README. Start it with `npm run dev` and open `http://localhost:8080`.
- Apps are routes on the single SPA: `/order` (customer), `/store`, `/driver`, `/admin`, `/support`, `/auth` (login/signup). Signup uses Supabase `mailer_autoconfirm`, so new accounts work immediately without email confirmation.
- Standard commands (from `package.json`): `npm run dev`, `npm run build`, `npm test` (Vitest unit), `npm run lint` (ESLint), `npm run test:e2e` (Playwright).
- `npm run lint` currently reports many **pre-existing** errors (largely `@typescript-eslint/no-explicit-any` in `supabase/functions/**`). The tooling itself works; a non-zero exit is expected on the current tree.
- Playwright e2e tests require seeded accounts + a running server and are configured via `.env.e2e` (see `e2e/README.md`); they are not runnable without those seeded credentials.
- Mobile (Capacitor/Android) and `scripts/*.sh` build flows are for release pipelines and are not needed for local web development.
