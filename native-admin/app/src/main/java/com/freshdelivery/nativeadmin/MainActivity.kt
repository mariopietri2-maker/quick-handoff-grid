package com.freshdelivery.nativeadmin

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.viewModels
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.freshdelivery.nativeadmin.data.DriverUi
import com.freshdelivery.nativeadmin.data.OrderRow
import com.freshdelivery.nativeadmin.data.StoreCallRow
import com.freshdelivery.nativeadmin.data.StoreRow
import com.freshdelivery.nativeadmin.ui.AdminUiState
import com.freshdelivery.nativeadmin.ui.AdminViewModel
import com.freshdelivery.nativeadmin.ui.DriverMapWebView

private val Orange = Color(0xFFEA580C)
private val Ink = Color(0xFF0F172A)
private val Muted = Color(0xFF64748B)
private val Surface = Color(0xFFFFF7ED)
private val CardBg = Color.White
private val Green = Color(0xFF059669)
private val Amber = Color(0xFFD97706)
private val Violet = Color(0xFF7C3AED)

class MainActivity : ComponentActivity() {
    private val vm: AdminViewModel by viewModels()

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContent {
            MaterialTheme(
                colorScheme = lightColorScheme(
                    primary = Orange,
                    background = Surface,
                    surface = CardBg,
                    onPrimary = Color.White,
                ),
            ) {
                val state by vm.state.collectAsState()
                when {
                    state.bootstrapping -> Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                        CircularProgressIndicator(color = Orange)
                    }
                    !state.signedIn -> LoginScreen(state.busy, state.error, vm::signIn)
                    else -> AdminShell(vm, state)
                }
            }
        }
    }
}

