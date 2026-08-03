package com.freshdelivery.nativecustomer.ui

import androidx.activity.compose.BackHandler
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.outlined.ArrowBack
import androidx.compose.material.icons.outlined.AccountCircle
import androidx.compose.material.icons.outlined.Add
import androidx.compose.material.icons.outlined.Home
import androidx.compose.material.icons.outlined.LocationOn
import androidx.compose.material.icons.outlined.Map
import androidx.compose.material.icons.outlined.MyLocation
import androidx.compose.material.icons.outlined.Receipt
import androidx.compose.material.icons.outlined.Remove
import androidx.compose.material.icons.outlined.Search
import androidx.compose.material.icons.outlined.ShoppingBag
import androidx.compose.material.icons.outlined.Store
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.FilterChip
import androidx.compose.material3.FilterChipDefaults
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.NavigationBar
import androidx.compose.material3.NavigationBarItem
import androidx.compose.material3.NavigationBarItemDefaults
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
import androidx.compose.material3.Scaffold
import androidx.compose.material3.SnackbarHost
import androidx.compose.material3.SnackbarHostState
import androidx.compose.material3.Surface
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
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import coil.compose.AsyncImage
import com.freshdelivery.nativecustomer.data.CustomerTab
import com.freshdelivery.nativecustomer.data.MenuItemRow
import com.freshdelivery.nativecustomer.data.OrderUi
import com.freshdelivery.nativecustomer.data.StoreRow
import com.freshdelivery.nativecustomer.ui.map.MapMarker
import com.freshdelivery.nativecustomer.ui.map.MapboxView
import com.freshdelivery.nativecustomer.ui.theme.UberChip
import com.freshdelivery.nativecustomer.ui.theme.UberGreen
import com.freshdelivery.nativecustomer.ui.theme.UberInk
import com.freshdelivery.nativecustomer.ui.theme.UberMuted
import com.freshdelivery.nativecustomer.ui.theme.UberSurface

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
    val fieldColors = OutlinedTextFieldDefaults.colors(
        focusedBorderColor = UberGreen,
        focusedLabelColor = UberGreen,
        cursorColor = UberGreen,
    )
    Column(
        Modifier
            .fillMaxSize()
            .background(Color.White)
            .statusBarsPadding()
            .padding(horizontal = 24.dp),
        verticalArrangement = Arrangement.Center,
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        Text(
            "Fresh",
            style = MaterialTheme.typography.displaySmall,
            color = UberInk,
        )
        Text(
            if (signupMode) "Δημιούργησε λογαριασμό" else "Παράγγειλε από τα αγαπημένα σου",
            color = UberMuted,
            style = MaterialTheme.typography.bodyMedium,
        )
        Spacer(Modifier.height(32.dp))
        if (signupMode) {
            OutlinedTextField(
                value = fullName,
                onValueChange = { fullName = it },
                label = { Text("Ονοματεπώνυμο") },
                singleLine = true,
                modifier = Modifier.fillMaxWidth(),
                shape = RoundedCornerShape(12.dp),
                colors = fieldColors,
            )
            Spacer(Modifier.height(12.dp))
            OutlinedTextField(
                value = phone,
                onValueChange = { phone = it },
                label = { Text("Τηλέφωνο") },
                singleLine = true,
                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Phone),
                modifier = Modifier.fillMaxWidth(),
                shape = RoundedCornerShape(12.dp),
                colors = fieldColors,
            )
            Spacer(Modifier.height(12.dp))
        }
        OutlinedTextField(
            value = email,
            onValueChange = { email = it },
            label = { Text("Email") },
            singleLine = true,
            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Email),
            modifier = Modifier.fillMaxWidth(),
            shape = RoundedCornerShape(12.dp),
            colors = fieldColors,
        )
        Spacer(Modifier.height(12.dp))
        OutlinedTextField(
            value = password,
            onValueChange = { password = it },
            label = { Text("Κωδικός") },
            singleLine = true,
            visualTransformation = PasswordVisualTransformation(),
            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Password),
            modifier = Modifier.fillMaxWidth(),
            shape = RoundedCornerShape(12.dp),
            colors = fieldColors,
        )
        if (!error.isNullOrBlank()) {
            Spacer(Modifier.height(12.dp))
            Text(error, color = MaterialTheme.colorScheme.error)
        }
        if (!info.isNullOrBlank()) {
            Spacer(Modifier.height(12.dp))
            Text(info, color = UberGreen)
        }
        Spacer(Modifier.height(24.dp))
        Button(
            onClick = {
                if (signupMode) onSignUp(email, password, fullName, phone)
                else onLogin(email, password)
            },
            enabled = !busy && email.isNotBlank() && password.length >= 6 &&
                (!signupMode || fullName.isNotBlank()),
            modifier = Modifier
                .fillMaxWidth()
                .height(56.dp),
            shape = RoundedCornerShape(28.dp),
            colors = ButtonDefaults.buttonColors(
                containerColor = UberGreen,
                contentColor = Color.White,
            ),
        ) {
            if (busy) CircularProgressIndicator(color = Color.White, modifier = Modifier.size(22.dp))
            else Text(
                if (signupMode) "Συνέχεια" else "Σύνδεση",
                fontWeight = FontWeight.Bold,
            )
        }
        TextButton(onClick = { onToggleSignup(!signupMode) }) {
            Text(
                if (signupMode) "Έχεις λογαριασμό; Σύνδεση"
                else "Νέος χρήστης; Δημιουργία λογαριασμού",
                color = UberInk,
            )
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
        if (!msg.isNullOrBlank()) {
            snackbar.showSnackbar(msg)
            onClearMessages()
        }
    }
    BackHandler(enabled = state.showCart || state.selectedStore != null) {
        if (state.showCart) onToggleCart(false) else onCloseStore()
    }
    if (state.showCart) {
        CartCheckoutScreen(
            state, snackbar, { onToggleCart(false) }, onUpdateQty, onSetDelivery,
            onSetNotes, onSetTip, onSetPayment, onPlaceOrder, onUseLocation, onGeocode, onPickSuggestion,
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
        Triple(CustomerTab.Browse, "Αναζήτηση", Icons.Outlined.Search),
        Triple(CustomerTab.Orders, "Παραγγελίες", Icons.Outlined.Receipt),
        Triple(CustomerTab.Profile, "Λογαριασμός", Icons.Outlined.AccountCircle),
    )

    Scaffold(
        containerColor = Color.White,
        snackbarHost = { SnackbarHost(snackbar) },
        bottomBar = {
            Column {
                if (state.cartCount > 0 && (state.tab == CustomerTab.Home || state.tab == CustomerTab.Browse)) {
                    StickyCartBar(
                        count = state.cartCount,
                        total = state.cartSubtotal,
                        onClick = { onToggleCart(true) },
                    )
                }
                NavigationBar(
                    containerColor = Color.White,
                    tonalElevation = 0.dp,
                    modifier = Modifier.border(
                        width = 0.5.dp,
                        color = MaterialTheme.colorScheme.outline,
                    ),
                ) {
                    tabs.forEach { (tab, label, icon) ->
                        val selected = state.tab == tab
                        NavigationBarItem(
                            selected = selected,
                            onClick = { onTab(tab) },
                            icon = {
                                Icon(
                                    icon as ImageVector,
                                    contentDescription = label,
                                    modifier = Modifier.size(24.dp),
                                )
                            },
                            label = {
                                Text(
                                    label,
                                    fontSize = 11.sp,
                                    fontWeight = if (selected) FontWeight.Bold else FontWeight.Normal,
                                )
                            },
                            colors = NavigationBarItemDefaults.colors(
                                selectedIconColor = UberInk,
                                selectedTextColor = UberInk,
                                unselectedIconColor = UberMuted,
                                unselectedTextColor = UberMuted,
                                indicatorColor = Color.Transparent,
                            ),
                        )
                    }
                }
            }
        },
    ) { padding ->
        Box(Modifier.padding(padding).fillMaxSize()) {
            when (state.tab) {
                CustomerTab.Home -> HomeTab(state, onRefresh, onOpenStore, onSearch, browseMode = false)
                CustomerTab.Browse -> HomeTab(state, onRefresh, onOpenStore, onSearch, browseMode = true)
                CustomerTab.Orders -> OrdersTab(state, onTrack, onRefresh, onCancelOrder)
                CustomerTab.Track -> TrackTab(state)
                CustomerTab.Profile -> ProfileTab(state, onSaveProfile, onSignOut)
            }
        }
    }
}

