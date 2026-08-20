package com.freshdelivery.nativecustomer.ui

import android.app.Application
import android.content.Context
import android.content.pm.PackageManager
import android.location.Geocoder
import androidx.core.content.ContextCompat
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import com.freshdelivery.nativecustomer.data.CartLine
import com.freshdelivery.nativecustomer.data.CustomerRepository
import com.freshdelivery.nativecustomer.data.CustomerTab
import com.freshdelivery.nativecustomer.data.DriverLocationRow
import com.freshdelivery.nativecustomer.data.GameConfig
import com.freshdelivery.nativecustomer.data.GameDeal
import com.freshdelivery.nativecustomer.data.GamePrize
import com.freshdelivery.nativecustomer.data.LiveChatMessageRow
import com.freshdelivery.nativecustomer.data.MenuItemRow
import com.freshdelivery.nativecustomer.data.MysteryCardDef
import com.freshdelivery.nativecustomer.data.OrderRow
import com.freshdelivery.nativecustomer.data.OrderUi
import com.freshdelivery.nativecustomer.data.ProfileRow
import com.freshdelivery.nativecustomer.data.SavedAddressRow
import com.freshdelivery.nativecustomer.data.StoreRow
import com.freshdelivery.nativecustomer.data.StoreRating
import com.freshdelivery.nativecustomer.data.SupportTicketRow
import com.freshdelivery.nativecustomer.data.SupabaseModule
import com.freshdelivery.nativecustomer.data.TicketMessageRow
import com.freshdelivery.nativecustomer.data.WHEEL_SEGMENTS
import com.freshdelivery.nativecustomer.data.WheelSegment
import com.freshdelivery.nativecustomer.data.defaultMysteryCards
import com.freshdelivery.nativecustomer.push.PushTokenHolder
import com.google.android.gms.location.LocationServices
import com.google.android.gms.location.Priority
import com.google.firebase.messaging.FirebaseMessaging
import io.github.jan.supabase.auth.auth
import io.github.jan.supabase.auth.status.SessionStatus
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import kotlinx.coroutines.tasks.await
import kotlinx.coroutines.withContext
import java.util.Locale
import kotlin.math.atan2
import kotlin.math.cos
import kotlin.math.sin
import kotlin.math.sqrt
import kotlin.random.Random

data class AddressSuggestion(
    val label: String,
    val lat: Double,
    val lng: Double,
)

/** Which support surface the customer is on: picker, ticket composer, list, or a thread. */
enum class SupportView { Topics, Compose, MyTickets, Live, Ticket }

/** Topics that skip the async ticket queue and open the urgent live chat instead (mirrors web). */
private val URGENT_TOPICS = setOf("wrong_order")

data class CustomerUiState(
    val bootstrapping: Boolean = true,
    val signedIn: Boolean = false,
    val userId: String? = null,
    val profile: ProfileRow? = null,
    val tab: CustomerTab = CustomerTab.Home,
    val stores: List<StoreRow> = emptyList(),
    val storeRatings: Map<String, StoreRating> = emptyMap(),
    val favoriteStoreIds: Set<String> = emptySet(),
    val canManageGames: Boolean = false,
    val selectedStore: StoreRow? = null,
    val menu: List<MenuItemRow> = emptyList(),
    val cart: List<CartLine> = emptyList(),
    val cartStoreId: String? = null,
    val cartStoreName: String? = null,
    val showCart: Boolean = false,
    val deliveryAddress: String = "",
    val deliveryLat: Double? = null,
    val deliveryLng: Double? = null,
    val notes: String = "",
    val tipAmount: Double = 0.0,
    val deliveryFee: Double = 0.99,
    val paymentMethod: String = "cash",
    val orders: List<OrderUi> = emptyList(),
    val trackingOrder: OrderUi? = null,
    val ratingOrderId: String? = null,
    val driverLocation: DriverLocationRow? = null,
    val busy: Boolean = false,
    val locating: Boolean = false,
    val savingProfile: Boolean = false,
    val searchQuery: String = "",
    val signupMode: Boolean = false,
    val addressSuggestions: List<AddressSuggestion> = emptyList(),
    val savedAddresses: List<SavedAddressRow> = emptyList(),
    val feeBase: Double = 0.99,
    val feePerKm: Double = 0.0,
    val error: String? = null,
    val info: String? = null,
    val appConfig: com.freshdelivery.nativecustomer.data.CustomerAppConfig = com.freshdelivery.nativecustomer.data.CustomerAppConfig(),
    // Emerald v2 games — lucky wheel / mystery cards (mirrors the web prototype)
    val gameActive: String = "wheel",
    val gameShow: Boolean = true,
    val gameEnabled: Boolean = true,
    val wheelSegments: List<WheelSegment> = WHEEL_SEGMENTS,
    val dealSeconds: Int = 899,
    val spinning: Boolean = false,
    val wheelPendingTarget: Int? = null,
    val spinLocked: Boolean = false,
    val wheelResult: GamePrize? = null,
    val cardClaimed: Boolean = false,
    val claimedCardIndex: Int? = null,
    val openedCards: Set<Int> = emptySet(),
    val cards: List<MysteryCardDef> = defaultMysteryCards(),
    val appliedDeal: GameDeal? = null,
    val adminOpen: Boolean = false,
    // Live support chat (live_chat_messages, customer channel)
    val supportOpen: Boolean = false,
    val supportView: SupportView = SupportView.Topics,
    val liveChatTopic: String? = null,
    val liveChatSessionId: String? = null,
    val liveChatClosed: Boolean = false,
    val liveChatMessages: List<LiveChatMessageRow> = emptyList(),
    val liveChatLoading: Boolean = false,
    val liveChatSubscribed: Boolean = false,
    val liveChatError: String? = null,
    // Async support tickets (support_tickets, ticket_messages)
    val ticketTopic: String? = null,
    val tickets: List<SupportTicketRow> = emptyList(),
    val activeTicket: SupportTicketRow? = null,
    val ticketMessages: List<TicketMessageRow> = emptyList(),
    val ticketLoading: Boolean = false,
    val ticketPending: Boolean = false,
    val ticketError: String? = null,
) {
    val cartSubtotal: Double get() = cart.sumOf { it.price * it.quantity }
    val cartCount: Int get() = cart.sumOf { it.quantity }
    val gameDiscount: Double
        get() {
            val deal = appliedDeal ?: return 0.0
            if (deal.freeDelivery) return deliveryFee
            val pct = deal.pct ?: 0
            return Math.round(cartSubtotal * pct / 100.0 * 100.0) / 100.0
        }
    val grandTotal: Double
        get() = (cartSubtotal + deliveryFee + tipAmount - gameDiscount).coerceAtLeast(0.0)
    val visibleStores: List<StoreRow>
        get() = if (searchQuery.isBlank()) stores else stores
    val activeOrders: List<OrderUi>
        get() = orders.filter { it.order.status !in TERMINAL_STATUSES }
}

