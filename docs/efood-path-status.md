# Efood-level for Ioannina — status

## Week 1 COMPLETE
## Week 2 COMPLETE (code)

| Day | Topic | Status |
|-----|--------|--------|
| 8 | Customer UX | pass |
| 9 | Tracking | pass |
| 10 | Store queue | **pass** — StoreDashboard → OrderQueue (earlier 9/10 was false fail) |
| 11 | Driver UX | pass |
| 12 | Greek status labels | **pass 7/7** TRACK_STEPS + trackHeadline |
| 13 | Support reachable | **pass** — SupportScreen, Support*Buttons, SupportApp, tickets |
| 14 | Week 2 review | **pass** aggregate |

### Fix note (Day 10)
StoreApp does not import OrderQueue directly; it renders StoreDashboard which **does** import and render OrderQueue with onStatusUpdate. Wiring is correct.

## Week 3 next (ops-heavy)
| Day | Focus |
|-----|--------|
| 15 | Pick Ioannina zones |
| 16–17 | Sign stores |
| 18 | Drivers |
| 19 | Admin tools |
| 20 | Promos stable |
| 21 | Peak dry run |
