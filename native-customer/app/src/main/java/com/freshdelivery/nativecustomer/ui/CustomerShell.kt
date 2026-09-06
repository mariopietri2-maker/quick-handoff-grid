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
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.outlined.ArrowBack
import androidx.compose.material.icons.filled.Favorite
import androidx.compose.material.icons.outlined.AccountCircle
import androidx.compose.material.icons.outlined.Add
import androidx.compose.material.icons.outlined.ChevronRight
import androidx.compose.material.icons.outlined.Close
import androidx.compose.material.icons.outlined.CreditCard
import androidx.compose.material.icons.filled.Favorite
import androidx.compose.material.icons.outlined.Delete
import androidx.compose.material.icons.outlined.DirectionsBike
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
import androidx.compose.runtime.mutableStateMapOf
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.material3.AlertDialog
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
import androidx.compose.ui.text.style.TextAlign
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

/** Parses a CSS HSL triplet like "24 100% 62%" into (accent, accentDark) — mirrors web `customer-theme.ts`. */
private fun hslTriplet(value: String?): Pair<Color, Color>? {
    val parts = value?.trim()?.split(Regex("[\\s,]+")) ?: return null
    if (parts.size < 3) return null
    val h = parts[0].toFloatOrNull() ?: return null
    val s = parts[1].removeSuffix("%").toFloatOrNull()?.div(100f) ?: return null
    val l = parts[2].removeSuffix("%").toFloatOrNull()?.div(100f) ?: return null
    val accent = Color.hsl(h, s.coerceIn(0f, 1f), l.coerceIn(0f, 1f))
    val dark = Color.hsl(h, s.coerceIn(0f, 1f), (l - 0.11f).coerceIn(0f, 1f))
    return accent to dark
}

