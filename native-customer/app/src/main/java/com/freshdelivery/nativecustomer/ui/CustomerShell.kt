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
import androidx.compose.foundation.layout.RowScope
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
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.outlined.ArrowBack
import androidx.compose.material.icons.outlined.AccountCircle
import androidx.compose.material.icons.outlined.Add
import androidx.compose.material.icons.outlined.ChevronRight
import androidx.compose.material.icons.outlined.Close
import androidx.compose.material.icons.outlined.CreditCard
import androidx.compose.material.icons.filled.Favorite
import androidx.compose.material.icons.outlined.Delete
import androidx.compose.material.icons.outlined.DirectionsBike
import androidx.compose.material.icons.outlined.Favorite
import androidx.compose.material.icons.outlined.FavoriteBorder
import androidx.compose.material.icons.outlined.Headset
import androidx.compose.material.icons.outlined.Home
import androidx.compose.material.icons.outlined.LocalOffer
import androidx.compose.material.icons.outlined.LocationOn
import androidx.compose.material.icons.outlined.Logout
import androidx.compose.material.icons.outlined.Map
import androidx.compose.material.icons.outlined.MyLocation
import androidx.compose.material.icons.outlined.Notifications
import androidx.compose.material.icons.outlined.Receipt
import androidx.compose.material.icons.outlined.Remove
import androidx.compose.material.icons.outlined.Restaurant
import androidx.compose.material.icons.outlined.RestaurantMenu
import androidx.compose.material.icons.outlined.Search
import androidx.compose.material.icons.outlined.ShoppingBag
import androidx.compose.material.icons.outlined.Star
import androidx.compose.material.icons.outlined.Store
import androidx.compose.material.icons.outlined.Timer
import androidx.compose.material.icons.outlined.Tune
import androidx.compose.material.icons.outlined.Wallet
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
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import coil.compose.AsyncImage
import com.freshdelivery.nativecustomer.data.CustomerTab
import com.freshdelivery.nativecustomer.data.MenuItemRow
import com.freshdelivery.nativecustomer.data.OrderUi
import com.freshdelivery.nativecustomer.data.SavedAddressRow
import com.freshdelivery.nativecustomer.data.StoreRating
import com.freshdelivery.nativecustomer.data.StoreRow
import com.freshdelivery.nativecustomer.ui.map.MapMarker
import com.freshdelivery.nativecustomer.ui.map.MapboxView
import com.freshdelivery.nativecustomer.ui.theme.FreshAmber
import com.freshdelivery.nativecustomer.ui.theme.FreshBg
import com.freshdelivery.nativecustomer.ui.theme.FreshChip
import com.freshdelivery.nativecustomer.ui.theme.FreshDivider
import com.freshdelivery.nativecustomer.ui.theme.FreshGreen
import com.freshdelivery.nativecustomer.ui.theme.FreshGreenDark
import com.freshdelivery.nativecustomer.ui.theme.FreshGreenSoft
import com.freshdelivery.nativecustomer.ui.theme.FreshInk
import com.freshdelivery.nativecustomer.ui.theme.FreshMuted
import com.freshdelivery.nativecustomer.ui.theme.FreshRose
import com.freshdelivery.nativecustomer.ui.theme.FreshRoseSoft
import com.freshdelivery.nativecustomer.ui.theme.FreshSurface
import com.freshdelivery.nativecustomer.ui.theme.FreshViolet
import com.freshdelivery.nativecustomer.ui.theme.FreshVioletSoft
import java.time.DayOfWeek
import java.time.LocalDate
import java.time.LocalDateTime
import kotlin.math.atan2
import kotlin.math.cos
import kotlin.math.sin
import kotlin.math.sqrt
import kotlinx.serialization.json.booleanOrNull
import kotlinx.serialization.json.contentOrNull
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive

private val FreshGradient = Brush.horizontalGradient(listOf(FreshGreen, FreshViolet))
private val FreshChipGradient = Brush.horizontalGradient(listOf(FreshChip, FreshChip))

@Composable
fun CustomerShell(
    state: CustomerUiState,
    onTab: (CustomerTab) -> Unit,
    onOpenStore: (StoreRow) -> Unit,
    onCloseStore: () -> Unit,
    onToggleFavorite: (String) -> Unit = {},
    onAddToCart: (MenuItemRow) -> Unit,
    onUpdateQty: (String, Int) -> Unit,
    onToggleCart: (Boolean) -> Unit,
    onSetDelivery: (String, Double?, Double?) -> Unit,
    onSaveAddress: () -> Unit = {},
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
    onAutocomplete: (String) -> Unit = {},
    onClearSuggestions: () -> Unit = {},
    onSelectSaved: (SavedAddressRow) -> Unit = {},
    onDeleteSaved: (String) -> Unit = {},
    onSaveProfile: (String, String) -> Unit = { _, _ -> },
    onCancelOrder: (OrderUi) -> Unit = {},
    onClearMessages: () -> Unit = {},
    onSpinWheel: () -> Unit = {},
    onOpenCard: (Int) -> Unit = {},
    onGameSelect: (String) -> Unit = {},
    onCardToggle: (Int, Boolean) -> Unit = { _, _ -> },
    onCardPrize: (Int, String) -> Unit = { _, _ -> },
    onToggleAdmin: (Boolean) -> Unit = {},
    onOpenSupport: () -> Unit = {},
    onCloseSupport: () -> Unit = {},
    onSelectSupportTopic: (String) -> Unit = {},
    onClearSupportTopic: () -> Unit = {},
    onSendLiveChat: (String) -> Unit = {},
    onShowMyTickets: () -> Unit = {},
    onOpenTicket: (com.freshdelivery.nativecustomer.data.SupportTicketRow) -> Unit = {},
    onSubmitTicket: (String) -> Unit = {},
    onSendTicket: (String) -> Unit = {},
) {
    val snackbar = remember { SnackbarHostState() }
    var addressOpen by remember { mutableStateOf(false) }
    LaunchedEffect(state.info, state.error) {
        val msg = state.error ?: state.info
        if (!msg.isNullOrBlank()) {
            snackbar.showSnackbar(msg)
            onClearMessages()
        }
    }
    BackHandler(enabled = addressOpen || state.showCart || state.selectedStore != null || state.adminOpen || state.supportOpen) {
        if (addressOpen) addressOpen = false
        else if (state.supportOpen) onCloseSupport()
        else if (state.adminOpen) onToggleAdmin(false)
        else if (state.showCart) onToggleCart(false)
        else onCloseStore()
    }
    if (addressOpen) {
        AddressPickerScreen(
            state = state,
            onBack = { addressOpen = false },
            onSetDelivery = onSetDelivery,
            onUseLocation = onUseLocation,
            onGeocode = onGeocode,
            onPickSuggestion = onPickSuggestion,
            onSaveAddress = onSaveAddress,
            onAutocomplete = onAutocomplete,
            onSelectSaved = onSelectSaved,
            onDeleteSaved = onDeleteSaved,
            snackbar = snackbar,
        )
        return
    }
    if (state.supportOpen) {
        SupportScreen(
            state = state,
            onBack = onCloseSupport,
            onSend = onSendLiveChat,
            onSelectTopic = onSelectSupportTopic,
            onClearTopic = onClearSupportTopic,
            onShowMyTickets = onShowMyTickets,
            onOpenTicket = onOpenTicket,
            onSubmitTicket = onSubmitTicket,
            onSendTicket = onSendTicket,
            snackbar = snackbar,
        )
        return
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
            isFavorite = state.favoriteStoreIds.contains(state.selectedStore.id),
            onToggleFavorite = { onToggleFavorite(state.selectedStore.id) },
        )
        return
    }
    if (state.adminOpen) {
        AdminPanel(
            state = state,
            onGameSelect = onGameSelect,
            onCardToggle = onCardToggle,
            onCardPrize = onCardPrize,
            onClose = { onToggleAdmin(false) },
            snackbar = snackbar,
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
        containerColor = FreshBg,
        snackbarHost = { SnackbarHost(snackbar) },
        bottomBar = {
            Column {
                if (state.cartCount > 0 && (state.tab == CustomerTab.Home || state.tab == CustomerTab.Browse)) {
                    FreshCartBar(
                        count = state.cartCount,
                        total = state.cartSubtotal,
                        onClick = { onToggleCart(true) },
                    )
                }
                NavigationBar(
                    containerColor = FreshSurface,
                    tonalElevation = 0.dp,
                    modifier = Modifier
                        .shadow(10.dp, RoundedCornerShape(topStart = 24.dp, topEnd = 24.dp))
                        .border(
                            width = 0.5.dp,
                            color = FreshDivider,
                            shape = RoundedCornerShape(topStart = 24.dp, topEnd = 24.dp),
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
                                selectedIconColor = FreshGreen,
                                selectedTextColor = FreshInk,
                                unselectedIconColor = FreshMuted,
                                unselectedTextColor = FreshMuted,
                                indicatorColor = FreshGreenSoft,
                            ),
                        )
                    }
                }
            }
        },
    ) { padding ->
        Box(Modifier.padding(padding).fillMaxSize()) {
            when (state.tab) {
                CustomerTab.Home -> HomeTab(
                    state, onOpenStore, onSearch,
                    browseMode = false,
                    onSpinWheel = onSpinWheel,
                    onOpenCard = onOpenCard,
                    onToggleAdmin = { onToggleAdmin(true) },
                    onEditAddress = { addressOpen = true; onClearSuggestions() },
                    onUseLocation = onUseLocation,
                )
                CustomerTab.Browse -> HomeTab(
                    state, onOpenStore, onSearch,
                    browseMode = true,
                    onSpinWheel = onSpinWheel,
                    onOpenCard = onOpenCard,
                    onToggleAdmin = { onToggleAdmin(true) },
                    onEditAddress = { addressOpen = true; onClearSuggestions() },
                    onUseLocation = onUseLocation,
                )
                CustomerTab.Orders -> OrdersTab(state, onTrack, onRefresh, onCancelOrder)
                CustomerTab.Track -> TrackTab(state)
                CustomerTab.Profile -> ProfileTab(state, onSaveProfile, onSignOut, onOpenSupport)
            }
        }
    }
}

