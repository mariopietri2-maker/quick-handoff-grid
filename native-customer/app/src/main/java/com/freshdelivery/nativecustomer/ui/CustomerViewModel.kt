package com.freshdelivery.nativecustomer.ui

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.freshdelivery.nativecustomer.data.CartLine
import com.freshdelivery.nativecustomer.data.CustomerRepository
import com.freshdelivery.nativecustomer.data.CustomerTab
import com.freshdelivery.nativecustomer.data.DriverLocationRow
import com.freshdelivery.nativecustomer.data.MenuItemRow
import com.freshdelivery.nativecustomer.data.OrderUi
import com.freshdelivery.nativecustomer.data.ProfileRow
import com.freshdelivery.nativecustomer.data.StoreRow
import com.freshdelivery.nativecustomer.data.SupabaseModule
import com.freshdelivery.nativecustomer.push.PushTokenHolder
import com.google.firebase.messaging.FirebaseMessaging
import io.github.jan.supabase.auth.auth
import io.github.jan.supabase.auth.status.SessionStatus
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import kotlinx.coroutines.tasks.await
import kotlin.math.atan2
import kotlin.math.cos
import kotlin.math.sin
import kotlin.math.sqrt

data class CustomerUiState(
    val bootstrapping: Boolean = true,
    val signedIn: Boolean = false,
    val userId: String? = null,
    val profile: ProfileRow? = null,
    val tab: CustomerTab = CustomerTab.Home,
    val stores: List<StoreRow> = emptyList(),
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
    val driverLocation: DriverLocationRow? = null,
    val busy: Boolean = false,
    val error: String? = null,
    val info: String? = null,
) {
    val cartSubtotal: Double get() = cart.sumOf { it.price * it.quantity }
    val cartCount: Int get() = cart.sumOf { it.quantity }
    val grandTotal: Double get() = cartSubtotal + deliveryFee + tipAmount
}

class CustomerViewModel : ViewModel() {
    private val repo = CustomerRepository()
    private val _state = MutableStateFlow(CustomerUiState())
    val state: StateFlow<CustomerUiState> = _state.asStateFlow()
    private var pollJob: Job? = null

    init {
        PushTokenHolder.listener = { token ->
            val uid = _state.value.userId ?: return@listener
            viewModelScope.launch { runCatching { repo.upsertPushToken(uid, token) } }
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
                        _state.value = CustomerUiState(bootstrapping = false, signedIn = false)
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
            _state.value = _state.value.copy(
                profile = profile,
                deliveryFee = fees.platform_service_fee ?: 0.99,
            )
        }
        registerFcm(userId)
        refreshAll()
        startPolling()
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

    fun signOut() {
        viewModelScope.launch { repo.signOut() }
    }

    fun selectTab(tab: CustomerTab) {
        _state.value = _state.value.copy(tab = tab, showCart = false, selectedStore = null)
        when (tab) {
            CustomerTab.Orders, CustomerTab.Track -> refreshOrders()
            CustomerTab.Home -> refreshStores()
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

    fun setNotes(notes: String) {
        _state.value = _state.value.copy(notes = notes)
    }

    fun setTip(tip: Double) {
        _state.value = _state.value.copy(tipAmount = tip.coerceAtLeast(0.0))
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
        viewModelScope.launch {
            _state.value = _state.value.copy(busy = true, error = null)
            runCatching {
                var distanceKm: Double? = null
                val store = s.stores.find { it.id == storeId } ?: s.selectedStore
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
                )
            }.onSuccess {
                _state.value = _state.value.copy(
                    busy = false,
                    cart = emptyList(),
                    cartStoreId = null,
                    cartStoreName = null,
                    showCart = false,
                    tipAmount = 0.0,
                    notes = "",
                    info = "Η παραγγελία καταχωρήθηκε!",
                    tab = CustomerTab.Orders,
                )
                refreshOrders()
            }.onFailure { e ->
                _state.value = _state.value.copy(busy = false, error = e.message ?: "Αποτυχία παραγγελίας")
            }
        }
    }

    fun trackOrder(order: OrderUi?) {
        _state.value = _state.value.copy(trackingOrder = order, tab = CustomerTab.Track, showCart = false)
        refreshDriverLocation()
    }

    fun refreshAll() {
        refreshStores()
        refreshOrders()
    }

    fun refreshStores() {
        viewModelScope.launch {
            runCatching {
                _state.value = _state.value.copy(stores = repo.fetchStores())
            }.onFailure { e ->
                _state.value = _state.value.copy(error = e.message)
            }
        }
    }

    fun refreshOrders() {
        val uid = _state.value.userId ?: return
        viewModelScope.launch {
            runCatching {
                val orders = repo.fetchOrders(uid)
                val active = orders.firstOrNull {
                    it.order.status !in listOf("delivered", "cancelled", "rejected")
                }
                _state.value = _state.value.copy(
                    orders = orders,
                    trackingOrder = _state.value.trackingOrder ?: active,
                )
                refreshDriverLocation()
            }.onFailure { e ->
                _state.value = _state.value.copy(error = e.message)
            }
        }
    }

    private fun refreshDriverLocation() {
        val driverId = _state.value.trackingOrder?.order?.driver_id ?: return
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
                delay(5_000)
                if (_state.value.signedIn) {
                    if (_state.value.tab == CustomerTab.Track || _state.value.tab == CustomerTab.Orders) {
                        refreshOrders()
                    }
                }
            }
        }
    }

    fun clearMessages() {
        _state.value = _state.value.copy(error = null, info = null)
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
        super.onCleared()
    }
}