@Composable
private fun StickyCartBar(count: Int, total: Double, onClick: () -> Unit) {
    Surface(
        onClick = onClick,
        color = UberInk,
        shape = RoundedCornerShape(12.dp),
        modifier = Modifier
            .fillMaxWidth()
            .padding(horizontal = 12.dp, vertical = 8.dp),
    ) {
        Row(
            Modifier
                .fillMaxWidth()
                .padding(horizontal = 16.dp, vertical = 14.dp),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Box(
                    Modifier
                        .size(28.dp)
                        .clip(CircleShape)
                        .background(UberGreen),
                    contentAlignment = Alignment.Center,
                ) {
                    Text(
                        "$count",
                        color = Color.White,
                        fontWeight = FontWeight.Bold,
                        fontSize = 13.sp,
                    )
                }
                Spacer(Modifier.width(12.dp))
                Text(
                    "Προβολή καλαθιού",
                    color = Color.White,
                    fontWeight = FontWeight.Bold,
                )
            }
            Text(
                "€" + "%.2f".format(total),
                color = Color.White,
                fontWeight = FontWeight.Bold,
            )
        }
    }
}

@Composable
private fun StoreHeroImage(url: String?, height: Int = 160) {
    Box(
        Modifier
            .fillMaxWidth()
            .height(height.dp)
            .background(UberSurface),
        contentAlignment = Alignment.Center,
    ) {
        if (url.isNullOrBlank()) {
            Icon(
                Icons.Outlined.Store,
                contentDescription = null,
                tint = UberMuted,
                modifier = Modifier.size(48.dp),
            )
        } else {
            AsyncImage(
                model = url,
                contentDescription = null,
                contentScale = ContentScale.Crop,
                modifier = Modifier.fillMaxSize(),
            )
        }
        Box(
            Modifier
                .fillMaxSize()
                .background(
                    Brush.verticalGradient(
                        colors = listOf(Color.Transparent, Color.Black.copy(alpha = 0.15f)),
                    ),
                ),
        )
    }
}

