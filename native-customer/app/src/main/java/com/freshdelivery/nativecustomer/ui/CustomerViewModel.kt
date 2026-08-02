package com.freshdelivery.nativecustomer.ui

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.freshdelivery.nativecustomer.data.CustomerRepository
import com.freshdelivery.nativecustomer.data.CustomerTab
import com.freshdelivery.nativecustomer.data.DriverLocationRow
import com.freshdelivery.nativecustomer.data.OrderUi
import com.freshdelivery.nativecustomer.data.ProfileRow
import com.freshdelivery.nativecustomer.data.StoreRow
import com.freshdelivery.nativecustomer.data.SupabaseModule
import io.github.jan.supabase.auth.auth
import io.github.jan.supabase.auth.status.SessionStatus
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

data class CustomerUiState(
    val bootstrapping: Boolean = true,
    val signedIn: Boolean = false,
    val userId: String? = null,
    val profile: ProfileRow? = null,
    val tab: CustomerTab = CustomerTab.Home,
    val stores: List<StoreRow> = emptyList(),
    val orders: List<OrderUi> = emptyList(),
    val trackingOrder: OrderUi? = null,
    val driverLocation: DriverLocationRow? = null,
    val busy: Boolean = false,
    val error: String? = null,
)

class CustomerViewModel : ViewModel() {
    private val repo = CustomerRepository()
    private val _state = MutableStateFlow(CustomerUiState())
    val state: StateFlow<CustomerUiState> = _state.asStateFlow()
    private var pollJob: Job? = null

    init {
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
            _state.value = _state.value.copy(profile = profile)
        }
        refreshAll()
        startPolling()
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
        _state.value = _state.value.copy(tab = tab)
        when (tab) {
            CustomerTab.Orders, CustomerTab.Track -> refreshOrders()
            CustomerTab.Home -> refreshStores()
            CustomerTab.Profile -> Unit
        }
    }

    fun trackOrder(order: OrderUi?) {
        _state.value = _state.value.copy(trackingOrder = order, tab = CustomerTab.Track)
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

    fun clearError() {
        _state.value = _state.value.copy(error = null)
    }
}
