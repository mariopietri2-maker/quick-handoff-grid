package com.freshdelivery.nativecustomer.ui

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
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.outlined.ArrowBack
import androidx.compose.material.icons.outlined.AccountCircle
import androidx.compose.material.icons.outlined.Add
import androidx.compose.material.icons.outlined.Home
import androidx.compose.material.icons.outlined.Map
import androidx.compose.material.icons.outlined.Receipt
import androidx.compose.material.icons.outlined.Remove
import androidx.compose.material.icons.outlined.ShoppingCart
import androidx.compose.material3.Badge
import androidx.compose.material3.BadgedBox
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.FloatingActionButton
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.NavigationBar
import androidx.compose.material3.NavigationBarItem
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.unit.dp
import com.freshdelivery.nativecustomer.data.CustomerTab
import com.freshdelivery.nativecustomer.data.MenuItemRow
import com.freshdelivery.nativecustomer.data.OrderUi
import com.freshdelivery.nativecustomer.data.StoreRow
import com.freshdelivery.nativecustomer.ui.map.MapMarker
import com.freshdelivery.nativecustomer.ui.map.MapboxView

@Composable
fun LoginScreen(
    busy: Boolean,
    error: String?,
    onLogin: (String, String) -> Unit,
) {
    var email by remember { mutableStateOf("") }
    var password by remember { mutableStateOf("") }
    Column(
        Modifier.fillMaxSize().padding(24.dp),
        verticalArrangement = Arrangement.Center,
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        Text("Fresh Customer", style = MaterialTheme.typography.headlineLarge, color = MaterialTheme.colorScheme.primary)
        Text("Native · Mapbox · FCM", color = MaterialTheme.colorScheme.onSurfaceVariant)
        Spacer(Modifier.height(24.dp))
        OutlinedTextField(
            value = email,
            onValueChange = { email = it },
            label = { Text("Email") },
            singleLine = true,
            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Email),
            modifier = Modifier.fillMaxWidth(),
        )
        Spacer(Modifier.height(12.dp))
        OutlinedTextField(
            value = password,
            onValueChange = { password = it },
            label = { Text("Password") },
            singleLine = true,
            visualTransformation = PasswordVisualTransformation(),
            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Password),
            modifier = Modifier.fillMaxWidth(),
        )
        if (!error.isNullOrBlank()) {
            Spacer(Modifier.height(12.dp))
            Text(error, color = MaterialTheme.colorScheme.error)
        }
        Spacer(Modifier.height(20.dp))
        Button(
            onClick = { onLogin(email, password) },
            enabled = !busy && email.isNotBlank() && password.isNotBlank(),
            modifier = Modifier.fillMaxWidth().height(52.dp),
        ) {
            if (busy) CircularProgressIndicator(color = Color.White)
            else Text("Σύνδεση")
        }
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
) {
    if (state.showCart) {
        CartCheckoutScreen(
            state = state,
            onBack = { onToggleCart(false) },
            onUpdateQty = onUpdateQty,
            onSetDelivery = onSetDelivery,
            onSetNotes = onSetNotes,
            onSetTip = onSetTip,
            onSetPayment = onSetPayment,
            onPlaceOrder = onPlaceOrder,
        )
        return
    }
    if (state.selectedStore != null) {
        MenuScreen(
            state = state,
            onBack = onCloseStore,
            onAdd = onAddToCart,
            onOpenCart = { onToggleCart(true) },
        )
        return
    }

    val tabs = listOf(
        Triple(CustomerTab.Home, "Αρχική", Icons.Outlined.Home),
        Triple(CustomerTab.Orders, "Παραγγελίες", Icons.Outlined.Receipt),
        Triple(CustomerTab.Track, "Χάρτης", Icons.Outlined.Map),
        Triple(CustomerTab.Profile, "Προφίλ", Icons.Outlined.AccountCircle),
    )

    Scaffold(
        bottomBar = {
            NavigationBar {
                tabs.forEach { (tab, label, icon) ->
                    NavigationBarItem(
                        selected = state.tab == tab,
                        onClick = { onTab(tab) },
                        icon = { Icon(icon as ImageVector, contentDescription = label) },
                        label = { Text(label) },
                    )
                }
            }
        },
        floatingActionButton = {
            if (state.cartCount > 0 && state.tab == CustomerTab.Home) {
                FloatingActionButton(onClick = { onToggleCart(true) }) {
                    BadgedBox(badge = { Badge { Text("${state.cartCount}") } }) {
                        Icon(Icons.Outlined.ShoppingCart, contentDescription = "Cart")
                    }
                }
            }
        },
    ) { padding ->
        Box(Modifier.padding(padding)) {
            when (state.tab) {
                CustomerTab.Home -> HomeTab(state, onRefresh, onOpenStore)
                CustomerTab.Orders -> OrdersTab(state, onTrack, onRefresh)
                CustomerTab.Track -> TrackTab(state)
                CustomerTab.Profile -> ProfileTab(state, onSignOut)
            }
        }
    }
}