@Composable
fun CustomerShell(
    state: CustomerUiState,
    onTab: (CustomerTab) -> Unit,
    onOpenStore: (StoreRow) -> Unit,
    onCloseStore: () -> Unit,
    onToggleFavorite: (String) -> Unit = {},
    onAddToCart: (MenuItemRow) -> Unit,
    onConfirmModifiers: (MenuItemRow, List<com.freshdelivery.nativecustomer.data.MenuModifierRow>) -> Unit = { _, _ -> },
    onDismissModifiers: () -> Unit = {},
    onSubmitReview: (String, String, Int, String) -> Unit = { _, _, _, _ -> },
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
    onAddressQuery: (String) -> Unit = {},
    onPickSuggestion: (AddressSuggestion) -> Unit = {},
    onClearSuggestions: () -> Unit = {},
    onSelectSaved: (SavedAddressRow) -> Unit = {},
    onDeleteSaved: (String) -> Unit = {},
    onSaveProfile: (String, String) -> Unit = { _, _ -> },
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
            onSaveAddress = onSaveAddress,
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

    state.modifierPickerItem?.let { item ->
        ModifierPickerDialog(
            item = item,
            modifiers = state.menuModifiers[item.id].orEmpty(),
            onDismiss = onDismissModifiers,
            onConfirm = { selected -> onConfirmModifiers(item, selected) },
        )
    }

    Scaffold(
        containerColor = FreshBg,
        snackbarHost = { SnackbarHost(snackbar) },
        bottomBar = {
            Column {
                if (state.cartCount > 0 && (state.tab == CustomerTab.Home || state.tab == CustomerTab.Browse)) {
                    FreshCartBar(
                        count = state.cartCount,
                        total = state.cartSubtotal,
                        minOrder = (state.stores.find { it.id == state.cartStoreId } ?: state.selectedStore)?.min_order_amount ?: 0.0,
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
                    onTab = onTab,
                    onOpenCart = { onToggleCart(true) },
                )
                CustomerTab.Browse -> HomeTab(
                    state, onOpenStore, onSearch,
                    browseMode = true,
                    onSpinWheel = onSpinWheel,
                    onOpenCard = onOpenCard,
                    onToggleAdmin = { onToggleAdmin(true) },
                    onEditAddress = { addressOpen = true; onClearSuggestions() },
                    onUseLocation = onUseLocation,
                    onTab = onTab,
                    onOpenCart = { onToggleCart(true) },
                )
                CustomerTab.Orders -> OrdersTab(state, onTrack, onRefresh, onSubmitReview)
                CustomerTab.Track -> TrackTab(state)
                CustomerTab.Profile -> ProfileTab(state, onSaveProfile, onSignOut, onOpenSupport)
            }
        }
    }
}

@Composable
private fun FreshCartBar(
    count: Int,
    total: Double,
    onClick: () -> Unit,
    minOrder: Double = 0.0,
) {
    val needMore = minOrder > 0 && total < minOrder
    val progress = if (minOrder > 0) (total / minOrder).toFloat().coerceIn(0f, 1f) else 1f
    Column(
        Modifier
            .fillMaxWidth()
            .padding(horizontal = 12.dp, vertical = 8.dp),
    ) {
        if (needMore) {
            Surface(
                color = Color.White,
                shape = RoundedCornerShape(14.dp),
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(bottom = 8.dp)
                    .shadow(4.dp, RoundedCornerShape(14.dp)),
            ) {
                Column(Modifier.padding(horizontal = 14.dp, vertical = 10.dp)) {
                    Text(
                        "Ακόμα €%.2f για ελάχιστη παραγγελία".format(minOrder - total),
                        color = FreshInk,
                        fontWeight = FontWeight.SemiBold,
                        style = MaterialTheme.typography.labelLarge,
                    )
                    Spacer(Modifier.height(6.dp))
                    Box(
                        Modifier
                            .fillMaxWidth()
                            .height(6.dp)
                            .clip(RoundedCornerShape(3.dp))
                            .background(FreshChip),
                    ) {
                        Box(
                            Modifier
                                .fillMaxWidth(progress)
                                .height(6.dp)
                                .clip(RoundedCornerShape(3.dp))
                                .background(FreshGreen),
                        )
                    }
                }
            }
        }
        Box(
            Modifier
                .fillMaxWidth()
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
                        if (needMore) "Συνέχεια παραγγελίας" else "Προβολή καλαθιού",
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
    onTab: (com.freshdelivery.nativecustomer.data.CustomerTab) -> Unit = {},
    onOpenCart: () -> Unit = {},
) {
    var filter by remember {
        mutableStateOf(
            if (state.deliveryLat != null && state.deliveryLng != null) HomeFilter.Near else HomeFilter.All,
        )
    }
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
            HomeFilter.Deals -> base.filter { !it.promo_badge.isNullOrBlank() || it.covers_delivery_fee == true }
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
                // Competitor-style header: NO logo on top — address + basket + profile only.
                // Brand row intentionally removed (was gated by showHeaderBrand).
                Row(verticalAlignment = Alignment.CenterVertically) {
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
                            text = (state.deliveryAddress.ifBlank { state.appConfig.cityLabel }) + " ⌄",
                            style = MaterialTheme.typography.titleMedium,
                            fontWeight = FontWeight.Bold,
                            maxLines = 1,
                            overflow = TextOverflow.Ellipsis,
                        )
                    }
                    // Basket with count badge (competitor top-right)
                    Box(contentAlignment = Alignment.TopEnd) {
                        IconButton(onClick = onOpenCart) {
                            Icon(Icons.Outlined.ShoppingBag, contentDescription = "Καλάθι", tint = FreshInk)
                        }
                        if (state.cartCount > 0) {
                            Surface(
                                color = Color(0xFF22C55E),
                                shape = CircleShape,
                                modifier = Modifier.padding(top = 6.dp, end = 6.dp),
                            ) {
                                Text(
                                    text = if (state.cartCount > 9) "9+" else "${state.cartCount}",
                                    color = Color.White,
                                    fontWeight = FontWeight.Bold,
                                    fontSize = 10.sp,
                                    modifier = Modifier.padding(horizontal = 5.dp, vertical = 1.dp),
                                )
                            }
                        }
                    }
                    IconButton(onClick = { onTab(com.freshdelivery.nativecustomer.data.CustomerTab.Profile) }) {
                        Icon(Icons.Outlined.AccountCircle, contentDescription = "Λογαριασμός", tint = FreshInk)
                    }
                    if (state.canManageGames) {
                        IconButton(onClick = onToggleAdmin) {
                            Icon(Icons.Outlined.Tune, contentDescription = "Διαχείριση παιχνιδιών", tint = FreshMuted)
                        }
                    }
                }
                // Slim location row under header (keeps GPS one-tap without clutter)
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    modifier = Modifier.clickable(onClick = onUseLocation),
                ) {
                    Icon(
                        Icons.Outlined.MyLocation,
                        contentDescription = null,
                        tint = FreshGreen,
                        modifier = Modifier.size(14.dp),
                    )
                    Spacer(Modifier.width(4.dp))
                    Text(
                        "Χρήση τρέχουσας τοποθεσίας",
                        color = FreshMuted,
                        style = MaterialTheme.typography.labelSmall,
                    )
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
                        placeholder = { Text("Πίτσα, σουβλάκι, καφές…", color = FreshMuted) },
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
                FreshFilterChip("Προσφορές", selected = filter == HomeFilter.Deals) { filter = HomeFilter.Deals }
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
                val rawTiles = state.appConfig.tiles.ifEmpty {
                    listOf(
                        com.freshdelivery.nativecustomer.data.CategoryTile("Φαγητό", "🍔", "all"),
                        com.freshdelivery.nativecustomer.data.CategoryTile("Πίτσα", "🍕", "Πίτσες"),
                        com.freshdelivery.nativecustomer.data.CategoryTile("Καφές", "☕", "Καφέδες"),
                        com.freshdelivery.nativecustomer.data.CategoryTile("Γλυκά", "🍰", "Γλυκά"),
                    )
                }
                // Food-only launch: hide retail verticals until showRetailVerticals=true.
                val retailLabels = setOf(
                    "supermarkets", "super-markets", "super markets",
                    "καταστήματα", "καταστηματα", "takeaway", "take-away",
                    "mini market", "mini-market", "minimarket",
                )
                val tiles = if (state.appConfig.showRetailVerticals) rawTiles
                else rawTiles.filter { it.label.trim().lowercase() !in retailLabels }
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

        val recentStores = remember(state.orders, state.stores) {
            val ids = state.orders.map { it.order.store_id }.distinct().take(8)
            ids.mapNotNull { id -> state.stores.find { it.id == id } }
        }
        if (recentStores.isNotEmpty()) {
            item {
                DiscoverSectionHeader(title = "Παράγγειλε ξανά", action = null, onAction = {})
            }
            item {
                Row(
                    Modifier
                        .horizontalScroll(rememberScrollState())
                        .padding(horizontal = 16.dp, vertical = 4.dp),
                    horizontalArrangement = Arrangement.spacedBy(10.dp),
                ) {
                    recentStores.forEach { store ->
                        StoreMiniCard(
                            store = store,
                            rating = state.storeRatings[store.id],
                            deliveryLat = state.deliveryLat,
                            deliveryLng = state.deliveryLng,
                            onClick = { onOpenStore(store) },
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
        // Fresh2GO discovery rails (efood density, own style)
        if (stores.isNotEmpty()) {
            val freeDelivery = stores.filter { it.covers_delivery_fee == true }.ifEmpty {
                stores.filter { (it.delivery_fee ?: 0.0) <= 0.0 }
            }
            val withOffers = stores.filter { !it.promo_badge.isNullOrBlank() }
            val nearFirst = if (hasLocation) {
                stores.sortedBy { storeDistanceKm(state.deliveryLat!!, state.deliveryLng!!, it) }
            } else stores

            if (withOffers.isNotEmpty()) {
                item {
                    DiscoverSectionHeader(title = "Προσφορές τώρα", action = "Όλες ›") {
                        filter = HomeFilter.Deals; onSearch("")
                    }
                }
                item {
                    Row(
                        Modifier
                            .horizontalScroll(rememberScrollState())
                            .padding(horizontal = 16.dp, vertical = 4.dp),
                        horizontalArrangement = Arrangement.spacedBy(10.dp),
                    ) {
                        withOffers.take(10).forEach { store ->
                            StoreMiniCard(
                                store = store,
                                rating = state.storeRatings[store.id],
                                deliveryLat = state.deliveryLat,
                                deliveryLng = state.deliveryLng,
                                onClick = { onOpenStore(store) },
                            )
                        }
                    }
                }
            }

            if (freeDelivery.isNotEmpty()) {
                item {
                    DiscoverSectionHeader(title = "Δωρεάν delivery", action = "Δες τα όλα ›") {
                        filter = HomeFilter.Deals; onSearch("")
                    }
                }
                item {
                    Row(
                        Modifier
                            .horizontalScroll(rememberScrollState())
                            .padding(horizontal = 16.dp, vertical = 4.dp),
                        horizontalArrangement = Arrangement.spacedBy(10.dp),
                    ) {
                        freeDelivery.take(10).forEach { store ->
                            StoreMiniCard(
                                store = store,
                                rating = state.storeRatings[store.id],
                                deliveryLat = state.deliveryLat,
                                deliveryLng = state.deliveryLng,
                                onClick = { onOpenStore(store) },
                            )
                        }
                    }
                }
            }

            item {
                DiscoverSectionHeader(title = "Κοντά σου", action = null, onAction = {})
            }
            item {
                Row(
                    Modifier
                        .horizontalScroll(rememberScrollState())
                        .padding(horizontal = 16.dp, vertical = 4.dp),
                    horizontalArrangement = Arrangement.spacedBy(10.dp),
                ) {
                    nearFirst.take(8).forEach { store ->
                        StoreMiniCard(
                            store = store,
                            rating = state.storeRatings[store.id],
                            deliveryLat = state.deliveryLat,
                            deliveryLng = state.deliveryLng,
                            onClick = { onOpenStore(store) },
                        )
                    }
                }
            }

            item {
                DiscoverSectionHeader(title = "Τι θα φας σήμερα;", action = null, onAction = {})
            }
            item {
                val cuisineHints = listOf(
                    "Σουβλάκι" to "🥙",
                    "Πίτσα" to "🍕",
                    "Burger" to "🍔",
                    "Κρέπα" to "🥞",
                    "Καφές" to "☕",
                    "Γλυκό" to "🍰",
                    "Σαλάτα" to "🥗",
                    "Ζυμαρικά" to "🍝",
                )
                Row(
                    Modifier
                        .horizontalScroll(rememberScrollState())
                        .padding(horizontal = 16.dp, vertical = 4.dp),
                    horizontalArrangement = Arrangement.spacedBy(14.dp),
                ) {
                    cuisineHints.forEach { (label, emoji) ->
                        Column(
                            horizontalAlignment = Alignment.CenterHorizontally,
                            modifier = Modifier.clickable { onSearch(label) },
                        ) {
                            Box(
                                Modifier
                                    .size(56.dp)
                                    .shadow(3.dp, CircleShape)
                                    .clip(CircleShape)
                                    .background(Color.White),
                                contentAlignment = Alignment.Center,
                            ) { Text(emoji, fontSize = 26.sp) }
                            Spacer(Modifier.height(4.dp))
                            Text(label, style = MaterialTheme.typography.labelMedium, color = FreshInk, fontWeight = FontWeight.SemiBold)
                        }
                    }
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
                    HomeFilter.All -> if (browseMode) "Όλα τα καταστήματα" else "Για σένα"
                    HomeFilter.Open -> "Ανοιχτά τώρα"
                    HomeFilter.Near -> "Κοντά σου"
                    HomeFilter.Deals -> "Προσφορές & δωρεάν delivery"
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

private enum class HomeFilter { All, Open, Near, Fav, Deals }

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

/** A store is open if the owner didn't force an override and it has no holiday
 *  today and today's opening_hours window covers the current time. */
private fun isStoreOpenNow(store: StoreRow): Boolean {
    if (store.is_active == false) return false
    when (store.status_override) {
        "open" -> return true
        "closed" -> return false
    }
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


private fun storeDeliveryFeeLabel(store: StoreRow): String {
    if (store.covers_delivery_fee == true) return "Δωρεάν delivery"
    val fee = store.delivery_fee
    return if (fee != null && fee > 0.0) {
        val s = if (fee % 1.0 == 0.0) fee.toInt().toString() else "%.1f".format(fee)
        "€$s delivery"
    } else {
        "Delivery"
    }
}

private fun storeDistanceLabel(store: StoreRow, deliveryLat: Double?, deliveryLng: Double?): String? {
    if (deliveryLat == null || deliveryLng == null) return null
    val km = storeDistanceKm(deliveryLat, deliveryLng, store)
    if (km == Double.MAX_VALUE) return null
    return if (km < 1.0) "${(km * 1000).toInt()} m" else "%.1f km".format(km)
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
            StoreHeroImage(store.cover_image_url?.takeIf { it.isNotBlank() } ?: store.image_url, height = 160)
            Surface(
                color = if (!active || !openNow) {
                    Color.Black.copy(alpha = 0.70f)
                } else {
                    FreshGreen
                },
                shape = RoundedCornerShape(10.dp),
                modifier = Modifier
                    .align(Alignment.TopStart)
                    .padding(10.dp),
            ) {
                Row(
                    Modifier.padding(horizontal = 10.dp, vertical = 5.dp),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    if (active && openNow) {
                        Box(
                            Modifier
                                .size(6.dp)
                                .clip(CircleShape)
                                .background(Color.White),
                        )
                        Spacer(Modifier.width(5.dp))
                    }
                    Text(
                        if (!active) "Κλειστό" else if (openNow) "Ανοιχτό" else "Κλειστό",
                        color = Color.White,
                        fontWeight = FontWeight.Bold,
                        style = MaterialTheme.typography.labelMedium,
                    )
                }
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
            val badge = store.promo_badge?.trim().orEmpty()
            if (badge.isNotEmpty()) {
                Surface(
                    color = FreshGreen,
                    shape = RoundedCornerShape(10.dp),
                    modifier = Modifier
                        .align(Alignment.BottomStart)
                        .padding(10.dp),
                ) {
                    Text(
                        badge,
                        color = Color.White,
                        fontWeight = FontWeight.Bold,
                        style = MaterialTheme.typography.labelMedium,
                        modifier = Modifier.padding(horizontal = 10.dp, vertical = 5.dp),
                        maxLines = 1,
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
            Row(verticalAlignment = Alignment.CenterVertically) {
                Text(
                    store.name ?: "Κατάστημα",
                    style = MaterialTheme.typography.titleLarge,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                    modifier = Modifier.weight(1f),
                )
                store.promo_badge?.takeIf { it.isNotBlank() }?.let {
                    Spacer(Modifier.width(6.dp))
                    Surface(color = FreshGreen, shape = RoundedCornerShape(8.dp)) {
                        Text(
                            it, color = Color.White, fontWeight = FontWeight.Bold,
                            style = MaterialTheme.typography.labelSmall,
                            modifier = Modifier.padding(horizontal = 8.dp, vertical = 4.dp),
                        )
                    }
                }
            }
            (store.tagline?.takeIf { it.isNotBlank() } ?: store.address)?.let {
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
                // Prep/flight estimate — highlighted chip
                Surface(
                    color = FreshGreenSoft,
                    shape = RoundedCornerShape(12.dp),
                ) {
                    Row(
                        Modifier.padding(horizontal = 10.dp, vertical = 6.dp),
                        verticalAlignment = Alignment.CenterVertically,
                    ) {
                        Icon(Icons.Outlined.Timer, contentDescription = null, tint = FreshGreenDark, modifier = Modifier.size(14.dp))
                        Spacer(Modifier.width(4.dp))
                        Text(
                            storeDeliveryEstimate(store, deliveryLat, deliveryLng),
                            color = FreshGreenDark,
                            fontWeight = FontWeight.Bold,
                            style = MaterialTheme.typography.labelMedium,
                        )
                    }
                }
                storeDistanceLabel(store, deliveryLat, deliveryLng)?.let { dist ->
                    Surface(
                        color = FreshChip,
                        shape = RoundedCornerShape(12.dp),
                    ) {
                        Text(
                            dist,
                            color = FreshMuted,
                            fontWeight = FontWeight.SemiBold,
                            style = MaterialTheme.typography.labelMedium,
                            modifier = Modifier.padding(horizontal = 10.dp, vertical = 6.dp),
                        )
                    }
                }
                Surface(
                    color = if (store.covers_delivery_fee == true) FreshGreenSoft else FreshChip,
                    shape = RoundedCornerShape(12.dp),
                ) {
                    Text(
                        storeDeliveryFeeLabel(store),
                        color = if (store.covers_delivery_fee == true) FreshGreenDark else FreshMuted,
                        fontWeight = FontWeight.Bold,
                        style = MaterialTheme.typography.labelMedium,
                        modifier = Modifier.padding(horizontal = 10.dp, vertical = 6.dp),
                    )
                }
                val minOrd = store.min_order_amount ?: 0.0
                if (minOrd > 0) {
                    Surface(
                        color = FreshChip,
                        shape = RoundedCornerShape(12.dp),
                    ) {
                        Text(
                            "Ελάχ. €%.0f".format(minOrd),
                            color = FreshMuted,
                            fontWeight = FontWeight.Bold,
                            style = MaterialTheme.typography.labelMedium,
                            modifier = Modifier.padding(horizontal = 10.dp, vertical = 6.dp),
                        )
                    }
                }
                val platformDelivers = (store.fulfilment_mode ?: "platform") != "store"
                if (platformDelivers) {
                    Surface(
                        color = FreshGreenSoft,
                        shape = RoundedCornerShape(12.dp),
                    ) {
                        Row(
                            Modifier.padding(horizontal = 10.dp, vertical = 6.dp),
                            verticalAlignment = Alignment.CenterVertically,
                        ) {
                            Icon(Icons.Outlined.DirectionsBike, contentDescription = null, tint = FreshGreen, modifier = Modifier.size(14.dp))
                            Spacer(Modifier.width(4.dp))
                            Text(
                                "Παράδοση Fresh2GO",
                                color = FreshGreenDark,
                                fontWeight = FontWeight.Bold,
                                style = MaterialTheme.typography.labelMedium,
                            )
                        }
                    }
                } else {
                    Surface(
                        color = FreshVioletSoft,
                        shape = RoundedCornerShape(12.dp),
                    ) {
                        Row(
                            Modifier.padding(horizontal = 10.dp, vertical = 6.dp),
                            verticalAlignment = Alignment.CenterVertically,
                        ) {
                            Icon(Icons.Outlined.Store, contentDescription = null, tint = FreshViolet, modifier = Modifier.size(14.dp))
                            Spacer(Modifier.width(4.dp))
                            Text(
                                "Παράδοση καταστήματος",
                                color = FreshViolet,
                                fontWeight = FontWeight.Bold,
                                style = MaterialTheme.typography.labelMedium,
                            )
                        }
                    }
                }
                Spacer(Modifier.weight(1f))
                Icon(Icons.Outlined.ChevronRight, contentDescription = null, tint = FreshMuted)
            }
        }
    }
}

@Composable
private fun DiscoverSectionHeader(title: String, action: String?, onAction: () -> Unit = {}) {
    Row(
        Modifier
            .fillMaxWidth()
            .padding(horizontal = 16.dp)
            .padding(top = 14.dp, bottom = 2.dp),
        horizontalArrangement = Arrangement.SpaceBetween,
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Text(title, style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold)
        if (action != null) {
            Text(
                action,
                color = FreshGreen,
                style = MaterialTheme.typography.labelLarge,
                fontWeight = FontWeight.Bold,
                modifier = Modifier.clickable(onClick = onAction),
            )
        }
    }
}

@Composable
private fun StoreMiniCard(
    store: StoreRow,
    onClick: () -> Unit,
    rating: StoreRating? = null,
    deliveryLat: Double? = null,
    deliveryLng: Double? = null,
) {
    Column(
        Modifier
            .width(160.dp)
            .shadow(4.dp, RoundedCornerShape(16.dp))
            .clip(RoundedCornerShape(16.dp))
            .background(Color.White)
            .clickable(onClick = onClick),
    ) {
        Box(Modifier.fillMaxWidth().height(84.dp)) {
            StoreHeroImage(store.cover_image_url?.takeIf { it.isNotBlank() } ?: store.image_url, height = 84)
            Surface(
                color = Color.White.copy(alpha = 0.92f),
                shape = RoundedCornerShape(8.dp),
                modifier = Modifier.align(Alignment.BottomEnd).padding(6.dp),
            ) {
                Row(Modifier.padding(horizontal = 7.dp, vertical = 3.dp)) {
                    Icon(Icons.Outlined.Star, contentDescription = null, tint = FreshAmber, modifier = Modifier.size(11.dp))
                    Spacer(Modifier.width(3.dp))
                    Text(
                        if ((rating?.count ?: 0) > 0) "%.1f".format(rating!!.avg) else "Νέο",
                        style = MaterialTheme.typography.labelSmall,
                        fontWeight = FontWeight.Bold,
                    )
                }
            }
        }
        Column(Modifier.padding(8.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Text(store.name ?: "Κατάστημα", fontWeight = FontWeight.Bold, fontSize = 12.sp, maxLines = 1, overflow = TextOverflow.Ellipsis, modifier = Modifier.weight(1f))
                store.promo_badge?.takeIf { it.isNotBlank() }?.let {
                    Surface(color = FreshGreen, shape = RoundedCornerShape(6.dp)) {
                        Text(it, color = Color.White, fontWeight = FontWeight.Bold, fontSize = 9.sp, modifier = Modifier.padding(horizontal = 5.dp, vertical = 2.dp))
                    }
                }
            }
            Text(
                buildString {
                append(storeDeliveryEstimate(store, deliveryLat, deliveryLng))
                storeDistanceLabel(store, deliveryLat, deliveryLng)?.let { append(" • "); append(it) }
                    val minO = store.min_order_amount ?: 0.0
                    if (minO > 0) append(" • Ελάχ. €%.0f".format(minO))
            },
                color = FreshMuted, fontSize = 11.sp, maxLines = 1, overflow = TextOverflow.Ellipsis,
            )
            Surface(color = FreshGreenSoft, shape = RoundedCornerShape(8.dp), modifier = Modifier.padding(top = 4.dp)) {
                Text(
                    if (store.covers_delivery_fee == true) "🛵 Δωρεάν διανομή"
                    else store.delivery_fee?.let { "🛵 €%.2f".format(it) } ?: "🛵 Δωρεάν διανομή",
                    color = FreshGreenDark, fontWeight = FontWeight.Bold, fontSize = 10.sp,
                    modifier = Modifier.padding(horizontal = 7.dp, vertical = 3.dp),
                )
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
    isFavorite: Boolean = false,
    onToggleFavorite: () -> Unit = {},
) {
    val store = state.selectedStore
    val menuGroups = remember(state.menu) {
        state.menu
            .groupBy { it.category?.trim()?.takeIf { c -> c.isNotEmpty() } ?: "Μενού" }
            .toList()
            .sortedBy { (cat, _) -> if (cat == "Μενού") "zzz" else cat }
    }
    var selectedCategory by remember(state.selectedStore?.id) { mutableStateOf<String?>(null) }
    val visibleGroups = remember(menuGroups, selectedCategory) {
        if (selectedCategory == null) menuGroups
        else menuGroups.filter { it.first == selectedCategory }
    }
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
                        val minO = store?.min_order_amount ?: 0.0
                        if (minO > 0) {
                            Text(
                                "Ελάχ. παραγγελία €%.0f".format(minO),
                                color = Color.White.copy(alpha = 0.9f),
                                style = MaterialTheme.typography.labelLarge,
                                fontWeight = FontWeight.SemiBold,
                            )
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
                if (menuGroups.size > 1) {
                    stickyHeader(key = "cat-chips") {
                        Row(
                            Modifier
                                .fillMaxWidth()
                                .background(FreshBg)
                                .horizontalScroll(rememberScrollState())
                                .padding(horizontal = 16.dp, vertical = 8.dp),
                            horizontalArrangement = Arrangement.spacedBy(8.dp),
                        ) {
                            FreshFilterChip("Όλα", selected = selectedCategory == null) {
                                selectedCategory = null
                            }
                            menuGroups.forEach { (cat, _) ->
                                FreshFilterChip(cat, selected = selectedCategory == cat) {
                                    selectedCategory = cat
                                }
                            }
                        }
                    }
                }
                visibleGroups.forEach { (category, itemsInCat) ->
                    item(key = "cat-$category") {
                        Text(
                            category,
                            style = MaterialTheme.typography.titleMedium,
                            fontWeight = FontWeight.Bold,
                            color = FreshInk,
                            modifier = Modifier.padding(horizontal = 16.dp, vertical = 10.dp),
                        )
                    }
                    items(itemsInCat, key = { it.id }) { item ->
                        FreshMenuRow(
                            item = item,
                            onAdd = {
                                if (item.is_available != false) onAdd(item)
                            },
                        )
                        Spacer(Modifier.height(6.dp))
                    }
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
                    minOrder = (state.stores.find { it.id == state.cartStoreId } ?: state.selectedStore)?.min_order_amount ?: 0.0,
                    onClick = onOpenCart,
                )
            }
        }
    }
}

@Composable
private fun FreshMenuRow(item: MenuItemRow, onAdd: () -> Unit) {
    val available = item.is_available != false
    Row(
        Modifier
            .fillMaxWidth()
            .padding(horizontal = 16.dp, vertical = 8.dp)
            .shadow(3.dp, RoundedCornerShape(20.dp))
            .clip(RoundedCornerShape(20.dp))
            .background(Color.White)
            .clickable(enabled = available, onClick = onAdd)
            .padding(12.dp),
        horizontalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        Column(Modifier.weight(1f)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Text(
                    item.name,
                    fontWeight = FontWeight.Bold,
                    style = MaterialTheme.typography.titleMedium,
                    color = if (available) FreshInk else FreshMuted,
                    modifier = Modifier.weight(1f),
                )
                if (!available) {
                    Surface(color = FreshChip, shape = RoundedCornerShape(8.dp)) {
                        Text(
                            "Μη διαθέσιμο",
                            color = FreshMuted,
                            fontWeight = FontWeight.SemiBold,
                            style = MaterialTheme.typography.labelSmall,
                            modifier = Modifier.padding(horizontal = 8.dp, vertical = 3.dp),
                        )
                    }
                }
            }
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
            if (state.cart.isEmpty()) {
                item {
                    Column(
                        Modifier
                            .fillMaxWidth()
                            .padding(vertical = 40.dp),
                        horizontalAlignment = Alignment.CenterHorizontally,
                    ) {
                        Box(
                            Modifier
                                .size(88.dp)
                                .clip(CircleShape)
                                .background(FreshGreenSoft),
                            contentAlignment = Alignment.Center,
                        ) {
                            Icon(
                                Icons.Outlined.ShoppingBag,
                                contentDescription = null,
                                tint = FreshGreenDark,
                                modifier = Modifier.size(40.dp),
                            )
                        }
                        Spacer(Modifier.height(16.dp))
                        Text(
                            "Το καλάθι είναι άδειο",
                            fontWeight = FontWeight.Bold,
                            style = MaterialTheme.typography.titleLarge,
                            color = FreshInk,
                        )
                        Spacer(Modifier.height(6.dp))
                        Text(
                            "Πρόσθεσε πιάτα από ένα κατάστημα για να συνεχίσεις.",
                            color = FreshMuted,
                            style = MaterialTheme.typography.bodyMedium,
                            textAlign = TextAlign.Center,
                            modifier = Modifier.padding(horizontal = 24.dp),
                        )
                        Spacer(Modifier.height(20.dp))
                        Button(
                            onClick = onBack,
                            colors = ButtonDefaults.buttonColors(containerColor = FreshGreen, contentColor = Color.White),
                            shape = RoundedCornerShape(16.dp),
                        ) {
                            Text("Δες καταστήματα", fontWeight = FontWeight.Bold)
                        }
                    }
                }
            } else {
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
                            enabled = true,
                            colors = ButtonDefaults.buttonColors(
                                containerColor = if (state.paymentMethod == "cash") FreshGreen else FreshChip,
                                contentColor = if (state.paymentMethod == "cash") Color.White else FreshInk,
                            ),
                            shape = RoundedCornerShape(16.dp),
                            modifier = Modifier.weight(1f),
                        ) {
                            Icon(Icons.Outlined.Wallet, contentDescription = null)
                            Spacer(Modifier.width(6.dp))
                            Text(if (state.paymentMethod == "cash") "Μετρητά ✓" else "Μετρητά")
                        }
                        Button(
                            onClick = { onSetPayment("card") },
                            enabled = true,
                            colors = ButtonDefaults.buttonColors(
                                containerColor = if (state.paymentMethod == "card") FreshGreen else FreshChip,
                                contentColor = if (state.paymentMethod == "card") Color.White else FreshInk,
                            ),
                            shape = RoundedCornerShape(16.dp),
                            modifier = Modifier.weight(1f),
                        ) {
                            Icon(Icons.Outlined.CreditCard, contentDescription = null)
                            Spacer(Modifier.width(6.dp))
                            Text(if (state.paymentMethod == "card") "Κάρτα ✓" else "Κάρτα")
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
                    val cartMin = (state.stores.find { it.id == state.cartStoreId } ?: state.selectedStore)?.min_order_amount ?: 0.0
                    if (cartMin > 0 && state.cartSubtotal < cartMin) {
                        Spacer(Modifier.height(12.dp))
                        Surface(
                            color = FreshGreenSoft,
                            shape = RoundedCornerShape(14.dp),
                            modifier = Modifier.fillMaxWidth(),
                        ) {
                            Column(Modifier.padding(14.dp)) {
                                Text(
                                    "Ελάχιστη παραγγελία €%.2f — ακόμα €%.2f".format(cartMin, cartMin - state.cartSubtotal),
                                    color = FreshGreenDark,
                                    fontWeight = FontWeight.SemiBold,
                                    style = MaterialTheme.typography.bodyMedium,
                                )
                                Spacer(Modifier.height(8.dp))
                                Box(
                                    Modifier
                                        .fillMaxWidth()
                                        .height(8.dp)
                                        .clip(RoundedCornerShape(4.dp))
                                        .background(Color.White.copy(alpha = 0.7f)),
                                ) {
                                    Box(
                                        Modifier
                                            .fillMaxWidth((state.cartSubtotal / cartMin).toFloat().coerceIn(0f, 1f))
                                            .height(8.dp)
                                            .clip(RoundedCornerShape(4.dp))
                                            .background(FreshGreen),
                                    )
                                }
                            }
                        }
                    }
                    Spacer(Modifier.height(16.dp))
                    val canPlace = !state.busy && state.cart.isNotEmpty() && address.isNotBlank() &&
                        (cartMin <= 0 || state.cartSubtotal >= cartMin)
                    Box(
                        Modifier
                            .fillMaxWidth()
                            .height(58.dp)
                            .shadow(12.dp, RoundedCornerShape(29.dp))
                            .clip(RoundedCornerShape(29.dp))
                            .background(if (!canPlace) FreshChipGradient else FreshGradient)
                            .clickable(
                                enabled = canPlace,
                                onClick = onPlaceOrder,
                            ),
                        contentAlignment = Alignment.Center,
                    ) {
                        if (state.busy) {
                            CircularProgressIndicator(color = Color.White, modifier = Modifier.size(24.dp))
                        } else {
                            Text(
                                if (cartMin > 0 && state.cartSubtotal < cartMin) {
                                    "Πρόσθεσε προϊόντα · ακόμα €" + "%.2f".format(cartMin - state.cartSubtotal)
                                } else {
                                    "Τοποθέτηση παραγγελίας · €" + "%.2f".format(state.grandTotal)
                                },
                                fontWeight = FontWeight.Bold,
                                color = if (!canPlace) FreshMuted else Color.White,
                            )
                        }
                    }
                    Spacer(Modifier.height(32.dp))
                }
            }
            } // end else non-empty cart
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
    onSaveAddress: () -> Unit,
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
                onValueChange = { address = it },
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
    onSubmitReview: (String, String, Int, String) -> Unit = { _, _, _, _ -> },
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
                    if (item.order.status == "delivered" && item.order.id !in state.reviewedOrderIds) {
                        Spacer(Modifier.height(8.dp))
                        ReviewStarsRow(
                            onSubmit = { rating, comment ->
                                onSubmitReview(item.order.id, item.order.store_id, rating, comment)
                            },
                        )
                    }
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
    // Prefer delivery pin, then store, then any marker (Ioannina fallback)
    val centerLat = order?.order?.delivery_latitude
        ?: order?.storeLat
        ?: markers.firstOrNull()?.lat
        ?: 39.6650
    val centerLng = order?.order?.delivery_longitude
        ?: order?.storeLng
        ?: markers.firstOrNull()?.lng
        ?: 20.8537
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
                Spacer(Modifier.height(10.dp))
                // ETA + headline
                val etaMin = estimateEtaMinutes(order.order)
                val headline = trackHeadline(order.order.status, state.driverLocation != null)
                Row(
                    Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Column(Modifier.weight(1f)) {
                        Text(headline.first, fontWeight = FontWeight.Bold, style = MaterialTheme.typography.titleMedium)
                        Text(headline.second, color = FreshMuted, style = MaterialTheme.typography.bodySmall)
                    }
                    if (etaMin != null) {
                        Surface(color = FreshGreenSoft, shape = RoundedCornerShape(14.dp)) {
                            Column(
                                Modifier.padding(horizontal = 12.dp, vertical = 8.dp),
                                horizontalAlignment = Alignment.CenterHorizontally,
                            ) {
                                Text("ETA", color = FreshMuted, style = MaterialTheme.typography.labelSmall)
                                Text("~$etaMin΄", color = FreshGreen, fontWeight = FontWeight.Bold, style = MaterialTheme.typography.titleMedium)
                            }
                        }
                    }
                }
                Spacer(Modifier.height(12.dp))
                OrderStatusTimeline(status = order.order.status)
                Spacer(Modifier.height(12.dp))
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
                                order.order.status == "pending" -> "Ολοκλήρωσε την πληρωμή με κάρτα αν χρειάζεται."
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

private val TRACK_STEPS = listOf(
    "placed" to "Στάλθηκε",
    "accepted" to "Αποδεκτή",
    "preparing" to "Ετοιμάζεται",
    "ready" to "Έτοιμη",
    "picked_up" to "Στο δρόμο",
    "delivered" to "Παραδόθηκε",
)

@Composable
private fun OrderStatusTimeline(status: String) {
    val normalized = when (status) {
        "pending" -> "placed"
        "confirmed" -> "accepted"
        "on_the_way", "in_transit", "arrived" -> "picked_up"
        else -> status
    }
    val idx = TRACK_STEPS.indexOfFirst { it.first == normalized }.coerceAtLeast(0)
    Row(
        Modifier
            .fillMaxWidth()
            .padding(vertical = 4.dp),
        horizontalArrangement = Arrangement.SpaceBetween,
        verticalAlignment = Alignment.CenterVertically,
    ) {
        TRACK_STEPS.forEachIndexed { i, (_, label) ->
            val done = i <= idx
            val active = i == idx
            Column(
                horizontalAlignment = Alignment.CenterHorizontally,
                modifier = Modifier.weight(1f),
            ) {
                Box(
                    Modifier
                        .size(if (active) 14.dp else 10.dp)
                        .clip(CircleShape)
                        .background(if (done) FreshGreen else FreshChip),
                )
                Spacer(Modifier.height(4.dp))
                Text(
                    label,
                    color = if (done) FreshInk else FreshMuted,
                    fontWeight = if (active) FontWeight.Bold else FontWeight.Normal,
                    style = MaterialTheme.typography.labelSmall,
                    maxLines = 1,
                )
            }
            if (i < TRACK_STEPS.lastIndex) {
                Box(
                    Modifier
                        .weight(0.35f)
                        .height(2.dp)
                        .background(if (i < idx) FreshGreen else FreshChip),
                )
            }
        }
    }
}

private fun trackHeadline(status: String, hasDriverLoc: Boolean): Pair<String, String> = when (status) {
    "pending" -> "Αναμονή πληρωμής" to "Ολοκλήρωσε την κάρτα για να σταλεί στο κατάστημα"
    "placed" -> "Στείλαμε την παραγγελία" to "Περιμένουμε επιβεβαίωση από το κατάστημα"
    "accepted", "confirmed" -> "Το κατάστημα αποδέχτηκε" to "Ξεκινάει η ετοιμασία"
    "preparing" -> "Ετοιμάζεται φρέσκο" to "Σύντομα θα είναι έτοιμη"
    "ready" -> "Έτοιμη για παραλαβή" to "Ψάχνουμε ή αναθέτουμε οδηγό"
    "picked_up", "on_the_way", "in_transit", "arrived" ->
        if (hasDriverLoc) "Ο οδηγός έρχεται!" to "Ζωντανή θέση στον χάρτη"
        else "Ο οδηγός παρέλαβε" to "Καθ' οδόν προς εσένα"
    "delivered" -> "Παραδόθηκε" to "Καλή όρεξη!"
    "cancelled" -> "Ακυρώθηκε" to "Η παραγγελία ακυρώθηκε"
    else -> statusLabel(status) to ""
}

/** Rough ETA minutes remaining — mirrors web prep(~30) + 15 buffer from created_at. */
private fun estimateEtaMinutes(order: com.freshdelivery.nativecustomer.data.OrderRow): Int? {
    if (order.status in listOf("delivered", "cancelled", "rejected", "refunded")) return null
    if (order.status == "pending") return null
    val created = order.created_at ?: return when (order.status) {
        "picked_up", "on_the_way", "in_transit" -> 12
        "ready" -> 18
        "preparing", "accepted", "confirmed" -> 28
        else -> 40
    }
    val startMs = runCatching {
        java.time.Instant.parse(created).toEpochMilli()
    }.getOrElse {
        // fallback ISO without Z
        runCatching { java.time.OffsetDateTime.parse(created).toInstant().toEpochMilli() }.getOrNull()
            ?: return 30
    }
    val totalMin = 45 // 30 prep + 15 delivery buffer
    val endMs = startMs + totalMin * 60_000L
    val remaining = ((endMs - System.currentTimeMillis()) / 60_000.0).toInt()
    return remaining.coerceIn(0, totalMin + 15)
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
            .verticalScroll(rememberScrollState())
            .padding(horizontal = 16.dp)
            .navigationBarsPadding()
            .padding(bottom = 24.dp),
    ) {
        Row(
            Modifier
                .fillMaxWidth()
                .padding(vertical = 12.dp),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Text(
                "Λογαριασμός",
                style = MaterialTheme.typography.headlineMedium,
            )
            TextButton(onClick = onSignOut) {
                Icon(Icons.Outlined.Logout, contentDescription = null, tint = FreshRose, modifier = Modifier.size(18.dp))
                Spacer(Modifier.width(4.dp))
                Text("Έξοδος", color = FreshRose, fontWeight = FontWeight.Bold)
            }
        }
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
        StreakLoyaltyCard(state)
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
        Spacer(Modifier.height(24.dp))
        OutlinedButton(
            onClick = onSignOut,
            modifier = Modifier
                .fillMaxWidth()
                .height(52.dp),
            shape = RoundedCornerShape(24.dp),
            colors = ButtonDefaults.outlinedButtonColors(contentColor = FreshRose),
            border = androidx.compose.foundation.BorderStroke(1.5.dp, FreshRose),
        ) {
            Icon(Icons.Outlined.Logout, contentDescription = null, modifier = Modifier.size(20.dp))
            Spacer(Modifier.width(8.dp))
            Text("Αποσύνδεση", fontWeight = FontWeight.Bold)
        }
        Spacer(Modifier.height(8.dp))
        Text(
            "Θα χρειαστεί να συνδεθείς ξανά για παραγγελίες.",
            color = FreshMuted,
            style = MaterialTheme.typography.bodySmall,
            modifier = Modifier.fillMaxWidth(),
        )
        Spacer(Modifier.height(16.dp))
    }
}

/**
 * "Streak Hero" loyalty card. Rewards consecutive-day ordering habits
 * (not just spend): streak grows daily, resets when a day is missed, and
 * grants a flat bonus at milestones (3 / 7 / 14 / 30 days).
 */
@Composable
private fun StreakLoyaltyCard(state: CustomerUiState) {
    val loyalty = state.loyalty ?: return
    val streak = loyalty.current_streak
    val bestStreak = loyalty.best_streak
    val next = loyalty.next_milestone_day
    val nextBonus = loyalty.next_milestone_bonus
    val nextLabel = loyalty.next_milestone_label
    val progress = if (next > 0) (streak.toFloat() / next.toFloat()).coerceIn(0f, 1f) else 1f
    val daysToBonus = (next - streak).coerceAtLeast(0)
    val tierLabel = when (loyalty.tier) {
        "platinum" -> "Πλατινένιο"
        "gold" -> "Χρυσό"
        "silver" -> "Ασημένιο"
        else -> "Χάλκινο"
    }
    val tierEmoji = when (loyalty.tier) {
        "platinum" -> "💎"
        "gold" -> "🥇"
        "silver" -> "🥈"
        else -> "🥉"
    }

    Column(
        Modifier
            .fillMaxWidth()
            .shadow(10.dp, RoundedCornerShape(26.dp))
            .clip(RoundedCornerShape(26.dp))
            .background(
                Brush.verticalGradient(
                    listOf(
                        Color(0xFF123A2C),
                        Color(0xFF0A2218),
                    ),
                ),
            )
            .padding(18.dp),
    ) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Text("🔥", style = MaterialTheme.typography.titleLarge)
                Spacer(Modifier.width(8.dp))
                Column {
                    Text(
                        "Streak Hero",
                        color = Color.White,
                        fontWeight = FontWeight.ExtraBold,
                        style = MaterialTheme.typography.titleMedium,
                    )
                    Text(
                        "Παράγγειλε κάθε μέρα, κέρδισε μπόνους",
                        color = Color(0xFF9FC6B2),
                        style = MaterialTheme.typography.bodySmall,
                    )
                }
            }
            Spacer(Modifier.weight(1f))
        }

        Spacer(Modifier.height(16.dp))

        Row(verticalAlignment = Alignment.Bottom) {
            Text(
                "$streak",
                color = Color(0xFFF7B955),
                fontWeight = FontWeight.ExtraBold,
                style = MaterialTheme.typography.displaySmall,
            )
            Spacer(Modifier.width(8.dp))
            Text(
                "μέρες συνεχόμενης\nπαραγγελίας",
                color = Color.White,
                fontWeight = FontWeight.Bold,
                style = MaterialTheme.typography.bodySmall,
                modifier = Modifier.padding(bottom = 6.dp),
            )
            Spacer(Modifier.weight(1f))
        }

        Spacer(Modifier.height(14.dp))

        // Points + tier row.
        Row(
            Modifier.fillMaxWidth(),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Surface(
                color = Color(0xFF1D5440),
                shape = RoundedCornerShape(12.dp),
            ) {
                Row(
                    Modifier.padding(horizontal = 10.dp, vertical = 6.dp),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Text(
                        "$tierEmoji  $tierLabel",
                        color = Color.White,
                        fontWeight = FontWeight.Bold,
                        style = MaterialTheme.typography.labelMedium,
                    )
                }
            }
            Spacer(Modifier.weight(1f))
            Text(
                "${loyalty.points} πόντοι",
                color = Color.White,
                fontWeight = FontWeight.ExtraBold,
                style = MaterialTheme.typography.titleMedium,
            )
        }

        Spacer(Modifier.height(14.dp))

        // Progress toward next milestone.
        if (next > 0) {
            Row(
                Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Text(
                    "Επόμενο ορόσημο: $nextLabel (+$nextBonus)",
                    color = Color(0xFF9FC6B2),
                    style = MaterialTheme.typography.bodySmall,
                    fontWeight = FontWeight.SemiBold,
                )
                Text(
                    "$streak/$next",
                    color = Color(0xFFF7B955),
                    style = MaterialTheme.typography.bodySmall,
                    fontWeight = FontWeight.Bold,
                )
            }
            Spacer(Modifier.height(6.dp))
            LinearProgressIndicator(
                progress = { progress },
                modifier = Modifier
                    .fillMaxWidth()
                    .height(8.dp)
                    .clip(RoundedCornerShape(4.dp)),
                color = Color(0xFFF7B955),
                trackColor = Color(0xFF1D5440),
            )
            Spacer(Modifier.height(6.dp))
            Text(
                if (daysToBonus > 0)
                    "$daysToBonus μέρες ακόμα για μπόνους $nextBonus πόντων!"
                else
                    "🎉 Μόλις έφτασες το ορόσημο $nextLabel!",
                color = Color(0xFF9FC6B2),
                style = MaterialTheme.typography.bodySmall,
            )
        }

        Spacer(Modifier.height(10.dp))
        HorizontalDivider(color = Color(0xFF1D5440))
        Spacer(Modifier.height(8.dp))
        Text(
            "Ρεκόρ: $bestStreak μέρες · Χάσε μία μέρα και η σειρά μηδενίζεται.",
            color = Color(0xFF7FA893),
            style = MaterialTheme.typography.bodySmall,
        )
    }
}

@Composable
private fun ModifierPickerDialog(
    item: MenuItemRow,
    modifiers: List<com.freshdelivery.nativecustomer.data.MenuModifierRow>,
    onDismiss: () -> Unit,
    onConfirm: (List<com.freshdelivery.nativecustomer.data.MenuModifierRow>) -> Unit,
) {
    val groups = modifiers.groupBy { it.group_name }.toList()
    val selected = remember {
        mutableStateMapOf<String, com.freshdelivery.nativecustomer.data.MenuModifierRow>()
    }
    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text(item.name, fontWeight = FontWeight.Bold) },
        text = {
            Column(modifier = Modifier.fillMaxWidth()) {
                groups.forEach { (group, opts) ->
                    Text(group, fontWeight = FontWeight.SemiBold, style = MaterialTheme.typography.labelLarge)
                    Spacer(Modifier.height(6.dp))
                    opts.forEach { opt ->
                        val isOn = selected[opt.id] != null
                        Row(
                            Modifier
                                .fillMaxWidth()
                                .clip(RoundedCornerShape(10.dp))
                                .background(if (isOn) FreshGreenSoft else FreshChip)
                                .clickable {
                                    val multi = opt.is_multi
                                    if (multi) {
                                        if (isOn) selected.remove(opt.id) else selected[opt.id] = opt
                                    } else {
                                        opts.forEach { selected.remove(it.id) }
                                        selected[opt.id] = opt
                                    }
                                }
                                .padding(10.dp),
                            horizontalArrangement = Arrangement.SpaceBetween,
                        ) {
                            Text(opt.option_name, style = MaterialTheme.typography.bodyMedium)
                            if (opt.price_delta > 0) {
                                Text("+€%.2f".format(opt.price_delta), color = FreshMuted, style = MaterialTheme.typography.bodySmall)
                            }
                        }
                        Spacer(Modifier.height(4.dp))
                    }
                    Spacer(Modifier.height(8.dp))
                }
            }
        },
        confirmButton = {
            TextButton(onClick = {
                // required groups
                val missing = groups.any { (g, opts) ->
                    opts.any { it.is_required } && opts.none { selected.containsKey(it.id) }
                }
                if (missing) return@TextButton
                onConfirm(selected.values.toList())
            }) { Text("Προσθήκη") }
        },
        dismissButton = {
            TextButton(onClick = onDismiss) { Text("Άκυρο") }
        },
    )
}

@Composable
private fun ReviewStarsRow(onSubmit: (Int, String) -> Unit) {
    var rating by remember { mutableIntStateOf(0) }
    var comment by remember { mutableStateOf("") }
    Column(Modifier.fillMaxWidth()) {
        Text("Βαθμολόγησε", fontWeight = FontWeight.SemiBold, style = MaterialTheme.typography.labelLarge)
        Row(horizontalArrangement = Arrangement.spacedBy(4.dp)) {
            (1..5).forEach { star ->
                Icon(
                    imageVector = if (star <= rating) Icons.Outlined.Star else Icons.Outlined.Star,
                    contentDescription = null,
                    tint = if (star <= rating) FreshAmber else FreshMuted,
                    modifier = Modifier
                        .size(28.dp)
                        .clickable { rating = star },
                )
            }
        }
        if (rating > 0) {
            OutlinedTextField(
                value = comment,
                onValueChange = { if (it.length <= 200) comment = it },
                placeholder = { Text("Σχόλιο (προαιρετικό)") },
                modifier = Modifier.fillMaxWidth(),
                singleLine = true,
            )
            Button(
                onClick = { onSubmit(rating, comment) },
                colors = ButtonDefaults.buttonColors(containerColor = FreshGreen),
                shape = RoundedCornerShape(12.dp),
                modifier = Modifier.fillMaxWidth(),
            ) { Text("Υποβολή") }
        }
    }
}
