#!/usr/bin/env python3
"""Week 1 full reliability pass for Ioannina soft launch."""
from pathlib import Path

changed = []

fcm = Path("native-driver/app/src/main/java/com/freshdelivery/nativedriver/push/DriverFirebaseMessagingService.kt")
if fcm.exists():
    t = fcm.read_text()
    old = """            } else {
                // One sound only: MediaPlayer. Notification is silent (channel has no sound).
                showNotification(title, body, isStoreCall = false, silent = true)
                if (isOffer || type.isBlank()) {
                    if (claimMediaSoundSlot()) {
                        playOfferSound(loop = false)
                    }
                    vibratePattern()
                }
            }"""
    new = """            } else {
                // Offers must survive process throttle: FGS ring (same as store call).
                showNotification(title, body, isStoreCall = false, silent = true)
                if (isOffer || type.isBlank()) {
                    StoreCallRingService.ensureChannel(this)
                    runCatching { StoreCallRingService.start(this, title, body) }
                    if (claimMediaSoundSlot()) {
                        playOfferSound(loop = false)
                    }
                    vibratePattern()
                }
            }"""
    if old in t:
        fcm.write_text(t.replace(old, new, 1))
        changed.append("driver FCM offer FGS")
    elif "StoreCallRingService.start(this, title, body)" in t:
        changed.append("driver FCM already")
    else:
        print("WARN driver FCM pattern")

vm = Path("native-customer/app/src/main/java/com/freshdelivery/nativecustomer/ui/CustomerViewModel.kt")
if vm.exists():
    t = vm.read_text()
    if "Το κατάστημα είναι κλειστό — δεν μπορείς να προσθέσεις στο καλάθι" not in t:
        needle = "    fun addToCart(item: MenuItemRow) {\n        val s = _state.value\n"
        if needle in t:
            guard = (
                "    fun addToCart(item: MenuItemRow) {\n"
                "        // week1 closed guard\n"
                "        run {\n"
                "            val st = _state.value\n"
                "            val store = st.selectedStore\n"
                "                ?: st.stores.firstOrNull { it.id == (st.cartStoreId ?: item.store_id) }\n"
                "            if (store != null) {\n"
                "                if (store.is_active == false) {\n"
                "                    _state.value = st.copy(error = \"Το κατάστημα δεν δέχεται παραγγελίες\")\n"
                "                    scheduleBannerClear()\n"
                "                    return\n"
                "                }\n"
                "                if (store.status_override == \"closed\" || !isStoreOpenNow(store)) {\n"
                "                    _state.value = st.copy(error = \"Το κατάστημα είναι κλειστό — δεν μπορείς να προσθέσεις στο καλάθι\")\n"
                "                    scheduleBannerClear()\n"
                "                    return\n"
                "                }\n"
                "            }\n"
                "        }\n"
                "        val s = _state.value\n"
            )
            t = t.replace(needle, guard, 1)
            changed.append("addToCart closed")

    old2 = """                val wasCard = s.paymentMethod == "card"
                _state.value = _state.value.copy(
                    busy = false,
                    cart = emptyList(),
                    cartStoreId = null,
                    cartStoreName = null,
                    showCart = false,
                    selectedStore = null,
                    menu = emptyList(),
                    tipAmount = 0.0,
                    notes = "",
                    addressSuggestions = emptyList(),
                    paymentMethod = "cash",
                    info = if (wasCard) {
                        "Παραγγελία καταχωρίστηκε! Παρακολούθησε την παράδοση."
                    } else {
                        "Η παραγγελία καταχωρήθηκε! Παρακολούθησε την παράδοση."
                    },
                    appliedDeal = null,
                    promoCodeInput = "",
                    promoCodeApplied = null,
                    promoCodeMessage = null,
                    promoPercentOff = 0.0,
                    promoFreeDelivery = false,
                    tab = CustomerTab.Track,
                )"""
    if old2 in t and "optimisticTrack" not in t:
        new2 = """                val wasCard = s.paymentMethod == "card"
                val optimisticTrack = placed?.let { oid ->
                    OrderUi(
                        order = OrderRow(
                            id = oid,
                            store_id = storeId,
                            status = if (wasCard) "pending" else "placed",
                            delivery_address = s.deliveryAddress,
                            delivery_latitude = s.deliveryLat,
                            delivery_longitude = s.deliveryLng,
                            total_amount = s.cart.sumOf { line -> line.price * line.quantity },
                            payment_method = if (wasCard) "card" else "cash",
                        ),
                        storeName = storeName,
                        storeLat = store?.latitude,
                        storeLng = store?.longitude,
                    )
                }
                _state.value = _state.value.copy(
                    busy = false,
                    cart = emptyList(),
                    cartStoreId = null,
                    cartStoreName = null,
                    showCart = false,
                    selectedStore = null,
                    menu = emptyList(),
                    tipAmount = 0.0,
                    notes = "",
                    addressSuggestions = emptyList(),
                    paymentMethod = "cash",
                    info = if (wasCard) {
                        "Παραγγελία καταχωρίστηκε! Παρακολούθησε την παράδοση."
                    } else {
                        "Η παραγγελία καταχωρήθηκε! Παρακολούθησε την παράδοση."
                    },
                    appliedDeal = null,
                    promoCodeInput = "",
                    promoCodeApplied = null,
                    promoCodeMessage = null,
                    promoPercentOff = 0.0,
                    promoFreeDelivery = false,
                    tab = CustomerTab.Track,
                    trackingOrder = optimisticTrack,
                )"""
        t = t.replace(old2, new2, 1)
        changed.append("atomic track")
    vm.write_text(t)