@Composable
private fun HomeTab(state: CustomerUiState, onRefresh: () -> Unit, onOpenStore: (StoreRow) -> Unit) {
    Column(Modifier.fillMaxSize().padding(16.dp)) {
        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
            Text("Καταστήματα", style = MaterialTheme.typography.headlineSmall, fontWeight = FontWeight.Bold)
            OutlinedButton(onClick = onRefresh) { Text("Ανανέωση") }
        }
        Spacer(Modifier.height(12.dp))
        LazyColumn(verticalArrangement = Arrangement.spacedBy(8.dp)) {
            items(state.stores, key = { it.id }) { store ->
                Card(
                    Modifier.fillMaxWidth().clickable { onOpenStore(store) },
                    colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
                ) {
                    Column(Modifier.padding(14.dp)) {
                        Text(store.name ?: "Store", fontWeight = FontWeight.Bold)
                        store.address?.let { Text(it, style = MaterialTheme.typography.bodySmall) }
                    }
                }
            }
        }
    }
}

@Composable
private fun MenuScreen(
    state: CustomerUiState,
    onBack: () -> Unit,
    onAdd: (MenuItemRow) -> Unit,
    onOpenCart: () -> Unit,
) {
    Column(Modifier.fillMaxSize()) {
        Row(
            Modifier.fillMaxWidth().padding(8.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            IconButton(onClick = onBack) {
                Icon(Icons.AutoMirrored.Outlined.ArrowBack, contentDescription = "Back")
            }
            Column(Modifier.weight(1f)) {
                Text(state.selectedStore?.name ?: "Menu", fontWeight = FontWeight.Bold)
                Text("${state.menu.size} προϊόντα", style = MaterialTheme.typography.bodySmall)
            }
            if (state.cartCount > 0) {
                IconButton(onClick = onOpenCart) {
                    BadgedBox(badge = { Badge { Text("${state.cartCount}") } }) {
                        Icon(Icons.Outlined.ShoppingCart, contentDescription = "Cart")
                    }
                }
            }
        }
        if (state.busy) {
            Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                CircularProgressIndicator()
            }
        } else {
            LazyColumn(
                Modifier.fillMaxSize().padding(horizontal = 16.dp),
                verticalArrangement = Arrangement.spacedBy(8.dp),
            ) {
                items(state.menu, key = { it.id }) { item ->
                    Card(Modifier.fillMaxWidth()) {
                        Row(
                            Modifier.padding(12.dp).fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically,
                        ) {
                            Column(Modifier.weight(1f)) {
                                Text(item.name, fontWeight = FontWeight.SemiBold)
                                item.description?.let {
                                    Text(it, style = MaterialTheme.typography.bodySmall)
                                }
                                Text("€" + "%.2f".format(item.price), color = MaterialTheme.colorScheme.primary)
                            }
                            Button(onClick = { onAdd(item) }) {
                                Icon(Icons.Outlined.Add, contentDescription = null)
                                Spacer(Modifier.width(4.dp))
                                Text("Add")
                            }
                        }
                    }
                }
                item { Spacer(Modifier.height(80.dp)) }
            }
        }
    }
}