@Composable
private fun FreshCartBar(count: Int, total: Double, onClick: () -> Unit) {
    Box(
        Modifier
            .fillMaxWidth()
            .padding(horizontal = 12.dp, vertical = 8.dp)
            .shadow(12.dp, RoundedCornerShape(20.dp))
            .clip(RoundedCornerShape(20.dp))
            .background(FreshGradient)
            .clickable(onClick = onClick),
    ) {
        Row(
            Modifier
                .fillMaxWidth()
                .padding(horizontal = 18.dp, vertical = 14.dp),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Box(
                    Modifier
                        .size(26.dp)
                        .clip(CircleShape)
                        .background(Color.White),
                    contentAlignment = Alignment.Center,
                ) {
                    Text(
                        "$count",
                        color = FreshGreen,
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
            .background(FreshChip),
        contentAlignment = Alignment.Center,
    ) {
        if (url.isNullOrBlank()) {
            Icon(
                Icons.Outlined.Store,
                contentDescription = null,
                tint = FreshMuted,
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
                        colors = listOf(Color.Transparent, Color.Black.copy(alpha = 0.18f)),
                    ),
                ),
        )
    }
}

@Composable
private fun HomeTab(
    state: CustomerUiState,
    onOpenStore: (StoreRow) -> Unit,
    onSearch: (String) -> Unit,
    browseMode: Boolean = false,
    onSpinWheel: () -> Unit = {},
    onOpenCard: (Int) -> Unit = {},
    onToggleAdmin: () -> Unit = {},
    onEditAddress: () -> Unit = {},
    onUseLocation: () -> Unit = {},
) {
    var filter by remember { mutableStateOf(HomeFilter.All) }
    val base = state.visibleStores
    val hasLocation = state.deliveryLat != null && state.deliveryLng != null
    val stores = remember(filter, base, hasLocation, state.favoriteStoreIds) {
        val open = base.filter { isStoreOpenNow(it) }
        val near = if (hasLocation) {
            base.sortedBy { storeDistanceKm(state.deliveryLat!!, state.deliveryLng!!, it) }
        } else base
        when (filter) {
            HomeFilter.All -> base
            HomeFilter.Open -> open
            HomeFilter.Near -> near
            HomeFilter.Fav -> base.filter { state.favoriteStoreIds.contains(it.id) }
        }
    }

    LazyColumn(
        modifier = Modifier
            .fillMaxSize()
            .background(FreshBg),
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
                    Box(
                        Modifier
                            .size(30.dp)
                            .clip(CircleShape)
                            .background(FreshGreenSoft),
                        contentAlignment = Alignment.Center,
                    ) {
                        Icon(
                            Icons.Outlined.LocationOn,
                            contentDescription = null,
                            tint = FreshGreen,
                            modifier = Modifier.size(16.dp),
                        )
                    }
                    Spacer(Modifier.width(8.dp))
                    Column(
                        Modifier
                            .weight(1f)
                            .clickable(onClick = onEditAddress),
                    ) {
                        Text(
                            "Παράδοση σε",
                            color = FreshMuted,
                            style = MaterialTheme.typography.labelMedium,
                        )
                        Text(
                            text = state.deliveryAddress.ifBlank { "Επίλεξε διεύθυνση" },
                            style = MaterialTheme.typography.titleMedium,
                            fontWeight = FontWeight.Bold,
                            maxLines = 1,
                            overflow = TextOverflow.Ellipsis,
                        )
                    }
                    IconButton(onClick = onUseLocation) {
                        Icon(Icons.Outlined.MyLocation, contentDescription = "Η τοποθεσία μου", tint = FreshGreen)
                    }
                    if (state.canManageGames) {
                        IconButton(onClick = onToggleAdmin) {
                            Icon(Icons.Outlined.Tune, contentDescription = "Διαχείριση παιχνιδιών", tint = FreshMuted)
                        }
                    }
                }
                Spacer(Modifier.height(12.dp))
                Box(
                    Modifier
                        .fillMaxWidth()
                        .shadow(4.dp, RoundedCornerShape(18.dp))
                        .clip(RoundedCornerShape(18.dp))
                        .background(Color.White),
                ) {
                    OutlinedTextField(
                        value = state.searchQuery,
                        onValueChange = onSearch,
                        singleLine = true,
                        leadingIcon = {
                            Icon(Icons.Outlined.Search, contentDescription = null, tint = FreshMuted)
                        },
                        trailingIcon = if (state.searchQuery.isNotEmpty()) {
                            {
                                IconButton(onClick = { onSearch("") }) {
                                    Icon(Icons.Outlined.Close, contentDescription = "Clear", tint = FreshMuted)
                                }
                            }
                        } else null,
                        placeholder = { Text("Αναζήτηση καταστημάτων", color = FreshMuted) },
                        modifier = Modifier.fillMaxWidth(),
                        shape = RoundedCornerShape(18.dp),
                        colors = OutlinedTextFieldDefaults.colors(
                            unfocusedContainerColor = Color.Transparent,
                            focusedContainerColor = Color.Transparent,
                            unfocusedBorderColor = Color.Transparent,
                            focusedBorderColor = Color.Transparent,
                            cursorColor = FreshGreen,
                        ),
                    )
                }
            }
        }
        item {
            Row(
                Modifier
                    .horizontalScroll(rememberScrollState())
                    .padding(horizontal = 16.dp, vertical = 8.dp),
                horizontalArrangement = Arrangement.spacedBy(8.dp),
            ) {
                FreshFilterChip("Όλα", selected = filter == HomeFilter.All) { filter = HomeFilter.All }
                FreshFilterChip("Ανοιχτά", selected = filter == HomeFilter.Open) { filter = HomeFilter.Open }
                FreshFilterChip("Κοντά μου", selected = filter == HomeFilter.Near) { filter = HomeFilter.Near }
                FreshFilterChip("Αγαπημένα", selected = filter == HomeFilter.Fav) { filter = HomeFilter.Fav }
            }
        }

        // Phase1: admin appConfig brand / promo / tiles
        state.appConfig.promos.firstOrNull()?.let { promo ->
            item {
                Box(
                    Modifier
                        .fillMaxWidth()
                        .padding(horizontal = 16.dp, vertical = 6.dp)
                        .shadow(10.dp, RoundedCornerShape(24.dp))
                        .clip(RoundedCornerShape(24.dp))
                        .background(FreshGradient),
                ) {
                    Row(Modifier.padding(18.dp), verticalAlignment = Alignment.CenterVertically) {
                        Box(
                            Modifier
                                .size(44.dp)
                                .clip(RoundedCornerShape(14.dp))
                                .background(Color.White.copy(alpha = 0.22f)),
                            contentAlignment = Alignment.Center,
                        ) {
                            Icon(Icons.Outlined.LocalOffer, contentDescription = null, tint = Color.White)
                        }
                        Spacer(Modifier.width(12.dp))
                        Column(Modifier.weight(1f)) {
                            Text(
                                promo.tag,
                                color = Color.White.copy(alpha = 0.85f),
                                fontWeight = FontWeight.Bold,
                                style = MaterialTheme.typography.labelMedium,
                            )
                            Text(
                                promo.title,
                                color = Color.White,
                                fontWeight = FontWeight.Bold,
                                style = MaterialTheme.typography.titleMedium,
                            )
                            Text(
                                promo.subtitle,
                                color = Color.White.copy(alpha = 0.8f),
                                style = MaterialTheme.typography.bodySmall,
                            )
                        }
                        if (promo.code.isNotBlank()) {
                            Surface(
                                color = Color.White,
                                shape = RoundedCornerShape(10.dp),
                            ) {
                                Text(
                                    promo.code,
                                    color = FreshGreenDark,
                                    fontWeight = FontWeight.Bold,
                                    modifier = Modifier.padding(horizontal = 10.dp, vertical = 6.dp),
                                )
                            }
                        }
                    }
                }
            }
        }
        item {
            Row(
                Modifier
                    .horizontalScroll(rememberScrollState())
                    .padding(horizontal = 16.dp, vertical = 8.dp),
                horizontalArrangement = Arrangement.spacedBy(14.dp),
            ) {
                val tiles = state.appConfig.tiles.ifEmpty {
                    listOf(
                        com.freshdelivery.nativecustomer.data.CategoryTile("Φαγητό", "🍔", "all"),
                        com.freshdelivery.nativecustomer.data.CategoryTile("Πίτσα", "🍕", "Πίτσες"),
                        com.freshdelivery.nativecustomer.data.CategoryTile("Καφές", "☕", "Καφέδες"),
                        com.freshdelivery.nativecustomer.data.CategoryTile("Γλυκά", "🍰", "Γλυκά"),
                    )
                }
                tiles.forEach { tile ->
                    Column(
                        horizontalAlignment = Alignment.CenterHorizontally,
                        modifier = Modifier
                            .clip(RoundedCornerShape(16.dp))
                            .clickable { onSearch(if (tile.category == "all") "" else tile.category) },
                    ) {
                        Box(
                            Modifier
                                .size(58.dp)
                                .shadow(4.dp, CircleShape)
                                .clip(CircleShape)
                                .background(Color.White),
                            contentAlignment = Alignment.Center,
                        ) {
                            Text(tile.emoji, fontSize = 26.sp)
                        }
                        Spacer(Modifier.height(6.dp))
                        Text(
                            tile.label,
                            style = MaterialTheme.typography.labelMedium,
                            color = FreshInk,
                            fontWeight = FontWeight.SemiBold,
                        )
                    }
                }
            }
        }
        if (state.gameShow) {
            item {
                when (state.gameActive) {
                    "wheel" -> LuckyWheelCard(state = state, onSpin = onSpinWheel)
                    else -> MysteryCardsSection(state = state, onOpenCard = onOpenCard)
                }
            }
        }
        item {
            Row(
                Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 16.dp)
                    .padding(top = 16.dp, bottom = 4.dp),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically,
            ) {
                val heading = when (filter) {
                    HomeFilter.All -> if (browseMode) "Όλα τα καταστήματα" else "Κοντά σου"
                    HomeFilter.Open -> "Ανοιχτά τώρα"
                    HomeFilter.Near -> "Κοντά μου"
                    HomeFilter.Fav -> "Αγαπημένα"
                }
                Text(heading, style = MaterialTheme.typography.titleLarge)
                Text(
                    "${stores.size} καταστήματα",
                    color = FreshMuted,
                    style = MaterialTheme.typography.bodySmall,
                )
            }
        }
        if (stores.isEmpty()) {
            item {
                Column(
                    Modifier
                        .fillMaxWidth()
                        .padding(32.dp),
                    horizontalAlignment = Alignment.CenterHorizontally,
                ) {
                    Icon(Icons.Outlined.Restaurant, contentDescription = null, tint = FreshMuted, modifier = Modifier.size(44.dp))
                    Spacer(Modifier.height(10.dp))
                    Text(
                        if (filter == HomeFilter.Near && !hasLocation) {
                            "Ορισμός διεύθυνσης για εγγύτητα"
                        } else if (filter == HomeFilter.Fav) {
                            "Δεν έχεις αγαπημένα ακόμα."
                        } else {
                            "Δεν βρέθηκαν καταστήματα."
                        },
                        color = FreshMuted,
                        style = MaterialTheme.typography.bodyMedium,
                    )
                }
            }
        }
        items(stores, key = { it.id }) { store ->
            FreshStoreCard(
                store = store,
                rating = state.storeRatings[store.id],
                isFavorite = state.favoriteStoreIds.contains(store.id),
                deliveryLat = state.deliveryLat,
                deliveryLng = state.deliveryLng,
                onClick = { onOpenStore(store) },
            )
        }
    }
}

