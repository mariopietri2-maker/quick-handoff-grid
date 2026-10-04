# P0 smoke test — Fresh2GO

Run after each native/web release.

## Customer native (2.9.22+)
- [ ] Install latest APK
- [ ] Login; home stores + promos
- [ ] Cart bar; place order
- [ ] Support close → new live chat works

## Store
- [ ] Login → store UI only (not customer)
- [ ] Accept order

## Driver native (2.6.33+)
- [ ] Online; receive offer; complete

## Admin
- [ ] /admin?section=ops_assistant works

## S+ gate (must all pass before calling release S+)

- [ ] `npm test` green in CI
- [ ] Store login never shows customer shell
- [ ] Support close → open new live chat
- [ ] Place order → store can accept → receipt readable
- [ ] K-driver can see N-store offers when on shift
- [ ] Customer tracking loads without full-map flash on every tab
- [ ] Download page shows **native** versions only as primary
