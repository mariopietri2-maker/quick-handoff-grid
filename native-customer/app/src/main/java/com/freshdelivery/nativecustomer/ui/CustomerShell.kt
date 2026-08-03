package com.freshdelivery.nativecustomer.ui

import androidx.activity.compose.BackHandler
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.outlined.ArrowBack
import androidx.compose.material.icons.outlined.AccountCircle
import androidx.compose.material.icons.outlined.Add
import androidx.compose.material.icons.outlined.Home
import androidx.compose.material.icons.outlined.Map
import androidx.compose.material.icons.outlined.MyLocation
import androidx.compose.material.icons.outlined.Receipt
import androidx.compose.material.icons.outlined.Remove
import androidx.compose.material.icons.outlined.Search
import androidx.compose.material.icons.outlined.ShoppingCart
import androidx.compose.material.icons.outlined.Store
import androidx.compose.material3.Badge
import androidx.compose.material3.BadgedBox
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.FloatingActionButton
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.NavigationBar
import androidx.compose.material3.NavigationBarItem
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
import androidx.compose.material3.SnackbarHost
import androidx.compose.material3.SnackbarHostState
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.unit.dp
import coil.compose.AsyncImage
import com.freshdelivery.nativecustomer.data.CustomerTab
import com.freshdelivery.nativecustomer.data.MenuItemRow
import com.freshdelivery.nativecustomer.data.OrderUi
import com.freshdelivery.nativecustomer.data.StoreRow
import com.freshdelivery.nativecustomer.ui.map.MapMarker
import com.freshdelivery.nativecustomer.ui.map.MapboxView

// RESTORE_MARKER: full file continues from main branch blob 7e2a253
// If this commit is incomplete, run: git checkout main -- native-customer/app/src/main/java/com/freshdelivery/nativecustomer/ui/CustomerShell.kt

@Composable
fun LoginScreen(
    busy: Boolean,
    error: String?,
    info: String? = null,
    signupMode: Boolean = false,
    onToggleSignup: (Boolean) -> Unit = {},
    onLogin: (String, String) -> Unit,
    onSignUp: (String, String, String, String) -> Unit = { _, _, _, _ -> },
) {
    var email by remember { mutableStateOf("") }
    var password by remember { mutableStateOf("") }
    var fullName by remember { mutableStateOf("") }
    var phone by remember { mutableStateOf("") }
    Column(
        Modifier.fillMaxSize().padding(24.dp),
        verticalArrangement = Arrangement.Center,
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        Text("Fresh Customer", style = MaterialTheme.typography.headlineLarge, color = MaterialTheme.colorScheme.primary)
        Text(if (signupMode) "Νέος λογαριασμός πελάτη" else "Native · Mapbox · FCM", color = MaterialTheme.colorScheme.onSurfaceVariant)
        Spacer(Modifier.height(24.dp))
        if (signupMode) {
            OutlinedTextField(value = fullName, onValueChange = { fullName = it }, label = { Text("Ονοματεπώνυμο") }, singleLine = true, modifier = Modifier.fillMaxWidth())
            Spacer(Modifier.height(12.dp))
            OutlinedTextField(value = phone, onValueChange = { phone = it }, label = { Text("Τηλέφωνο") }, singleLine = true, keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Phone), modifier = Modifier.fillMaxWidth())
            Spacer(Modifier.height(12.dp))
        }
        OutlinedTextField(value = email, onValueChange = { email = it }, label = { Text("Email") }, singleLine = true, keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Email), modifier = Modifier.fillMaxWidth())
        Spacer(Modifier.height(12.dp))
        OutlinedTextField(value = password, onValueChange = { password = it }, label = { Text("Password") }, singleLine = true, visualTransformation = PasswordVisualTransformation(), keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Password), modifier = Modifier.fillMaxWidth())
        if (!error.isNullOrBlank()) { Spacer(Modifier.height(12.dp)); Text(error, color = MaterialTheme.colorScheme.error) }
        if (!info.isNullOrBlank()) { Spacer(Modifier.height(12.dp)); Text(info, color = MaterialTheme.colorScheme.primary) }
        Spacer(Modifier.height(20.dp))
        Button(onClick = { if (signupMode) onSignUp(email, password, fullName, phone) else onLogin(email, password) }, enabled = !busy && email.isNotBlank() && password.length >= 6 && (!signupMode || fullName.isNotBlank()), modifier = Modifier.fillMaxWidth().height(52.dp)) {
            if (busy) CircularProgressIndicator(color = Color.White) else Text(if (signupMode) "Δημιουργία λογαριασμού" else "Σύνδεση")
        }
        TextButton(onClick = { onToggleSignup(!signupMode) }) { Text(if (signupMode) "Έχω ήδη λογαριασμό · Σύνδεση" else "Νέος εδώ; Δημιουργία λογαριασμού") }
    }
}