@Composable
private fun FreshFilterChip(label: String, selected: Boolean, onClick: () -> Unit) {
    FilterChip(
        selected = selected,
        onClick = onClick,
        label = {
            Text(
                label,
                fontWeight = if (selected) FontWeight.Bold else FontWeight.Medium,
            )
        },
        shape = RoundedCornerShape(16.dp),
        colors = FilterChipDefaults.filterChipColors(
            selectedContainerColor = FreshGreen,
            selectedLabelColor = Color.White,
            containerColor = Color.White,
            labelColor = FreshInk,
        ),
        border = null,
    )
}

private enum class HomeFilter { All, Open, Near, Fav }

private const val EARTH_RADIUS_KM = 6371.0

private fun storeDistanceKm(lat: Double, lng: Double, store: StoreRow): Double {
    val slat = store.latitude ?: return Double.MAX_VALUE
    val slng = store.longitude ?: return Double.MAX_VALUE
    val dLat = Math.toRadians(slat - lat)
    val dLng = Math.toRadians(slng - lng)
    val a = sin(dLat / 2) * sin(dLat / 2) +
        cos(Math.toRadians(lat)) * cos(Math.toRadians(slat)) *
        sin(dLng / 2) * sin(dLng / 2)
    return EARTH_RADIUS_KM * 2 * atan2(sqrt(a), sqrt(1 - a))
}

/** A store is open if it has no holiday today and today's opening_hours window covers the current time. */
private fun isStoreOpenNow(store: StoreRow): Boolean {
    if (store.is_active == false) return false
    val today = LocalDate.now()
    val holidayDates = store.holiday_dates ?: emptyList()
    val dateKey = "%04d-%02d-%02d".format(today.year, today.monthValue, today.dayOfMonth)
    if (holidayDates.any { it.contains(dateKey) }) return false
    val hours = store.opening_hours ?: return true
    val now = LocalDateTime.now()
    val dayKey = when (now.dayOfWeek) {
        DayOfWeek.MONDAY -> "mon"
        DayOfWeek.TUESDAY -> "tue"
        DayOfWeek.WEDNESDAY -> "wed"
        DayOfWeek.THURSDAY -> "thu"
        DayOfWeek.FRIDAY -> "fri"
        DayOfWeek.SATURDAY -> "sat"
        DayOfWeek.SUNDAY -> "sun"
    }
    val schedule = hours.jsonObject[dayKey] ?: return true
    val obj = schedule.jsonObject
    val enabled = obj["enabled"]?.jsonPrimitive?.booleanOrNull ?: true
    if (!enabled) return false
    val open = obj["open"]?.jsonPrimitive?.contentOrNull ?: return true
    val close = obj["close"]?.jsonPrimitive?.contentOrNull ?: return true
    fun toMin(v: String): Int? {
        val hhmm = v.trim().split(":")
        if (hhmm.size != 2) return null
        return hhmm[0].toIntOrNull()?.times(60)?.plus(hhmm[1].toIntOrNull() ?: 0)
    }
    val openMin = toMin(open) ?: return true
    val closeMin = toMin(close) ?: return true
    val minuteOfDay = now.hour * 60 + now.minute
    return if (closeMin > openMin) minuteOfDay in openMin until closeMin else minuteOfDay >= openMin || minuteOfDay < closeMin
}

private fun storeDeliveryEstimate(store: StoreRow, deliveryLat: Double?, deliveryLng: Double?): String {
    if (deliveryLat == null || deliveryLng == null) return "25–35'"
    val km = storeDistanceKm(deliveryLat, deliveryLng, store)
    if (km == Double.MAX_VALUE) return "25–35'"
    val minutes = (18 + km * 4).toInt().coerceIn(20, 75)
    return "${minutes - 5}–${minutes + 5}'"
}