@Composable
private fun HomeTab(
    state: CustomerUiState,
    onRefresh: () -> Unit,
    onOpenStore: (StoreRow) -> Unit,
    onSearch: (String) -> Unit,,
    browseMode: Boolean = false,
) {
    var filterOpen by remember { mutableStateOf(false) }
    val stores = if (filterOpen) {
        state.visibleStores.filter { it.is_active != false }
    } else {
        state.visibleStores
    }

    LazyColumn(
        modifier = Modifier
            .fillMaxSize()
            .background(Color.White),
        contentPadding = PaddingValues(bottom = 24.dp),
    ) {
        item {
            Column(
                Modifier
                    .fillMaxWidth()
                    .statusBarsPadding()
                    .padding(horizontal = 16.dp)
                    .padding(top = 8.dp, bottom = 4.dp),
            ) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Icon(
                        Icons.Outlined.LocationOn,
                        contentDescription = null,
                        tint = UberInk,
                        modifier = Modifier.size(18.dp),
                    )
                    Spacer(Modifier.width(4.dp))
                    Text(
                        text = state.deliveryAddress.ifBlank { "Επίλεξε διεύθυνση παράδοσης" },
                        style = MaterialTheme.typography.titleMedium,
                        fontWeight = FontWeight.Bold,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis,
                        modifier = Modifier.weight(1f),
                    )
                }
                Spacer(Modifier.height(12.dp))
                OutlinedTextField(
                    value = state.searchQuery,
                    onValueChange = onSearch,
                    singleLine = true,
                    leadingIcon = {
                        Icon(Icons.Outlined.Search, contentDescription = null, tint = UberMuted)
                    },
                    placeholder = { Text("Αναζήτηση καταστημάτων", color = UberMuted) },
                    modifier = Modifier.fillMaxWidth(),
                    shape = RoundedCornerShape(28.dp),
                    colors = OutlinedTextFieldDefaults.colors(
                        unfocusedContainerColor = UberSurface,
                        focusedContainerColor = UberSurface,
                        unfocusedBorderColor = Color.Transparent,
                        focusedBorderColor = UberGreen,
                        cursorColor = UberGreen,
                    ),
                )
            }
        }
        item {
            Row(
                Modifier
                    .horizontalScroll(rememberScrollState())
                    .padding(horizontal = 16.dp, vertical = 8.dp),
                horizontalArrangement = Arrangement.spacedBy(8.dp),
            ) {
                UberFilterChip("Όλα", selected = !filterOpen) { filterOpen = false }
                UberFilterChip("Ανοιχτά", selected = filterOpen) { filterOpen = true }
                TextButton(onClick = onRefresh) {
                    Text("Ανανέωση", color = UberGreen, fontWeight = FontWeight.Bold)
                }
            }
        }
        
        // Phase1: admin appConfig brand / promo / tiles
        item {
            Column(Modifier.padding(horizontal = 16.dp, vertical = 8.dp)) {
                Text(state.appConfig.appName, style = MaterialTheme.typography.headlineSmall, fontWeight = FontWeight.Bold, color = UberInk)
                Text("${state.appConfig.cityLabel} · ${state.appConfig.tagline}", color = UberMuted, style = MaterialTheme.typography.bodySmall)
            }
        }
        state.appConfig.promos.firstOrNull()?.let { promo ->
            item {
                Surface(
                    modifier = Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 6.dp),
                    shape = RoundedCornerShape(16.dp),
                    color = UberInk,
                ) {
                    Column(Modifier.padding(16.dp)) {
                        Text(promo.tag, color = UberGreen, fontWeight = FontWeight.Bold, style = MaterialTheme.typography.labelMedium)
                        Text(promo.title, color = Color.White, fontWeight = FontWeight.Bold, style = MaterialTheme.typography.titleMedium)
                        Text(promo.subtitle, color = Color.White.copy(alpha = 0.8f), style = MaterialTheme.typography.bodySmall)
                        if (promo.code.isNotBlank()) {
                            Text("Κωδικός: ${promo.code}", color = UberGreen, fontWeight = FontWeight.SemiBold, style = MaterialTheme.typography.labelMedium)
                        }
                    }
                }
            }
        }
        item {
            Row(
                Modifier.horizontalScroll(rememberScrollState()).padding(horizontal = 16.dp, vertical = 8.dp),
                horizontalArrangement = Arrangement.spacedBy(8.dp),
            ) {
                state.appConfig.tiles.forEach { tile ->
                    Surface(
                        onClick = { onSearch(if (tile.category == "all") "" else tile.label) },
                        shape = RoundedCornerShape(20.dp),
                        color = UberSurface,
                    ) {
                        Text(
                            "${tile.emoji} ${tile.label}",
                            modifier = Modifier.padding(horizontal = 14.dp, vertical = 10.dp),
                            fontWeight = FontWeight.SemiBold,
                            color = UberInk,
                        )
                    }
                }
            }
        }