@Composable
private fun LoginScreen(busy: Boolean, error: String?, onLogin: (String, String) -> Unit) {
    var email by remember { mutableStateOf("") }
    var pass by remember { mutableStateOf("") }
    Column(
        Modifier.fillMaxSize().background(Surface).padding(28.dp),
        verticalArrangement = Arrangement.Center,
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        Box(
            Modifier.size(72.dp).clip(RoundedCornerShape(20.dp)).background(Orange),
            contentAlignment = Alignment.Center,
        ) {
            Icon(Icons.Default.AdminPanelSettings, null, tint = Color.White, modifier = Modifier.size(40.dp))
        }
        Spacer(Modifier.height(16.dp))
        Text("Fresh2GO", fontSize = 30.sp, fontWeight = FontWeight.Black, color = Orange)
        Text("Operations Console", fontSize = 16.sp, fontWeight = FontWeight.SemiBold, color = Ink)
        Text("Admin only · live drivers · orders · map", fontSize = 12.sp, color = Muted)
        Spacer(Modifier.height(28.dp))
        OutlinedTextField(email, { email = it }, label = { Text("Email") }, singleLine = true, modifier = Modifier.fillMaxWidth())
        Spacer(Modifier.height(10.dp))
        OutlinedTextField(
            pass, { pass = it }, label = { Text("Password") },
            singleLine = true, visualTransformation = PasswordVisualTransformation(),
            modifier = Modifier.fillMaxWidth(),
        )
        if (error != null) {
            Spacer(Modifier.height(10.dp))
            Text(error, color = Color(0xFFDC2626), fontSize = 13.sp)
        }
        Spacer(Modifier.height(18.dp))
        Button(
            onClick = { onLogin(email, pass) },
            enabled = !busy && email.isNotBlank() && pass.isNotBlank(),
            modifier = Modifier.fillMaxWidth().height(54.dp),
            shape = RoundedCornerShape(14.dp),
            colors = ButtonDefaults.buttonColors(containerColor = Orange),
        ) {
            if (busy) CircularProgressIndicator(Modifier.size(22.dp), color = Color.White, strokeWidth = 2.dp)
            else Text("Sign in as Admin", fontWeight = FontWeight.Bold)
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun AdminShell(vm: AdminViewModel, state: AdminUiState) {
    Scaffold(
        topBar = {
            TopAppBar(
                title = {
                    Column {
                        Text("Ops Console", fontWeight = FontWeight.Bold)
                        Text("Live · 6s refresh", fontSize = 11.sp, color = Muted)
                    }
                },
                actions = {
                    if (state.refreshing || state.busy) {
                        CircularProgressIndicator(Modifier.size(18.dp).padding(end = 8.dp), strokeWidth = 2.dp, color = Orange)
                    }
                    IconButton(onClick = vm::refresh) { Icon(Icons.Default.Refresh, "Refresh") }
                    IconButton(onClick = vm::signOut) { Icon(Icons.Default.Logout, "Logout") }
                },
                colors = TopAppBarDefaults.topAppBarColors(containerColor = CardBg),
            )
        },
        bottomBar = {
            NavigationBar(containerColor = CardBg, tonalElevation = 8.dp) {
                NavItem(state.tab == 0, { vm.setTab(0) }, Icons.Default.Dashboard, "Home")
                NavItem(state.tab == 1, { vm.setTab(1) }, Icons.Default.Map, "Map")
                NavItem(state.tab == 2, { vm.setTab(2) }, Icons.Default.TwoWheeler, "Drivers")
                NavItem(state.tab == 3, { vm.setTab(3) }, Icons.Default.ReceiptLong, "Orders")
                NavItem(state.tab == 4, { vm.setTab(4) }, Icons.Default.Store, "Stores")
            }
        },
    ) { pad ->
        Column(Modifier.fillMaxSize().padding(pad).background(Surface)) {
            if (state.error != null) {
                Surface(color = Color(0xFFFEE2E2), modifier = Modifier.fillMaxWidth()) {
                    Text(state.error!!, color = Color(0xFFB91C1C), modifier = Modifier.padding(10.dp), fontSize = 13.sp)
                }
            }
            if (state.info != null) {
                Surface(color = Color(0xFFD1FAE5), modifier = Modifier.fillMaxWidth()) {
                    Text(state.info!!, color = Green, modifier = Modifier.padding(10.dp), fontSize = 13.sp)
                }
            }
            if (state.assignOrderId != null) {
                Surface(color = Color(0xFFFFEDD5), modifier = Modifier.fillMaxWidth().clickable { }) {
                    Row(Modifier.padding(10.dp), verticalAlignment = Alignment.CenterVertically) {
                        Text("Assign driver → order ${state.assignOrderId.take(8)}…  (tap a driver)", modifier = Modifier.weight(1f), fontSize = 13.sp)
                        TextButton(onClick = vm::clearAssign) { Text("Cancel") }
                    }
                }
            }
            when (state.tab) {
                0 -> HomeTab(state)
                1 -> MapTab(state)
                2 -> DriversTab(vm, state)
                3 -> OrdersTab(vm, state)
                4 -> StoresTab(vm, state)
            }
        }
    }
}

@Composable
private fun NavItem(selected: Boolean, onClick: () -> Unit, icon: androidx.compose.ui.graphics.vector.ImageVector, label: String) {
    NavigationBarItem(
        selected = selected,
        onClick = onClick,
        icon = { Icon(icon, null) },
        label = { Text(label, fontSize = 10.sp) },
        colors = NavigationBarItemDefaults.colors(indicatorColor = Orange.copy(alpha = 0.15f), selectedIconColor = Orange),
    )
}

@Composable
private fun HomeTab(state: AdminUiState) {
    val s = state.snapshot
    LazyColumn(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
        item {
            Text("Live operations", fontWeight = FontWeight.Black, fontSize = 22.sp, color = Ink)
            Text("${state.drivers.count { it.online }} drivers online · ${state.orders.size} active orders", color = Muted, fontSize = 13.sp)
        }
        item {
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                BigStat("Kitchen", "${s.openOrders}", Orange, Modifier.weight(1f))
                BigStat("On road", "${s.onRoadOrders}", Green, Modifier.weight(1f))
            }
        }
        item {
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                BigStat("Online", "${s.onlineDrivers}", Green, Modifier.weight(1f))
                BigStat("Break", "${s.onBreakDrivers}", Amber, Modifier.weight(1f))
            }
        }
        item {
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                BigStat("Stores", "${s.activeStores}", Orange, Modifier.weight(1f))
                BigStat("Ghost calls", "${s.openStoreCalls}/${s.acceptedStoreCalls}", Violet, Modifier.weight(1f))
            }
        }
        if (state.storeCalls.isNotEmpty()) {
            item {
                Text("Ghost / store calls", fontWeight = FontWeight.Bold, fontSize = 16.sp)
            }
            items(state.storeCalls.take(8), key = { it.id }) { c ->
                CallCard(c, state.stores, state.drivers)
            }
        }
        item {
            Text("Recent kitchen / road", fontWeight = FontWeight.Bold, fontSize = 16.sp, modifier = Modifier.padding(top = 8.dp))
        }
        items(state.orders.take(12), key = { it.id }) { o ->
            MiniOrderRow(o, state.stores)
        }
    }
}

