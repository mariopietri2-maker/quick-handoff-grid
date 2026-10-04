# Phase 1 — Production local (toward S-tier)

## Done in code
- [x] Store role cannot stay on `/order` (CustomerApp + RootEntry)
- [x] MobileAppGate keeps store/driver/customer shells on path
- [x] Live chat: prefer **open** session in `get_my_live_chat_session`
- [x] Native SupportScreen: «Ξεκίνα νέα συνομιλία» after close
- [x] Download page: Native primary, Capacitor marked Legacy
- [x] Smoke checklist: `docs/P0_SMOKE_TEST.md`

## You must verify on devices
- [ ] Customer order → store accept → driver complete
- [ ] Support close → new chat on native customer
- [ ] Store login never shows customer UI

## Next (Phase 2)
- Split CustomerShell
- Archive dead workflows
- Automated smoke in CI where possible
