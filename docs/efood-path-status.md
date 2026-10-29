# Efood-level for Ioannina — status

## Week 1 scoreboard
| Day | Topic | Status |
|-----|--------|--------|
| 1 | Cash E2E | **device pass** |
| 2 | Closed store | **device pass** |
| 3 | Store accept | **device pass** |
| 4 | Driver offer foreground | **code pass 10/10** |
| 5 | Driver offer background | **code pass 13/13** |
| 6 | Card payment path | **code pass 7/7** (needs Stripe secrets for live pay) |
| 7 | Week 1 review | next |

## Day 5 verified
FCM, isOffer, notification, FGS ring, MediaPlayer alarm attrs, manifest permissions.

## Day 6 verified
Card/cash placeOrder, PaymentSheet, setup-intent, friendly errors, pending optimistic, pay retry. Edge functions deployed (401 without JWT).

## Residual (device/ops, not missing code)
- OEM battery kill on background rings
- Stripe keys must be set for real card charges
- Density of stores/drivers = Week 3