@Composable
fun CustomerShell(
    state: CustomerUiState,
    onTab: (CustomerTab) -> Unit,
    onOpenStore: (StoreRow) -> Unit,
    onCloseStore: () -> Unit,
    onAddToCart: (MenuItemRow) -> Unit,
    onUpdateQty: (String, Int) -> Unit,
    onToggleCart: (Boolean) -> Unit,
    onSetDelivery: (String, Double?, Double?) -> Unit,
    onSetNotes: (String) -> Unit,
    onSetTip: (Double) -> Unit,
    onSetPayment: (String) -> Unit,
    onPlaceOrder: () -> Unit,
    onTrack: (OrderUi?) -> Unit,
    onRefresh: () -> Unit,
    onSignOut: () -> Unit,
    onSearch: (String) -> Unit = {},
    onUseLocation: () -> Unit = {},
    onGeocode: (String) -> Unit = {},
    onPickSuggestion: (AddressSuggestion) -> Unit = {},
    onSaveProfile: (String, String) -> Unit = { _, _ -> },
    onCancelOrder: (OrderUi) -> Unit = {},
    onClearMessages: () -> Unit = {},
) {
    val snackbar = remember { SnackbarHostState() }
    LaunchedEffect(state.info, state.error) {
        val msg = state.error ?: state.info
        if (!msg.isNullOrBlank()) { snackbar.showSnackbar(msg); onClearMessages() }
    }
    BackHandler(enabled = state.showCart || state.selectedStore != null) {
        if (state.showCart) onToggleCart(false) else onCloseStore()
    }
    if (state.showCart) {
        CartCheckoutScreen(state, snackbar, { onToggleCart(false) }, onUpdateQty, onSetDelivery, onSetNotes, onSetTip, onSetPayment, onPlaceOrder, onUseLocation, onGeocode, onPickSuggestion)
        return
    }
    if (state.selectedStore != null) {
        MenuScreen(state, onCloseStore, onAddToCart) { onToggleCart(true) }
        return
    }
    val tabs = listOf(Triple(CustomerTab.Home, "Αρχική", Icons.Outlined.Home), Triple(CustomerTab.Orders, "Παραγγελίες", Icons.Outlined.Receipt), Triple(CustomerTab.Track, "Χάρτης", Icons.Outlined.Map), Triple(CustomerTab.Profile, "Προφίλ", Icons.Outlined.AccountCircle))
    Scaffold(snackbarHost = { SnackbarHost(snackbar) }, bottomBar = {
        NavigationBar {
            tabs.forEach { (tab, label, icon) ->
                NavigationBarItem(selected = state.tab == tab, onClick = { onTab(tab) }, icon = {
                    if (tab == CustomerTab.Orders && state.activeOrders.isNotEmpty()) BadgedBox(badge = { Badge { Text("${state.activeOrders.size}") } }) { Icon(icon as ImageVector, contentDescription = label) }
                    else Icon(icon as ImageVector, contentDescription = label)
                }, label = { Text(label) })
            }
        }
    }, floatingActionButton = {
        if (state.cartCount > 0 && state.tab == CustomerTab.Home) FloatingActionButton(onClick = { onToggleCart(true) }) { BadgedBox(badge = { Badge { Text("${state.cartCount}") } }) { Icon(Icons.Outlined.ShoppingCart, contentDescription = "Cart") } }
    }) { padding ->
        Box(Modifier.padding(padding)) {
            when (state.tab) {
                CustomerTab.Home -> HomeTab(state, onRefresh, onOpenStore, onSearch)
                CustomerTab.Orders -> OrdersTab(state, onTrack, onRefresh, onCancelOrder)
                CustomerTab.Track -> TrackTab(state)
                CustomerTab.Profile -> ProfileTab(state, onSaveProfile, onSignOut)
            }
        }
    }
}