@Composable
private fun CartCheckoutScreen(
    state: CustomerUiState,
    onBack: () -> Unit,
    onUpdateQty: (String, Int) -> Unit,
    onSetDelivery: (String, Double?, Double?) -> Unit,
    onSetNotes: (String) -> Unit,
    onSetTip: (Double) -> Unit,
    onSetPayment: (String) -> Unit,
    onPlaceOrder: () -> Unit,
) {
    var address by remember(state.deliveryAddress) { mutableStateOf(state.deliveryAddress) }
    var latText by remember { mutableStateOf(state.deliveryLat?.toString() ?: "") }
    var lngText by remember { mutableStateOf(state.deliveryLng?.toString() ?: "") }
    var tipText by remember { mutableStateOf(state.tipAmount.toString()) }

    Column(Modifier.fillMaxSize()) {
        Row(Modifier.fillMaxWidth().padding(8.dp), verticalAlignment = Alignment.CenterVertically) {
            IconButton(onClick = onBack) {
                Icon(Icons.AutoMirrored.Outlined.ArrowBack, contentDescription = "Back")
            }
            Text(
                "Καλάθι · ${state.cartStoreName ?: ""}",
                fontWeight = FontWeight.Bold,
                modifier = Modifier.weight(1f),
            )
        }
        LazyColumn(
            Modifier.weight(1f).padding(horizontal = 16.dp),
            verticalArrangement = Arrangement.spacedBy(10.dp),
        ) {
            items(state.cart, key = { it.menuItemId }) { line ->
                Card(Modifier.fillMaxWidth()) {
                    Row(
                        Modifier.padding(12.dp).fillMaxWidth(),
                        verticalAlignment = Alignment.CenterVertically,
                    ) {
                        Column(Modifier.weight(1f)) {
                            Text(line.name, fontWeight = FontWeight.SemiBold)
                            Text("€" + "%.2f".format(line.price))
                        }
                        IconButton(onClick = { onUpdateQty(line.menuItemId, line.quantity - 1) }) {
                            Icon(Icons.Outlined.Remove, contentDescription = "-")
                        }
                        Text("${line.quantity}", fontWeight = FontWeight.Bold)
                        IconButton(onClick = { onUpdateQty(line.menuItemId, line.quantity + 1) }) {
                            Icon(Icons.Outlined.Add, contentDescription = "+")
                        }
                    }
                }
            }
            item {
                Text("Διεύθυνση παράδοσης", fontWeight = FontWeight.Bold)
                OutlinedTextField(
                    value = address,
                    onValueChange = {
                        address = it
                        onSetDelivery(it, latText.toDoubleOrNull(), lngText.toDoubleOrNull())
                    },
                    modifier = Modifier.fillMaxWidth(),
                    label = { Text("Διεύθυνση") },
                )
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    OutlinedTextField(
                        value = latText,
                        onValueChange = {
                            latText = it
                            onSetDelivery(address, it.toDoubleOrNull(), lngText.toDoubleOrNull())
                        },
                        label = { Text("Lat") },
                        modifier = Modifier.weight(1f),
                        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Decimal),
                    )
                    OutlinedTextField(
                        value = lngText,
                        onValueChange = {
                            lngText = it
                            onSetDelivery(address, latText.toDoubleOrNull(), it.toDoubleOrNull())
                        },
                        label = { Text("Lng") },
                        modifier = Modifier.weight(1f),
                        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Decimal),
                    )
                }
                Text("Για Ioannina π.χ. 39.665 / 20.854", style = MaterialTheme.typography.bodySmall)
            }
            item {
                OutlinedTextField(
                    value = state.notes,
                    onValueChange = onSetNotes,
                    label = { Text("Σημειώσεις") },
                    modifier = Modifier.fillMaxWidth(),
                )
            }
            item {
                OutlinedTextField(
                    value = tipText,
                    onValueChange = {
                        tipText = it
                        onSetTip(it.toDoubleOrNull() ?: 0.0)
                    },
                    label = { Text("Φιλοδώρημα €") },
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Decimal),
                    modifier = Modifier.fillMaxWidth(),
                )
            }
            item {
                Text("Πληρωμή", fontWeight = FontWeight.Bold)
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    Button(
                        onClick = { onSetPayment("cash") },
                        enabled = state.paymentMethod != "cash",
                    ) { Text("Μετρητά") }
                    OutlinedButton(
                        onClick = { onSetPayment("cash") },
                    ) { Text("Κάρτα (web)") }
                }
                Text("Native: μετρητά μόνο · κάρτα στο Capacitor", style = MaterialTheme.typography.bodySmall)
            }
            item {
                Text("Υποσύνολο €" + "%.2f".format(state.cartSubtotal))
                Text("Παράδοση €" + "%.2f".format(state.deliveryFee))
                Text("Φιλοδώρημα €" + "%.2f".format(state.tipAmount))
                Text(
                    "Σύνολο €" + "%.2f".format(state.grandTotal),
                    fontWeight = FontWeight.Bold,
                    color = MaterialTheme.colorScheme.primary,
                )
                if (!state.error.isNullOrBlank()) {
                    Text(state.error!!, color = MaterialTheme.colorScheme.error)
                }
                Spacer(Modifier.height(8.dp))
                Button(
                    onClick = onPlaceOrder,
                    enabled = !state.busy && state.cart.isNotEmpty() && address.isNotBlank(),
                    modifier = Modifier.fillMaxWidth().height(52.dp),
                ) {
                    if (state.busy) CircularProgressIndicator(color = Color.White)
                    else Text("Υποβολή παραγγελίας · €" + "%.2f".format(state.grandTotal))
                }
                Spacer(Modifier.height(24.dp))
            }
        }
    }
}

