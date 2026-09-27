# Fresh2GO bots

This project uses four bot layers. Status: foundation live; external chat apps need your tokens.

## 1. Coding / GitHub bot
- **What:** Daily Grok automation (`fresh2go-daily-project-bot`) checks Actions builds and posts a short status.
- **Where:** Grok Automations (09:00 Europe/Athens).
- **Also:** GitHub Actions under `.github/workflows/` (APK builds, apply patches).
- **You can ask in chat:** “rebuild customer apk”, “fix print”, etc. (same as now).

## 2. Customer support bot (in-app)
- **What:** FAQ auto-replies before live chat; human support still closes tickets.
- **Where:** Expand FAQ in `src/lib/support-faq.ts`.
- **Topics examples:** order status, payment, address, promo code, cancel order.

## 3. Ops bot (you / team)
- **What:** Build failure + release notes via Grok notifications (email/app).
- **Telegram/Discord (optional):** set secrets:
  - `TELEGRAM_BOT_TOKEN` + `TELEGRAM_CHAT_ID`, or
  - `DISCORD_WEBHOOK_URL`
- Workflow: `.github/workflows/ops-notify.yml`

## 4. Store helper bot
- **What:** Partner tips + auto-accept (AutoAcceptRules in store app).
- **FAQ:** `src/lib/store-helper-faq.ts` (printer width, accept order, Fresh2GO delivery).

## Safety
- Bots must not delete production data.
- Only support role closes live chat.
- Printer width stays **per store**.
