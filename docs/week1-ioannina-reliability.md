# Week 1 — Ioannina reliability (full pass)

## Implemented in code
- [x] Closed store blocked at placeOrder
- [x] Closed store blocked at addToCart
- [x] Atomic trackingOrder after place order
- [x] Driver offer uses StoreCallRingService (FGS) for background ring
- [x] Store auto-accept: alert max 5 rings
- [x] Store mute stops alert loop
- [x] create-setup-intent + create-payment-sheet deployed

## Verify on device
- [ ] Cash order → Track map + status
- [ ] Card order → PaymentSheet (Stripe secrets)
- [ ] Store: placed rings until accept
- [ ] Driver background / screen off → offer ring
- [ ] Disable battery optimization on driver test phones

## Ops
Sign stores + drivers in 2–3 Ioannina neighborhoods after the loop is green.
