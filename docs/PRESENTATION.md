# Fresh Delivery — Product presentation

**Live:** https://quick-handoff-grid-production.up.railway.app/presentation  
**As of:** 2026-07-23 (production Supabase `ojkesspghyqmjmupybva`)

---

## 1. What it is

Fresh Delivery is a real-time food-delivery marketplace for **Ιωάννινα**: customers, multi-store restaurants, drivers, admin ops, and support — one Supabase backend, Railway SPA host, Capacitor mobile shells.

## 2. How it works

1. Customer browses `/order`, checks out (cash/card).
2. Store accepts & prepares in `/store` (installable PWA).
3. **Auto-dispatch** offers the job to nearby / fair-earnings drivers.
4. Driver picks up → live Mapbox tracking → delivers.
5. Admin/Support can **modify live orders** (amounts, address), cancel, unassign, refund (admin).

## 3. Live statistics (prod snapshot)

| Metric | Value |
|---|---|
| Total orders | 806 |
| Delivered | 201 |
| Delivered GMV | €3,942 |
| Delivery fees (delivered) | €544 |
| Tips | €67 |
| Avg ticket | ~€19.60 |
| Active stores | 5 (with logo + cover photos) |
| Driver profiles | 11 |
| User profiles | 29 |
| Menu items | 12 |
| Open (non-terminal) orders | 0 |

Payment mix on delivered sample: almost all **cash** (card rails ready via Stripe).

## 4. Economics (configured)

From `platform_settings`:

- Default store commission ≈ **43.33%**
- Admin share ≈ **33.33%** of commission split
- Driver: base **€3** + **€0.50/km** (min €3, max €12) + tip
- Customer platform service fee **€0.99**
- Driver pool ≈ **10%** of subtotal
- Auto-dispatch + fair earnings distribution enabled

## 5. Monthly infrastructure cost (estimate)

| Item | Soft launch | Notes |
|---|---|---|
| Railway | €5–20 | SPA hosting |
| Supabase | €0–25 | Free → Pro |
| Mapbox | €0–40 | Free tier then usage |
| Firebase FCM | €0–10 | Early volume ~free |
| Domain / email | €2–8 | Amortized |
| Apple Developer | ~€8/mo | $99/yr |
| Google Play | €0 | $25 one-time |
| **Fixed total** | **€15–110** | Before ads / Stripe % |

**Variable:** Stripe EE card ≈ 1.4% + €0.25 per card payment.

At ~€50–100/mo fixed, a few dozen paid orders/day cover infra easily once card volume grows.

## 6. Capacity (measured 2026-07-20)

- `place_order` burst ~45 rps, 100% success (p50 129ms)
- Safe sustained ~20 orders/min
- Read mix ~296 rps
- Keep Mapbox under ~14 sustained rps

## 7. Mobile / stores

- Play AABs: `play-store-aabs-v1`
- iOS Xcode zips: `ios-xcode-projects-v1`
- Live stores seeded with cuisine photos in `store-images` bucket

## 8. Next for public launch

1. Stripe **live** keys  
2. Play Internal testing → Production  
3. TestFlight after Mac archive  
4. More Ioannina stores + drivers  
5. Store listing assets / Data safety / privacy policy  
