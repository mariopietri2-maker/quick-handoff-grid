# Day 6 — Card payment path

**Goal:** Customer can start card checkout; errors are clear if Stripe is not configured.

## Preconditions
- Customer APK latest
- Supabase edge: `create-payment-sheet`, `create-setup-intent` deployed
- Stripe keys on edge functions (test or live)

## Tests
1. Add item → cart → select **card**
2. Place order
3. Payment sheet opens **or** friendly Greek error (not JWT dump)
4. If paid: order leaves pure unpaid pending; store can accept when rules allow
5. Cash still works (regression)

## Pass when
- Card path does not crash
- User understands success or failure
- Cash still 1/1 OK