@Composable
private fun BigStat(label: String, value: String, accent: Color, modifier: Modifier = Modifier) {
    Card(modifier, shape = RoundedCornerShape(18.dp), colors = CardDefaults.cardColors(containerColor = CardBg), elevation = CardDefaults.cardElevation(1.dp)) {
        Column(Modifier.padding(16.dp)) {
            Text(label, color = Muted, fontSize = 12.sp, fontWeight = FontWeight.Medium)
            Text(value, fontWeight = FontWeight.Black, fontSize = 30.sp, color = accent)
        }
    }
}

@Composable
private fun CallCard(c: StoreCallRow, stores: List<StoreRow>, drivers: List<DriverUi>) {
    val store = stores.firstOrNull { it.id == c.store_id }?.name ?: c.store_id.take(8)
    val rider = drivers.firstOrNull { it.id == c.accepted_by }?.name
    Card(colors = CardDefaults.cardColors(containerColor = CardBg), shape = RoundedCornerShape(14.dp)) {
        Row(Modifier.padding(12.dp), verticalAlignment = Alignment.CenterVertically) {
            Box(Modifier.size(10.dp).clip(CircleShape).background(if (c.status == "open") Violet else Green))
            Spacer(Modifier.width(10.dp))
            Column(Modifier.weight(1f)) {
                Text(store, fontWeight = FontWeight.SemiBold, maxLines = 1, overflow = TextOverflow.Ellipsis)
                Text(
                    if (c.status == "open") "OPEN · waiting Ghost Rider"
                    else "ACCEPTED · ${rider ?: c.accepted_by?.take(8) ?: "?"}",
                    fontSize = 12.sp, color = Muted,
                )
            }
            StatusChip(c.status.uppercase(), if (c.status == "open") Violet else Green)
        }
    }
}

@Composable
private fun MiniOrderRow(o: OrderRow, stores: List<StoreRow>) {
    val store = stores.firstOrNull { it.id == o.store_id }?.name ?: "—"
    Card(colors = CardDefaults.cardColors(containerColor = CardBg), shape = RoundedCornerShape(12.dp)) {
        Row(Modifier.padding(12.dp), verticalAlignment = Alignment.CenterVertically) {
            Column(Modifier.weight(1f)) {
                Text("$store · ${o.status}", fontWeight = FontWeight.SemiBold, fontSize = 13.sp, maxLines = 1, overflow = TextOverflow.Ellipsis)
                Text(o.delivery_address ?: o.id.take(8), fontSize = 12.sp, color = Muted, maxLines = 1, overflow = TextOverflow.Ellipsis)
            }
            Text(o.total?.let { "€%.1f".format(it) } ?: "—", fontWeight = FontWeight.Bold, color = Orange)
        }
    }
}