@Composable
private fun OrdersTab(state: CustomerUiState, onTrack: (OrderUi?) -> Unit, onRefresh: () -> Unit) {
    Column(Modifier.fillMaxSize().padding(16.dp)) {
        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
            Text("Παραγγελίες", style = MaterialTheme.typography.headlineSmall, fontWeight = FontWeight.Bold)
            OutlinedButton(onClick = onRefresh) { Text("Ανανέωση") }
        }
        Spacer(Modifier.height(12.dp))
        if (state.orders.isEmpty()) Text("Δεν υπάρχουν παραγγελίες ακόμα.")
        LazyColumn(verticalArrangement = Arrangement.spacedBy(8.dp)) {
            items(state.orders, key = { it.order.id }) { item ->
                Card(
                    Modifier.fillMaxWidth().clickable { onTrack(item) },
                    colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
                ) {
                    Column(Modifier.padding(14.dp)) {
                        Text(item.storeName ?: "Κατάστημα", fontWeight = FontWeight.Bold)
                        Text(item.order.status)
                        item.order.delivery_address?.let { Text(it, style = MaterialTheme.typography.bodySmall) }
                        item.order.total_amount?.let {
                            Text("€" + "%.2f".format(it), color = MaterialTheme.colorScheme.primary)
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun TrackTab(state: CustomerUiState) {
    val order = state.trackingOrder
    val markers = buildList {
        order?.order?.delivery_latitude?.let { lat ->
            order.order.delivery_longitude?.let { lng ->
                add(MapMarker(lat, lng, "Παράδοση", "#3b82f6"))
            }
        }
        state.driverLocation?.let { d ->
            add(MapMarker(d.latitude, d.longitude, "Οδηγός", "#22c55e"))
        }
    }
    val centerLat = markers.firstOrNull()?.lat ?: 39.6650
    val centerLng = markers.firstOrNull()?.lng ?: 20.8537

    Column(Modifier.fillMaxSize()) {
        Box(Modifier.fillMaxWidth().height(280.dp).background(Color(0xFF0F172A))) {
            MapboxView(
                modifier = Modifier.fillMaxSize(),
                centerLat = centerLat,
                centerLng = centerLng,
                markers = markers,
            )
        }
        Column(Modifier.padding(16.dp)) {
            if (order == null) {
                Text("Επίλεξε παραγγελία από Παραγγελίες για live tracking.")
            } else {
                Text(order.storeName ?: "Παραγγελία", style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.Bold)
                Text("Status: " + order.order.status, color = MaterialTheme.colorScheme.primary)
                order.order.delivery_address?.let { Text(it) }
                if (state.driverLocation != null) {
                    Text("Οδηγός στον χάρτη (Mapbox).", style = MaterialTheme.typography.bodySmall)
                } else if (!order.order.driver_id.isNullOrBlank()) {
                    Text("Αναμονή θέσης οδηγού…", style = MaterialTheme.typography.bodySmall)
                } else {
                    Text("Δεν έχει ανατεθεί οδηγός ακόμα.", style = MaterialTheme.typography.bodySmall)
                }
            }
        }
    }
}

@Composable
private fun ProfileTab(state: CustomerUiState, onSignOut: () -> Unit) {
    Column(Modifier.fillMaxSize().padding(16.dp)) {
        Text("Προφίλ", style = MaterialTheme.typography.headlineSmall, fontWeight = FontWeight.Bold)
        Spacer(Modifier.height(12.dp))
        Text(state.profile?.full_name ?: "—")
        Text(state.profile?.phone ?: "")
        Spacer(Modifier.height(8.dp))
        Text("Push: FCM ενεργό", style = MaterialTheme.typography.bodySmall)
        Spacer(Modifier.height(24.dp))
        Button(onClick = onSignOut) { Text("Αποσύνδεση") }
    }
}