@Composable
private fun FreshStoreCard(
    store: StoreRow,
    onClick: () -> Unit,
    rating: StoreRating? = null,
    isFavorite: Boolean = false,
    deliveryLat: Double? = null,
    deliveryLng: Double? = null,
) {
    val openNow = isStoreOpenNow(store)
    val active = store.is_active != false
    Column(
        Modifier
            .fillMaxWidth()
            .padding(horizontal = 16.dp, vertical = 8.dp)
            .shadow(6.dp, RoundedCornerShape(22.dp))
            .clip(RoundedCornerShape(22.dp))
            .background(Color.White)
            .clickable(onClick = onClick),
    ) {
        Box(Modifier.fillMaxWidth().height(160.dp)) {
            StoreHeroImage(store.image_url, height = 160)
            Surface(
                color = if (!active || !openNow) {
                    Color.Black.copy(alpha = 0.65f)
                } else {
                    Color.White.copy(alpha = 0.92f)
                },
                shape = RoundedCornerShape(10.dp),
                modifier = Modifier
                    .align(Alignment.TopStart)
                    .padding(10.dp),
            ) {
                Text(
                    if (!active) "Κλειστό" else if (openNow) "Ανοιχτό" else "Κλειστό",
                    color = if (!active || !openNow) Color.White else FreshGreenDark,
                    fontWeight = FontWeight.Bold,
                    style = MaterialTheme.typography.labelMedium,
                    modifier = Modifier.padding(horizontal = 10.dp, vertical = 5.dp),
                )
            }
            Surface(
                color = Color.White.copy(alpha = 0.92f),
                shape = RoundedCornerShape(10.dp),
                modifier = Modifier
                    .align(Alignment.TopEnd)
                    .padding(10.dp),
            ) {
                if (isFavorite) {
                    Icon(
                        Icons.Filled.Favorite,
                        contentDescription = null,
                        tint = FreshRose,
                        modifier = Modifier.padding(horizontal = 8.dp, vertical = 6.dp),
                    )
                }
            }
            Surface(
                color = Color.White.copy(alpha = 0.92f),
                shape = RoundedCornerShape(10.dp),
                modifier = Modifier
                    .align(Alignment.BottomEnd)
                    .padding(10.dp),
            ) {
                Row(
                    Modifier.padding(horizontal = 10.dp, vertical = 5.dp),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Icon(Icons.Outlined.Star, contentDescription = null, tint = FreshAmber, modifier = Modifier.size(13.dp))
                    Spacer(Modifier.width(4.dp))
                    val avg = rating?.avg ?: 0.0
                    val count = rating?.count ?: 0
                    Text(
                        if (count > 0) "%.1f".format(avg) else "Νέο",
                        color = FreshInk,
                        fontWeight = FontWeight.Bold,
                        style = MaterialTheme.typography.labelMedium,
                    )
                }
            }
        }
        Column(Modifier.padding(14.dp)) {
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
                    color = FreshMuted,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                )
            }
            Spacer(Modifier.height(10.dp))
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalAlignment = Alignment.CenterVertically) {
                FreshMetaPill {
                    Icon(Icons.Outlined.Timer, contentDescription = null, tint = FreshMuted, modifier = Modifier.size(14.dp))
                    Spacer(Modifier.width(4.dp))
                    Text(
                        storeDeliveryEstimate(store, deliveryLat, deliveryLng),
                        color = FreshInk,
                        fontWeight = FontWeight.SemiBold,
                    )
                }
                FreshMetaPill {
                    Icon(Icons.Outlined.DirectionsBike, contentDescription = null, tint = FreshMuted, modifier = Modifier.size(14.dp))
                    Spacer(Modifier.width(4.dp))
                    Text("Παράδοση", color = FreshInk, fontWeight = FontWeight.SemiBold)
                }
                Spacer(Modifier.weight(1f))
                Icon(Icons.Outlined.ChevronRight, contentDescription = null, tint = FreshMuted)
            }
        }
    }
}

@Composable
private fun FreshMetaPill(content: @Composable RowScope.() -> Unit) {
    Surface(
        color = FreshChip,
        shape = RoundedCornerShape(10.dp),
    ) {
        Row(
            Modifier.padding(horizontal = 10.dp, vertical = 6.dp),
            verticalAlignment = Alignment.CenterVertically,
            content = content,
        )
    }
}