val TERMINAL_STATUSES = listOf("delivered", "cancelled", "rejected", "refunded")

class CustomerViewModel(app: Application) : AndroidViewModel(app) {
    private val repo = CustomerRepository()
    private val _state = MutableStateFlow(CustomerUiState())
    val state: StateFlow<CustomerUiState> = _state.asStateFlow()
    private var pollJob: Job? = null
    private var ordersRealtimeJob: Job? = null
    private var driverRealtimeJob: Job? = null
    private var driverChannelFor: String? = null
    private var gameTickerJob: Job? = null
    private var liveChatJob: Job? = null
    private var liveChatSessionJob: Job? = null
    private var ticketJob: Job? = null
    private var autocompleteJob: Job? = null
    private var searchJob: Job? = null

    init {
        _state.value = _state.value.copy(gameShow = Random.nextDouble() < 0.6)
        loadAdminState()
        PushTokenHolder.listener = { token ->
            val uid = _state.value.userId
            if (uid != null) {
                viewModelScope.launch { runCatching { repo.upsertPushToken(uid, token) } }
            }
        }
        viewModelScope.launch {
            SupabaseModule.client.auth.sessionStatus.collect { status ->
                when (status) {
                    is SessionStatus.Authenticated -> {
                        val uid = status.session.user?.id
                        _state.value = _state.value.copy(
                            bootstrapping = false,
                            signedIn = true,
                            userId = uid,
                        )
                        if (uid != null) onSignedIn(uid)
                    }
                    is SessionStatus.NotAuthenticated -> {
                        pollJob?.cancel()
                        ordersRealtimeJob?.cancel()
                        driverRealtimeJob?.cancel()
                        driverChannelFor = null
                        liveChatJob?.cancel()
                        liveChatJob = null
                        liveChatSessionJob?.cancel()
                        liveChatSessionJob = null
                        ticketJob?.cancel()
                        ticketJob = null
                        repo.unsubscribeAll()
                        val gameActive = _state.value.gameActive
                        val cards = _state.value.cards
                        _state.value = CustomerUiState(bootstrapping = false, signedIn = false).copy(
                            gameActive = gameActive,
                            cards = cards,
                            gameShow = Random.nextDouble() < 0.6,
                        )
                    }
                    else -> Unit
                }
            }
        }
    }

    private suspend fun onSignedIn(userId: String) {
        runCatching {
            val profile = repo.loadProfile(userId)
            val fees = repo.platformFees()
            val base = fees.customer_base_fee ?: fees.platform_service_fee ?: 0.99
            val perKm = fees.customer_per_km_fee ?: 0.0
            val prefs = getApplication<Application>().getSharedPreferences("fresh_customer", Context.MODE_PRIVATE)
            val savedAddr = prefs.getString("last_delivery_address", "") ?: ""
            val savedLat = prefs.getString("last_delivery_lat", null)?.toDoubleOrNull()
            val savedLng = prefs.getString("last_delivery_lng", null)?.toDoubleOrNull()
            _state.value = _state.value.copy(
                profile = profile,
                feeBase = base,
                feePerKm = perKm,
                deliveryFee = base,
                deliveryAddress = if (savedAddr.isNotBlank()) savedAddr else _state.value.deliveryAddress,
                deliveryLat = savedLat ?: _state.value.deliveryLat,
                deliveryLng = savedLng ?: _state.value.deliveryLng,
            )
            recomputeDeliveryFee()
        }
        refreshSavedAddresses()
        refreshFavorites()
        runCatching {
            val cfg = repo.fetchAppConfig()
            _state.value = _state.value.copy(appConfig = cfg).applyGameConfig(cfg.games)
        }
        viewModelScope.launch {
            runCatching { repo.canManageGames() }
                .onSuccess { can -> _state.value = _state.value.copy(canManageGames = can) }
        }
        registerFcm(userId)
        refreshAll()
        startRealtime(userId)
        startPolling()
        startGameTicker()
    }

    private fun startRealtime(userId: String) {
        ordersRealtimeJob?.cancel()
        ordersRealtimeJob = viewModelScope.launch {
            runCatching {
                repo.subscribeOrders(userId).collect { refreshOrders() }
            }
        }
    }

    private fun watchDriver(driverId: String) {
        if (driverChannelFor == driverId) return
        driverRealtimeJob?.cancel()
        driverChannelFor = driverId
        driverRealtimeJob = viewModelScope.launch {
            runCatching {
                repo.subscribeDriverLocations(driverId).collect { refreshDriverLocation() }
            }
        }
    }

    private fun stopWatchingDriver() {
        if (driverChannelFor == null && driverRealtimeJob == null) return
        driverRealtimeJob?.cancel()
        driverRealtimeJob = null
        driverChannelFor = null
        viewModelScope.launch { runCatching { repo.unsubscribeDriverLocations() } }
    }

    private fun registerFcm(userId: String) {
        viewModelScope.launch {
            runCatching {
                val token = PushTokenHolder.pendingToken
                    ?: FirebaseMessaging.getInstance().token.await()
                if (!token.isNullOrBlank()) repo.upsertPushToken(userId, token)
            }
        }
    }

    fun signIn(email: String, password: String) {
        viewModelScope.launch {
            _state.value = _state.value.copy(busy = true, error = null)
            runCatching { repo.signIn(email, password) }
                .onFailure { e ->
                    _state.value = _state.value.copy(busy = false, error = e.message ?: "Login failed")
                }
                .onSuccess { _state.value = _state.value.copy(busy = false) }
        }
    }

    fun toggleSignupMode(on: Boolean) {
        _state.value = _state.value.copy(signupMode = on, error = null, info = null)
    }

    fun signUp(email: String, password: String, fullName: String, phone: String) {
        viewModelScope.launch {
            _state.value = _state.value.copy(busy = true, error = null)
            runCatching { repo.signUp(email, password, fullName, phone) }
                .onFailure { e ->
                    _state.value = _state.value.copy(busy = false, error = e.message ?: "Signup failed")
                }
                .onSuccess {
                    _state.value = _state.value.copy(
                        busy = false,
                        signupMode = false,
                        info = "Έλεγξε το email σου για επιβεβαίωση και μετά συνδέσου.",
                    )
                }
        }
    }

    fun saveProfile(fullName: String, phone: String) {
        val uid = _state.value.userId ?: return
        viewModelScope.launch {
            _state.value = _state.value.copy(savingProfile = true, error = null)
            runCatching {
                repo.updateProfile(uid, fullName, phone)
                repo.loadProfile(uid)
            }.onSuccess { profile ->
                _state.value = _state.value.copy(
                    savingProfile = false,
                    profile = profile ?: _state.value.profile,
                    info = "Το προφίλ αποθηκεύτηκε",
                )
            }.onFailure { e ->
                _state.value = _state.value.copy(savingProfile = false, error = e.message)
            }
        }
    }

