# P0 smoke test — Fresh2GO

Run after each native/web release. Check every box before calling the build good.

## Customer native (2.9.22+)
- [ ] Install APK from GitHub `mobile-apks-v1` / website download
- [ ] Login works; text fields readable
- [ ] Home shows stores + promos (remote config)
- [ ] Open store → menu → add item → cart bar shows qty · Καλάθι · total
- [ ] Place order (cash or test payment)
- [ ] Support: open live chat → support closes → **Νέο αίτημα / Ξεκίνα νέα συνομιλία** → new chat sends

## Store (PWA / Capacitor)
- [ ] Login as store → **only** store UI (never customer discovery)
- [ ] New order rings / appears
- [ ] Accept order; receipt/print readable

## Driver native (2.6.33+)
- [ ] Login; go online / shift if required
- [ ] Receive offer for test order
- [ ] Accept → map → complete flow

## Admin
- [ ] `/admin?section=ops_assistant` opens Ops Assistant
- [ ] Run now → promos + health update

## Web
- [ ] https://fresh2go.gr/order loads stores
- [ ] Store users on `/order` redirect to `/store`