@Composable
private fun MapTab(state: AdminUiState) {
    val online = state.drivers.filter { it.online && it.lat != null && it.lng != null }
    Column(Modifier.fillMaxSize()) {
        Row(
            Modifier.fillMaxWidth().horizontalScroll(rememberScrollState()).padding(horizontal = 12.dp, vertical = 8.dp),
            horizontalArrangement = Arrangement.spacedBy(8.dp),
        ) {
            LegendDot(Green, "Online ${state.snapshot.onlineDrivers}")
            LegendDot(Amber, "Break ${state.snapshot.onBreakDrivers}")
            LegendDot(Orange, "Stores")
            LegendDot(Violet, "Ghost")
        }
        Card(
            Modifier.fillMaxSize().padding(horizontal = 12.dp).padding(bottom = 12.dp),
            shape = RoundedCornerShape(18.dp),
            elevation = CardDefaults.cardElevation(2.dp),
        ) {
            if (online.isEmpty() && state.stores.none { it.latitude != null }) {
                Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                    Text("No GPS points yet — drivers appear when on shift", color = Muted, modifier = Modifier.padding(24.dp))
                }
            } else {
                DriverMapWebView(
                    drivers = state.drivers.filter { it.lat != null && it.lng != null },
                    stores = state.stores.filter { it.latitude != null && it.longitude != null },
                    modifier = Modifier.fillMaxSize(),
                )
            }
        }
    }
}

@Composable
private fun LegendDot(color: Color, label: String) {
    Surface(color = CardBg, shape = RoundedCornerShape(999.dp), shadowElevation = 1.dp) {
        Row(Modifier.padding(horizontal = 10.dp, vertical = 6.dp), verticalAlignment = Alignment.CenterVertically) {
            Box(Modifier.size(8.dp).clip(CircleShape).background(color))
            Spacer(Modifier.width(6.dp))
            Text(label, fontSize = 11.sp, fontWeight = FontWeight.Medium)
        }
    }
}