    fun cancelOrder(order: OrderUi) {
        viewModelScope.launch {
            _state.value = _state.value.copy(busy = true, error = null)
            runCatching { repo.cancelOrder(order.order.id) }
                .onSuccess {
                    _state.value = _state.value.copy(busy = false, info = "Η παραγγελία ακυρώθηκε")
                    refreshOrders()
                }
                .onFailure { e ->
                    _state.value = _state.value.copy(
                        busy = false,
                        error = e.message ?: "Δεν επιτρέπεται ακύρωση σε αυτό το στάδιο",
                    )
                }
        }
    }

    fun setSearchQuery(q: String) {
        _state.value = _state.value.copy(searchQuery = q)
        searchJob?.cancel()
        val trimmed = q.trim()
        if (trimmed.isBlank()) {
            refreshStores()
            return
        }
        searchJob = viewModelScope.launch {
            delay(280)
            val results = repo.searchStores(trimmed)
            _state.value = _state.value.copy(stores = results)
        }
    }

    fun useCurrentLocation() {
        val app = getApplication<Application>()
        if (ContextCompat.checkSelfPermission(app, android.Manifest.permission.ACCESS_FINE_LOCATION)
            != PackageManager.PERMISSION_GRANTED
        ) {
            _state.value = _state.value.copy(error = "Ενεργοποίησε την πρόσβαση τοποθεσίας από τις ρυθμίσεις της συσκευής")
            return
        }
        viewModelScope.launch {
            _state.value = _state.value.copy(locating = true, error = null)
            runCatching {
                val fused = LocationServices.getFusedLocationProviderClient(getApplication())
                val loc = fused.getCurrentLocation(Priority.PRIORITY_BALANCED_POWER_ACCURACY, null).await()
                    ?: fused.lastLocation.await()
                    ?: error("Δεν βρέθηκε τοποθεσία")
                val label = reverseGeocode(loc.latitude, loc.longitude)
                _state.value = _state.value.copy(
                    locating = false,
                    deliveryLat = loc.latitude,
                    deliveryLng = loc.longitude,
                    deliveryAddress = label ?: _state.value.deliveryAddress,
                    addressSuggestions = emptyList(),
                    info = "Η τοποθεσία ενημερώθηκε",
                )
                recomputeDeliveryFee()
                persistLastAddress()
                if (label != null) seedGeocodeCache(label, loc.latitude, loc.longitude)
            }.onFailure { e ->
                _state.value = _state.value.copy(locating = false, error = e.message ?: "Αποτυχία τοποθεσίας")
            }
        }
    }

    fun geocodeAddress(address: String) {
        if (address.isBlank()) return
        viewModelScope.launch {
            _state.value = _state.value.copy(locating = true, error = null, addressSuggestions = emptyList())
            val hits = runCatching { forwardGeocodeMany(address) }.getOrNull().orEmpty()
            when {
                hits.isEmpty() -> {
                    _state.value = _state.value.copy(locating = false, error = "Δεν βρέθηκε η διεύθυνση")
                }
                hits.size == 1 -> {
                    val h = hits.first()
                    _state.value = _state.value.copy(
                        locating = false,
                        deliveryAddress = h.label,
                        deliveryLat = h.lat,
                        deliveryLng = h.lng,
                        addressSuggestions = emptyList(),
                        info = "Η διεύθυνση εντοπίστηκε στον χάρτη",
                    )
                    recomputeDeliveryFee()
                    persistLastAddress()
                    seedGeocodeCache(h.label, h.lat, h.lng)
                }
                else -> {
                    _state.value = _state.value.copy(
                        locating = false,
                        addressSuggestions = hits,
                        info = "Επίλεξε διεύθυνση από τις προτάσεις",
                    )
                }
            }
        }
    }

    fun pickAddressSuggestion(s: AddressSuggestion) {
        applyAddress(s.label, s.lat, s.lng)
        _state.value = _state.value.copy(info = "Η διεύθυνση επιλέχθηκε")
        seedGeocodeCache(s.label, s.lat, s.lng)
    }

    private fun recomputeDeliveryFee() {
        val s = _state.value
        val store = s.stores.find { it.id == s.cartStoreId } ?: s.selectedStore
        val dLat = s.deliveryLat
        val dLng = s.deliveryLng
        val fee = if (store?.latitude != null && store.longitude != null && dLat != null && dLng != null) {
            val km = haversineKm(store.latitude, store.longitude, dLat, dLng)
            (s.feeBase + s.feePerKm * km).coerceAtLeast(s.feeBase)
        } else {
            s.feeBase
        }
        _state.value = s.copy(deliveryFee = fee)
    }

    private fun persistLastAddress() {
        val s = _state.value
        val prefs = getApplication<Application>().getSharedPreferences("fresh_customer", Context.MODE_PRIVATE)
        prefs.edit()
            .putString("last_delivery_address", s.deliveryAddress)
            .putString("last_delivery_lat", s.deliveryLat?.toString())
            .putString("last_delivery_lng", s.deliveryLng?.toString())
            .apply()
    }

    private suspend fun reverseGeocode(lat: Double, lng: Double): String? = withContext(Dispatchers.IO) {
        runCatching {
            @Suppress("DEPRECATION")
            Geocoder(getApplication(), Locale.getDefault())
                .getFromLocation(lat, lng, 1)
                ?.firstOrNull()
                ?.getAddressLine(0)
        }.getOrNull()
    }

    private suspend fun forwardGeocodeMany(address: String): List<AddressSuggestion> = withContext(Dispatchers.IO) {
        runCatching {
            @Suppress("DEPRECATION")
            Geocoder(getApplication(), Locale.getDefault())
                .getFromLocationName(address, 5)
                ?.mapNotNull { a ->
                    val line = a.getAddressLine(0) ?: return@mapNotNull null
                    AddressSuggestion(line, a.latitude, a.longitude)
                }
                ?.distinctBy { it.label }
                .orEmpty()
        }.getOrElse { emptyList() }
    }

    fun signOut() {
        viewModelScope.launch { repo.signOut() }
    }

    fun selectTab(tab: CustomerTab) {
        _state.value = _state.value.copy(tab = tab, showCart = false, selectedStore = null, menu = emptyList())
        when (tab) {
            CustomerTab.Orders, CustomerTab.Track -> refreshOrders()
            CustomerTab.Home, CustomerTab.Browse -> refreshStores()
            CustomerTab.Profile -> Unit
        }
    }

