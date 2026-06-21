## Goal
Ship a unique customer-app revamp with an AI-generated hero slideshow, an admin tool to create those cards (image + prompt → AI image), and a sweep to wire up dead buttons.

## 1. AI Hero Cards — backend
- Migration: new table `public.ai_hero_cards`
  - `id`, `title`, `subtitle`, `cta_label`, `cta_link`, `image_url` (storage), `source_image_url` (admin upload), `prompt`, `status` (`draft|active`), `sort_order`, `created_at`, `created_by`
  - GRANTs: `SELECT` to `anon`+`authenticated` (public slideshow); full CRUD via service_role; admin-only writes via `has_role(auth.uid(),'admin')` policies.
- Storage bucket `ai-hero-cards` (public) for source uploads + generated PNGs.
- Edge function `generate-hero-card`:
  - Input: `{ card_id, source_image_url, prompt, title }`
  - Calls Lovable AI Gateway `/v1/images/generations` (`openai/gpt-image-2`, `quality:"low"`, `stream:true`, `partial_images:1`); uses source as visual reference in the prompt text.
  - Uploads final base64 PNG to storage, updates row's `image_url`.
  - Streams SSE back so admin sees progressive preview.

## 2. Admin — AI Card Creator
- New tab inside `Καταστήματα` sidebar group: `Καταστήματα → AI Cards` (path `/admin?tab=ai-cards`).
- Page `AiCardsAdmin.tsx`:
  - List of existing cards (reorder, toggle active, delete).
  - "Create card" panel: upload reference image, title, subtitle, CTA, free-text prompt, "Generate" button.
  - Live progressive preview via `streamImage` helper while AI runs (blur on partial, sharp on final).
  - Save → inserts row, kicks off edge function, persists generated `image_url`.

## 3. Customer App — full revamp (all screens, one design language)
Theme name: **"Fresh Bento"** — soft warm-white surfaces, rounded-3xl bento tiles, brand accent (existing `c-accent`), subtle motion. Reuse current OfferCard. No new external libs.

Screens touched:
- `CustomerApp.tsx` (home): replace `OnePlusOneHero` with new `AiHeroCarousel` (auto-advance, dots, swipe) sourced from `ai_hero_cards` where `status='active'`. Keep existing quick tiles, offer rows, store list.
- `RestaurantPage.tsx`: new sticky header w/ blurred hero, bento-style category strip, cleaner item rows, persistent footer cart button.
- `CheckoutPage.tsx`: stepper (Address → Time → Pay), summary card, brand CTA.
- `MyOrdersPage.tsx`: segmented "Ενεργές / Ιστορικό", status pills, empty state.
- `OrderTrackingPage.tsx`: bigger status hero, driver card, ETA chip, contact buttons.
- `ProfilePage.tsx`: bento grid (wallet, addresses, referrals, settings, support, logout).

New components:
- `src/components/customer/AiHeroCarousel.tsx`
- `src/components/customer/BentoTile.tsx`
- `src/components/customer/SectionHeader.tsx`

## 4. Functional sweep — wire up dead buttons
Audit these known surfaces and bind handlers / routes:
- Customer header: Search bar bottom-nav button (focus + scroll), Address sheet save (already works — verify), Language toggle.
- Home: "See all" on offer rows (filter + scroll), category chips, quick tiles, promo banner click.
- Restaurant: Share, Favorite, Info, Reviews.
- Checkout: Apply promo, schedule time, payment method select.
- Orders: Reorder, Rate, Contact support.
- Profile tiles: each routes to existing pages or shows a "coming soon" toast (no silent dead clicks).

For any button without a destination yet, hook a `toast` with a clear message instead of leaving it inert.

## 5. Verification
- Build passes.
- Playwright: load `/order`, screenshot home, click into a store, into checkout, into profile — confirm no console errors and visible state changes on every tap.
- Admin: open AI Cards tab, generate a sample card end-to-end, confirm it appears on `/order`.

## Technical details
- Stack: React + Vite + Tailwind + shadcn, Supabase (Lovable Cloud), AI Gateway image stream (`openai/gpt-image-2`, default params).
- Edge function uses `LOVABLE_API_KEY` server-side; image upload via service role.
- Carousel auto-advance every 5s, pauses on touch; uses CSS scroll-snap (no new lib).
- Reuses existing semantic tokens (`c-accent`, `c-muted`); no hardcoded hex.

## Out of scope
- Driver/store/admin apps beyond the new AI Cards tab.
- Payment provider changes.
- New languages.
