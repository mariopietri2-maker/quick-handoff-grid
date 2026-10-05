# Fresh2GO bots

## 1. Ops Assistant (daily marketing) — **B**
- **Admin:** Settings / Sidebar → **Ops Assistant**
- **Does:** Rotates enabled promo banners in `customer_app_config` (customer native + web)
- **Health:** stuck orders, long-open chats, tickets
- **Run:** «Εκτέλεση τώρα» or daily cron ~09:00 Athens (`ops-assistant-daily`)
- **RPC:** `run_ops_assistant(trigger)`

## 2. Ops notify (Telegram / Discord) — **C**
- **Workflow:** `.github/workflows/ops-notify.yml`
- **Secrets (GitHub repo):**
  - `TELEGRAM_BOT_TOKEN` + `TELEGRAM_CHAT_ID`
  - optional `DISCORD_WEBHOOK_URL`
  - optional `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` for health pulse
- **Triggers:** after **Build Native APKs**, every 2h schedule, manual dispatch

## 3. Support FAQ bot
- In-app FAQ before live chat (`SupportScreen` / `support-faq`)

## 4. Coding / release
- This chat + GitHub Actions (APK builds)

## Safety
- No auto-delete of production data
- Only support closes live chat
- Promo rotation only toggles `enabled` on existing banners