    fun openStore(store: StoreRow) {
        viewModelScope.launch {
            _state.value = _state.value.copy(selectedStore = store, busy = true, error = null)
            runCatching {
                _state.value = _state.value.copy(
                    menu = repo.fetchMenu(store.id),
                    busy = false,
                )
            }.onFailure { e ->
                _state.value = _state.value.copy(busy = false, error = e.message)
            }
        }
    }

    fun closeStore() {
        _state.value = _state.value.copy(selectedStore = null, menu = emptyList())
    }

    fun addToCart(item: MenuItemRow) {
        val s = _state.value
        if (s.cartStoreId != null && s.cartStoreId != item.store_id) {
            _state.value = s.copy(error = "Άδειασε το καλάθι για άλλο κατάστημα")
            return
        }
        val existing = s.cart.find { it.menuItemId == item.id }
        val next = if (existing != null) {
            s.cart.map {
                if (it.menuItemId == item.id) it.copy(quantity = it.quantity + 1) else it
            }
        } else {
            s.cart + CartLine(item.id, item.name, item.price, 1)
        }
        _state.value = s.copy(
            cart = next,
            cartStoreId = item.store_id,
            cartStoreName = s.selectedStore?.name ?: s.cartStoreName,
            info = "Προστέθηκε: ${item.name}",
        )
    }

    fun updateQty(menuItemId: String, qty: Int) {
        val next = if (qty <= 0) {
            _state.value.cart.filter { it.menuItemId != menuItemId }
        } else {
            _state.value.cart.map {
                if (it.menuItemId == menuItemId) it.copy(quantity = qty) else it
            }
        }
        _state.value = _state.value.copy(
            cart = next,
            cartStoreId = if (next.isEmpty()) null else _state.value.cartStoreId,
            cartStoreName = if (next.isEmpty()) null else _state.value.cartStoreName,
            showCart = if (next.isEmpty()) false else _state.value.showCart,
        )
    }

    fun toggleCart(open: Boolean = true) {
        _state.value = _state.value.copy(showCart = open)
    }

    fun setDelivery(address: String, lat: Double?, lng: Double?) {
        _state.value = _state.value.copy(
            deliveryAddress = address,
            deliveryLat = lat,
            deliveryLng = lng,
        )
    }

    fun saveAddress() {
        val s = _state.value
        persistLastAddress()
        val addr = s.deliveryAddress.trim()
        if (addr.length < 5) return
        val lat = s.deliveryLat
        val lng = s.deliveryLng
        viewModelScope.launch {
            runCatching {
                repo.saveMyDeliveryAddress(addr, lat, lng)
                if (lat != null && lng != null) repo.rememberAddressGeocode(addr, addr, lat, lng)
                refreshSavedAddresses()
            }
        }
    }

    fun clearAddressSuggestions() {
        _state.value = _state.value.copy(addressSuggestions = emptyList())
    }

    /** Debounced live autocomplete: shared cache → saved addresses → device geocoder. */
    fun autocompleteAddress(query: String) {
        autocompleteJob?.cancel()
        val q = query.trim()
        if (q.length < 3) {
            _state.value = _state.value.copy(addressSuggestions = emptyList())
            return
        }
        autocompleteJob = viewModelScope.launch {
            delay(220)
            val cached = runCatching { repo.suggestCachedAddresses(q, 6) }.getOrDefault(emptyList())
            val geocoder = runCatching { forwardGeocodeMany(q) }.getOrDefault(emptyList())
            val streetKey = streetKeyOf(q)
            val saved = _state.value.savedAddresses
                .filter { it.latitude != null && it.longitude != null }
                .filter { it.address.contains(q, ignoreCase = true) || streetKeyOf(it.address) == streetKey }
                .map { AddressSuggestion(it.address, it.latitude!!, it.longitude!!) }
            val merged = LinkedHashMap<String, AddressSuggestion>()
            (saved + cached.map { AddressSuggestion(it.display_address, it.latitude ?: 0.0, it.longitude ?: 0.0) } + geocoder)
                .filter { it.lat != 0.0 || it.lng != 0.0 }
                .forEach { s -> merged.putIfAbsent(s.label.trim().lowercase(), s) }
            _state.value = _state.value.copy(addressSuggestions = merged.values.take(8).toList())
        }
    }

    /** Apply a personally saved address (resolves coords on the fly if missing). */
    fun selectSavedAddress(sa: SavedAddressRow) {
        val addr = sa.address.trim()
        if (sa.latitude != null && sa.longitude != null) {
            applyAddress(addr, sa.latitude, sa.longitude)
            saveAddress()
        } else {
            _state.value = _state.value.copy(locating = true, error = null)
            viewModelScope.launch {
                val hit = runCatching { forwardGeocodeMany(addr) }.getOrNull()?.firstOrNull()
                if (hit != null) {
                    applyAddress(hit.label, hit.lat, hit.lng)
                    saveAddress()
                } else {
                    _state.value = _state.value.copy(locating = false, error = "Δεν βρέθηκε η διεύθυνση")
                }
            }
        }
    }

    fun deleteSavedAddress(id: String) {
        viewModelScope.launch {
            runCatching {
                repo.deleteSavedAddress(id)
                refreshSavedAddresses()
            }
        }
    }

    fun setDefaultSavedAddress(id: String) {
        val uid = _state.value.userId ?: return
        viewModelScope.launch {
            runCatching {
                repo.setDefaultSavedAddress(uid, id)
                refreshSavedAddresses()
            }
        }
    }

    fun refreshSavedAddresses() {
        val uid = _state.value.userId ?: return
        viewModelScope.launch {
            runCatching {
                _state.value = _state.value.copy(savedAddresses = repo.fetchSavedAddresses())
            }
        }
    }

    private fun applyAddress(label: String, lat: Double?, lng: Double?) {
        _state.value = _state.value.copy(
            deliveryAddress = label,
            deliveryLat = lat,
            deliveryLng = lng,
            addressSuggestions = emptyList(),
        )
        recomputeDeliveryFee()
        persistLastAddress()
    }

    private fun seedGeocodeCache(label: String, lat: Double, lng: Double) {
        viewModelScope.launch {
            runCatching { repo.rememberAddressGeocode(label, label, lat, lng) }
        }
    }

    /** Strip the trailing house number so "Δημοκρατίας 15" matches "Δημοκρατίας 12". */
    private fun streetKeyOf(address: String): String =
        address.lowercase().trim()
            .replace(Regex("\\d.*$"), "")
            .replace(Regex("\\s+"), " ")
            .trim()

    fun setNotes(notes: String) {
        _state.value = _state.value.copy(notes = notes)
    }

    fun setTip(tip: Double) {
        _state.value = _state.value.copy(tipAmount = tip.coerceIn(0.0, 100.0))
    }

    fun setPaymentMethod(method: String) {
        _state.value = _state.value.copy(paymentMethod = method)
    }