@Composable
private fun DriversTab(vm: AdminViewModel, state: AdminUiState) {
    val list = vm.filteredDrivers()
    val selected = state.drivers.firstOrNull { it.id == state.selectedDriverId }
    Column(Modifier.fillMaxSize()) {
        SearchField(state.query, vm::setQuery, "Search drivers…")
        FilterChips(
            options = listOf("all" to "All", "online" to "Online", "break" to "Break", "offline" to "Off", "ghost" to "Ghost Rider", "inactive" to "Inactive"),
            selected = state.driverFilter,
            onSelect = vm::setDriverFilter,
        )
        if (selected != null) {
            DriverDetail(selected, state.assignOrderId, vm)
        }
        LazyColumn(Modifier.padding(horizontal = 12.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            items(list, key = { it.id }) { d ->
                DriverCard(d, selected = d.id == state.selectedDriverId, onClick = {
                    if (state.assignOrderId != null) {
                        vm.assignDriver(state.assignOrderId!!, d.id)
                    } else {
                        vm.selectDriver(if (state.selectedDriverId == d.id) null else d.id)
                    }
                })
            }
            item { Spacer(Modifier.height(16.dp)) }
        }
    }
}

@Composable
private fun DriverCard(d: DriverUi, selected: Boolean, onClick: () -> Unit) {
    val statusColor = when {
        !d.active -> Color(0xFFEF4444)
        d.online && d.onBreak -> Amber
        d.online -> Green
        else -> Muted
    }
    Card(
        onClick = onClick,
        shape = RoundedCornerShape(16.dp),
        colors = CardDefaults.cardColors(containerColor = if (selected) Orange.copy(0.08f) else CardBg),
        border = if (selected) CardDefaults.outlinedCardBorder().let { null } else null,
    ) {
        Row(Modifier.padding(14.dp), verticalAlignment = Alignment.CenterVertically) {
            Box(Modifier.size(12.dp).clip(CircleShape).background(statusColor))
            Spacer(Modifier.width(12.dp))
            Column(Modifier.weight(1f)) {
                Text(d.name, fontWeight = FontWeight.Bold, maxLines = 1, overflow = TextOverflow.Ellipsis)
                Text(
                    buildString {
                        append(if (d.online) if (d.onBreak) "ON BREAK" else "ONLINE" else "OFFLINE")
                        append(" · ")
                        append(if (d.callRole in setOf("K", "both")) "Ghost Rider" else d.callRole)
                        if (d.lat != null) append(" · GPS")
                    },
                    fontSize = 12.sp, color = Muted,
                )
            }
            if (!d.active) StatusChip("OFF", Color(0xFFEF4444))
        }
    }
}

@Composable
private fun DriverDetail(d: DriverUi, assignOrderId: String?, vm: AdminViewModel) {
    Card(
        Modifier.fillMaxWidth().padding(12.dp),
        shape = RoundedCornerShape(18.dp),
        colors = CardDefaults.cardColors(containerColor = CardBg),
        elevation = CardDefaults.cardElevation(2.dp),
    ) {
        Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            Text(d.name, fontWeight = FontWeight.Black, fontSize = 18.sp)
            Text("id ${d.id.take(12)}…", fontSize = 11.sp, color = Muted)
            if (d.phone != null) Text("☎ ${d.phone}", fontSize = 13.sp)
            Text(
                "Role: ${if (d.callRole in setOf("K", "both")) "Ghost Rider ($d.callRole)" else d.callRole}" +
                    (d.vehicle?.let { " · $it" } ?: ""),
                fontSize = 13.sp,
            )
            if (d.lat != null && d.lng != null) {
                Text("GPS: ${"%.5f".format(d.lat)}, ${"%.5f".format(d.lng)}", fontSize = 12.sp, color = Muted)
            }
            if (assignOrderId != null) {
                Button(
                    onClick = { vm.assignDriver(assignOrderId, d.id) },
                    modifier = Modifier.fillMaxWidth(),
                    colors = ButtonDefaults.buttonColors(containerColor = Orange),
                ) { Text("Assign to order ${assignOrderId.take(8)}") }
            }
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                if (d.online) {
                    OutlinedButton(onClick = { vm.forceEndShift(d.id) }) { Text("End shift") }
                }
                if (d.active) {
                    OutlinedButton(onClick = { vm.setDriverActive(d.id, false) }) { Text("Deactivate") }
                } else {
                    Button(onClick = { vm.setDriverActive(d.id, true) }, colors = ButtonDefaults.buttonColors(containerColor = Green)) {
                        Text("Activate")
                    }
                }
            }
        }
    }
}

