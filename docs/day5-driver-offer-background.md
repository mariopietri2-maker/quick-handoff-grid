# Day 5 — Driver offer (background / screen off)

**Goal:** Offer notification + sound when driver app is **not** in foreground.

## Setup
1. Driver APK with FGS ring (latest build)
2. Login → **online**
3. Grant: notifications, battery unrestricted (Settings → Apps → Driver → Battery)
4. Put app in **background** or turn **screen off**
5. Trigger a new offer (store order → dispatch)

## Pass criteria
- [ ] Notification appears
- [ ] Sound/vibration without opening app first
- [ ] Opening notification lands on offer

## If fail
- OEM battery kill (Xiaomi/Huawei/Samsung) — disable optimization
- Notification permission denied
- Driver offline in app
- Offer only for other role (K vs M)