    fun placeOrder() {
        val s = _state.value
        val storeId = s.cartStoreId ?: return
        if (s.cart.isEmpty()) return
        if (s.deliveryAddress.isBlank()) {
            _state.value = s.copy(error = "Βάλε διεύθυνση παράδοσης")
            return
        }
        if (s.deliveryLat == null || s.deliveryLng == null) {
            _state.value = s.copy(error = "Πάτα «Εύρεση στον χάρτη» ή «Η τοποθεσία μου» για ακριβείς συντεταγμένες")
            return
        }
        viewModelScope.launch {
            _state.value = _state.value.copy(busy = true, error = null)
            val store = s.stores.find { it.id == storeId } ?: s.selectedStore
            runCatching {
                var distanceKm: Double? = null
                val dLat = s.deliveryLat
                val dLng = s.deliveryLng
                if (store?.latitude != null && store.longitude != null && dLat != null && dLng != null) {
                    distanceKm = haversineKm(store.latitude, store.longitude, dLat, dLng)
                }
                repo.placeOrder(
                    storeId = storeId,
                    items = s.cart,
                    deliveryAddress = s.deliveryAddress.trim(),
                    deliveryLat = s.deliveryLat,
                    deliveryLng = s.deliveryLng,
                    paymentMethod = s.paymentMethod,
                    tipAmount = s.tipAmount,
                    deliveryFee = s.deliveryFee,
                    notes = s.notes.ifBlank { null },
                    distanceKm = distanceKm,
                    promoCode = s.appliedDeal?.code,
                )
            }.onSuccess { placedId ->
                persistLastAddress()
                saveAddress()
                val placed = placedId?.takeIf { it.isNotBlank() }
                _state.value = _state.value.copy(
                    busy = false,
                    cart = emptyList(),
                    cartStoreId = null,
                    cartStoreName = null,
                    showCart = false,
                    tipAmount = 0.0,
                    notes = "",
                    addressSuggestions = emptyList(),
                    info = "Η παραγγελία καταχωρήθηκε!",
                    appliedDeal = null,
                )
                // Auto-open the live tracking map for the freshly placed order
                // (web parity: checkouts jump straight to /order-tracking/<id>).
                if (placed != null) {
                    autoOpenTrack(
                        orderId = placed,
                        storeId = storeId,
                        storeName = s.cartStoreName ?: store?.name,
                        storeLat = store?.latitude,
                        storeLng = store?.longitude,
                    )
                } else {
                    _state.value = _state.value.copy(tab = CustomerTab.Orders)
                    refreshOrders()
                }
            }.onFailure { e ->
                _state.value = _state.value.copy(busy = false, error = e.message ?: "Αποτυχία παραγγελίας")
            }
        }
    }

    fun openOrderFromDeepLink(orderId: String) {
        viewModelScope.launch {
            runCatching {
                refreshAll()
                val order = _state.value.orders.firstOrNull { it.order.id == orderId }
                    ?: _state.value.activeOrders.firstOrNull { it.order.id == orderId }
                    ?: _state.value.trackingOrder?.takeIf { it.order.id == orderId }
                if (order != null) {
                    trackOrder(order)
                } else {
                    _state.value = _state.value.copy(info = "Άνοιγμα παραγγελίας…")
                    refreshAll()
                    val again = _state.value.orders.firstOrNull { it.order.id == orderId }
                        ?: _state.value.activeOrders.firstOrNull { it.order.id == orderId }
                    again?.let { trackOrder(it) }
                }
            }
        }
    }

    fun submitRating(order: OrderUi, stars: Int, comment: String?) {
        viewModelScope.launch {
            _state.value = _state.value.copy(busy = true, error = null)
            runCatching {
                repo.submitReview(
                    storeId = order.order.store_id,
                    orderId = order.order.id,
                    rating = stars,
                    comment = comment,
                )
            }.onSuccess {
                _state.value = _state.value.copy(
                    busy = false,
                    info = "Ευχαριστούμε για την αξιολόγηση!",
                    ratingOrderId = null,
                )
            }.onFailure { e ->
                _state.value = _state.value.copy(busy = false, error = e.message ?: "Σφάλμα αξιολόγησης")
            }
        }
    }

    fun openRating(orderId: String?) {
        _state.value = _state.value.copy(ratingOrderId = orderId)
    }

    fun trackOrder(order: OrderUi?) {
        _state.value = _state.value.copy(trackingOrder = order, tab = CustomerTab.Track, showCart = false)
        refreshDriverLocation()
    }

    private fun autoOpenTrack(
        orderId: String,
        storeId: String,
        storeName: String?,
        storeLat: Double?,
        storeLng: Double?,
    ) {
        // Optimistically show the new order's map right away; the next
        // refreshOrders() replaces it with the authoritative server row.
        val s = _state.value
        val hint = OrderUi(
            order = OrderRow(
                id = orderId,
                store_id = storeId,
                status = "placed",
                delivery_address = s.deliveryAddress,
                delivery_latitude = s.deliveryLat,
                delivery_longitude = s.deliveryLng,
                total_amount = s.cart.sumOf { it.price * it.quantity },
            ),
            storeName = storeName,
            storeLat = storeLat,
            storeLng = storeLng,
        )
        _state.value = _state.value.copy(trackingOrder = hint, tab = CustomerTab.Track, showCart = false)
        viewModelScope.launch {
            runCatching { repo.fetchOrders(s.userId.orEmpty()) }
                .onSuccess { orders ->
                    val authoritative = orders.firstOrNull { it.order.id == orderId }
                    val tracked = authoritative ?: _state.value.trackingOrder
                    _state.value = _state.value.copy(
                        orders = orders,
                        trackingOrder = tracked,
                    )
                    refreshDriverLocation()
                }
        }
    }

    fun refreshAll() {
        refreshStores()
        refreshOrders()
    }

    fun refreshStores() {
        viewModelScope.launch {
            runCatching {
                _state.value = _state.value.copy(
                    stores = repo.fetchStores(),
                    storeRatings = repo.fetchStoreRatings(),
                )
            }.onFailure { e ->
                _state.value = _state.value.copy(error = e.message)
            }
        }
    }

    fun refreshFavorites() {
        val uid = _state.value.userId ?: return
        viewModelScope.launch {
            runCatching { repo.fetchFavoriteStoreIds(uid) }
                .onSuccess { ids -> _state.value = _state.value.copy(favoriteStoreIds = ids.toSet()) }
        }
    }

    fun toggleFavorite(storeId: String) {
        val uid = _state.value.userId ?: return
        val cur = _state.value.favoriteStoreIds
        val adding = storeId !in cur
        _state.value = _state.value.copy(
            favoriteStoreIds = if (adding) cur + storeId else cur - storeId,
        )
        viewModelScope.launch {
            runCatching {
                if (adding) repo.addFavoriteStore(uid, storeId) else repo.removeFavoriteStore(uid, storeId)
            }.onFailure { e ->
                _state.value = _state.value.copy(favoriteStoreIds = cur, error = e.message)
            }
        }
    }