@Composable private fun StoreThumb(url: String?, size: Int = 56) {
    Box(Modifier.size(size.dp).clip(RoundedCornerShape(12.dp)).background(MaterialTheme.colorScheme.surfaceVariant), contentAlignment = Alignment.Center) {
        if (url.isNullOrBlank()) Icon(Icons.Outlined.Store, contentDescription = null, tint = MaterialTheme.colorScheme.onSurfaceVariant)
        else AsyncImage(model = url, contentDescription = null, contentScale = ContentScale.Crop, modifier = Modifier.fillMaxSize())
    }
}

@Composable private fun HomeTab(state: CustomerUiState, onRefresh: () -> Unit, onOpenStore: (StoreRow) -> Unit, onSearch: (String) -> Unit) {
    Column(Modifier.fillMaxSize().padding(16.dp)) {
        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
            Text("Καταστήματα", style = MaterialTheme.typography.headlineSmall, fontWeight = FontWeight.Bold)
            OutlinedButton(onClick = onRefresh) { Text("Ανανέωση") }
        }
        Spacer(Modifier.height(10.dp))
        OutlinedTextField(value = state.searchQuery, onValueChange = onSearch, singleLine = true, leadingIcon = { Icon(Icons.Outlined.Search, contentDescription = null) }, label = { Text("Αναζήτηση καταστήματος") }, modifier = Modifier.fillMaxWidth())
        Spacer(Modifier.height(12.dp))
        if (state.visibleStores.isEmpty()) Text("Δεν βρέθηκαν καταστήματα.", style = MaterialTheme.typography.bodyMedium)
        LazyColumn(verticalArrangement = Arrangement.spacedBy(8.dp)) {
            items(state.visibleStores, key = { it.id }) { store ->
                Card(Modifier.fillMaxWidth().clickable { onOpenStore(store) }, colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface)) {
                    Row(Modifier.padding(12.dp).fillMaxWidth(), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                        StoreThumb(store.image_url)
                        Column(Modifier.weight(1f)) { Text(store.name ?: "Store", fontWeight = FontWeight.Bold); store.address?.let { Text(it, style = MaterialTheme.typography.bodySmall) } }
                    }
                }
            }
            item { Spacer(Modifier.height(72.dp)) }
        }
    }
}

@Composable private fun MenuScreen(state: CustomerUiState, onBack: () -> Unit, onAdd: (MenuItemRow) -> Unit, onOpenCart: () -> Unit) {
    Column(Modifier.fillMaxSize()) {
        Row(Modifier.fillMaxWidth().padding(8.dp), verticalAlignment = Alignment.CenterVertically) {
            IconButton(onClick = onBack) { Icon(Icons.AutoMirrored.Outlined.ArrowBack, contentDescription = "Back") }
            Column(Modifier.weight(1f)) { Text(state.selectedStore?.name ?: "Menu", fontWeight = FontWeight.Bold); Text("${state.menu.size} προϊόντα", style = MaterialTheme.typography.bodySmall) }
            if (state.cartCount > 0) IconButton(onClick = onOpenCart) { BadgedBox(badge = { Badge { Text("${state.cartCount}") } }) { Icon(Icons.Outlined.ShoppingCart, contentDescription = "Cart") } }
        }
        if (state.busy) Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) { CircularProgressIndicator() }
        else LazyColumn(Modifier.fillMaxSize().padding(horizontal = 16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            items(state.menu, key = { it.id }) { item ->
                Card(Modifier.fillMaxWidth()) {
                    Row(Modifier.padding(12.dp).fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(12.dp), verticalAlignment = Alignment.CenterVertically) {
                        StoreThumb(item.image_url, size = 52)
                        Column(Modifier.weight(1f)) {
                            Text(item.name, fontWeight = FontWeight.SemiBold)
                            item.description?.let { Text(it, style = MaterialTheme.typography.bodySmall) }
                            Text("€" + "%.2f".format(item.price), color = MaterialTheme.colorScheme.primary)
                        }
                        Button(onClick = { onAdd(item) }) { Icon(Icons.Outlined.Add, contentDescription = null); Spacer(Modifier.width(4.dp)); Text("Add") }
                    }
                }
            }
            item { Spacer(Modifier.height(80.dp)) }
        }
    }
}

