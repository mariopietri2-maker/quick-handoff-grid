# Day 1 — Cash order end-to-end

**Goal:** 5 successful cash orders: open store → cart → cash → place → Track shows order.

## App to use
- Customer native **1.0.10** (versionCode **7233212**)
- Download: https://github.com/mariopietri2-maker/quick-handoff-grid/releases/download/mobile-apks-v1/fresh2go-customer-native-debug.apk
- Store PWA: same project store URL (owner login)

## Preconditions
1. Install / update customer APK 1.0.10
2. Login as customer
3. One store **open** (status not closed, within hours)
4. Payment method **Μετρητά / cash** (default)

## Test script (repeat ×5)
1. Set delivery address + map pin (Εύρεση / Η τοποθεσία μου)
2. Open store → add ≥1 item → open cart
3. Confirm **cash** selected
4. Place order
5. **Pass if:**
   - Cart clears
   - App goes to **Παρακολούθηση / Track**
   - Order id / status visible (placed)
   - Store + delivery pins if coords exist
6. Store PWA: order appears as **placed** → Accept works

## Fail log (fill in)
| # | Store | Result | What you saw |
|---|-------|--------|--------------|
| 1 | | pass/fail | |
| 2 | | pass/fail | |
| 3 | | pass/fail | |
| 4 | | pass/fail | |
| 5 | | pass/fail | |

## Known code path (already on main)
- `placeOrder` forces cash unless card selected
- Requires address + lat/lng
- Blocks closed / inactive store
- On success: `trackingOrder` + tab Track (`optimisticTrack`)

## Day 1 done when
At least **5/5** cash orders complete steps 1–5 without reinstall or workaround.