item {
            val categories = listOf(
                "🍔 Burger", "🍕 Pizza", "🍣 Sushi", "🥗 Σαλάτες",
                "☕ Καφές", "🍰 Γλυκά", "🍗 Κοτόπουλο", "🌮 Mexican",
            )
            Row(
                Modifier
                    .horizontalScroll(rememberScrollState())
                    .padding(horizontal = 16.dp, vertical = 4.dp),
                horizontalArrangement = Arrangement.spacedBy(8.dp),
            ) {
                categories.forEach { label ->
                    Surface(
                        shape = RoundedCornerShape(20.dp),
                        color = UberSurface,
                        modifier = Modifier.clickable { onSearch(label.substringAfter(" ").trim()) },
                    ) {
                        Text(
                            label,
                            modifier = Modifier.padding(horizontal = 14.dp, vertical = 8.dp),
                            style = MaterialTheme.typography.labelLarge,
                            fontWeight = FontWeight.SemiBold,
                            color = UberInk,
                        )
                    }
                }
            }
        }
        item {
            Text(
                "Κοντά σου",
                style = MaterialTheme.typography.titleLarge,
                modifier = Modifier.padding(horizontal = 16.dp, vertical = 4.dp),
            )
        }
        if (stores.isEmpty()) {
            item {
                Text(
                    "Δεν βρέθηκαν καταστήματα.",
                    color = UberMuted,
                    modifier = Modifier.padding(16.dp),
                )
            }
        }
        items(stores, key = { it.id }) { store ->
            UberStoreCard(store = store, onClick = { onOpenStore(store) })
        }
    }
}

@Composable
private fun UberFilterChip(label: String, selected: Boolean, onClick: () -> Unit) {
    FilterChip(
        selected = selected,
        onClick = onClick,
        label = {
            Text(
                label,
                fontWeight = if (selected) FontWeight.Bold else FontWeight.Medium,
            )
        },
        shape = RoundedCornerShape(20.dp),
        colors = FilterChipDefaults.filterChipColors(
            selectedContainerColor = UberInk,
            selectedLabelColor = Color.White,
            containerColor = UberChip,
            labelColor = UberInk,
        ),
        border = null,
    )
}

@Composable
private fun UberStoreCard(store: StoreRow, onClick: () -> Unit) {
    Column(
        Modifier
            .fillMaxWidth()
            .padding(horizontal = 16.dp, vertical = 10.dp)
            .clip(RoundedCornerShape(16.dp))
            .clickable(onClick = onClick),
    ) {
        StoreHeroImage(store.image_url, height = 168)
        Spacer(Modifier.height(10.dp))
        Text(
            store.name ?: "Κατάστημα",
            style = MaterialTheme.typography.titleLarge,
            maxLines = 1,
            overflow = TextOverflow.Ellipsis,
        )
        store.address?.let {
            Text(
                it,
                style = MaterialTheme.typography.bodySmall,
                color = UberMuted,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
            )
        }
        Spacer(Modifier.height(6.dp))
        Text(
            "★ 4.8 · 25–35 λεπτά · Παράδοση",
            style = MaterialTheme.typography.bodySmall,
            color = UberMuted,
        )
        Spacer(Modifier.height(6.dp))
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            MetaPill(if (store.is_active == false) "Κλειστό" else "Ανοιχτό")
            MetaPill("Παράδοση")
        }
    }
}

@Composable
private fun MetaPill(text: String) {
    Surface(
        color = UberSurface,
        shape = RoundedCornerShape(6.dp),
    ) {
        Text(
            text,
            modifier = Modifier.padding(horizontal = 8.dp, vertical = 4.dp),
            style = MaterialTheme.typography.labelMedium,
            color = UberInk,
        )
    }
}

@Composable
private fun MenuScreen(
    state: CustomerUiState,
    onBack: () -> Unit,
    onAdd: (MenuItemRow) -> Unit,
    onOpenCart: () -> Unit,
) {
    val store = state.selectedStore
    Box(Modifier.fillMaxSize().background(Color.White)) {
        LazyColumn(Modifier.fillMaxSize()) {
            item {
                Box {
                    StoreHeroImage(store?.image_url, height = 220)
                    IconButton(
                        onClick = onBack,
                        modifier = Modifier
                            .statusBarsPadding()
                            .padding(8.dp)
                            .background(Color.White.copy(alpha = 0.92f), CircleShape),
                    ) {
                        Icon(Icons.AutoMirrored.Outlined.ArrowBack, contentDescription = "Back")
                    }
                }
            }
            item {
                Column(Modifier.padding(16.dp)) {
                    Text(
                        store?.name ?: "Μενού",
                        style = MaterialTheme.typography.headlineMedium,
                    )
                    store?.address?.let {
                        Text(it, color = UberMuted, style = MaterialTheme.typography.bodyMedium)
                    }
                    Text(
                        "${state.menu.size} προϊόντα",
                        color = UberMuted,
                        style = MaterialTheme.typography.bodySmall,
                    )
                }
                HorizontalDivider(color = MaterialTheme.colorScheme.outline)
            }
            if (state.busy) {
                item {
                    Box(
                        Modifier
                            .fillMaxWidth()
                            .padding(40.dp),
                        contentAlignment = Alignment.Center,
                    ) {
                        CircularProgressIndicator(color = UberGreen)
                    }
                }
            } else {
                items(state.menu, key = { it.id }) { item ->
                    UberMenuRow(item = item, onAdd = { onAdd(item) })
                    HorizontalDivider(
                        color = MaterialTheme.colorScheme.outline,
                        modifier = Modifier.padding(start = 16.dp),
                    )
                }
                item { Spacer(Modifier.height(100.dp)) }
            }
        }
        if (state.cartCount > 0) {
            Box(
                Modifier
                    .align(Alignment.BottomCenter)
                    .navigationBarsPadding()
                    .padding(12.dp),
            ) {
                StickyCartBar(
                    count = state.cartCount,
                    total = state.cartSubtotal,
                    onClick = onOpenCart,
                )
            }
        }
    }
}