@Composable
private fun MenuScreen(
    state: CustomerUiState,
    onBack: () -> Unit,
    onAdd: (MenuItemRow) -> Unit,
    onOpenCart: () -> Unit,
    isFavorite: Boolean = false,
    onToggleFavorite: () -> Unit = {},
) {
    val store = state.selectedStore
    Box(Modifier.fillMaxSize().background(FreshBg)) {
        LazyColumn(Modifier.fillMaxSize()) {
            item {
                Box {
                    StoreHeroImage(store?.image_url, height = 250)
                    Box(
                        Modifier
                            .fillMaxSize()
                            .background(
                                Brush.verticalGradient(
                                    listOf(
                                        Color.Transparent,
                                        Color.Black.copy(alpha = 0.55f),
                                    ),
                                    startY = 120f,
                                ),
                            ),
                    )
                    IconButton(
                        onClick = onBack,
                        modifier = Modifier
                            .statusBarsPadding()
                            .padding(8.dp)
                            .shadow(6.dp, CircleShape)
                            .background(Color.White, CircleShape),
                    ) {
                        Icon(Icons.AutoMirrored.Outlined.ArrowBack, contentDescription = "Back", tint = FreshInk)
                    }
                    Column(
                        Modifier
                            .align(Alignment.BottomStart)
                            .statusBarsPadding()
                            .padding(16.dp),
                    ) {
                        Text(
                            store?.name ?: "Μενού",
                            style = MaterialTheme.typography.headlineMedium,
                            color = Color.White,
                        )
                        store?.address?.let {
                            Text(it, color = Color.White.copy(alpha = 0.85f), style = MaterialTheme.typography.bodyMedium)
                        }
                        Spacer(Modifier.height(8.dp))
                        Surface(
                            color = Color.White.copy(alpha = 0.22f),
                            shape = RoundedCornerShape(10.dp),
                        ) {
                            Text(
                                "${state.menu.size} προϊόντα",
                                color = Color.White,
                                fontWeight = FontWeight.SemiBold,
                                style = MaterialTheme.typography.labelMedium,
                                modifier = Modifier.padding(horizontal = 10.dp, vertical = 5.dp),
                            )
                        }
                    }
                }
            }
            item {
                Row(
                    Modifier
                        .fillMaxWidth()
                        .padding(horizontal = 16.dp, vertical = 14.dp),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Icon(Icons.Outlined.RestaurantMenu, contentDescription = null, tint = FreshGreen, modifier = Modifier.size(18.dp))
                    Spacer(Modifier.width(8.dp))
                    Text("Μενού", style = MaterialTheme.typography.titleLarge)
                    Spacer(Modifier.weight(1f))
                    TextButton(onClick = onToggleFavorite) {
                        Icon(
                            if (isFavorite) Icons.Filled.Favorite else Icons.Outlined.FavoriteBorder,
                            contentDescription = null,
                            tint = if (isFavorite) FreshRose else FreshMuted,
                            modifier = Modifier.size(18.dp),
                        )
                        Spacer(Modifier.width(4.dp))
                        Text(
                            if (isFavorite) "Αγαπημένο" else "Αγαπημένα",
                            color = if (isFavorite) FreshRose else FreshMuted,
                        )
                    }
                }
            }
            if (state.busy) {
                item {
                    Box(
                        Modifier
                            .fillMaxWidth()
                            .padding(40.dp),
                        contentAlignment = Alignment.Center,
                    ) {
                        CircularProgressIndicator(color = FreshGreen)
                    }
                }
            } else {
                items(state.menu, key = { it.id }) { item ->
                    FreshMenuRow(item = item, onAdd = { onAdd(item) })
                    Spacer(Modifier.height(6.dp))
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
                FreshCartBar(
                    count = state.cartCount,
                    total = state.cartSubtotal,
                    onClick = onOpenCart,
                )
            }
        }
    }
}

@Composable
private fun FreshMenuRow(item: MenuItemRow, onAdd: () -> Unit) {
    Row(
        Modifier
            .fillMaxWidth()
            .padding(horizontal = 16.dp, vertical = 8.dp)
            .shadow(3.dp, RoundedCornerShape(20.dp))
            .clip(RoundedCornerShape(20.dp))
            .background(Color.White)
            .clickable(onClick = onAdd)
            .padding(12.dp),
        horizontalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        Column(Modifier.weight(1f)) {
            Text(item.name, fontWeight = FontWeight.Bold, style = MaterialTheme.typography.titleMedium)
            item.description?.takeIf { it.isNotBlank() }?.let {
                Spacer(Modifier.height(4.dp))
                Text(
                    it,
                    style = MaterialTheme.typography.bodySmall,
                    color = FreshMuted,
                    maxLines = 2,
                    overflow = TextOverflow.Ellipsis,
                )
            }
            Spacer(Modifier.height(8.dp))
            Text(
                "€" + "%.2f".format(item.price),
                fontWeight = FontWeight.Bold,
                color = FreshGreenDark,
            )
        }
        Box {
            Box(
                Modifier
                    .size(96.dp)
                    .clip(RoundedCornerShape(16.dp))
                    .background(FreshChip),
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
                    Icon(Icons.Outlined.ShoppingBag, null, tint = FreshMuted)
                }
            }
            Box(
                Modifier
                    .align(Alignment.BottomEnd)
                    .padding(4.dp)
                    .size(32.dp)
                    .shadow(4.dp, CircleShape)
                    .clip(CircleShape)
                    .background(FreshGradient)
                    .clickable(onClick = onAdd),
                contentAlignment = Alignment.Center,
            ) {
                Icon(Icons.Outlined.Add, contentDescription = "Add", tint = Color.White, modifier = Modifier.size(20.dp))
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
        focusedBorderColor = FreshGreen,
        focusedLabelColor = FreshGreen,
        cursorColor = FreshGreen,
    )
    Column(
        Modifier
            .fillMaxSize()
            .background(FreshBg)
            .statusBarsPadding(),
    ) {
        SnackbarHost(snackbar)
        Row(
            Modifier
                .fillMaxWidth()
                .padding(horizontal = 8.dp, vertical = 4.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            IconButton(onClick = onBack) {
                Icon(Icons.AutoMirrored.Outlined.ArrowBack, contentDescription = "Back", tint = FreshInk)
            }
            Text(
                "Καλάθι",
                style = MaterialTheme.typography.titleLarge,
                modifier = Modifier.weight(1f),
            )
            Surface(
                color = FreshGreenSoft,
                shape = RoundedCornerShape(10.dp),
            ) {
                Text(
                    state.cartStoreName ?: "",
                    color = FreshGreenDark,
                    fontWeight = FontWeight.SemiBold,
                    style = MaterialTheme.typography.labelMedium,
                    modifier = Modifier.padding(horizontal = 10.dp, vertical = 5.dp),
                )
            }
        }
        LazyColumn(
            Modifier
                .weight(1f)
                .padding(horizontal = 16.dp),
            verticalArrangement = Arrangement.spacedBy(10.dp),
        ) {
            item {
                Text("Τα αντικείμενά σου", fontWeight = FontWeight.Bold, style = MaterialTheme.typography.titleMedium, modifier = Modifier.padding(top = 8.dp))
            }
            items(state.cart, key = { it.menuItemId }) { line ->
                Row(
                    Modifier
                        .fillMaxWidth()
                        .shadow(3.dp, RoundedCornerShape(18.dp))
                        .clip(RoundedCornerShape(18.dp))
                        .background(Color.White)
                        .padding(horizontal = 14.dp, vertical = 12.dp),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Column(Modifier.weight(1f)) {
                        Text(line.name, fontWeight = FontWeight.SemiBold)
                        Text(
                            "€" + "%.2f".format(line.price * line.quantity),
                            color = FreshGreenDark,
                            fontWeight = FontWeight.Bold,
                            style = MaterialTheme.typography.bodySmall,
                        )
                    }
                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        modifier = Modifier
                            .clip(RoundedCornerShape(20.dp))
                            .background(FreshChip)
                            .padding(horizontal = 4.dp),
                    ) {
                        IconButton(
                            onClick = { onUpdateQty(line.menuItemId, line.quantity - 1) },
                            modifier = Modifier.size(34.dp),
                        ) {
                            Icon(Icons.Outlined.Remove, contentDescription = "-", tint = FreshGreen)
                        }
                        Text("${line.quantity}", fontWeight = FontWeight.Bold, modifier = Modifier.width(22.dp), textAlign = androidx.compose.ui.text.style.TextAlign.Center)
                        IconButton(
                            onClick = { onUpdateQty(line.menuItemId, line.quantity + 1) },
                            modifier = Modifier.size(34.dp),
                        ) {
                            Icon(Icons.Outlined.Add, contentDescription = "+", tint = FreshGreen)
                        }
                    }
                }
            }
            item {
                Column(
                    Modifier
                        .fillMaxWidth()
                        .padding(vertical = 6.dp),
                ) {
                    Text("Διεύθυνση παράδοσης", fontWeight = FontWeight.Bold, style = MaterialTheme.typography.titleMedium)
                    Spacer(Modifier.height(8.dp))
                    OutlinedTextField(
                        value = address,
                        onValueChange = {
                            address = it
                            onSetDelivery(it, null, null)
                        },
                        modifier = Modifier.fillMaxWidth(),
                        singleLine = true,
                        label = { Text("Οδός, αριθμός, πόλη") },
                        leadingIcon = { Icon(Icons.Outlined.LocationOn, contentDescription = null, tint = FreshMuted) },
                        shape = RoundedCornerShape(16.dp),
                        colors = fieldColors,
                    )
                    Spacer(Modifier.height(10.dp))
                    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        Button(
                            onClick = onUseLocation,
                            enabled = !state.locating,
                            modifier = Modifier.weight(1f),
                            colors = ButtonDefaults.buttonColors(containerColor = FreshGreen),
                            shape = RoundedCornerShape(16.dp),
                        ) {
                            Icon(Icons.Outlined.MyLocation, contentDescription = null)
                            Spacer(Modifier.width(6.dp))
                            Text("Η τοποθεσία μου")
                        }
                        OutlinedButton(
                            onClick = { onGeocode(address) },
                            enabled = !state.locating && address.isNotBlank(),
                            modifier = Modifier.weight(1f),
                            shape = RoundedCornerShape(16.dp),
                        ) {
                            Text("Εύρεση")
                        }
                    }
                    if (state.locating) {
                        Spacer(Modifier.height(6.dp))
                        LinearProgressIndicator(
                            modifier = Modifier.fillMaxWidth(),
                            color = FreshGreen,
                        )
                    }
                    val pinned = state.deliveryLat != null && state.deliveryLng != null
                    Spacer(Modifier.height(6.dp))
                    Text(
                        if (pinned) {
                            "Σημείο: %.5f, %.5f".format(state.deliveryLat, state.deliveryLng)
                        } else {
                            "Χωρίς σημείο στον χάρτη — πάτα τοποθεσία ή εύρεση."
                        },
                        style = MaterialTheme.typography.bodySmall,
                        color = if (pinned) FreshGreen else MaterialTheme.colorScheme.error,
                    )
                    if (state.addressSuggestions.isNotEmpty()) {
                        Spacer(Modifier.height(8.dp))
                        Text("Προτάσεις", fontWeight = FontWeight.SemiBold)
                        state.addressSuggestions.forEach { s ->
                            Surface(
                                onClick = { onPickSuggestion(s) },
                                color = FreshChip,
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
            }
            item {
                Column(
                    Modifier
                        .fillMaxWidth()
                        .shadow(3.dp, RoundedCornerShape(18.dp))
                        .clip(RoundedCornerShape(18.dp))
                        .background(Color.White)
                        .padding(14.dp),
                ) {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Icon(Icons.Outlined.Notifications, contentDescription = null, tint = FreshViolet, modifier = Modifier.size(18.dp))
                        Spacer(Modifier.width(8.dp))
                        Text("Σημειώσεις για τον οδηγό", fontWeight = FontWeight.SemiBold)
                    }
                    Spacer(Modifier.height(8.dp))
                    OutlinedTextField(
                        value = state.notes,
                        onValueChange = onSetNotes,
                        placeholder = { Text("π.χ. Χτύπα το κουδούνι") },
                        modifier = Modifier.fillMaxWidth(),
                        shape = RoundedCornerShape(14.dp),
                        colors = fieldColors,
                    )
                    Spacer(Modifier.height(10.dp))
                    OutlinedTextField(
                        value = tipText,
                        onValueChange = {
                            tipText = it
                            onSetTip(it.toDoubleOrNull() ?: 0.0)
                        },
                        label = { Text("Φιλοδώρημα (€)") },
                        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Decimal),
                        modifier = Modifier.fillMaxWidth(),
                        shape = RoundedCornerShape(14.dp),
                        colors = fieldColors,
                    )
                }
            }
            item {
                Column(Modifier.fillMaxWidth()) {
                    Text("Πληρωμή", fontWeight = FontWeight.Bold, style = MaterialTheme.typography.titleMedium)
                    Spacer(Modifier.height(8.dp))
                    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        Button(
                            onClick = { onSetPayment("cash") },
                            enabled = state.paymentMethod != "cash",
                            colors = ButtonDefaults.buttonColors(
                                containerColor = if (state.paymentMethod == "cash") FreshGreen else FreshChip,
                                contentColor = if (state.paymentMethod == "cash") Color.White else FreshInk,
                            ),
                            shape = RoundedCornerShape(16.dp),
                            modifier = Modifier.weight(1f),
                        ) {
                            Icon(Icons.Outlined.Wallet, contentDescription = null)
                            Spacer(Modifier.width(6.dp))
                            Text("Μετρητά")
                        }
                        Button(
                            onClick = {},
                            enabled = false,
                            colors = ButtonDefaults.buttonColors(
                                containerColor = FreshChip,
                                contentColor = FreshMuted,
                            ),
                            shape = RoundedCornerShape(16.dp),
                            modifier = Modifier.weight(1f),
                        ) {
                            Icon(Icons.Outlined.CreditCard, contentDescription = null)
                            Spacer(Modifier.width(6.dp))
                            Text("Κάρτα (σύντομα)")
                        }
                    }
                }
            }
            item {
                Column(
                    Modifier
                        .fillMaxWidth()
                        .padding(vertical = 6.dp),
                ) {
                    SummaryLine("Υποσύνολο", state.cartSubtotal)
                    val feeNote = if (state.feePerKm > 0 && state.deliveryLat != null) {
                        "βάση €" + "%.2f".format(state.feeBase) + " + €" + "%.2f".format(state.feePerKm) + "/km"
                    } else null
                    SummaryLine(
                        "Παράδοση" + (if (feeNote != null) " ($feeNote)" else ""),
                        state.deliveryFee,
                    )
                    SummaryLine("Φιλοδώρημα", state.tipAmount)
                    state.appliedDeal?.let { deal ->
                        Row(
                            Modifier
                                .fillMaxWidth()
                                .padding(vertical = 3.dp),
                            horizontalArrangement = Arrangement.SpaceBetween,
                        ) {
                            Text(
                                "Καλή τύχη · ${deal.label}",
                                color = FreshGreenDark,
                                fontWeight = FontWeight.Bold,
                                fontSize = 13.sp,
                            )
                            Text(
                                "−€" + "%.2f".format(state.gameDiscount),
                                color = FreshRose,
                                fontWeight = FontWeight.Bold,
                                fontSize = 13.sp,
                            )
                        }
                    }
                    HorizontalDivider(
                        Modifier.padding(vertical = 8.dp),
                        color = FreshDivider,
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
                            color = FreshGreenDark,
                        )
                    }
                    if (!state.error.isNullOrBlank()) {
                        Text(state.error!!, color = MaterialTheme.colorScheme.error)
                    }
                    Spacer(Modifier.height(16.dp))
                    Box(
                        Modifier
                            .fillMaxWidth()
                            .height(58.dp)
                            .shadow(12.dp, RoundedCornerShape(29.dp))
                            .clip(RoundedCornerShape(29.dp))
                            .background(if (state.busy || state.cart.isEmpty() || address.isBlank()) FreshChipGradient else FreshGradient)
                            .clickable(
                                enabled = !state.busy && state.cart.isNotEmpty() && address.isNotBlank(),
                                onClick = onPlaceOrder,
                            ),
                        contentAlignment = Alignment.Center,
                    ) {
                        if (state.busy) {
                            CircularProgressIndicator(color = Color.White, modifier = Modifier.size(24.dp))
                        } else {
                            Text(
                                "Τοποθέτηση παραγγελίας · €" + "%.2f".format(state.grandTotal),
                                fontWeight = FontWeight.Bold,
                                color = if (state.cart.isEmpty() || address.isBlank()) FreshMuted else Color.White,
                            )
                        }
                    }
                    Spacer(Modifier.height(32.dp))
                }
            }
        }
    }
}

@Composable
private fun AddressPickerScreen(
    state: CustomerUiState,
    onBack: () -> Unit,
    onSetDelivery: (String, Double?, Double?) -> Unit,
    onUseLocation: () -> Unit,
    onGeocode: (String) -> Unit,
    onPickSuggestion: (AddressSuggestion) -> Unit,
    onSaveAddress: () -> Unit,
    onAutocomplete: (String) -> Unit = {},
    onSelectSaved: (SavedAddressRow) -> Unit = {},
    onDeleteSaved: (String) -> Unit = {},
    snackbar: SnackbarHostState? = null,
) {
    var address by remember(state.deliveryAddress) { mutableStateOf(state.deliveryAddress) }
    val fieldColors = OutlinedTextFieldDefaults.colors(
        focusedBorderColor = FreshGreen,
        focusedLabelColor = FreshGreen,
        cursorColor = FreshGreen,
    )
    Column(
        Modifier
            .fillMaxSize()
            .background(FreshBg)
            .statusBarsPadding(),
    ) {
        if (snackbar != null) {
            SnackbarHost(snackbar)
        }
        Row(
            Modifier
                .fillMaxWidth()
                .padding(horizontal = 8.dp, vertical = 4.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            IconButton(onClick = onBack) {
                Icon(Icons.AutoMirrored.Outlined.ArrowBack, contentDescription = "Back", tint = FreshInk)
            }
            Text(
                "Διεύθυνση παράδοσης",
                style = MaterialTheme.typography.titleLarge,
                modifier = Modifier.weight(1f),
            )
        }
        Column(
            Modifier
                .fillMaxWidth()
                .verticalScroll(rememberScrollState())
                .padding(horizontal = 16.dp, vertical = 8.dp),
        ) {
            OutlinedTextField(
                value = address,
                onValueChange = {
                    address = it
                    onAutocomplete(it)
                },
                modifier = Modifier.fillMaxWidth(),
                singleLine = true,
                label = { Text("Οδός, αριθμός, πόλη") },
                leadingIcon = { Icon(Icons.Outlined.LocationOn, contentDescription = null, tint = FreshMuted) },
                shape = RoundedCornerShape(16.dp),
                colors = fieldColors,
            )
            if (state.savedAddresses.isNotEmpty()) {
                Spacer(Modifier.height(12.dp))
                Text("Αποθηκευμένες διευθύνσεις", fontWeight = FontWeight.Bold, style = MaterialTheme.typography.titleSmall)
                state.savedAddresses.forEach { sa ->
                    Surface(
                        onClick = {
                            onSelectSaved(sa)
                            onBack()
                        },
                        color = if (sa.is_default == true) FreshGreenSoft else FreshChip,
                        shape = RoundedCornerShape(12.dp),
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(top = 6.dp),
                    ) {
                        Row(
                            Modifier.padding(start = 12.dp, top = 4.dp, bottom = 4.dp, end = 4.dp),
                            verticalAlignment = Alignment.CenterVertically,
                        ) {
                            Icon(
                                Icons.Outlined.LocationOn,
                                contentDescription = null,
                                tint = FreshGreen,
                                modifier = Modifier.size(18.dp),
                            )
                            Spacer(Modifier.width(8.dp))
                            Column(Modifier.weight(1f)) {
                                Text(
                                    (sa.label ?: "Σπίτι").ifBlank { "Σπίτι" },
                                    fontWeight = FontWeight.SemiBold,
                                    style = MaterialTheme.typography.bodySmall,
                                )
                                Text(
                                    sa.address,
                                    style = MaterialTheme.typography.bodySmall,
                                    color = FreshMuted,
                                    maxLines = 1,
                                    overflow = TextOverflow.Ellipsis,
                                )
                            }
                            IconButton(onClick = { onDeleteSaved(sa.id) }) {
                                Icon(Icons.Outlined.Delete, contentDescription = "Διαγραφή", tint = FreshRose)
                            }
                        }
                    }
                }
            }
            Spacer(Modifier.height(10.dp))
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                Button(
                    onClick = onUseLocation,
                    enabled = !state.locating,
                    modifier = Modifier.weight(1f),
                    colors = ButtonDefaults.buttonColors(containerColor = FreshGreen),
                    shape = RoundedCornerShape(16.dp),
                ) {
                    Icon(Icons.Outlined.MyLocation, contentDescription = null)
                    Spacer(Modifier.width(6.dp))
                    Text("Η τοποθεσία μου")
                }
                OutlinedButton(
                    onClick = { onGeocode(address) },
                    enabled = !state.locating && address.isNotBlank(),
                    modifier = Modifier.weight(1f),
                    shape = RoundedCornerShape(16.dp),
                ) {
                    Text("Εύρεση")
                }
            }
            if (state.locating) {
                Spacer(Modifier.height(6.dp))
                LinearProgressIndicator(
                    modifier = Modifier.fillMaxWidth(),
                    color = FreshGreen,
                )
            }
            val pinned = state.deliveryLat != null && state.deliveryLng != null
            Spacer(Modifier.height(6.dp))
            Text(
                if (pinned) {
                    "Σημείο: %.5f, %.5f".format(state.deliveryLat, state.deliveryLng)
                } else {
                    "Χωρίς σημείο στον χάρτη — πάτα τοποθεσία ή εύρεση."
                },
                style = MaterialTheme.typography.bodySmall,
                color = if (pinned) FreshGreen else MaterialTheme.colorScheme.error,
            )
            if (state.addressSuggestions.isNotEmpty()) {
                Spacer(Modifier.height(8.dp))
                Text("Προτάσεις", fontWeight = FontWeight.SemiBold)
                state.addressSuggestions.forEach { s ->
                    Surface(
                        onClick = {
                            onPickSuggestion(s)
                            onSaveAddress()
                            onBack()
                        },
                        color = FreshChip,
                        shape = RoundedCornerShape(12.dp),
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(top = 6.dp),
                    ) {
                        Text(s.label, modifier = Modifier.padding(12.dp))
                    }
                }
            }
            Spacer(Modifier.height(16.dp))
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                if (state.deliveryAddress.isNotBlank()) {
                    OutlinedButton(
                        onClick = {
                            onSetDelivery("", null, null)
                            onSaveAddress()
                            onBack()
                        },
                        modifier = Modifier.weight(1f),
                        shape = RoundedCornerShape(16.dp),
                    ) {
                        Text("Καθαρισμός")
                    }
                }
                Button(
                    onClick = {
                        val committed = address.trim()
                        val keepCoords = committed == state.deliveryAddress
                        onSetDelivery(
                            committed,
                            if (keepCoords) state.deliveryLat else null,
                            if (keepCoords) state.deliveryLng else null,
                        )
                        onSaveAddress()
                        onBack()
                    },
                    enabled = address.isNotBlank(),
                    modifier = Modifier.weight(1f),
                    colors = ButtonDefaults.buttonColors(containerColor = FreshGreen),
                    shape = RoundedCornerShape(16.dp),
                ) {
                    Text("Αποθήκευση")
                }
            }
            Spacer(Modifier.height(32.dp))
        }
    }
}