@Composable private fun CartCheckoutScreen(
    state: CustomerUiState, snackbar: SnackbarHostState, onBack: () -> Unit, onUpdateQty: (String, Int) -> Unit,
    onSetDelivery: (String, Double?, Double?) -> Unit, onSetNotes: (String) -> Unit, onSetTip: (Double) -> Unit,
    onSetPayment: (String) -> Unit, onPlaceOrder: () -> Unit, onUseLocation: () -> Unit, onGeocode: (String) -> Unit,
    onPickSuggestion: (AddressSuggestion) -> Unit,
) {
    var address by remember(state.deliveryAddress) { mutableStateOf(state.deliveryAddress) }
    var tipText by remember { mutableStateOf(state.tipAmount.toString()) }
    Column(Modifier.fillMaxSize()) {
        SnackbarHost(snackbar)
        Row(Modifier.fillMaxWidth().padding(8.dp), verticalAlignment = Alignment.CenterVertically) {
            IconButton(onClick = onBack) { Icon(Icons.AutoMirrored.Outlined.ArrowBack, contentDescription = "Back") }
            Text("Καλάθι · ${state.cartStoreName ?: ""}", fontWeight = FontWeight.Bold, modifier = Modifier.weight(1f))
        }
        LazyColumn(Modifier.weight(1f).padding(horizontal = 16.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
            items(state.cart, key = { it.menuItemId }) { line ->
                Card(Modifier.fillMaxWidth()) {
                    Row(Modifier.padding(12.dp).fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
                        Column(Modifier.weight(1f)) { Text(line.name, fontWeight = FontWeight.SemiBold); Text("€" + "%.2f".format(line.price)) }
                        IconButton(onClick = { onUpdateQty(line.menuItemId, line.quantity - 1) }) { Icon(Icons.Outlined.Remove, contentDescription = "-") }
                        Text("${line.quantity}", fontWeight = FontWeight.Bold)
                        IconButton(onClick = { onUpdateQty(line.menuItemId, line.quantity + 1) }) { Icon(Icons.Outlined.Add, contentDescription = "+") }
                    }
                }
            }
            item {
                Text("Διεύθυνση παράδοσης", fontWeight = FontWeight.Bold)
                OutlinedTextField(value = address, onValueChange = { address = it; onSetDelivery(it, state.deliveryLat, state.deliveryLng) }, modifier = Modifier.fillMaxWidth(), singleLine = true, label = { Text("Οδός, αριθμός, πόλη") })
                Spacer(Modifier.height(8.dp))
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    Button(onClick = onUseLocation, enabled = !state.locating, modifier = Modifier.weight(1f)) { Icon(Icons.Outlined.MyLocation, contentDescription = null); Spacer(Modifier.width(6.dp)); Text("Η τοποθεσία μου") }
                    OutlinedButton(onClick = { onGeocode(address) }, enabled = !state.locating && address.isNotBlank(), modifier = Modifier.weight(1f)) { Text("Εύρεση στον χάρτη") }
                }
                if (state.locating) { Spacer(Modifier.height(6.dp)); LinearProgressIndicator(Modifier.fillMaxWidth()) }
                val pinned = state.deliveryLat != null && state.deliveryLng != null
                Text(if (pinned) "Σημείο παράδοσης: %.5f, %.5f".format(state.deliveryLat, state.deliveryLng) else "Χωρίς σημείο στον χάρτη — πάτα «Η τοποθεσία μου» ή «Εύρεση στον χάρτη».", style = MaterialTheme.typography.bodySmall, color = if (pinned) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.error)
                if (state.addressSuggestions.isNotEmpty()) {
                    Spacer(Modifier.height(8.dp))
                    Text("Προτάσεις διεύθυνσης", fontWeight = FontWeight.SemiBold)
                    state.addressSuggestions.forEach { s ->
                        Card(Modifier.fillMaxWidth().padding(top = 6.dp).clickable { onPickSuggestion(s) }, colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceVariant)) {
                            Text(s.label, modifier = Modifier.padding(12.dp), style = MaterialTheme.typography.bodyMedium)
                        }
                    }
                }
            }
            item { OutlinedTextField(value = state.notes, onValueChange = onSetNotes, label = { Text("Σημειώσεις") }, modifier = Modifier.fillMaxWidth()) }
            item { OutlinedTextField(value = tipText, onValueChange = { tipText = it; onSetTip(it.toDoubleOrNull() ?: 0.0) }, label = { Text("Φιλοδώρημα €") }, keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Decimal), modifier = Modifier.fillMaxWidth()) }
            item {
                Text("Πληρωμή", fontWeight = FontWeight.Bold)
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    Button(onClick = { onSetPayment("cash") }, enabled = state.paymentMethod != "cash") { Text("Μετρητά") }
                    OutlinedButton(onClick = {}, enabled = false) { Text("Κάρτα (web)") }
                }
                Text("Native: μετρητά · κάρτα στο web/Capacitor", style = MaterialTheme.typography.bodySmall)
            }
            item {
                Text("Υποσύνολο €" + "%.2f".format(state.cartSubtotal))
                val feeNote = if (state.feePerKm > 0 && state.deliveryLat != null) "βάση €" + "%.2f".format(state.feeBase) + " + €" + "%.2f".format(state.feePerKm) + "/km" else null
                Text("Παράδοση €" + "%.2f".format(state.deliveryFee) + (if (feeNote != null) " ($feeNote)" else ""))
                Text("Φιλοδώρημα €" + "%.2f".format(state.tipAmount))
                Text("Σύνολο €" + "%.2f".format(state.grandTotal), fontWeight = FontWeight.Bold, color = MaterialTheme.colorScheme.primary)
                if (!state.error.isNullOrBlank()) Text(state.error!!, color = MaterialTheme.colorScheme.error)
                Spacer(Modifier.height(8.dp))
                Button(onClick = onPlaceOrder, enabled = !state.busy && state.cart.isNotEmpty() && address.isNotBlank(), modifier = Modifier.fillMaxWidth().height(52.dp)) {
                    if (state.busy) CircularProgressIndicator(color = Color.White) else Text("Υποβολή παραγγελίας · €" + "%.2f".format(state.grandTotal))
                }
                Spacer(Modifier.height(24.dp))
            }
        }
    }
}

