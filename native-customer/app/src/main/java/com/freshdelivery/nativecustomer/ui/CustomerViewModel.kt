package com.freshdelivery.nativecustomer.ui

import com.freshdelivery.nativecustomer.util.userFacingError

import android.app.Application
import android.content.Intent
import android.net.Uri
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
import com.freshdelivery.nativecustomer.data.LoyaltyStatus
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
import kotlinx.serialization.json.contentOrNull
import kotlinx.serialization.json.jsonArray
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
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

/** How long the games section stays visible once it appears — then it hides for the rest of the day. */
private const val GAME_SHOW_WINDOW_MS = 5 * 60 * 1000L

data class PaymentSheetRequest(
    val orderId: String,
    val clientSecret: String,
    val publishableKey: String,
    val ephemeralKey: String? = null,
    val customerId: String? = null,
)

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
    /** Modifiers for current store menu (keyed by menu_item_id). */
    val menuModifiers: Map<String, List<com.freshdelivery.nativecustomer.data.MenuModifierRow>> = emptyMap(),
    val modifierPickerItem: com.freshdelivery.nativecustomer.data.MenuItemRow? = null,
    /** Stripe PaymentSheet launch request (consumed by MainActivity). */
    val paymentSheetRequest: PaymentSheetRequest? = null,
    val reviewedOrderIds: Set<String> = emptySet(),
    val loyalty: LoyaltyStatus? = null,
    val orders: List<OrderUi> = emptyList(),
    val trackingOrder: OrderUi? = null,
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
    private var searchJob: Job? = null
    private var cachedStores: List<StoreRow> = emptyList()
    private var gameShowUntilMs = 0L

    init {
        _state.value = _state.value.copy(gameShow = rollDailyGameShow())
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
                            gameShow = rollDailyGameShow(),
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
                    _state.value = _state.value.copy(busy = false, error = userFacingError(e, "Αποτυχία σύνδεσης"))
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
                    _state.value = _state.value.copy(busy = false, error = userFacingError(e, "Αποτυχία εγγραφής"))
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
                _state.value = _state.value.copy(savingProfile = false, error = userFacingError(e, "Αποτυχία αποθήκευσης προφίλ"))
            }
        }
    }

    fun setSearchQuery(q: String) {
        _state.value = _state.value.copy(searchQuery = q)
        searchJob?.cancel()
        val trimmed = q.trim()
        if (trimmed.isBlank()) {
            if (cachedStores.isNotEmpty()) {
                _state.value = _state.value.copy(stores = cachedStores)
            } else {
                refreshStores()
            }
            return
        }
        searchJob = viewModelScope.launch {
            delay(220)
            val results = repo.searchStores(trimmed)
            if (_state.value.searchQuery.trim() == trimmed) {
                _state.value = _state.value.copy(stores = results)
            }
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
                _state.value = _state.value.copy(locating = false, error = userFacingError(e, "Αποτυχία τοποθεσίας"))
            }
        }
    }

    /** Live address suggestions while typing (Mapbox). */
    fun onAddressQuery(query: String) {
        _state.value = _state.value.copy(deliveryAddress = query)
        if (query.trim().length < 4) {
            _state.value = _state.value.copy(addressSuggestions = emptyList())
            return
        }
        viewModelScope.launch {
            kotlinx.coroutines.delay(350)
            if (_state.value.deliveryAddress != query) return@launch
            val hits = runCatching { forwardGeocodeMany(query) }.getOrNull().orEmpty()
            if (_state.value.deliveryAddress == query) {
                _state.value = _state.value.copy(addressSuggestions = hits)
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


    /** Strict Ioannina service area — suggestions outside are dropped. */
    private fun isIoanninaSuggestion(label: String, lat: Double, lng: Double): Boolean {
        val inBox = lat in 39.55..39.82 && lng in 20.70..21.05
        if (!inBox) return false
        val l = label.lowercase()
        val blocked = listOf(
            "αθήνα", "athens", "θεσσαλονίκη", "thessaloniki", "πάτρα", "patra",
            "λάρισα", "ηράκλειο", "βόλος", "καβάλα",
        )
        if (blocked.any { it in l }) return false
        return true
    }

    private suspend fun forwardGeocodeMany(address: String): List<AddressSuggestion> = withContext(Dispatchers.IO) {
        val q = address.trim()
        if (q.length < 3) return@withContext emptyList()
        val cityBias = listOf("ιωανν", "ioannina", "γιάννεν")
        val hasCity = cityBias.any { q.lowercase().contains(it) }
        val queries = buildList {
            add(q)
            if (!hasCity) {
                add("$q Ιωάννινα")
                add("$q, Ιωάννινα")
            }
        }.distinct()
        val token = com.freshdelivery.nativecustomer.BuildConfig.MAPBOX_TOKEN
        val proximity = "proximity=20.8529,39.6675&bbox=20.70,39.55,21.05,39.82"
        fun mapboxQuery(query: String): List<AddressSuggestion> = runCatching {
            val url = java.net.URL(
                "https://api.mapbox.com/geocoding/v5/mapbox.places/" +
                    java.net.URLEncoder.encode(query, "UTF-8") +
                    ".json?access_token=$token&country=gr&language=el&limit=6" +
                    "&types=address,place,locality,neighborhood,poi&$proximity",
            )
            val conn = (url.openConnection() as java.net.HttpURLConnection).apply {
                connectTimeout = 8000
                readTimeout = 8000
                requestMethod = "GET"
            }
            if (conn.responseCode !in 200..299) {
                conn.errorStream?.bufferedReader()?.readText()
                return@runCatching emptyList()
            }
            val body = conn.inputStream.bufferedReader().readText()
            val root = kotlinx.serialization.json.Json.parseToJsonElement(body).jsonObject
            val features = root["features"]?.jsonArray.orEmpty()
            features.mapNotNull { f ->
                val obj = f.jsonObject
                val place = obj["place_name"]?.jsonPrimitive?.contentOrNull ?: return@mapNotNull null
                val center = obj["center"]?.jsonArray ?: return@mapNotNull null
                val lng = center.getOrNull(0)?.jsonPrimitive?.content?.toDoubleOrNull() ?: return@mapNotNull null
                val lat = center.getOrNull(1)?.jsonPrimitive?.content?.toDoubleOrNull() ?: return@mapNotNull null
                AddressSuggestion(place, lat, lng)
            }
        }.getOrElse { emptyList() }

        val mapbox = queries.flatMap { mapboxQuery(it) }
            .filter { isIoanninaSuggestion(it.label, it.lat, it.lng) }
            .distinctBy { it.label }
        if (mapbox.isNotEmpty()) return@withContext mapbox
        val geoQueries = if (hasCity) listOf(q) else listOf(q, "$q Ιωάννινα")
        geoQueries.flatMap { gq ->
            runCatching {
                @Suppress("DEPRECATION")
                Geocoder(getApplication(), Locale.getDefault())
                    .getFromLocationName(gq, 5)
                    ?.mapNotNull { a ->
                        val line = a.getAddressLine(0) ?: return@mapNotNull null
                        if (!isIoanninaSuggestion(line, a.latitude, a.longitude)) return@mapNotNull null
                        AddressSuggestion(line, a.latitude, a.longitude)
                    }
                    .orEmpty()
            }.getOrElse { emptyList() }
        }.distinctBy { it.label }
    }

    fun signOut() {
        viewModelScope.launch {
            runCatching { repo.signOut() }
            // Clear UI immediately even if sessionStatus is slow/missed.
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
            runCatching { repo.unsubscribeAll() }
            val gameActive = _state.value.gameActive
            val cards = _state.value.cards
            _state.value = CustomerUiState(bootstrapping = false, signedIn = false).copy(
                gameActive = gameActive,
                cards = cards,
                gameShow = rollDailyGameShow(),
                info = "Αποσυνδέθηκες.",
            )
        }
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
                val menu = repo.fetchMenu(store.id)
                val mods = repo.fetchModifiers(menu.map { it.id })
                val byItem = mods.groupBy { it.menu_item_id }
                _state.value = _state.value.copy(
                    menu = menu,
                    menuModifiers = byItem,
                    busy = false,
                )
            }.onFailure { e ->
                _state.value = _state.value.copy(busy = false, error = userFacingError(e))
            }
        }
    }

    fun closeStore() {
        _state.value = _state.value.copy(selectedStore = null, menu = emptyList())
    }

    fun addToCart(item: MenuItemRow) {
        val mods = _state.value.menuModifiers[item.id].orEmpty()
        if (mods.isNotEmpty()) {
            _state.value = _state.value.copy(modifierPickerItem = item)
            return
        }
        addToCartWithModifiers(item, emptyList())
    }

    fun dismissModifierPicker() {
        _state.value = _state.value.copy(modifierPickerItem = null)
    }

    fun confirmModifiers(item: MenuItemRow, selected: List<com.freshdelivery.nativecustomer.data.MenuModifierRow>) {
        addToCartWithModifiers(item, selected)
        _state.value = _state.value.copy(modifierPickerItem = null)
    }

    private fun addToCartWithModifiers(
        item: MenuItemRow,
        selected: List<com.freshdelivery.nativecustomer.data.MenuModifierRow>,
    ) {
        val s = _state.value
        val storeId = s.selectedStore?.id ?: return
        if (s.cartStoreId != null && s.cartStoreId != storeId) {
            _state.value = s.copy(error = "Άδειασε το καλάθι για άλλο κατάστημα")
            return
        }
        val extra = selected.sumOf { it.price_delta }
        val label = selected.joinToString(", ") { it.option_name }
        val name = if (label.isBlank()) item.name else "${item.name} ($label)"
        val unit = item.price + extra
        val keyIds = selected.map { it.id }.sorted()
        val existing = s.cart.indexOfFirst {
            it.menuItemId == item.id && it.selectedModifierIds.sorted() == keyIds
        }
        val next = s.cart.toMutableList()
        if (existing >= 0) {
            val line = next[existing]
            next[existing] = line.copy(quantity = line.quantity + 1)
        } else {
            next.add(
                CartLine(
                    menuItemId = item.id,
                    name = name,
                    price = unit,
                    quantity = 1,
                    modifierLabel = label,
                    selectedModifierIds = keyIds,
                ),
            )
        }
        _state.value = s.copy(
            cart = next,
            cartStoreId = storeId,
            cartStoreName = s.selectedStore?.name,
            error = null,
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
        val store = s.stores.find { it.id == storeId } ?: s.selectedStore
        if (store == null) {
            _state.value = s.copy(error = "Δεν βρέθηκε το κατάστημα")
            return
        }
        if (store.is_active == false) {
            _state.value = s.copy(error = "Το κατάστημα δεν δέχεται παραγγελίες αυτή τη στιγμή")
            return
        }
        if (store.status_override == "closed") {
            _state.value = s.copy(error = "Το κατάστημα είναι προσωρινά κλειστό — δοκίμασε αργότερα")
            return
        }
        val sLat = store.latitude
        val sLng = store.longitude
        val dLat0 = s.deliveryLat
        val dLng0 = s.deliveryLng
        if (sLat != null && sLng != null && dLat0 != null && dLng0 != null) {
            val nearStore = haversineKm(sLat, sLng, dLat0, dLng0) < 0.05
            val addrLooksLikeStore = !store.address.isNullOrBlank() &&
                s.deliveryAddress.trim().equals(store.address!!.trim(), ignoreCase = true)
            if (nearStore || addrLooksLikeStore) {
                _state.value = s.copy(
                    error = "Η διεύθυνση παράδοσης είναι ίδια με του καταστήματος. Επίλεξε τη διεύθυνση του σπιτιού σου.",
                )
                return
            }
        }
        viewModelScope.launch {
            _state.value = _state.value.copy(busy = true, error = null)
            runCatching {
                var distanceKm: Double? = null
                val dLat = s.deliveryLat
                val dLng = s.deliveryLng
                if (store?.latitude != null && store.longitude != null && dLat != null && dLng != null) {
                    distanceKm = haversineKm(store.latitude, store.longitude, dLat, dLng)
                }
                val payMethod = if (s.paymentMethod == "card") "card" else "cash"
                repo.placeOrder(
                    storeId = storeId,
                    items = s.cart,
                    deliveryAddress = s.deliveryAddress.trim(),
                    deliveryLat = s.deliveryLat,
                    deliveryLng = s.deliveryLng,
                    paymentMethod = payMethod,
                    tipAmount = s.tipAmount,
                    deliveryFee = s.deliveryFee,
                    notes = s.notes.ifBlank { null },
                    distanceKm = distanceKm,
                    promoCode = s.appliedDeal?.code,
                )
            }.onSuccess { placedId ->
                persistLastAddress()
                saveAddress()
                val placed = placedId.trim().trim('"').takeIf { it.isNotBlank() }
                val storeName = s.cartStoreName ?: store?.name
                val wasCard = s.paymentMethod == "card"
                _state.value = _state.value.copy(
                    busy = false,
                    cart = emptyList(),
                    cartStoreId = null,
                    cartStoreName = null,
                    showCart = false,
                    selectedStore = null,
                    menu = emptyList(),
                    tipAmount = 0.0,
                    notes = "",
                    addressSuggestions = emptyList(),
                    paymentMethod = "cash",
                    info = if (wasCard) {
                        "Παραγγελία καταχωρήθηκε. Ολοκλήρωσε την πληρωμή με κάρτα στο browser."
                    } else {
                        "Η παραγγελία καταχωρήθηκε! Παρακολούθησε την παράδοση."
                    },
                    appliedDeal = null,
                    tab = CustomerTab.Track,
                )
                if (placed != null) {
                    autoOpenTrack(
                        orderId = placed,
                        storeId = storeId,
                        storeName = storeName,
                        storeLat = store?.latitude,
                        storeLng = store?.longitude,
                    )
                    if (wasCard) {
                        launchNativePaymentSheet(placed)
                    }
                } else {
                    _state.value = _state.value.copy(tab = CustomerTab.Orders)
                    refreshOrders()
                }
  }.onFailure { e ->
                _state.value = _state.value.copy(busy = false, error = userFacingError(e, "Αποτυχία παραγγελίας"))
            }
        }
    }

    fun trackOrder(order: OrderUi?) {
        _state.value = _state.value.copy(trackingOrder = order, tab = CustomerTab.Track, showCart = false)
        refreshDriverLocation()
        ensureDeliveryCoordsOnTrack(order)
    }


    private fun launchNativePaymentSheet(orderId: String) {
        viewModelScope.launch {
            _state.value = _state.value.copy(busy = true, error = null)
            runCatching { repo.createPaymentSheet(orderId) }
                .onSuccess { payload ->
                    if (payload.publishableKey.isBlank() || payload.paymentIntentClientSecret.isBlank()) {
                        _state.value = _state.value.copy(busy = false, error = "Stripe δεν είναι ρυθμισμένο.")
                        openCardPaymentInBrowser(orderId)
                        return@onSuccess
                    }
                    _state.value = _state.value.copy(
                        busy = false,
                        paymentSheetRequest = PaymentSheetRequest(
                            orderId = orderId,
                            clientSecret = payload.paymentIntentClientSecret,
                            publishableKey = payload.publishableKey,
                            ephemeralKey = payload.ephemeralKey,
                            customerId = payload.customerId,
                        ),
                        info = "Ολοκλήρωσε την πληρωμή στο φύλλο κάρτας.",
                    )
                }
                .onFailure { e ->
                    _state.value = _state.value.copy(
                        busy = false,
                        error = userFacingError(e, "Αποτυχία πληρωμής"),
                    )
                    openCardPaymentInBrowser(orderId)
                }
        }
    }

    fun clearPaymentSheetRequest() {
        _state.value = _state.value.copy(paymentSheetRequest = null)
    }

    fun onPaymentSheetResult(success: Boolean, message: String?) {
        clearPaymentSheetRequest()
        if (success) {
            _state.value = _state.value.copy(info = "Η πληρωμή ολοκληρώθηκε!")
            refreshOrders()
        } else if (!message.isNullOrBlank()) {
            _state.value = _state.value.copy(error = message)
        }
    }

    fun submitReview(orderId: String, storeId: String, rating: Int, comment: String) {
        viewModelScope.launch {
            val ok = repo.submitReview(orderId, storeId, rating, comment.ifBlank { null })
            if (ok) {
                _state.value = _state.value.copy(
                    reviewedOrderIds = _state.value.reviewedOrderIds + orderId,
                    info = "Ευχαριστούμε για την κριτική!",
                )
            } else {
                _state.value = _state.value.copy(error = "Αποτυχία υποβολής κριτικής")
            }
        }
    }

    private fun openCardPaymentInBrowser(orderId: String) {
        runCatching {
            val uri = Uri.parse("https://freshdelivery.app/order-tracking/$orderId?pay=1")
            val intent = Intent(Intent.ACTION_VIEW, uri).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            getApplication<Application>().startActivity(intent)
        }
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
        ensureDeliveryCoordsOnTrack(hint)
        viewModelScope.launch {
            runCatching { repo.fetchOrders(s.userId.orEmpty()) }
                .onSuccess { orders ->
                    val authoritative = orders.firstOrNull { it.order.id == orderId }
                    // Prefer server row, but keep local delivery coords if server still null.
                    var tracked = authoritative ?: _state.value.trackingOrder
                    tracked = tracked?.let { t ->
                        if (t.order.delivery_latitude == null || t.order.delivery_longitude == null) {
                            val st = _state.value
                            if (st.deliveryLat != null && st.deliveryLng != null) {
                                t.copy(
                                    order = t.order.copy(
                                        delivery_latitude = st.deliveryLat,
                                        delivery_longitude = st.deliveryLng,
                                        delivery_address = t.order.delivery_address
                                            ?: st.deliveryAddress.takeIf { it.isNotBlank() },
                                    ),
                                )
                            } else t
                        } else t
                    }
                    // Keep store coords from optimistic hint if server join missed them
                    if (tracked != null && (tracked.storeLat == null || tracked.storeLng == null) &&
                        (storeLat != null && storeLng != null)
                    ) {
                        tracked = tracked.copy(storeLat = storeLat, storeLng = storeLng, storeName = tracked.storeName ?: storeName)
                    }
                    _state.value = _state.value.copy(
                        orders = orders,
                        trackingOrder = tracked,
                    )
                    refreshDriverLocation()
                    ensureDeliveryCoordsOnTrack(tracked)
                }
        }
    }

    /**
     * If tracking order has address text but no lat/lng, forward-geocode
     * so the green delivery pin appears on the map.
     */
    private fun ensureDeliveryCoordsOnTrack(order: OrderUi?) {
        if (order == null) return
        val hasCoords = order.order.delivery_latitude != null && order.order.delivery_longitude != null
        if (hasCoords) return
        val addr = order.order.delivery_address?.trim().orEmpty()
        if (addr.isBlank()) return
        viewModelScope.launch {
            val hit = runCatching { forwardGeocodeMany(addr) }.getOrNull()?.firstOrNull() ?: return@launch
            val cur = _state.value.trackingOrder ?: return@launch
            if (cur.order.id != order.order.id) return@launch
            _state.value = _state.value.copy(
                trackingOrder = cur.copy(
                    order = cur.order.copy(
                        delivery_latitude = hit.lat,
                        delivery_longitude = hit.lng,
                    ),
                ),
            )
        }
    }

    fun refreshAll() {
        refreshStores()
        refreshOrders()
        refreshLoyalty()
    }

    fun refreshStores() {
        viewModelScope.launch {
            runCatching {
                val stores = repo.fetchStores()
                val ratings = repo.fetchStoreRatings()
                cachedStores = stores
                _state.value = _state.value.copy(
                    stores = stores,
                    storeRatings = ratings,
                )
            }.onFailure { e ->
                _state.value = _state.value.copy(error = userFacingError(e))
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
                _state.value = _state.value.copy(favoriteStoreIds = cur, error = userFacingError(e))
            }
        }
    }

    fun refreshOrders() {
        val uid = _state.value.userId ?: return
        viewModelScope.launch {
            runCatching {
                val orders = repo.fetchOrders(uid)
                val active = orders.firstOrNull { it.order.status !in TERMINAL_STATUSES }
                val prev = _state.value.trackingOrder
                var tracked = prev
                    ?.let { cur -> orders.firstOrNull { it.order.id == cur.order.id } }
                    ?: active
                // Preserve delivery/store coords from previous tracking row if refresh lost them
                if (tracked != null && prev != null && tracked.order.id == prev.order.id) {
                    if (tracked.order.delivery_latitude == null && prev.order.delivery_latitude != null) {
                        tracked = tracked.copy(
                            order = tracked.order.copy(
                                delivery_latitude = prev.order.delivery_latitude,
                                delivery_longitude = prev.order.delivery_longitude,
                            ),
                        )
                    }
                    if (tracked.storeLat == null && prev.storeLat != null) {
                        tracked = tracked.copy(storeLat = prev.storeLat, storeLng = prev.storeLng)
                    }
                }
                _state.value = _state.value.copy(orders = orders, trackingOrder = tracked)
                refreshDriverLocation()
                ensureDeliveryCoordsOnTrack(tracked)
            }.onFailure { e ->
                _state.value = _state.value.copy(error = userFacingError(e))
            }
        }
    }

    fun refreshLoyalty() {
        val uid = _state.value.userId ?: return
        viewModelScope.launch {
            runCatching { repo.fetchLoyaltyStatus() }
                .onSuccess { loyalty -> _state.value = _state.value.copy(loyalty = loyalty) }
        }
    }

    private fun refreshDriverLocation() {
        val driverId = _state.value.trackingOrder?.order?.driver_id
        if (driverId.isNullOrBlank()) {
            stopWatchingDriver()
            if (_state.value.driverLocation != null) {
                _state.value = _state.value.copy(driverLocation = null)
            }
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
        gameShowUntilMs = System.currentTimeMillis() + GAME_SHOW_WINDOW_MS
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
                        ticketError = userFacingError(e, "Δεν φορτώθηκαν τα αιτήματα"),
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
                    ticketError = userFacingError(e, "Αποτυχία υποβολής"),
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
                        ticketError = userFacingError(e, "Δεν φορτώθηκε το αίτημα"),
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

    /**
     * One roll per calendar day — decides if the games section shows customers.
     * Wheel appears with 30% probability, mystery cards with 40%. Resets at midnight.
     * When it appears it stays visible for 5 minutes only; after that it hides
     * (live via the game ticker) and does not return until the next day's roll.
     */
    private fun rollDailyGameShow(): Boolean {
        val chance = if (_state.value.gameActive == "cards") 0.4 else 0.3
        val prefs = getApplication<Application>().getSharedPreferences("fresh_customer", Context.MODE_PRIVATE)
        if (prefs.getString("game_show_day", null) == todayKey()) {
            if (!prefs.getBoolean("game_show_today", false)) {
                gameShowUntilMs = 0L
                return false
            }
            val shownAt = prefs.getLong("game_shown_at", 0L)
            val until = shownAt + GAME_SHOW_WINDOW_MS
            gameShowUntilMs = until
            return System.currentTimeMillis() < until
        }
        val show = Random.nextDouble() < chance
        gameShowUntilMs = if (show) System.currentTimeMillis() + GAME_SHOW_WINDOW_MS else 0L
        prefs.edit()
            .putString("game_show_day", todayKey())
            .putBoolean("game_show_today", show)
            .putLong("game_shown_at", System.currentTimeMillis())
            .apply()
        return show
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
                        gameShow = if (s.gameEnabled) rollDailyGameShow() else false,
                    )
                } else {
                    val expired = gameShowUntilMs > 0 && System.currentTimeMillis() >= gameShowUntilMs
                    if (expired) {
                        gameShowUntilMs = 0L
                        _state.value = s.copy(dealSeconds = s.dealSeconds - 1, gameShow = false)
                    } else {
                        _state.value = s.copy(dealSeconds = s.dealSeconds - 1)
                    }
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
