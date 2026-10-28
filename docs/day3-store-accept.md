# Day 3 — Store accept

**Goal:** Cash order appears in store → Accept works → alert stops → status becomes preparing (or accepted→preparing).

## Setup
1. Customer app 1.0.10 — place **1 cash** order to an **open** store you control
2. Store PWA — logged in as **owner** of that store
3. Sound on (not muted) for first order if you want to hear the alert

## Tests
1. New order shows in queue with status **placed** (or Greek equivalent)
2. Tap **Αποδοχή**
3. Status moves away from placed (preparing / accepted)
4. Order alert **stops** (if it was ringing)
5. No error toast; if accept fails, you see a **real** error (not fake success)
6. Optional: Accept a second cash order the same way

## Fail cases to note
- Pending/card unpaid → must NOT accept (message about card)
- Wrong account (not store owner) → authorization error

## Done when
At least **2 successful accepts** on real cash orders from today.
