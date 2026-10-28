# Day 2 — Closed store

**Goal:** Customer cannot add to cart or place order when store is closed.

## App
Customer native **1.0.10** (7233212) — same APK as Day 1.

## How to close a store for the test
In **store PWA / admin**: set store to closed (`status_override = closed`) **or** set hours so current time is outside open window.

## Tests
1. **Closed + add to cart** — open that store menu → tap add → must show error, item not in cart
2. **Closed + place order** — if cart already had items from when open: try place → must fail with closed message
3. **Re-open store** — set open again → add + cash place still works (1 order)

## Expected Greek messages (approx)
- Cart: «Το κατάστημα είναι κλειστό — δεν μπορείς να προσθέσεις στο καλάθι»
- Place (override): «Το κατάστημα είναι προσωρινά κλειστό…»
- Place (hours): «Το κατάστημα φαίνεται κλειστό τώρα…»
- Inactive: «Το κατάστημα δεν δέχεται παραγγελίες…»

## Done when
- [ ] Cannot add while closed
- [ ] Cannot place while closed
- [ ] Can order again after re-open
