# Efood-level for Ioannina — status

## Done
- Day 1 cash E2E — **pass** (device)
- Day 2 closed store — **pass** (device)
- Day 3 store accept — **pass** (device)
- Day 4 driver offer foreground — **code pass 10/10** (device confirm recommended)
- P0 polling + APKs uploaded 2026-10-28 ~18:57 UTC

## Day 4 code checklist (verified on main)
- [x] setOnline → shift + refreshWork
- [x] fetchPendingOffers when online
- [x] maybeAlertOffers sound
- [x] realtime subscribePendingOffers
- [x] FCM isOffer + FGS ring + notification
- [x] acceptOffer
- [x] poll backup

## In progress / next
- Day 5 background offer — **code ready** (FGS); device + OEM battery still required
- Day 6 card path
- Day 7 week-1 review

## Residual risk (not a code miss)
Xiaomi/Huawei/Samsung may still kill background rings unless battery unrestricted.