@Composable
private fun UberMenuRow(item: MenuItemRow, onAdd: () -> Unit) {
    Row(
        Modifier
            .fillMaxWidth()
            .clickable(onClick = onAdd)
            .padding(16.dp),
        horizontalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        Column(Modifier.weight(1f)) {
            Text(item.name, fontWeight = FontWeight.Bold, style = MaterialTheme.typography.titleMedium)
            item.description?.takeIf { it.isNotBlank() }?.let {
                Spacer(Modifier.height(4.dp))
                Text(
                    it,
                    style = MaterialTheme.typography.bodySmall,
                    color = UberMuted,
                    maxLines = 2,
                    overflow = TextOverflow.Ellipsis,
                )
            }
            Spacer(Modifier.height(8.dp))
            Text(
                "€" + "%.2f".format(item.price),
                fontWeight = FontWeight.Bold,
            )
        }
        Box {
            Box(
                Modifier
                    .size(96.dp)
                    .clip(RoundedCornerShape(12.dp))
                    .background(UberSurface),
                contentAlignment = Alignment.Center,
            ) {
                if (!item.image_url.isNullOrBlank()) {
                    AsyncImage(
                        model = item.image_url,
                        contentDescription = null,
                        contentScale = ContentScale.Crop,
                        modifier = Modifier.fillMaxSize(),
                    )
                } else {
                    Icon(Icons.Outlined.ShoppingBag, null, tint = UberMuted)
                }
            }
            Box(
                Modifier
                    .align(Alignment.BottomEnd)
                    .padding(4.dp)
                    .size(32.dp)
                    .clip(CircleShape)
                    .background(Color.White)
                    .border(1.dp, MaterialTheme.colorScheme.outline, CircleShape)
                    .clickable(onClick = onAdd),
                contentAlignment = Alignment.Center,
            ) {
                Icon(Icons.Outlined.Add, contentDescription = "Add", tint = UberGreen, modifier = Modifier.size(20.dp))
            }
        }
    }
}

