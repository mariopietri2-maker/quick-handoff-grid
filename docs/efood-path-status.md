# Efood-level for Ioannina — status

## Weeks 1–3 code: READY
## Week 4 — Soft launch

| Day | Focus | Status |
|-----|--------|--------|
| 22 | Soft launch rules | **code ready 8/8** — go/no-go checklist below |
| 23 | Live lunch | ops |
| 24 | Fix top 3 from log | ops + targeted fixes |
| 25 | Live dinner | ops |
| 26 | Payments + support under load | ops |
| 27 | Driver background on 2–3 OEMs | device |
| 28 | Store rush sound/accept | device |
| 29 | Feature freeze | rule |
| 30 | Scorecard vs local efood | review |

### Day 22 soft-launch rules (use these)
1. **Zone-limited** — only 2–3 Ioannina areas
2. **Invite / friends first** — not full city ads yet
3. **Cash primary** until Stripe verified live
4. **Log every failure** (screenshot + order id + time)
5. **No new features** during Days 23–29 — only fixes from the log

### Day 22 go/no-go (code)
- [x] Cash order → track
- [x] Closed store blocked
- [x] Store accept
- [x] Driver offer FCM/FGS
- [x] Card path present
- [x] Support surfaces
- [x] Geo/zones tools

### Day 22 go/no-go (ops — you)
- [ ] ≥5 open stores in launch zones
- [ ] ≥5 drivers willing at peak
- [ ] Latest customer 1.0.11 + driver 1.0.3 installed
- [ ] Battery unrestricted on driver phones
- [ ] Stripe keys if card offered to public

### Day 30 local efood scorecard
- 9/10 test orders finish clean
- Closed store cannot order
- Store accept + sound stop
- Driver hears offer (bg with OEM settings)
- Cash always; card if configured
- Track not empty
- Peak coverage in chosen zones

## Honest limit
National efood parity is out of scope. **Ioannina soft-launch parity** is the target and the platform side is in place.