@Composable
private fun SummaryLine(label: String, amount: Double) {
    Row(
        Modifier
            .fillMaxWidth()
            .padding(vertical = 3.dp),
        horizontalArrangement = Arrangement.SpaceBetween,
    ) {
        Text(label, color = FreshMuted)
        Text("€" + "%.2f".format(amount), fontWeight = FontWeight.SemiBold)
    }
}

private fun statusLabel(status: String): String = when (status) {
    "placed" -> "Καταχωρήθηκε"
    "pending" -> "Σε αναμονή"
    "accepted", "confirmed" -> "Αποδεκτή"
    "preparing" -> "Ετοιμάζεται"
    "ready" -> "Έτοιμη"
    "picked_up", "on_the_way", "in_transit" -> "Καθ' οδόν"
    "delivered" -> "Παραδόθηκε"
    "cancelled" -> "Ακυρώθηκε"
    "rejected" -> "Απορρίφθηκε"
    "refunded" -> "Επιστροφή χρημάτων"
    else -> status
}

private fun statusColors(status: String): Pair<Color, Color> = when {
    status in listOf("pending", "accepted", "confirmed", "preparing", "ready", "picked_up", "on_the_way", "in_transit") ->
        FreshVioletSoft to FreshViolet
    status == "delivered" -> FreshGreenSoft to FreshGreenDark
    status in listOf("cancelled", "rejected", "refunded") -> FreshRoseSoft to FreshRose
    else -> FreshChip to FreshInk
}