@Composable
private fun CartCheckoutScreen(
    state: CustomerUiState,
    snackbar: SnackbarHostState,
    onBack: () -> Unit,
    onUpdateQty: (String, Int) -> Unit,
    onSetDelivery: (String, Double?, Double?) -> Unit,
    onSetNotes: (String) -> Unit,
    onSetTip: (Double) -> Unit,
    onSetPayment: (String) -> Unit,
    onPlaceOrder: () -> Unit,
    onUseLocation: () -> Unit,
    onGeocode: (String) -> Unit,
    onPickSuggestion: (AddressSuggestion) -> Unit,
) {
    var address by remember(state.deliveryAddress) { mutableStateOf(state.deliveryAddress) }
    var tipText by remember { mutableStateOf(state.tipAmount.toString()) }
    val fieldColors = OutlinedTextFieldDefaults.colors(
        focusedBorderColor = UberGreen,
        focusedLabelColor = UberGreen,
        cursorColor = UberGreen,
    )
    Column(
        Modifier
            .fillMaxSize()
            .background(Color.White)
            .statusBarsPadding(),
    ) {
        SnackbarHost(snackbar)
        Row(
            Modifier
                .fillMaxWidth()
                .padding(8.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            IconButton(onClick = onBack) {
                Icon(Icons.AutoMirrored.Outlined.ArrowBack, contentDescription = "Back")
            }
            Text(
                "Καλάθι",
                style = MaterialTheme.typography.titleLarge,
                modifier = Modifier.weight(1f),
            )
        }
        Text(
            state.cartStoreName ?: "",
            color = UberMuted,
            modifier = Modifier.padding(horizontal = 16.dp),
            style = MaterialTheme.typography.bodyMedium,
        )
        LazyColumn(
            Modifier
                .weight(1f)
                .padding(horizontal = 16.dp),
            verticalArrangement = Arrangement.spacedBy(4.dp),
        ) {
            items(state.cart, key = { it.menuItemId }) { line ->
                Row(
                    Modifier
                        .fillMaxWidth()
                        .padding(vertical = 12.dp),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Column(Modifier.weight(1f)) {
                        Text(line.name, fontWeight = FontWeight.SemiBold)
                        Text("€" + "%.2f".format(line.price * line.quantity), color = UberMuted)
                    }
                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        modifier = Modifier
                            .clip(RoundedCornerShape(20.dp))
                            .border(1.dp, MaterialTheme.colorScheme.outline, RoundedCornerShape(20.dp))
                            .padding(horizontal = 4.dp),
                    ) {
                        IconButton(
                            onClick = { onUpdateQty(line.menuItemId, line.quantity - 1) },
                            modifier = Modifier.size(36.dp),
                        ) {
                            Icon(Icons.Outlined.Remove, contentDescription = "-", tint = UberGreen)
                        }
                        Text("${line.quantity}", fontWeight = FontWeight.Bold, modifier = Modifier.width(24.dp))
                        IconButton(
                            onClick = { onUpdateQty(line.menuItemId, line.quantity + 1) },
                            modifier = Modifier.size(36.dp),
                        ) {
                            Icon(Icons.Outlined.Add, contentDescription = "+", tint = UberGreen)
                        }
                    }
                }
                HorizontalDivider(color = MaterialTheme.colorScheme.outline)
            }
            item {
                Spacer(Modifier.height(16.dp))
                Text("Διεύθυνση παράδοσης", fontWeight = FontWeight.Bold)
                Spacer(Modifier.height(8.dp))
                OutlinedTextField(
                    value = address,
                    onValueChange = {
                        address = it
                        onSetDelivery(it, state.deliveryLat, state.deliveryLng)
                    },
                    modifier = Modifier.fillMaxWidth(),
                    singleLine = true,
                    label = { Text("Οδός, αριθμός, πόλη") },
                    shape = RoundedCornerShape(12.dp),
                    colors = fieldColors,
                )
                Spacer(Modifier.height(8.dp))
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    Button(
                        onClick = onUseLocation,
                        enabled = !state.locating,
                        modifier = Modifier.weight(1f),
                        colors = ButtonDefaults.buttonColors(containerColor = UberGreen),
                        shape = RoundedCornerShape(24.dp),
                    ) {
                        Icon(Icons.Outlined.MyLocation, contentDescription = null)
                        Spacer(Modifier.width(6.dp))
                        Text("Η τοποθεσία μου")
                    }
                    OutlinedButton(
                        onClick = { onGeocode(address) },
                        enabled = !state.locating && address.isNotBlank(),
                        modifier = Modifier.weight(1f),
                        shape = RoundedCornerShape(24.dp),
                    ) {
                        Text("Εύρεση")
                    }
                }
                if (state.locating) {
                    Spacer(Modifier.height(6.dp))
                    LinearProgressIndicator(
                        modifier = Modifier.fillMaxWidth(),
                        color = UberGreen,
                    )
                }
                val pinned = state.deliveryLat != null && state.deliveryLng != null
                Text(
                    if (pinned) {
                        "Σημείο: %.5f, %.5f".format(state.deliveryLat, state.deliveryLng)
                    } else {
                        "Χωρίς σημείο στον χάρτη — πάτα τοποθεσία ή εύρεση."
                    },
                    style = MaterialTheme.typography.bodySmall,
                    color = if (pinned) UberGreen else MaterialTheme.colorScheme.error,
                )
                if (state.addressSuggestions.isNotEmpty()) {
                    Spacer(Modifier.height(8.dp))
                    Text("Προτάσεις", fontWeight = FontWeight.SemiBold)
                    state.addressSuggestions.forEach { s ->
                        Surface(
                            onClick = { onPickSuggestion(s) },
                            color = UberSurface,
                            shape = RoundedCornerShape(12.dp),
                            modifier = Modifier
                                .fillMaxWidth()
                                .padding(top = 6.dp),
                        ) {
                            Text(s.label, modifier = Modifier.padding(12.dp))
                        }
                    }
                }
            }
            item {
                Spacer(Modifier.height(12.dp))
                OutlinedTextField(
                    value = state.notes,
                    onValueChange = onSetNotes,
                    label = { Text("Σημειώσεις για τον οδηγό") },
                    modifier = Modifier.fillMaxWidth(),
                    shape = RoundedCornerShape(12.dp),
                    colors = fieldColors,
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
                    shape = RoundedCornerShape(12.dp),
                    colors = fieldColors,
                )
            }
            item {
                Spacer(Modifier.height(8.dp))
                Text("Πληρωμή", fontWeight = FontWeight.Bold)
                Spacer(Modifier.height(8.dp))
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    Button(
                        onClick = { onSetPayment("cash") },
                        enabled = state.paymentMethod != "cash",
                        colors = ButtonDefaults.buttonColors(
                            containerColor = if (state.paymentMethod == "cash") UberGreen else UberSurface,
                            contentColor = if (state.paymentMethod == "cash") Color.White else UberInk,
                        ),
                        shape = RoundedCornerShape(20.dp),
                    ) { Text("Μετρητά") }
                    OutlinedButton(onClick = {}, enabled = false, shape = RoundedCornerShape(20.dp)) {
                        Text("Κάρτα (web)")
                    }
                }
            }
            item {
                Spacer(Modifier.height(16.dp))
                SummaryLine("Υποσύνολο", state.cartSubtotal)
                val feeNote = if (state.feePerKm > 0 && state.deliveryLat != null) {
                    "βάση €" + "%.2f".format(state.feeBase) + " + €" + "%.2f".format(state.feePerKm) + "/km"
                } else null
                SummaryLine(
                    "Παράδοση" + (if (feeNote != null) " ($feeNote)" else ""),
                    state.deliveryFee,
                )
                SummaryLine("Φιλοδώρημα", state.tipAmount)
                HorizontalDivider(
                    Modifier.padding(vertical = 8.dp),
                    color = MaterialTheme.colorScheme.outline,
                )
                Row(
                    Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                ) {
                    Text("Σύνολο", fontWeight = FontWeight.Bold, style = MaterialTheme.typography.titleLarge)
                    Text(
                        "€" + "%.2f".format(state.grandTotal),
                        fontWeight = FontWeight.Bold,
                        style = MaterialTheme.typography.titleLarge,
                    )
                }
                if (!state.error.isNullOrBlank()) {
                    Text(state.error!!, color = MaterialTheme.colorScheme.error)
                }
                Spacer(Modifier.height(16.dp))
                Button(
                    onClick = onPlaceOrder,
                    enabled = !state.busy && state.cart.isNotEmpty() && address.isNotBlank(),
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(56.dp),
                    shape = RoundedCornerShape(28.dp),
                    colors = ButtonDefaults.buttonColors(containerColor = UberGreen),
                ) {
                    if (state.busy) {
                        CircularProgressIndicator(color = Color.White, modifier = Modifier.size(22.dp))
                    } else {
                        Text(
                            "Τοποθέτηση παραγγελίας · €" + "%.2f".format(state.grandTotal),
                            fontWeight = FontWeight.Bold,
                        )
                    }
                }
                Spacer(Modifier.height(32.dp))
            }
        }
    }
}