    fun refreshOrders() {
        val uid = _state.value.userId ?: return
        viewModelScope.launch {
            runCatching {
                val orders = repo.fetchOrders(uid)
                val active = orders.firstOrNull { it.order.status !in TERMINAL_STATUSES }
                val tracked = _state.value.trackingOrder
                    ?.let { cur -> orders.firstOrNull { it.order.id == cur.order.id } }
                    ?: active
                _state.value = _state.value.copy(orders = orders, trackingOrder = tracked)
                refreshDriverLocation()
            }.onFailure { e ->
                _state.value = _state.value.copy(error = e.message)
            }
        }
    }

    private fun refreshDriverLocation() {
        val driverId = _state.value.trackingOrder?.order?.driver_id ?: run {
            stopWatchingDriver()
            return
        }
        watchDriver(driverId)
        viewModelScope.launch {
            runCatching {
                _state.value = _state.value.copy(driverLocation = repo.fetchDriverLocation(driverId))
            }
        }
    }

    private fun startPolling() {
        pollJob?.cancel()
        pollJob = viewModelScope.launch {
            while (true) {
                delay(30_000)
                if (_state.value.signedIn && _state.value.activeOrders.isNotEmpty()) {
                    refreshOrders()
                }
            }
        }
    }

    fun clearMessages() {
        _state.value = _state.value.copy(error = null, info = null)
    }

    /** Server-published games config overrides the local (prefs) state. */
    private fun CustomerUiState.applyGameConfig(g: GameConfig): CustomerUiState = copy(
        gameEnabled = g.enabled,
        gameActive = if (g.active == "cards") "cards" else "wheel",
        gameShow = if (g.enabled) gameShow else false,
        wheelSegments = g.wheelSegments,
        cards = g.cards,
    )

    // ---------- Emerald v2 games: lucky wheel + mystery cards ----------

    fun spinWheel() {
        val s = _state.value
        if (!s.gameEnabled || s.spinning || s.spinLocked || !s.gameShow || s.gameActive != "wheel") return
        if (!canSpinToday()) {
            _state.value = s.copy(info = "Η ρόδα είναι διαθέσιμη μία φορά την ημέρα")
            return
        }
        val segs = s.wheelSegments.ifEmpty { WHEEL_SEGMENTS }
        val target = Random.nextInt(segs.size)
        _state.value = s.copy(spinning = true, wheelPendingTarget = target, wheelResult = null)
        viewModelScope.launch {
            delay(4_200)
            val cur = _state.value
            val seg = segs[target]
            val deal = GameDeal(
                code = seg.sub,
                pct = seg.pct,
                freeDelivery = seg.freeDelivery,
                label = if (seg.freeDelivery) "Δωρεάν παράδοση" else "${seg.label} έκπτωση",
            )
            _state.value = cur.copy(
                spinning = false,
                wheelPendingTarget = null,
                spinLocked = true,
                wheelResult = GamePrize(
                    label = if (seg.freeDelivery) "ΔΩΡΕΑΝ ΠΑΡΑΔΟΣΗ!" else "Κέρδισες ${seg.label} έκπτωση! Ο κωδικός εφαρμόστηκε.",
                    code = seg.sub,
                    pct = seg.pct,
                    freeDelivery = seg.freeDelivery,
                ),
                appliedDeal = deal,
            )
            persistSpinDay()
        }
    }

    fun openMysteryCard(index: Int) {
        val s = _state.value
        val card = s.cards.getOrNull(index) ?: return
        if (!s.gameEnabled || !card.enabled || s.cardClaimed || !s.gameShow || s.gameActive != "cards") return
        if (!canClaimCardToday()) {
            _state.value = s.copy(info = "Οι κάρτες ξαναεμφανίζονται αύριο")
            return
        }
        _state.value = s.copy(
            cardClaimed = true,
            claimedCardIndex = index,
            openedCards = s.cards.indices.toSet(),
            appliedDeal = prizeToDeal(card.prize),
        )
        persistCardClaimDay()
    }

    /** Turn a mystery-card prize string into a real checkout deal (code + pct/free delivery). */
    private fun prizeToDeal(prize: String): GameDeal? {
        val p = prize.trim()
        if (p.isEmpty()) return null
        val pct = Regex("(\\d+)\\s*%").find(p)?.groupValues?.get(1)?.toIntOrNull()
        val free = p.contains("δωρεάν", ignoreCase = true) || p.contains("free", ignoreCase = true)
        return if (free) {
            GameDeal(code = "ΠΑΡΑΔΟΣΗ", freeDelivery = true, label = "Δωρεάν παράδοση")
        } else if (pct != null) {
            val code = when (pct) {
                5 -> "FRESH5"
                10 -> "FRESH10"
                15 -> "FRESH15"
                20 -> "FRESH20"
                25 -> "FRESH25"
                else -> "FRESH$pct"
            }
            GameDeal(code = code, pct = pct, label = "$pct% έκπτωση")
        } else {
            null
        }
    }

    fun selectGame(game: String) {
        _state.value = _state.value.copy(gameActive = game, gameShow = true)
        persistAdminState()
    }

    fun toggleCard(index: Int, on: Boolean) {
        _state.value = _state.value.copy(
            cards = _state.value.cards.mapIndexed { j, c -> c.copy(enabled = on && j == index) },
        )
        persistAdminState()
    }

    fun setCardPrize(index: Int, prize: String) {
        _state.value = _state.value.copy(
            cards = _state.value.cards.mapIndexed { j, c -> if (j == index) c.copy(prize = prize) else c },
        )
        persistAdminState()
    }

    fun toggleAdmin(open: Boolean) {
        _state.value = _state.value.copy(adminOpen = open)
    }

    // ── Live support chat ──

    fun openSupport() {
        if (_state.value.supportOpen) return
        _state.value = _state.value.copy(supportOpen = true, supportView = SupportView.Topics)
        viewModelScope.launch {
            val uid = _state.value.userId ?: return@launch
            runCatching { repo.fetchMyTickets(uid) }
                .onSuccess { list -> _state.value = _state.value.copy(tickets = list) }
            val session = repo.getMyLiveChatSession()
            if (session != null && session.id != null) {
                val closed = session.status == "closed"
                _state.value = _state.value.copy(
                    supportView = SupportView.Live,
                    liveChatSessionId = session.id,
                    liveChatClosed = closed,
                    liveChatTopic = session.topic?.takeIf { it.isNotBlank() } ?: "Γενικό",
                    liveChatLoading = true,
                )
                fetchLiveChatHistory()
                if (!closed) startLiveChatSubscription(uid)
            }
        }
    }

