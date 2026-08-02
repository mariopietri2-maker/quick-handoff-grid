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
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.AccountCircle
import androidx.compose.material.icons.outlined.Home
import androidx.compose.material.icons.outlined.Map
import androidx.compose.material.icons.outlined.Receipt
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
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
import com.freshdelivery.nativecustomer.data.OrderUi
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
        Text("Native · Mapbox", color = MaterialTheme.colorScheme.onSurfaceVariant)
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
    onTrack: (OrderUi?) -> Unit,
    onRefresh: () -> Unit,
    onSignOut: () -> Unit,
) {
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
    ) { padding ->
        Box(Modifier.padding(padding)) {
            when (state.tab) {
                CustomerTab.Home -> HomeTab(state, onRefresh)
                CustomerTab.Orders -> OrdersTab(state, onTrack, onRefresh)
                CustomerTab.Track -> TrackTab(state)
                CustomerTab.Profile -> ProfileTab(state, onSignOut)
            }
        }
    }
}

@Composable
private fun HomeTab(state: CustomerUiState, onRefresh: () -> Unit) {
    Column(Modifier.fillMaxSize().padding(16.dp)) {
        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
            Text("Καταστήματα", style = MaterialTheme.typography.headlineSmall, fontWeight = FontWeight.Bold)
            OutlinedButton(onClick = onRefresh) { Text("Ανανέωση") }
        }
        Text("Πλήρες μενού & checkout: χρησιμοποίησε το Capacitor app μέχρι parity.", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
        Spacer(Modifier.height(12.dp))
        LazyColumn(verticalArrangement = Arrangement.spacedBy(8.dp)) {
            items(state.stores, key = { it.id }) { store ->
                Card(Modifier.fillMaxWidth(), colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface)) {
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
private fun OrdersTab(state: CustomerUiState, onTrack: (OrderUi?) -> Unit, onRefresh: () -> Unit) {
    Column(Modifier.fillMaxSize().padding(16.dp)) {
        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
            Text("Παραγγελίες", style = MaterialTheme.typography.headlineSmall, fontWeight = FontWeight.Bold)
            OutlinedButton(onClick = onRefresh) { Text("Ανανέωση") }
        }
        Spacer(Modifier.height(12.dp))
        if (state.orders.isEmpty()) {
            Text("Δεν υπάρχουν παραγγελίες ακόμα.")
        }
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
                Text("Επίλεξε παραγγελία από την καρτέλα Παραγγελίες για live tracking.")
            } else {
                Text(order.storeName ?: "Παραγγελία", style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.Bold)
                Text("Status: " + order.order.status, color = MaterialTheme.colorScheme.primary)
                order.order.delivery_address?.let { Text(it) }
                if (state.driverLocation != null) {
                    Text("Οδηγός εμφανίζεται στον χάρτη (Mapbox).", style = MaterialTheme.typography.bodySmall)
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
        Spacer(Modifier.height(24.dp))
        Button(onClick = onSignOut) { Text("Αποσύνδεση") }
    }
}
