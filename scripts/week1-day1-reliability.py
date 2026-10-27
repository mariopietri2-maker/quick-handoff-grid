#!/usr/bin/env python3
"""Week1 day1: block addToCart when store closed; atomic tracking after placeOrder."""
from pathlib import Path

changed = []
vm = Path("native-customer/app/src/main/java/com/freshdelivery/nativecustomer/ui/CustomerViewModel.kt")
t = vm.read_text()

# --- addToCart: block closed ---
# Find function start and inject guard after basic validation
old_add = None
for candidate in [
    '''    fun addToCart(item: MenuItemRow) {
        val s = _state.value
''',
    '''    fun addToCart(item: MenuItemRow) {
''',
]:
    if candidate in t:
        old_add = candidate
        break

if old_add and "addToCart week1 closed guard" not in t:
    # Read a bit of the function to insert after store resolution
    # Prefer injecting right at start with store lookup
    insert = '''    fun addToCart(item: MenuItemRow) {
        // week1 closed guard
        run {
            val st = _state.value
            val store = st.selectedStore
                ?: st.stores.firstOrNull { it.id == (st.cartStoreId ?: item.store_id) }
            if (store != null) {
                if (store.is_active == false) {
                    _state.value = st.copy(error = "Το κατάστημα δεν δέχεται παραγγελίες")
                    scheduleBannerClear()
                    return
                }
                if (store.status_override == "closed" || !isStoreOpenNow(store)) {
                    _state.value = st.copy(error = "Το κατάστημα είναι κλειστό — δεν μπορείς να προσθέσεις στο καλάθι")
                    scheduleBannerClear()
                    return
                }
            }
        }
'''
    # Replace only the function signature line block once
    if '''    fun addToCart(item: MenuItemRow) {
        val s = _state.value
''' in t:
        t = t.replace(
            '''    fun addToCart(item: MenuItemRow) {
        val s = _state.value
''',
            insert + '''        val s = _state.value
''',
            1,
        )
        changed.append("addToCart closed guard")
    elif '''    fun addToCart(item: MenuItemRow) {
''' in t:
        t = t.replace(
            '''    fun addToCart(item: MenuItemRow) {
''',
            insert,
            1,
        )
        changed.append("addToCart closed guard")
else:
    print("skip addToCart", "already" if "addToCart week1 closed guard" in t else "pattern missing")

# --- placeOrder onSuccess: set trackingOrder in same state update ---
# Look for the copy block that sets tab = CustomerTab.Track after place
marker = "tab = CustomerTab.Track,"
idx = t.find("}.onSuccess { placedId ->")
if idx < 0:
    print("WARN no placeOrder onSuccess")
else:
    # Find first tab = CustomerTab.Track after onSuccess
    sub = t[idx:idx+2500]
    if "trackingOrder =" in sub[:1200]:
        print("trackingOrder already near onSuccess")
    else:
        old = """                _state.value = _state.value.copy(
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
        new = """                val optimisticTrack = placed?.let { oid ->
                    OrderUi(
                        order = OrderRow(
                            id = oid,
                            store_id = storeId,
                            status = if (wasCard) "pending" else "placed",
                            delivery_address = s.deliveryAddress,
                            delivery_latitude = s.deliveryLat,
                            delivery_longitude = s.deliveryLng,
                            total_amount = s.cart.sumOf { it.price * it.quantity },
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
                    trackingOrder = optimisticTrack ?: _state.value.trackingOrder,
                )"""
        if old in t:
            # placed is defined after this block in current code — need reorder
            # Check order of vals
            pass

# Safer: after `val wasCard = ...` and `val placed = ...` inject tracking into copy
# Current order: placed, storeName, wasCard, then copy without trackingOrder
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
if old2 in t:
    t = t.replace(old2, new2, 1)
    changed.append("atomic trackingOrder on placeOrder")
else:
    print("WARN placeOrder copy pattern")

vm.write_text(t)
print("CHANGED:", ", ".join(changed) if changed else "none")
if not changed:
    raise SystemExit(1)