    fun closeSupport() {
        closeLiveChat()
        cancelTicketSubscriptions()
        _state.value = _state.value.copy(
            supportOpen = false,
            supportView = SupportView.Topics,
            liveChatTopic = null,
            liveChatSessionId = null,
            liveChatClosed = false,
            ticketTopic = null,
            tickets = emptyList(),
            activeTicket = null,
            ticketMessages = emptyList(),
            ticketError = null,
        )
    }

    /** Customer picks a problem first — urgent topics go to live chat, the rest become tickets. */
    fun selectSupportTopic(topic: String) {
        if (_state.value.userId == null) return
        if (topic in URGENT_TOPICS) {
            selectLiveChatTopic(topic)
        } else {
            _state.value = _state.value.copy(
                supportView = SupportView.Compose,
                ticketTopic = topic,
                ticketError = null,
            )
        }
    }

    private fun selectLiveChatTopic(topic: String) {
        viewModelScope.launch {
            val sessionId = repo.ensureMyLiveChatSession(topic)
            _state.value = _state.value.copy(
                supportView = SupportView.Live,
                liveChatTopic = topic,
                liveChatSessionId = sessionId ?: _state.value.liveChatSessionId,
                liveChatClosed = false,
                liveChatError = null,
            )
            openLiveChat()
        }
    }

    /** Back to the topic picker (closes the active chat/ticket, keeps the support screen open). */
    fun clearSupportTopic() {
        closeLiveChat()
        cancelTicketSubscriptions()
        _state.value = _state.value.copy(
            supportView = SupportView.Topics,
            liveChatTopic = null,
            liveChatSessionId = null,
            liveChatClosed = false,
            ticketTopic = null,
            activeTicket = null,
            ticketMessages = emptyList(),
            ticketError = null,
        )
    }

    // ── Async support tickets ──

    fun openMyTickets() {
        val uid = _state.value.userId ?: return
        _state.value = _state.value.copy(supportView = SupportView.MyTickets, ticketError = null)
        viewModelScope.launch {
            runCatching { repo.fetchMyTickets(uid) }
                .onSuccess { list -> _state.value = _state.value.copy(tickets = list) }
                .onFailure { e ->
                    _state.value = _state.value.copy(
                        ticketError = e.message ?: "Δεν φορτώθηκαν τα αιτήματα",
                    )
                }
        }
    }

    /** Create the ticket and jump straight into its thread. */
    fun submitTicket(description: String) {
        val uid = _state.value.userId ?: return
        val topic = _state.value.ticketTopic ?: return
        val trimmed = description.trim()
        if (trimmed.isEmpty() || _state.value.ticketPending) return
        viewModelScope.launch {
            _state.value = _state.value.copy(ticketPending = true, ticketError = null)
            runCatching {
                repo.createTicket(uid, topic, trimmed, _state.value.trackingOrder?.order?.id)
                repo.fetchMyTickets(uid)
            }.onSuccess { list ->
                val created = list.firstOrNull()
                _state.value = _state.value.copy(
                    ticketPending = false,
                    tickets = list,
                    activeTicket = created,
                    ticketTopic = null,
                    supportView = SupportView.Ticket,
                )
                if (created != null) openTicketThread(created)
            }.onFailure { e ->
                _state.value = _state.value.copy(
                    ticketPending = false,
                    ticketError = e.message ?: "Αποτυχία υποβολής",
                )
            }
        }
    }

    fun openTicket(ticket: SupportTicketRow) {
        _state.value = _state.value.copy(
            activeTicket = ticket,
            supportView = SupportView.Ticket,
            ticketError = null,
        )
        openTicketThread(ticket)
    }

    private fun openTicketThread(ticket: SupportTicketRow) {
        ticketJob?.cancel()
        _state.value = _state.value.copy(ticketLoading = true)
        viewModelScope.launch {
            runCatching { repo.fetchTicketMessages(ticket.id) }
                .onSuccess { msgs ->
                    _state.value = _state.value.copy(ticketMessages = msgs, ticketLoading = false)
                }
                .onFailure { e ->
                    _state.value = _state.value.copy(
                        ticketLoading = false,
                        ticketError = e.message ?: "Δεν φορτώθηκε το ticket",
                    )
                }
        }
        val uid = _state.value.userId ?: return
        ticketJob = viewModelScope.launch {
            runCatching { repo.subscribeTicketMessages(ticket.id) }
                .onSuccess { flow -> flow.collect { _ -> refreshTicketMessages(ticket.id) } }
        }
    }

    fun sendTicketMessage(text: String) {
        val uid = _state.value.userId ?: return
        val ticketId = _state.value.activeTicket?.id ?: return
        val trimmed = text.trim()
        if (trimmed.isEmpty()) return
        viewModelScope.launch {
            runCatching { repo.sendTicketMessage(ticketId, uid, trimmed) }
                .onSuccess { refreshTicketMessages(ticketId) }
                .onFailure { e ->
                    _state.value = _state.value.copy(
                        ticketError = e.message ?: "Αποτυχία αποστολής",
                    )
                }
        }
    }

    private fun refreshTicketMessages(ticketId: String) {
        val uid = _state.value.userId ?: return
        viewModelScope.launch {
            runCatching { repo.fetchTicketMessages(ticketId) }
                .onSuccess { msgs -> _state.value = _state.value.copy(ticketMessages = msgs) }
            runCatching { repo.fetchMyTickets(uid) }
                .onSuccess { list ->
                    val activeId = _state.value.activeTicket?.id
                    _state.value = _state.value.copy(
                        tickets = list,
                        activeTicket = list.firstOrNull { it.id == activeId } ?: _state.value.activeTicket,
                    )
                }
        }
    }

    private fun cancelTicketSubscriptions() {
        ticketJob?.cancel()
        ticketJob = null
        viewModelScope.launch {
            runCatching { repo.unsubscribeTickets() }
        }
    }

    private fun openLiveChat() {
        val uid = _state.value.userId ?: return
        _state.value = _state.value.copy(liveChatLoading = true, liveChatError = null, liveChatClosed = false)
        fetchLiveChatHistory()
        startLiveChatSubscription(uid)
    }

    /** Load the full past conversation so the customer keeps their history. */
    private fun fetchLiveChatHistory() {
        val uid = _state.value.userId ?: return
        viewModelScope.launch {
            runCatching { repo.fetchLiveChat(uid) }
                .onSuccess { msgs ->
                    _state.value = _state.value.copy(
                        liveChatMessages = msgs,
                        liveChatLoading = false,
                        liveChatError = null,
                    )
                }
                .onFailure { e ->
                    _state.value = _state.value.copy(
                        liveChatLoading = false,
                        liveChatError = e.message ?: "Δεν συνδέθηκε το chat",
                    )
                }
        }
    }