@Composable
private fun SummaryLine(label: String, amount: Double) {
    Row(
        Modifier
            .fillMaxWidth()
            .padding(vertical = 2.dp),
        horizontalArrangement = Arrangement.SpaceBetween,
    ) {
        Text(label, color = UberMuted)
        Text("€" + "%.2f".format(amount))
    }
}

private fun statusLabel(status: String): String = when (status) {
    "pending" -> "Σε αναμονή"
    "accepted", "confirmed" -> "Αποδεκτή"
    "preparing" -> "Ετοιμάζεται"
    "ready" -> "Έτοιμη"
    "picked_up", "on_the_way", "in_transit" -> "Καθ' οδόν"
    "delivered" -> "Παραδόθηκε"
    "cancelled" -> "Ακυρώθηκε"
    "rejected" -> "Απορρίφθηκε"
    else -> status
}

@Composable
private fun OrdersTab(
    state: CustomerUiState,
    onTrack: (OrderUi?) -> Unit,
    onRefresh: () -> Unit,
    onCancelOrder: (OrderUi) -> Unit,
) {
    LazyColumn(
        Modifier
            .fillMaxSize()
            .background(Color.White)
            .padding(horizontal = 16.dp),
        contentPadding = PaddingValues(bottom = 24.dp),
    ) {
        item {
            Row(
                Modifier
                    .fillMaxWidth()
                    .statusBarsPadding()
                    .padding(vertical = 12.dp),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Text("Παραγγελίες", style = MaterialTheme.typography.headlineMedium)
                TextButton(onClick = onRefresh) {
                    Text("Ανανέωση", color = UberGreen, fontWeight = FontWeight.Bold)
                }
            }
        }
        if (state.orders.isEmpty()) {
            item {
                Text("Δεν υπάρχουν παραγγελίες ακόμα.", color = UberMuted)
            }
        }
        items(state.orders, key = { it.order.id }) { item ->
            val cancellable = item.order.status in listOf("pending", "accepted", "confirmed")
            Column(
                Modifier
                    .fillMaxWidth()
                    .clip(RoundedCornerShape(16.dp))
                    .background(UberSurface)
                    .clickable { onTrack(item) }
                    .padding(16.dp)
                    .padding(bottom = 4.dp),
            ) {
                Row(
                    Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                ) {
                    Text(
                        item.storeName ?: "Κατάστημα",
                        fontWeight = FontWeight.Bold,
                        modifier = Modifier.weight(1f),
                    )
                    item.order.store_order_number?.let {
                        Text("#%04d".format(it), color = UberGreen, fontWeight = FontWeight.Bold)
                    }
                }
                Spacer(Modifier.height(6.dp))
                MetaPill(statusLabel(item.order.status))
                item.order.delivery_address?.let {
                    Spacer(Modifier.height(6.dp))
                    Text(it, style = MaterialTheme.typography.bodySmall, color = UberMuted)
                }
                item.order.total_amount?.let {
                    Text("€" + "%.2f".format(it), fontWeight = FontWeight.Bold)
                }
                Row {
                    TextButton(onClick = { onTrack(item) }) {
                        Text("Παρακολούθηση", color = UberGreen, fontWeight = FontWeight.Bold)
                    }
                    if (cancellable) {
                        TextButton(
                            onClick = { onCancelOrder(item) },
                            enabled = !state.busy,
                        ) {
                            Text("Ακύρωση", color = MaterialTheme.colorScheme.error)
                        }
                    }
                }
            }
            Spacer(Modifier.height(10.dp))
        }
    }
}