private fun statusLabel(status: String): String = when (status) {
    "pending" -> "Σε αναμονή καταστήματος"
    "accepted", "confirmed" -> "Αποδεκτή"
    "preparing" -> "Ετοιμάζεται"
    "ready" -> "Έτοιμη για παραλαβή"
    "picked_up", "on_the_way", "in_transit" -> "Καθ' οδόν"
    "delivered" -> "Παραδόθηκε"
    "cancelled" -> "Ακυρώθηκε"
    "rejected" -> "Απορρίφθηκε"
    else -> status
}

@Composable private fun OrdersTab(state: CustomerUiState, onTrack: (OrderUi?) -> Unit, onRefresh: () -> Unit, onCancelOrder: (OrderUi) -> Unit) {
    Column(Modifier.fillMaxSize().padding(16.dp)) {
        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
            Text("Παραγγελίες", style = MaterialTheme.typography.headlineSmall, fontWeight = FontWeight.Bold)
            OutlinedButton(onClick = onRefresh) { Text("Ανανέωση") }
        }
        Spacer(Modifier.height(12.dp))
        if (state.orders.isEmpty()) Text("Δεν υπάρχουν παραγγελίες ακόμα.")
        LazyColumn(verticalArrangement = Arrangement.spacedBy(8.dp)) {
            items(state.orders, key = { it.order.id }) { item ->
                val cancellable = item.order.status in listOf("pending", "accepted", "confirmed")
                Card(Modifier.fillMaxWidth().clickable { onTrack(item) }, colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface)) {
                    Column(Modifier.padding(14.dp)) {
                        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                            Text(item.storeName ?: "Κατάστημα", fontWeight = FontWeight.Bold)
                            item.order.store_order_number?.let { Text("#%04d".format(it), color = MaterialTheme.colorScheme.primary) }
                        }
                        Text(statusLabel(item.order.status))
                        item.order.delivery_address?.let { Text(it, style = MaterialTheme.typography.bodySmall) }
                        item.order.total_amount?.let { Text("€" + "%.2f".format(it), color = MaterialTheme.colorScheme.primary) }
                        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                            TextButton(onClick = { onTrack(item) }) { Text("Παρακολούθηση") }
                            if (cancellable) TextButton(onClick = { onCancelOrder(item) }, enabled = !state.busy) { Text("Ακύρωση", color = MaterialTheme.colorScheme.error) }
                        }
                    }
                }
            }
            item { Spacer(Modifier.height(72.dp)) }
        }
    }
}

