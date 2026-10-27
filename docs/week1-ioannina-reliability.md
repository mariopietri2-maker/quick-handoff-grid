# Week 1 — Ioannina reliability (efood-level local)

Goal: full order loop works 9/10 times in Ioannina zones.

## Checklist

### Customer
- [x] Closed / inactive store blocked at `placeOrder`
- [x] Closed store blocked at `addToCart` (week1)
- [x] After place order → Track tab + optimistic `trackingOrder` (atomic)
- [ ] Card path: PaymentSheet opens for pending card orders
- [ ] Cash path: lands on track with address pins
- [ ] Empty track screen shows clear CTA (orders list)

### Store PWA
- [ ] New `placed` order plays alert until accept (or 5× if auto-accept)
- [ ] Cancel / accept stops sound
- [ ] Owner role sees store UI not marketing site

### Driver
- [ ] Offer FCM while app backgrounded → notification + sound
- [ ] Screen off still rings (battery unrestricted recommended)
- [ ] Store call ring service stops when accepted/cancelled

### Payments / backend
- [x] `create-setup-intent` deployed (project ojkesspghyqmjmupybva)
- [x] `create-payment-sheet` reachable (not 404)
- [ ] Stripe secrets set (live or sandbox) on Edge Functions

### Ops test (do daily)
1. Open store → add item → cash order → Track shows map + status
2. Same with card (if Stripe configured)
3. Store accepts → status updates on customer
4. Driver receives offer in background
5. Closed store → cannot add to cart / place order

## Day log
- Day 1: closed-store cart block + atomic track after order + this checklist