@Composable
private fun OrdersTab(vm: AdminViewModel, state: AdminUiState) {
    val list = vm.filteredOrders()
    val selected = state.orders.firstOrNull { it.id == state.selectedOrderId }
    val storeNames = state.stores.associate { it.id to it.name }
    val driverNames = state.drivers.associate { it.id to it.name }
    Column(Modifier.fillMaxSize()) {
        SearchField(state.query, vm::setQuery, "Search orders / address…")
        FilterChips(
            options = listOf("all" to "All", "kitchen" to "Kitchen", "road" to "On road", "unassigned" to "No driver"),
            selected = state.orderFilter,
            onSelect = vm::setOrderFilter,
        )
        if (selected != null) {
            OrderDetail(selected, storeNames, driverNames, vm)
        }
        LazyColumn(Modifier.padding(horizontal = 12.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            items(list, key = { it.id }) { o ->
                OrderCard(
                    o,
                    store = storeNames[o.store_id] ?: "—",
                    driver = o.driver_id?.let { driverNames[it] },
                    selected = o.id == state.selectedOrderId,
                    onClick = { vm.selectOrder(if (state.selectedOrderId == o.id) null else o.id) },
                )
            }
            item { Spacer(Modifier.height(16.dp)) }
        }
    }
}

@Composable
private fun OrderCard(o: OrderRow, store: String, driver: String?, selected: Boolean, onClick: () -> Unit) {
    Card(onClick = onClick, shape = RoundedCornerShape(16.dp), colors = CardDefaults.cardColors(containerColor = if (selected) Orange.copy(0.08f) else CardBg)) {
        Column(Modifier.padding(14.dp)) {
            Row {
                Text(o.status.uppercase(), fontWeight = FontWeight.Black, color = Orange, fontSize = 12.sp, modifier = Modifier.weight(1f))
                Text(o.total?.let { "€%.2f".format(it) } ?: "—", fontWeight = FontWeight.Bold)
            }
            Text(store, fontWeight = FontWeight.SemiBold, maxLines = 1, overflow = TextOverflow.Ellipsis)
            Text(o.delivery_address ?: "No address", fontSize = 12.sp, color = Muted, maxLines = 2, overflow = TextOverflow.Ellipsis)
            Text(
                buildString {
                    append(o.id.take(8))
                    if (driver != null) append(" · $driver")
                    else append(" · unassigned")
                    o.source?.let { append(" · $it") }
                },
                fontSize = 11.sp, color = Muted,
            )
        }
    }
}

@Composable
private fun OrderDetail(
    o: OrderRow,
    storeNames: Map<String, String>,
    driverNames: Map<String, String>,
    vm: AdminViewModel,
) {
    Card(
        Modifier.fillMaxWidth().padding(12.dp),
        shape = RoundedCornerShape(18.dp),
        colors = CardDefaults.cardColors(containerColor = CardBg),
        elevation = CardDefaults.cardElevation(2.dp),
    ) {
        Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
            Text(storeNames[o.store_id] ?: "Store", fontWeight = FontWeight.Black, fontSize = 17.sp)
            Text(o.delivery_address ?: "—", fontSize = 13.sp)
            Text("Status ${o.status} · ${o.total?.let { "€%.2f".format(it) } ?: ""}", fontSize = 13.sp, color = Muted)
            Text(
                "Driver: ${o.driver_id?.let { driverNames[it] ?: it.take(8) } ?: "—"}",
                fontSize = 13.sp,
            )
            if (!o.customer_phone.isNullOrBlank()) Text("☎ ${o.customer_phone}", fontSize = 13.sp)
            Row(Modifier.horizontalScroll(rememberScrollState()), horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                if (o.status == "placed") OutlinedButton(onClick = { vm.forceOrderStatus(o.id, "accepted") }) { Text("Accept") }
                if (o.status in listOf("accepted", "preparing")) OutlinedButton(onClick = { vm.forceOrderStatus(o.id, "ready") }) { Text("Ready") }
                if (o.status in listOf("ready", "picked_up", "delivering")) {
                    Button(onClick = { vm.forceOrderStatus(o.id, "delivered") }, colors = ButtonDefaults.buttonColors(containerColor = Green)) {
                        Text("Delivered")
                    }
                }
                OutlinedButton(onClick = { vm.beginAssign(o.id) }) { Text("Assign driver") }
                OutlinedButton(onClick = { vm.forceOrderStatus(o.id, "cancelled") }) { Text("Cancel") }
            }
        }
    }
}