@Composable private fun TrackTab(state: CustomerUiState) {
    val order = state.trackingOrder
    val markers = buildList {
        order?.order?.delivery_latitude?.let { lat -> order.order.delivery_longitude?.let { lng -> add(MapMarker(lat, lng, "Παράδοση", "#3b82f6")) } }
        state.driverLocation?.let { d -> add(MapMarker(d.latitude, d.longitude, "Οδηγός", "#22c55e")) }
    }
    val centerLat = markers.firstOrNull()?.lat ?: 39.6650
    val centerLng = markers.firstOrNull()?.lng ?: 20.8537
    Column(Modifier.fillMaxSize()) {
        Box(Modifier.fillMaxWidth().height(280.dp).background(Color(0xFF0F172A))) {
            MapboxView(modifier = Modifier.fillMaxSize(), centerLat = centerLat, centerLng = centerLng, markers = markers)
        }
        Column(Modifier.padding(16.dp)) {
            if (order == null) Text("Επίλεξε παραγγελία από Παραγγελίες για live tracking.")
            else {
                Text(order.storeName ?: "Παραγγελία", style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.Bold)
                Text(statusLabel(order.order.status), color = MaterialTheme.colorScheme.primary)
                order.order.delivery_address?.let { Text(it) }
                when {
                    state.driverLocation != null -> Text("Ο οδηγός κινείται προς εσένα.", style = MaterialTheme.typography.bodySmall)
                    !order.order.driver_id.isNullOrBlank() -> Text("Αναμονή θέσης οδηγού…", style = MaterialTheme.typography.bodySmall)
                    else -> Text("Δεν έχει ανατεθεί οδηγός ακόμα.", style = MaterialTheme.typography.bodySmall)
                }
            }
        }
    }
}

@Composable private fun ProfileTab(state: CustomerUiState, onSaveProfile: (String, String) -> Unit, onSignOut: () -> Unit) {
    var fullName by remember(state.profile?.full_name) { mutableStateOf(state.profile?.full_name ?: "") }
    var phone by remember(state.profile?.phone) { mutableStateOf(state.profile?.phone ?: "") }
    Column(Modifier.fillMaxSize().padding(16.dp)) {
        Text("Προφίλ", style = MaterialTheme.typography.headlineSmall, fontWeight = FontWeight.Bold)
        Spacer(Modifier.height(16.dp))
        OutlinedTextField(value = fullName, onValueChange = { fullName = it }, label = { Text("Ονοματεπώνυμο") }, singleLine = true, modifier = Modifier.fillMaxWidth())
        Spacer(Modifier.height(12.dp))
        OutlinedTextField(value = phone, onValueChange = { phone = it }, label = { Text("Τηλέφωνο") }, singleLine = true, keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Phone), modifier = Modifier.fillMaxWidth())
        Spacer(Modifier.height(12.dp))
        Button(onClick = { onSaveProfile(fullName, phone) }, enabled = !state.savingProfile && fullName.isNotBlank(), modifier = Modifier.fillMaxWidth()) {
            if (state.savingProfile) CircularProgressIndicator(color = Color.White) else Text("Αποθήκευση")
        }
        Spacer(Modifier.height(20.dp))
        Text("Ειδοποιήσεις push: ενεργές", style = MaterialTheme.typography.bodySmall)
        Text("Παραγγελίες συνολικά: ${state.orders.size}", style = MaterialTheme.typography.bodySmall)
        Spacer(Modifier.height(24.dp))
        OutlinedButton(onClick = onSignOut, modifier = Modifier.fillMaxWidth()) { Text("Αποσύνδεση") }
    }
}
