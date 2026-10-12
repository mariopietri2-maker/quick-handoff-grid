package com.freshdelivery.nativeadmin

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.viewModels
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.freshdelivery.nativeadmin.ui.AdminViewModel

private val Orange = Color(0xFFEA580C)
private val Ink = Color(0xFF111827)
private val Muted = Color(0xFF6B7280)
private val Surface = Color(0xFFFFF7EC)

class MainActivity : ComponentActivity() {
    private val vm: AdminViewModel by viewModels()

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContent {
            MaterialTheme(
                colorScheme = lightColorScheme(
                    primary = Orange,
                    background = Surface,
                    surface = Color.White,
                ),
            ) {
                val state by vm.state.collectAsState()
                when {
                    state.bootstrapping -> Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                        CircularProgressIndicator(color = Orange)
                    }
                    !state.signedIn -> LoginScreen(
                        busy = state.busy,
                        error = state.error,
                        onLogin = vm::signIn,
                    )
                    else -> AdminShell(
                        state = state,
                        onTab = vm::setTab,
                        onRefresh = vm::refresh,
                        onSignOut = vm::signOut,
                        onEndShift = vm::forceEndShift,
                        onSetActive = vm::setDriverActive,
                        onForceStatus = vm::forceOrderStatus,
                    )
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
        Modifier.fillMaxSize().background(Surface).padding(24.dp),
        verticalArrangement = Arrangement.Center,
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        Text("Fresh2GO", fontSize = 28.sp, fontWeight = FontWeight.Black, color = Orange)
        Text("Admin Ops", fontSize = 18.sp, fontWeight = FontWeight.Bold, color = Ink)
        Spacer(Modifier.height(24.dp))
        OutlinedTextField(email, { email = it }, label = { Text("Email") }, singleLine = true, modifier = Modifier.fillMaxWidth())
        Spacer(Modifier.height(8.dp))
        OutlinedTextField(
            pass, { pass = it }, label = { Text("Password") },
            singleLine = true,
            visualTransformation = PasswordVisualTransformation(),
            modifier = Modifier.fillMaxWidth(),
        )
        if (error != null) {
            Spacer(Modifier.height(8.dp))
            Text(error, color = Color(0xFFDC2626), fontSize = 13.sp)
        }
        Spacer(Modifier.height(16.dp))
        Button(
            onClick = { onLogin(email, pass) },
            enabled = !busy && email.isNotBlank() && pass.isNotBlank(),
            modifier = Modifier.fillMaxWidth().height(52.dp),
            colors = ButtonDefaults.buttonColors(containerColor = Orange),
        ) {
            if (busy) CircularProgressIndicator(Modifier.size(22.dp), color = Color.White, strokeWidth = 2.dp)
            else Text("Είσοδος Admin", fontWeight = FontWeight.Bold)
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun AdminShell(
    state: com.freshdelivery.nativeadmin.ui.AdminUiState,
    onTab: (Int) -> Unit,
    onRefresh: () -> Unit,
    onSignOut: () -> Unit,
    onEndShift: (String) -> Unit,
    onSetActive: (String, Boolean) -> Unit,
    onForceStatus: (String, String) -> Unit,
) {
    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Admin Ops", fontWeight = FontWeight.Bold) },
                actions = {
                    IconButton(onClick = onRefresh) { Icon(Icons.Default.Refresh, contentDescription = "Refresh") }
                    IconButton(onClick = onSignOut) { Icon(Icons.Default.Logout, contentDescription = "Logout") }
                },
                colors = TopAppBarDefaults.topAppBarColors(containerColor = Color.White),
            )
        },
        bottomBar = {
            NavigationBar(containerColor = Color.White) {
                NavigationBarItem(state.tab == 0, { onTab(0) }, { Icon(Icons.Default.Dashboard, null) }, label = { Text("Overview") })
                NavigationBarItem(state.tab == 1, { onTab(1) }, { Icon(Icons.Default.TwoWheeler, null) }, label = { Text("Drivers") })
                NavigationBarItem(state.tab == 2, { onTab(2) }, { Icon(Icons.Default.ReceiptLong, null) }, label = { Text("Orders") })
                NavigationBarItem(state.tab == 3, { onTab(3) }, { Icon(Icons.Default.Store, null) }, label = { Text("Stores") })
            }
        },
    ) { pad ->
        Column(Modifier.fillMaxSize().padding(pad).background(Surface)) {
            if (state.error != null) {
                Text(state.error!!, color = Color(0xFFDC2626), modifier = Modifier.padding(12.dp), fontSize = 13.sp)
            }
            if (state.info != null) {
                Text(state.info!!, color = Color(0xFF059669), modifier = Modifier.padding(horizontal = 12.dp), fontSize = 13.sp)
            }
            when (state.tab) {
                0 -> OverviewTab(state)
                1 -> DriversTab(state, onEndShift, onSetActive)
                2 -> OrdersTab(state, onForceStatus)
                3 -> StoresTab(state)
            }
        }
    }
}

@Composable
private fun OverviewTab(state: com.freshdelivery.nativeadmin.ui.AdminUiState) {
    val s = state.snapshot
    Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
        Text("Live operations", fontWeight = FontWeight.Black, fontSize = 20.sp, color = Ink)
        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            StatCard("Open", "${s.openOrders}", Modifier.weight(1f))
            StatCard("On road", "${s.acceptedOrders}", Modifier.weight(1f))
        }
        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            StatCard("Drivers online", "${s.onlineDrivers}", Modifier.weight(1f))
            StatCard("Stores open", "${s.activeStores}", Modifier.weight(1f))
        }
        Text("Auto-refresh every 8s", color = Muted, fontSize = 12.sp)
    }
}