@Composable
private fun StoresTab(vm: AdminViewModel, state: AdminUiState) {
    val q = state.query.trim().lowercase()
    val list = state.stores.filter {
        q.isEmpty() || it.name.lowercase().contains(q) || (it.address?.lowercase()?.contains(q) == true)
    }
    Column {
        SearchField(state.query, vm::setQuery, "Search stores…")
        // Live calls
        if (state.storeCalls.isNotEmpty()) {
            Text("Live Ghost calls", fontWeight = FontWeight.Bold, modifier = Modifier.padding(horizontal = 16.dp, vertical = 8.dp))
            state.storeCalls.take(5).forEach { c ->
                Card(Modifier.padding(horizontal = 12.dp, vertical = 4.dp), shape = RoundedCornerShape(12.dp)) {
                    Row(Modifier.padding(12.dp), verticalAlignment = Alignment.CenterVertically) {
                        Column(Modifier.weight(1f)) {
                            Text(state.stores.firstOrNull { it.id == c.store_id }?.name ?: c.store_id.take(8), fontWeight = FontWeight.SemiBold)
                            Text(c.status, fontSize = 12.sp, color = Muted)
                        }
                        if (c.status == "open") {
                            TextButton(onClick = { vm.closeCall(c.id) }) { Text("Close") }
                        }
                    }
                }
            }
        }
        LazyColumn(Modifier.padding(12.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            items(list, key = { it.id }) { s ->
                StoreCard(s)
            }
        }
    }
}

@Composable
private fun StoreCard(s: StoreRow) {
    Card(shape = RoundedCornerShape(16.dp), colors = CardDefaults.cardColors(containerColor = CardBg)) {
        Row(Modifier.padding(14.dp), verticalAlignment = Alignment.CenterVertically) {
            Box(
                Modifier.size(40.dp).clip(RoundedCornerShape(12.dp))
                    .background(if (s.store_role == "N") Violet.copy(0.15f) else Orange.copy(0.12f)),
                contentAlignment = Alignment.Center,
            ) {
                Icon(
                    if (s.store_role == "N") Icons.Default.VisibilityOff else Icons.Default.Store,
                    null,
                    tint = if (s.store_role == "N") Violet else Orange,
                )
            }
            Spacer(Modifier.width(12.dp))
            Column(Modifier.weight(1f)) {
                Text(s.name, fontWeight = FontWeight.Bold, maxLines = 1, overflow = TextOverflow.Ellipsis)
                Text(
                    listOfNotNull(
                        if (s.store_role == "N") "Ghost Store" else "Partner",
                        s.address,
                    ).joinToString(" · "),
                    fontSize = 12.sp, color = Muted, maxLines = 2, overflow = TextOverflow.Ellipsis,
                )
            }
            StatusChip(if (s.is_active == true) "OPEN" else "CLOSED", if (s.is_active == true) Green else Muted)
        }
    }
}

@Composable
private fun SearchField(value: String, onChange: (String) -> Unit, placeholder: String) {
    OutlinedTextField(
        value = value,
        onValueChange = onChange,
        placeholder = { Text(placeholder) },
        leadingIcon = { Icon(Icons.Default.Search, null) },
        trailingIcon = {
            if (value.isNotEmpty()) IconButton(onClick = { onChange("") }) { Icon(Icons.Default.Close, null) }
        },
        singleLine = true,
        modifier = Modifier.fillMaxWidth().padding(horizontal = 12.dp, vertical = 8.dp),
        shape = RoundedCornerShape(14.dp),
    )
}

@Composable
private fun FilterChips(options: List<Pair<String, String>>, selected: String, onSelect: (String) -> Unit) {
    Row(
        Modifier.fillMaxWidth().horizontalScroll(rememberScrollState()).padding(horizontal = 12.dp, vertical = 4.dp),
        horizontalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        options.forEach { (id, label) ->
            FilterChip(
                selected = selected == id,
                onClick = { onSelect(id) },
                label = { Text(label) },
                colors = FilterChipDefaults.filterChipColors(
                    selectedContainerColor = Orange.copy(0.15f),
                    selectedLabelColor = Orange,
                ),
            )
        }
    }
}

@Composable
private fun StatusChip(text: String, color: Color) {
    Surface(color = color.copy(alpha = 0.12f), shape = RoundedCornerShape(999.dp)) {
        Text(
            text,
            modifier = Modifier.padding(horizontal = 10.dp, vertical = 4.dp),
            color = color,
            fontSize = 11.sp,
            fontWeight = FontWeight.Bold,
        )
    }
}