uo = Path("src/hooks/useOrders.ts")
if uo.exists():
    t = uo.read_text()
    if "startOrderAlertLoop({ maxRepeats: 10 })" in t:
        uo.write_text(t.replace("startOrderAlertLoop({ maxRepeats: 10 })", "startOrderAlertLoop({ maxRepeats: 5 })"))
        changed.append("auto-accept 5 rings")

oq = Path("src/components/store/OrderQueue.tsx")
if oq.exists():
    t = oq.read_text()
    if "stopOrderAlertLoop" not in t:
        t = "import { stopOrderAlertLoop } from '@/lib/notifications';\n" + t
    old_mute = (
        "              const next = !soundMuted;\n"
        "              setSoundMuted(next);\n"
        "              localStorage.setItem('store_sound_muted', next ? '1' : '0');"
    )
    new_mute = (
        "              const next = !soundMuted;\n"
        "              setSoundMuted(next);\n"
        "              localStorage.setItem('store_sound_muted', next ? '1' : '0');\n"
        "              if (next) { try { stopOrderAlertLoop(); } catch {} }"
    )
    if old_mute in t:
        t = t.replace(old_mute, new_mute, 1)
        changed.append("mute stops alert")
    oq.write_text(t)

Path("docs/week1-ioannina-reliability.md").write_text(
    "# Week 1 — Ioannina reliability (full pass)\n\n"
    "## Implemented in code\n"
    "- [x] Closed store blocked at placeOrder\n"
    "- [x] Closed store blocked at addToCart\n"
    "- [x] Atomic trackingOrder after place order\n"
    "- [x] Driver offer uses StoreCallRingService (FGS) for background ring\n"
    "- [x] Store auto-accept: alert max 5 rings\n"
    "- [x] Store mute stops alert loop\n"
    "- [x] create-setup-intent + create-payment-sheet deployed\n\n"
    "## Verify on device\n"
    "- [ ] Cash order → Track map + status\n"
    "- [ ] Card order → PaymentSheet (Stripe secrets)\n"
    "- [ ] Store: placed rings until accept\n"
    "- [ ] Driver background / screen off → offer ring\n"
    "- [ ] Disable battery optimization on driver test phones\n\n"
    "## Ops\n"
    "Sign stores + drivers in 2–3 Ioannina neighborhoods after the loop is green.\n"
)
changed.append("docs")
print("CHANGED:", ", ".join(changed))