@Composable
private fun StatCard(label: String, value: String, modifier: Modifier = Modifier) {
    Card(modifier, shape = RoundedCornerShape(16.dp), colors = CardDefaults.cardColors(containerColor = Color.White)) {
        Column(Modifier.padding(16.dp)) {
            Text(label, color = Muted, fontSize = 12.sp)
            Text(value, fontWeight = FontWeight.Black, fontSize = 28.sp, color = Ink)
        }
    }
}

@Composable
private fun DriversTab(
    state: com.freshdelivery.nativeadmin.ui.AdminUiState,
    onEndShift: (String) -> Unit,
    onSetActive: (String, Boolean) -> Unit,
) {
    LazyColumn(Modifier.padding(12.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
        items(state.drivers, key = { it.id }) { d ->
            Card(colors = CardDefaults.cardColors(containerColor = Color.White), shape = RoundedCornerShape(14.dp)) {
                Column(Modifier.padding(12.dp)) {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Text(d.name, fontWeight = FontWeight.Bold, modifier = Modifier.weight(1f))
                        StatusChip(
                            when {
                                !d.active -> "OFF"
                                d.online && d.onBreak -> "BREAK"
                                d.online -> "ONLINE"
                                else -> "IDLE"
                            },
                        )
                    }
                    Text(
                        buildString {
                            append(d.callRole)
                            if (d.lat != null) append(" · loc ok")
                        },
                        color = Muted,
                        fontSize = 12.sp,
                    )
                    Row(horizontalArrangement = Arrangement.spacedBy(8.dp), modifier = Modifier.padding(top = 8.dp)) {
                        if (d.online) {
                            OutlinedButton(onClick = { onEndShift(d.id) }) { Text("End shift") }
                        }
                        if (d.active) {
                            OutlinedButton(onClick = { onSetActive(d.id, false) }) { Text("Deactivate") }
                        } else {
                            Button(onClick = { onSetActive(d.id, true) }, colors = ButtonDefaults.buttonColors(containerColor = Orange)) {
                                Text("Activate")
                            }
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun OrdersTab(
    state: com.freshdelivery.nativeadmin.ui.AdminUiState,
    onForceStatus: (String, String) -> Unit,
) {
    LazyColumn(Modifier.padding(12.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
        items(state.orders, key = { it.id }) { o ->
            Card(colors = CardDefaults.cardColors(containerColor = Color.White), shape = RoundedCornerShape(14.dp)) {
                Column(Modifier.padding(12.dp)) {
                    Row {
                        Text(o.status.uppercase(), fontWeight = FontWeight.Bold, modifier = Modifier.weight(1f), color = Orange)
                        Text(o.id.take(8), color = Muted, fontSize = 12.sp)
                    }
                    Text(o.delivery_address ?: "—", fontSize = 13.sp, color = Ink, maxLines = 2)
                    Text("total=${o.total ?: "?"} · src=${o.source ?: "in_app"}", fontSize = 11.sp, color = Muted)
                    Row(horizontalArrangement = Arrangement.spacedBy(6.dp), modifier = Modifier.padding(top = 8.dp)) {
                        if (o.status == "placed") {
                            OutlinedButton(onClick = { onForceStatus(o.id, "accepted") }) { Text("Accept") }
                        }
                        if (o.status in listOf("accepted", "preparing")) {
                            OutlinedButton(onClick = { onForceStatus(o.id, "ready") }) { Text("Ready") }
                        }
                        if (o.status in listOf("ready", "picked_up", "delivering")) {
                            Button(onClick = { onForceStatus(o.id, "delivered") }, colors = ButtonDefaults.buttonColors(containerColor = Orange)) {
                                Text("Delivered")
                            }
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun StoresTab(state: com.freshdelivery.nativeadmin.ui.AdminUiState) {
    LazyColumn(Modifier.padding(12.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
        items(state.stores, key = { it.id }) { s ->
            Card(colors = CardDefaults.cardColors(containerColor = Color.White), shape = RoundedCornerShape(14.dp)) {
                Row(Modifier.padding(12.dp), verticalAlignment = Alignment.CenterVertically) {
                    Column(Modifier.weight(1f)) {
                        Text(s.name, fontWeight = FontWeight.Bold)
                        Text(
                            listOfNotNull(
                                if (s.store_role == "N") "Ghost Store" else "Partner",
                                s.address,
                            ).joinToString(" · "),
                            color = Muted,
                            fontSize = 12.sp,
                            maxLines = 2,
                        )
                    }
                    StatusChip(if (s.is_active == true) "OPEN" else "CLOSED")
                }
            }
        }
    }
}

@Composable
private fun StatusChip(text: String) {
    val bg = when (text) {
        "ONLINE", "OPEN" -> Color(0xFFD1FAE5)
        "BREAK" -> Color(0xFFFEF3C7)
        "OFF", "CLOSED", "IDLE" -> Color(0xFFF3F4F6)
        else -> Color(0xFFFFEDD5)
    }
    val fg = when (text) {
        "ONLINE", "OPEN" -> Color(0xFF047857)
        "BREAK" -> Color(0xFFB45309)
        else -> Color(0xFF374151)
    }
    Surface(color = bg, shape = RoundedCornerShape(999.dp)) {
        Text(text, modifier = Modifier.padding(horizontal = 10.dp, vertical = 4.dp), color = fg, fontSize = 11.sp, fontWeight = FontWeight.Bold)
    }
}
