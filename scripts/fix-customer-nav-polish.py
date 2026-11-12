#!/usr/bin/env python3
"""Navigation polish for native customer app."""
from pathlib import Path
import re

vm = Path('native-customer/app/src/main/java/com/freshdelivery/nativecustomer/ui/CustomerViewModel.kt')
vt = vm.read_text()

# 1) selectTab: auto-attach latest active order when opening Track; clear search on Home
old_select = '''    fun selectTab(tab: CustomerTab) {
        refreshNetworkStatus()
        // Always clear store menu / cart overlays so bottom-nav Home is never "stuck"
        _state.value = _state.value.copy(
            tab = tab,
            showCart = false,
            selectedStore = null,
            menu = emptyList(),
            menuModifiers = emptyMap(),
            modifierPickerItem = null,
            error = null,
            // Leave live tracking when user explicitly opens another main tab
            trackingOrder = if (tab == CustomerTab.Track) _state.value.trackingOrder else null,
        )
        when (tab) {
            CustomerTab.Orders, CustomerTab.Track -> refreshOrders()
            CustomerTab.Home, CustomerTab.Browse -> refreshStores()
            CustomerTab.Profile -> refreshSavedCards()
        }
    }'''

new_select = '''    fun selectTab(tab: CustomerTab) {
        refreshNetworkStatus()
        val cur = _state.value
        val terminal = setOf("delivered", "cancelled", "canceled", "completed", "rejected", "failed")
        val trackOrder = when {
            tab != CustomerTab.Track -> null
            cur.trackingOrder != null -> cur.trackingOrder
            else -> cur.orders.firstOrNull { ou ->
                val st = ou.order.status?.lowercase().orEmpty()
                st.isNotBlank() && st !in terminal
            }
        }
        // Home = discovery feed; Browse = search — clear shared query when returning Home
        val nextQuery = if (tab == CustomerTab.Home) "" else cur.searchQuery
        _state.value = cur.copy(
            tab = tab,
            showCart = false,
            selectedStore = null,
            menu = emptyList(),
            menuModifiers = emptyMap(),
            modifierPickerItem = null,
            error = null,
            searchQuery = nextQuery,
            trackingOrder = trackOrder,
        )
        when (tab) {
            CustomerTab.Orders, CustomerTab.Track -> refreshOrders()
            CustomerTab.Home, CustomerTab.Browse -> refreshStores()
            CustomerTab.Profile -> refreshSavedCards()
        }
        if (tab == CustomerTab.Track && trackOrder != null) {
            refreshDriverLocation()
            ensureDeliveryCoordsOnTrack(trackOrder)
        }
    }'''

if old_select in vt:
    vt = vt.replace(old_select, new_select, 1)
    print('selectTab updated')
else:
    print('selectTab pattern miss')

# 2) placeOrder: force Track even if network lag — already sets Track; ensure Orders fallback still tries track
old_fb = '''                } else {
                    _state.value = _state.value.copy(tab = CustomerTab.Orders)
                    refreshOrders()
                }'''
new_fb = '''                } else {
                    // Keep user on tracking / orders — never leave them on cart
                    _state.value = _state.value.copy(tab = CustomerTab.Track, showCart = false)
                    refreshOrders()
                }'''
if old_fb in vt:
    vt = vt.replace(old_fb, new_fb, 1)
    print('placeOrder fallback Track')
else:
    print('placeOrder fallback miss')

vm.write_text(vt)

shell = Path('native-customer/app/src/main/java/com/freshdelivery/nativecustomer/ui/CustomerShell.kt')
st = shell.read_text()

# 3) TrackTab signature + empty CTAs
old_sig = 'private fun TrackTab(state: CustomerUiState, onRefresh: () -> Unit = {}, onPay: (String) -> Unit = {}) {'
new_sig = 'private fun TrackTab(state: CustomerUiState, onRefresh: () -> Unit = {}, onPay: (String) -> Unit = {}, onGoOrders: () -> Unit = {}, onGoHome: () -> Unit = {}) {'
if old_sig in st:
    st = st.replace(old_sig, new_sig, 1)
    print('TrackTab sig')
else:
    print('TrackTab sig miss')

old_empty = '''            if (order == null) {
                Column(
                    Modifier.fillMaxWidth().padding(vertical = 24.dp),
                    horizontalAlignment = Alignment.CenterHorizontally,
                ) {
                    Text("Δεν παρακολουθείς παραγγελία", fontWeight = FontWeight.Bold, color = FreshInk)
                    Spacer(Modifier.height(6.dp))
                    Text("Άνοιξε Παραγγελίες και πάτα μια ενεργή παραγγελία.", color = FreshMuted)
                }
            } else {'''

new_empty = '''            if (order == null) {
                Column(
                    Modifier.fillMaxWidth().padding(vertical = 24.dp),
                    horizontalAlignment = Alignment.CenterHorizontally,
                ) {
                    Text("Δεν παρακολουθείς παραγγελία", fontWeight = FontWeight.Bold, color = FreshInk)
                    Spacer(Modifier.height(6.dp))
                    Text(
                        "Άνοιξε τις παραγγελίες σου ή γύρνα στην αρχική για να παραγγείλεις.",
                        color = FreshMuted,
                        style = MaterialTheme.typography.bodyMedium,
                    )
                    Spacer(Modifier.height(16.dp))
                    Button(
                        onClick = onGoOrders,
                        colors = ButtonDefaults.buttonColors(containerColor = FreshGreen),
                        shape = RoundedCornerShape(14.dp),
                        modifier = Modifier.fillMaxWidth(),
                    ) {
                        Text("Οι παραγγελίες μου", fontWeight = FontWeight.Bold)
                    }
                    Spacer(Modifier.height(8.dp))
                    OutlinedButton(
                        onClick = onGoHome,
                        shape = RoundedCornerShape(14.dp),
                        modifier = Modifier.fillMaxWidth(),
                    ) {
                        Text("Αρχική", fontWeight = FontWeight.SemiBold, color = FreshInk)
                    }
                }
            } else {'''

if old_empty in st:
    st = st.replace(old_empty, new_empty, 1)
    print('Track empty CTA')
else:
    print('Track empty miss')

# 4) Wire TrackTab call site
old_call = 'CustomerTab.Track -> TrackTab(state, onRefresh = onRefresh, onPay = onPayOrder)'
new_call = '''CustomerTab.Track -> TrackTab(
                    state,
                    onRefresh = onRefresh,
                    onPay = onPayOrder,
                    onGoOrders = { onTab(CustomerTab.Orders) },
                    onGoHome = { onTab(CustomerTab.Home) },
                )'''
if old_call in st:
    st = st.replace(old_call, new_call, 1)
    print('TrackTab wired')
else:
    print('TrackTab call miss')

# 5) Browse title hint — clarify it's the search tab
st = st.replace(
    '''                    Text(
                        "Αναζήτηση",
                        style = MaterialTheme.typography.headlineMedium,
                        modifier = Modifier.weight(1f),
                    )''',
    '''                    Column(Modifier.weight(1f)) {
                        Text(
                            "Αναζήτηση",
                            style = MaterialTheme.typography.headlineMedium,
                        )
                        Text(
                            "Καταστήματα & προϊόντα",
                            style = MaterialTheme.typography.labelMedium,
                            color = FreshMuted,
                        )
                    }''',
    1,
)

shell.write_text(st)
print('ALL NAV POLISH DONE')