@Composable
private fun StatusPill(status: String) {
    val (bg, fg) = statusColors(status)
    Surface(
        color = bg,
        shape = RoundedCornerShape(10.dp),
    ) {
        Text(
            statusLabel(status),
            color = fg,
            fontWeight = FontWeight.Bold,
            style = MaterialTheme.typography.labelMedium,
            modifier = Modifier.padding(horizontal = 10.dp, vertical = 5.dp),
        )
    }
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
            .background(FreshBg)
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
                IconButton(
                    onClick = onRefresh,
                    modifier = Modifier
                        .size(40.dp)
                        .clip(RoundedCornerShape(14.dp))
                        .background(Color.White)
                        .shadow(3.dp, RoundedCornerShape(14.dp)),
                ) {
                    Icon(Icons.Outlined.Receipt, contentDescription = "Ανανέωση", tint = FreshGreen)
                }
            }
        }
        if (state.orders.isEmpty()) {
            item {
                Column(
                    Modifier
                        .fillMaxWidth()
                        .padding(32.dp),
                    horizontalAlignment = Alignment.CenterHorizontally,
                ) {
                    Icon(Icons.Outlined.Receipt, contentDescription = null, tint = FreshMuted, modifier = Modifier.size(44.dp))
                    Spacer(Modifier.height(10.dp))
                    Text("Δεν υπάρχουν παραγγελίες ακόμα.", color = FreshMuted, style = MaterialTheme.typography.bodyMedium)
                    Spacer(Modifier.height(6.dp))
                    Text("Παράγγειλε από ένα κατάστημα για να εμφανιστούν εδώ.", color = FreshMuted, style = MaterialTheme.typography.bodySmall)
                }
            }
        }
        items(state.orders, key = { it.order.id }) { item ->
            Column(
                Modifier
                    .fillMaxWidth()
                    .padding(vertical = 6.dp)
                    .shadow(4.dp, RoundedCornerShape(20.dp))
                    .clip(RoundedCornerShape(20.dp))
                    .background(Color.White)
                    .clickable { onTrack(item) }
                    .padding(16.dp),
            ) {
                Row(
                    Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Row(Modifier.weight(1f), verticalAlignment = Alignment.CenterVertically) {
                        Box(
                            Modifier
                                .size(40.dp)
                                .clip(RoundedCornerShape(12.dp))
                                .background(FreshGreenSoft),
                            contentAlignment = Alignment.Center,
                        ) {
                            Icon(Icons.Outlined.Restaurant, contentDescription = null, tint = FreshGreen, modifier = Modifier.size(20.dp))
                        }
                        Spacer(Modifier.width(10.dp))
                        Column {
                            Text(
                                item.storeName ?: "Κατάστημα",
                                fontWeight = FontWeight.Bold,
                            )
                            item.order.delivery_address?.let {
                                Text(it, style = MaterialTheme.typography.bodySmall, color = FreshMuted, maxLines = 1, overflow = TextOverflow.Ellipsis)
                            }
                        }
                    }
                    item.order.store_order_number?.let {
                        Text("#%04d".format(it), color = FreshGreen, fontWeight = FontWeight.Bold)
                    }
                }
                Spacer(Modifier.height(12.dp))
                Row(verticalAlignment = Alignment.CenterVertically) {
                    StatusPill(item.order.status)
                    Spacer(Modifier.weight(1f))
                    item.order.total_amount?.let {
                        Text("€" + "%.2f".format(it), fontWeight = FontWeight.Bold, style = MaterialTheme.typography.titleMedium)
                    }
                }
                HorizontalDivider(Modifier.padding(vertical = 12.dp), color = FreshDivider)
                Row {
                    Button(
                        onClick = { onTrack(item) },
                        colors = ButtonDefaults.buttonColors(containerColor = FreshGreen),
                        shape = RoundedCornerShape(14.dp),
                        modifier = Modifier.weight(1f),
                    ) {
                        Icon(Icons.Outlined.Map, contentDescription = null, modifier = Modifier.size(16.dp))
                        Spacer(Modifier.width(6.dp))
                        Text("Παρακολούθηση", fontWeight = FontWeight.Bold)
                    }
                }
            }
        }
    }
}