    fun sendLiveChatMessage(text: String) {
        val uid = _state.value.userId ?: return
        val trimmed = text.trim()
        if (trimmed.isEmpty()) return
        if (_state.value.liveChatClosed) {
            _state.value = _state.value.copy(liveChatError = "Η συνομιλία έκλεισε από την υποστήριξη")
            return
        }
        viewModelScope.launch {
            runCatching { repo.sendLiveChatMessage(uid, uid, trimmed, _state.value.liveChatTopic) }
                .onSuccess { refreshLiveChat(uid) }
                .onFailure { e ->
                    _state.value = _state.value.copy(
                        liveChatError = e.message ?: "Αποτυχία αποστολής",
                    )
                }
        }
    }

    private fun startLiveChatSubscription(customerId: String) {
        liveChatJob?.cancel()
        liveChatJob = viewModelScope.launch {
            runCatching { repo.subscribeLiveChat(customerId) }
                .onSuccess { flow ->
                    _state.value = _state.value.copy(liveChatSubscribed = true)
                    flow.collect { _ -> refreshLiveChat(customerId) }
                }
                .onFailure { e ->
                    _state.value = _state.value.copy(
                        liveChatSubscribed = false,
                        liveChatError = e.message ?: "Δεν συνδέθηκε το chat",
                    )
                }
        }
        liveChatSessionJob?.cancel()
        liveChatSessionJob = viewModelScope.launch {
            runCatching { repo.subscribeLiveChatSessions(customerId) }
                .onSuccess { flow ->
                    flow.collect { _ ->
                        val session = runCatching { repo.getMyLiveChatSession() }.getOrNull()
                        if (session != null) {
                            _state.value = _state.value.copy(
                                liveChatSessionId = session.id,
                                liveChatClosed = session.status == "closed",
                                liveChatTopic = session.topic?.takeIf { it.isNotBlank() } ?: _state.value.liveChatTopic,
                            )
                        }
                    }
                }
        }
    }

    private fun refreshLiveChat(customerId: String) {
        viewModelScope.launch {
            runCatching { repo.fetchLiveChat(customerId) }
                .onSuccess { msgs -> _state.value = _state.value.copy(liveChatMessages = msgs) }
        }
    }

    private fun closeLiveChat() {
        liveChatJob?.cancel()
        liveChatJob = null
        liveChatSessionJob?.cancel()
        liveChatSessionJob = null
        viewModelScope.launch {
            _state.value = _state.value.copy(
                liveChatMessages = emptyList(),
                liveChatLoading = false,
                liveChatSubscribed = false,
                liveChatError = null,
            )
        }
    }

    private fun todayKey(): String = java.time.LocalDate.now().toString()

    private fun canSpinToday(): Boolean {
        val prefs = getApplication<Application>().getSharedPreferences("fresh_customer", Context.MODE_PRIVATE)
        return prefs.getString("wheel_last_spin_day", null) != todayKey()
    }

    private fun canClaimCardToday(): Boolean {
        val prefs = getApplication<Application>().getSharedPreferences("fresh_customer", Context.MODE_PRIVATE)
        return prefs.getString("card_claim_day", null) != todayKey()
    }

    private fun persistSpinDay() {
        getApplication<Application>().getSharedPreferences("fresh_customer", Context.MODE_PRIVATE)
            .edit().putString("wheel_last_spin_day", todayKey()).apply()
    }

    private fun persistCardClaimDay() {
        getApplication<Application>().getSharedPreferences("fresh_customer", Context.MODE_PRIVATE)
            .edit().putString("card_claim_day", todayKey()).apply()
    }

    /** Seconds until local midnight — drives the daily game-cycle countdown. */
    private fun secondsToMidnight(): Int =
        java.time.Duration.between(
            java.time.LocalDateTime.now(),
            java.time.LocalDate.now().plusDays(1).atStartOfDay(),
        ).seconds.toInt().coerceAtLeast(1)

    private fun startGameTicker() {
        gameTickerJob?.cancel()
        gameTickerJob = viewModelScope.launch {
            while (true) {
                delay(1_000)
                val s = _state.value
                if (!s.signedIn) continue
                if (s.dealSeconds <= 0) {
                    _state.value = s.copy(
                        dealSeconds = secondsToMidnight(),
                        spinning = false,
                        wheelPendingTarget = null,
                        spinLocked = !canSpinToday(),
                        wheelResult = null,
                        cardClaimed = false,
                        claimedCardIndex = null,
                        openedCards = emptySet(),
                        appliedDeal = null,
                        gameShow = if (s.gameEnabled) Random.nextDouble() < 0.6 else false,
                    )
                } else {
                    _state.value = s.copy(dealSeconds = s.dealSeconds - 1)
                }
            }
        }
    }

    private fun persistAdminState() {
        val s = _state.value
        val sb = StringBuilder()
        s.cards.forEach { c ->
            sb.append(c.tag).append('|').append(c.name).append('|').append(c.prize).append('|').append(c.enabled).append('\n')
        }
        getApplication<Application>().getSharedPreferences("fresh_customer", Context.MODE_PRIVATE)
            .edit()
            .putString("game_active", s.gameActive)
            .putString("game_cards", sb.toString())
            .apply()
    }

    private fun loadAdminState() {
        val prefs = getApplication<Application>().getSharedPreferences("fresh_customer", Context.MODE_PRIVATE)
        val active = prefs.getString("game_active", null)
        val raw = prefs.getString("game_cards", null) ?: return
        val cards = raw.split('\n').mapNotNull { line ->
            val p = line.split('|')
            if (p.size < 4) return@mapNotNull null
            MysteryCardDef(tag = p[0], name = p[1], prize = p[2], enabled = p[3].toBoolean())
        }
        if (cards.isNotEmpty()) {
            _state.value = _state.value.copy(
                cards = cards,
                gameActive = active ?: _state.value.gameActive,
            )
        }
    }

    private fun haversineKm(lat1: Double, lon1: Double, lat2: Double, lon2: Double): Double {
        val r = 6371.0
        val dLat = Math.toRadians(lat2 - lat1)
        val dLon = Math.toRadians(lon2 - lon1)
        val a = sin(dLat / 2) * sin(dLat / 2) +
            cos(Math.toRadians(lat1)) * cos(Math.toRadians(lat2)) *
            sin(dLon / 2) * sin(dLon / 2)
        return r * 2 * atan2(sqrt(a), sqrt(1 - a))
    }

    override fun onCleared() {
        PushTokenHolder.listener = null
        gameTickerJob?.cancel()
        liveChatJob?.cancel()
        liveChatSessionJob?.cancel()
        ticketJob?.cancel()
        searchJob?.cancel()
        super.onCleared()
    }
}
