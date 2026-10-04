# Fresh2GO money path (marketplace model)

Aligned with efood / Wolt / Uber-class **collect & disburse**, adapted for Ioannina scale.

## Stages

| # | Stage | Fresh2GO |
|---|--------|----------|
| 1 | Quote | Cart → `total_amount`, locked `driver_payout` |
| 2 | Pay-in rail | `cash` \| `card` (Stripe) \| `viva` |
| 3 | Authorize | Card/Viva: order `pending` + PaymentIntent / Smart Checkout |
| 4 | Capture | `payments-webhook` / `viva-webhook` → `placed` |
| 5 | Fulfill | Store accept → driver → `delivered` |
| 6 | Settle | Trigger `settle_order_commission` → wallets + `commission_settled_at` |
| 7 | Payout | Admin store payables + driver wallet (bank batch operational) |

## Split (food subtotal only)

Default (configurable in platform settings):

- **Store keeps** ~85%
- **Pool / basket** ~10%
- **Admin** residual ~5%

**Driver** = locked `driver_payout` (or quote) **+ tip** — not a % of food.

## Cash

- No PSP capture.
- Driver collects `cashToCollect` ≈ customer total.
- `shift_cash_balance` + max cash cap (driver app).
- Platform commission still taken at settle from store side of ledger.

## Code

- `src/lib/money-path.ts` — stages, split, ledger, invariants
- `src/lib/money.ts` — display totals
- `src/lib/driver-payout.ts` — driver display
- DB: `settle_order_commission`, `transactions` wallets

## S+ checklist

- [ ] Card: pending → webhook → placed only when amount matches
- [ ] Cash: driver cash UI matches order total
- [ ] Delivered → `commission_settled_at` set (System Doctor can force `settle_order_now`)
- [ ] Store payables panel matches ledger
- [ ] Refunds: Stripe/Viva refund + order status + no double settle