@Composable
private fun TrackTab(state: CustomerUiState) {
    val order = state.trackingOrder

    // Live driver pin + store + delivery pin. Order in the list also picks
    // the map center: store → delivery → driver.
    val markers = buildList {
        order?.storeLat?.let { lat ->
            order.storeLng?.let { lng ->
                add(MapMarker(lat, lng, order.storeName ?: "Κατάστημα", "#F97316"))
            }
        }
        order?.order?.delivery_latitude?.let { lat ->
            order.order.delivery_longitude?.let { lng ->
                add(MapMarker(lat, lng, "Παράδοση", "#10B981"))
            }
        }
        state.driverLocation?.let { d ->
            add(MapMarker(d.latitude, d.longitude, "Οδηγός", "#7C6CFF"))
        }
    }
    val centerLat = markers.firstOrNull()?.lat ?: 39.6650
    val centerLng = markers.firstOrNull()?.lng ?: 20.8537
    Column(Modifier.fillMaxSize().background(FreshBg)) {
        Box(
            Modifier
                .fillMaxWidth()
                .weight(1f)
                .clip(RoundedCornerShape(bottomStart = 28.dp, bottomEnd = 28.dp)),
        ) {
            MapboxView(
                modifier = Modifier.fillMaxSize(),
                centerLat = centerLat,
                centerLng = centerLng,
                markers = markers,
            )
        }
        Column(
            Modifier
                .fillMaxWidth()
                .navigationBarsPadding()
                .padding(16.dp),
        ) {
            if (order == null) {
                Text(
                    "Επίλεξε παραγγελία από Παραγγελίες για live tracking.",
                    color = FreshMuted,
                )
            } else {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Column(Modifier.weight(1f)) {
                        Text(
                            order.storeName ?: "Παραγγελία",
                            style = MaterialTheme.typography.titleLarge,
                        )
                        order.order.delivery_address?.let {
                            Text(it, color = FreshMuted, style = MaterialTheme.typography.bodySmall, maxLines = 1, overflow = TextOverflow.Ellipsis)
                        }
                    }
                    StatusPill(order.order.status)
                }
                Spacer(Modifier.height(14.dp))
                Surface(
                    color = if (state.driverLocation != null) FreshGreenSoft else FreshVioletSoft,
                    shape = RoundedCornerShape(18.dp),
                    modifier = Modifier.fillMaxWidth(),
                ) {
                    Row(Modifier.padding(14.dp), verticalAlignment = Alignment.CenterVertically) {
                        Icon(
                            Icons.Outlined.DirectionsBike,
                            contentDescription = null,
                            tint = if (state.driverLocation != null) FreshGreen else FreshViolet,
                        )
                        Spacer(Modifier.width(10.dp))
                        Text(
                            when {
                                state.driverLocation != null -> "Ο οδηγός κινείται προς εσένα."
                                !order.order.driver_id.isNullOrBlank() -> "Αναμονή θέσης οδηγού…"
                                else -> "Δεν έχει ανατεθεί οδηγός ακόμα."
                            },
                            color = FreshInk,
                            fontWeight = FontWeight.SemiBold,
                            style = MaterialTheme.typography.bodyMedium,
                        )
                    }
                }
            }
        }
    }
}

@Composable
private fun ProfileTab(
    state: CustomerUiState,
    onSaveProfile: (String, String) -> Unit,
    onSignOut: () -> Unit,
    onOpenSupport: () -> Unit = {},
) {
    var fullName by remember(state.profile?.full_name) {
        mutableStateOf(state.profile?.full_name ?: "")
    }
    var phone by remember(state.profile?.phone) {
        mutableStateOf(state.profile?.phone ?: "")
    }
    val fieldColors = OutlinedTextFieldDefaults.colors(
        focusedBorderColor = FreshGreen,
        focusedLabelColor = FreshGreen,
        cursorColor = FreshGreen,
    )
    Column(
        Modifier
            .fillMaxSize()
            .background(FreshBg)
            .statusBarsPadding()
            .padding(horizontal = 16.dp),
    ) {
        Text(
            "Λογαριασμός",
            style = MaterialTheme.typography.headlineMedium,
            modifier = Modifier.padding(vertical = 12.dp),
        )
        Column(
            Modifier
                .fillMaxWidth()
                .shadow(4.dp, RoundedCornerShape(22.dp))
                .clip(RoundedCornerShape(22.dp))
                .background(Color.White)
                .padding(16.dp),
        ) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Box(
                    Modifier
                        .size(56.dp)
                        .shadow(6.dp, CircleShape)
                        .clip(CircleShape)
                        .background(FreshGradient),
                    contentAlignment = Alignment.Center,
                ) {
                    Icon(Icons.Outlined.AccountCircle, contentDescription = null, tint = Color.White, modifier = Modifier.size(30.dp))
                }
                Spacer(Modifier.width(14.dp))
                Column(Modifier.weight(1f)) {
                    Text(
                        fullName.ifBlank { "Φίλος του Fresh" },
                        style = MaterialTheme.typography.titleLarge,
                    )
                    Text(
                        state.profile?.phone?.ifBlank { "Κατάστημα αγαπημένο: ${state.orders.size}" } ?: "Καλησπέρα! 👋",
                        color = FreshMuted,
                        style = MaterialTheme.typography.bodySmall,
                    )
                }
            }
            Spacer(Modifier.height(16.dp))
            HorizontalDivider(color = FreshDivider)
            Spacer(Modifier.height(12.dp))
            Row(verticalAlignment = Alignment.CenterVertically) {
                Icon(Icons.Outlined.Receipt, contentDescription = null, tint = FreshGreen, modifier = Modifier.size(18.dp))
                Spacer(Modifier.width(8.dp))
                Text("Παραγγελίες: ${state.orders.size}", color = FreshInk, fontWeight = FontWeight.SemiBold)
                Spacer(Modifier.weight(1f))
                Icon(Icons.Outlined.Notifications, contentDescription = null, tint = FreshViolet, modifier = Modifier.size(18.dp))
                Spacer(Modifier.width(8.dp))
                Text("Push: ενεργές", color = FreshMuted)
            }
        }
        Spacer(Modifier.height(14.dp))
        Row(
            Modifier
                .fillMaxWidth()
                .shadow(4.dp, RoundedCornerShape(22.dp))
                .clip(RoundedCornerShape(22.dp))
                .background(Color.White)
                .clickable(onClick = onOpenSupport)
                .padding(16.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Box(
                Modifier
                    .size(44.dp)
                    .background(FreshGreenSoft, RoundedCornerShape(14.dp)),
                contentAlignment = Alignment.Center,
            ) {
                Icon(Icons.Outlined.Headset, contentDescription = null, tint = FreshGreen, modifier = Modifier.size(22.dp))
            }
            Spacer(Modifier.width(12.dp))
            Column(Modifier.weight(1f)) {
                Text("Βοήθεια & Υποστήριξη", fontWeight = FontWeight.Bold, style = MaterialTheme.typography.titleMedium)
                Text("Live chat με την ομάδα μας — 24/7", color = FreshMuted, style = MaterialTheme.typography.bodySmall)
            }
            Icon(Icons.Outlined.ChevronRight, contentDescription = null, tint = FreshMuted)
        }
        Spacer(Modifier.height(20.dp))
        Column(
            Modifier
                .fillMaxWidth()
                .shadow(4.dp, RoundedCornerShape(22.dp))
                .clip(RoundedCornerShape(22.dp))
                .background(Color.White)
                .padding(16.dp),
        ) {
            Text("Στοιχεία προφίλ", fontWeight = FontWeight.Bold, style = MaterialTheme.typography.titleMedium)
            Spacer(Modifier.height(12.dp))
            OutlinedTextField(
                value = fullName,
                onValueChange = { fullName = it },
                label = { Text("Ονοματεπώνυμο") },
                singleLine = true,
                modifier = Modifier.fillMaxWidth(),
                shape = RoundedCornerShape(14.dp),
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
                shape = RoundedCornerShape(14.dp),
                colors = fieldColors,
            )
            Spacer(Modifier.height(16.dp))
            Button(
                onClick = { onSaveProfile(fullName, phone) },
                enabled = !state.savingProfile && fullName.isNotBlank(),
                modifier = Modifier
                    .fillMaxWidth()
                    .height(52.dp)
                    .shadow(8.dp, RoundedCornerShape(26.dp)),
                shape = RoundedCornerShape(26.dp),
                colors = ButtonDefaults.buttonColors(containerColor = FreshGreen),
            ) {
                if (state.savingProfile) CircularProgressIndicator(color = Color.White, modifier = Modifier.size(22.dp))
                else Text("Αποθήκευση", fontWeight = FontWeight.Bold)
            }
        }
        Spacer(Modifier.weight(1f))
        OutlinedButton(
            onClick = onSignOut,
            modifier = Modifier
                .fillMaxWidth()
                .height(48.dp)
                .navigationBarsPadding()
                .padding(bottom = 8.dp),
            shape = RoundedCornerShape(24.dp),
            colors = ButtonDefaults.outlinedButtonColors(contentColor = FreshRose),
            border = androidx.compose.foundation.BorderStroke(1.dp, FreshRose),
        ) {
            Icon(Icons.Outlined.Logout, contentDescription = null, modifier = Modifier.size(18.dp))
            Spacer(Modifier.width(6.dp))
            Text("Αποσύνδεση", fontWeight = FontWeight.SemiBold)
        }
        Spacer(Modifier.height(12.dp))
    }
}