@Composable
private fun TrackTab(state: CustomerUiState) {
    val order = state.trackingOrder
    val markers = buildList {
        order?.order?.delivery_latitude?.let { lat ->
            order.order.delivery_longitude?.let { lng ->
                add(MapMarker(lat, lng, "Παράδοση", "#06C167"))
            }
        }
        state.driverLocation?.let { d ->
            add(MapMarker(d.latitude, d.longitude, "Οδηγός", "#141414"))
        }
    }
    val centerLat = markers.firstOrNull()?.lat ?: 39.6650
    val centerLng = markers.firstOrNull()?.lng ?: 20.8537
    Column(Modifier.fillMaxSize().background(Color.White)) {
        Box(
            Modifier
                .fillMaxWidth()
                .height(300.dp)
                .background(UberSurface),
        ) {
            MapboxView(
                modifier = Modifier.fillMaxSize(),
                centerLat = centerLat,
                centerLng = centerLng,
                markers = markers,
            )
        }
        Column(Modifier.padding(16.dp)) {
            if (order == null) {
                Text(
                    "Επίλεξε παραγγελία από Παραγγελίες για live tracking.",
                    color = UberMuted,
                )
            } else {
                Text(
                    order.storeName ?: "Παραγγελία",
                    style = MaterialTheme.typography.headlineSmall,
                )
                Spacer(Modifier.height(6.dp))
                MetaPill(statusLabel(order.order.status))
                order.order.delivery_address?.let {
                    Spacer(Modifier.height(8.dp))
                    Text(it)
                }
                Spacer(Modifier.height(8.dp))
                Text(
                    when {
                        state.driverLocation != null -> "Ο οδηγός κινείται προς εσένα."
                        !order.order.driver_id.isNullOrBlank() -> "Αναμονή θέσης οδηγού…"
                        else -> "Δεν έχει ανατεθεί οδηγός ακόμα."
                    },
                    color = UberMuted,
                    style = MaterialTheme.typography.bodyMedium,
                )
            }
        }
    }
}

@Composable
private fun ProfileTab(
    state: CustomerUiState,
    onSaveProfile: (String, String) -> Unit,
    onSignOut: () -> Unit,
) {
    var fullName by remember(state.profile?.full_name) {
        mutableStateOf(state.profile?.full_name ?: "")
    }
    var phone by remember(state.profile?.phone) {
        mutableStateOf(state.profile?.phone ?: "")
    }
    val fieldColors = OutlinedTextFieldDefaults.colors(
        focusedBorderColor = UberGreen,
        focusedLabelColor = UberGreen,
        cursorColor = UberGreen,
    )
    Column(
        Modifier
            .fillMaxSize()
            .background(Color.White)
            .statusBarsPadding()
            .padding(16.dp),
    ) {
        Text("Λογαριασμός", style = MaterialTheme.typography.headlineMedium)
        Spacer(Modifier.height(20.dp))
        OutlinedTextField(
            value = fullName,
            onValueChange = { fullName = it },
            label = { Text("Ονοματεπώνυμο") },
            singleLine = true,
            modifier = Modifier.fillMaxWidth(),
            shape = RoundedCornerShape(12.dp),
            colors = fieldColors,
        )
        Spacer(Modifier.height(12.dp))
        OutlinedTextField(
            value = phone,
            onValueChange = { phone = it },
            label = { Text("Τηλέφωνο") },
            singleLine = true,
            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Phone),
            modifier = Modifier.fillMaxWidth(),
            shape = RoundedCornerShape(12.dp),
            colors = fieldColors,
        )
        Spacer(Modifier.height(16.dp))
        Button(
            onClick = { onSaveProfile(fullName, phone) },
            enabled = !state.savingProfile && fullName.isNotBlank(),
            modifier = Modifier
                .fillMaxWidth()
                .height(52.dp),
            shape = RoundedCornerShape(26.dp),
            colors = ButtonDefaults.buttonColors(containerColor = UberGreen),
        ) {
            if (state.savingProfile) CircularProgressIndicator(color = Color.White, modifier = Modifier.size(22.dp))
            else Text("Αποθήκευση", fontWeight = FontWeight.Bold)
        }
        Spacer(Modifier.height(24.dp))
        Text("Παραγγελίες: ${state.orders.size}", color = UberMuted)
        Text("Push: ενεργές", color = UberMuted)
        Spacer(Modifier.height(24.dp))
        OutlinedButton(
            onClick = onSignOut,
            modifier = Modifier.fillMaxWidth().height(48.dp),
            shape = RoundedCornerShape(24.dp),
        ) {
            Text("Αποσύνδεση", color = UberInk, fontWeight = FontWeight.SemiBold)
        }
    }
}
