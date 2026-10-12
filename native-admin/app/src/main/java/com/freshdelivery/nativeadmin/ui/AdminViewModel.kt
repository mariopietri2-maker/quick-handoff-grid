package com.freshdelivery.nativeadmin.ui

import android.app.Application
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import com.freshdelivery.nativeadmin.data.AdminRepository
import com.freshdelivery.nativeadmin.data.LoginPrefs
import com.freshdelivery.nativeadmin.data.DriverUi
import com.freshdelivery.nativeadmin.data.OpsSnapshot
import com.freshdelivery.nativeadmin.data.OrderRow
import com.freshdelivery.nativeadmin.data.StoreCallRow
import com.freshdelivery.nativeadmin.data.StoreRow
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch

data class AdminUiState(
    val bootstrapping: Boolean = true,
    val signedIn: Boolean = false,
    val isAdmin: Boolean = false,
    val busy: Boolean = false,
    val refreshing: Boolean = false,
    val error: String? = null,
    val info: String? = null,
    val tab: Int = 0,
    val query: String = "",
    val driverFilter: String = "all", // all | online | break | offline | ghost
    val orderFilter: String = "all",
    val drivers: List<DriverUi> = emptyList(),
    val orders: List<OrderRow> = emptyList(),
    val stores: List<StoreRow> = emptyList(),
    val storeCalls: List<StoreCallRow> = emptyList(),
    val snapshot: OpsSnapshot = OpsSnapshot(0, 0, 0, 0, 0, 0, 0),
    val selectedDriverId: String? = null,
    val selectedOrderId: String? = null,
    val assignOrderId: String? = null,
    val lastUpdated: Long = 0L,
)

class AdminViewModel(app: Application) : AndroidViewModel(app) {
    private val repo = AdminRepository()
    private val _state = MutableStateFlow(AdminUiState())
    val state: StateFlow<AdminUiState> = _state.asStateFlow()
    private var pollJob: Job? = null

    init {
        viewModelScope.launch {
            val uid = repo.currentUserId()
            if (uid != null) {
                val admin = runCatching { repo.isAdmin(uid) }.getOrDefault(false)
                if (admin) {
                    _state.value = _state.value.copy(signedIn = true, isAdmin = true, bootstrapping = false)
                    startPolling()
                } else {
                    repo.signOut()
                    _state.value = _state.value.copy(
                        signedIn = false,
                        bootstrapping = false,
                        error = "Μόνο λογαριασμοί admin",
                    )
                }
            } else {
                _state.value = _state.value.copy(bootstrapping = false)
            }
        }
    }

    fun signIn(email: String, password: String, remember: Boolean = true) {
        viewModelScope.launch {
            _state.value = _state.value.copy(busy = true, error = null)
            runCatching {
                repo.signIn(email, password)
                val uid = repo.currentUserId() ?: error("No session")
                if (!repo.isAdmin(uid)) {
                    repo.signOut()
                    error("Μόνο λογαριασμοί admin")
                }
            }.onSuccess {
                LoginPrefs.save(getApplication(), email, password, remember)
                _state.value = _state.value.copy(busy = false, signedIn = true, isAdmin = true)
                startPolling()
            }.onFailure { e ->
                _state.value = _state.value.copy(busy = false, error = e.message ?: "Αποτυχία σύνδεσης")
            }
        }
    }

    fun signOut() {
        pollJob?.cancel()
        viewModelScope.launch {
            repo.signOut()
            _state.value = AdminUiState(bootstrapping = false)
        }
    }

    fun setTab(tab: Int) {
        _state.value = _state.value.copy(tab = tab, selectedDriverId = null, selectedOrderId = null)
    }

    fun setQuery(q: String) {
        _state.value = _state.value.copy(query = q)
    }

    fun setDriverFilter(f: String) {
        _state.value = _state.value.copy(driverFilter = f)
    }

    fun setOrderFilter(f: String) {
        _state.value = _state.value.copy(orderFilter = f)
    }

    fun selectDriver(id: String?) {
        _state.value = _state.value.copy(selectedDriverId = id)
    }

    fun selectOrder(id: String?) {
        _state.value = _state.value.copy(selectedOrderId = id)
    }

    fun beginAssign(orderId: String) {
        _state.value = _state.value.copy(assignOrderId = orderId, tab = 1)
    }

    fun clearAssign() {
        _state.value = _state.value.copy(assignOrderId = null)
    }

    fun refresh() {
        viewModelScope.launch {
            _state.value = _state.value.copy(refreshing = true)
            loadAll()
            _state.value = _state.value.copy(refreshing = false)
        }
    }

    private fun startPolling() {
        pollJob?.cancel()
        pollJob = viewModelScope.launch {
            while (isActive) {
                loadAll()
                delay(6_000)
            }
        }
    }

    private suspend fun loadAll() {
        runCatching {
            val drivers = repo.loadDrivers()
            val orders = repo.loadOpenOrders()
            val stores = repo.loadStores()
            val calls = repo.loadStoreCalls()
            val snap = repo.snapshot(drivers, orders, stores, calls)
            _state.value = _state.value.copy(
                drivers = drivers,
                orders = orders,
                stores = stores,
                storeCalls = calls,
                snapshot = snap,
                error = null,
                lastUpdated = System.currentTimeMillis(),
            )
        }.onFailure { e ->
            _state.value = _state.value.copy(error = e.message)
        }
    }

    fun forceEndShift(driverId: String) = act("Shift τερματίστηκε") {
        repo.forceEndShift(driverId)
    }

    fun setDriverActive(driverId: String, active: Boolean) = act(
        if (active) "Οδηγός ενεργός" else "Οδηγός ανενεργός",
    ) {
        repo.setDriverActive(driverId, active)
    }

    fun forceOrderStatus(orderId: String, status: String) = act("Status → $status") {
        repo.forceOrderStatus(orderId, status)
    }

    fun assignDriver(orderId: String, driverId: String) = act("Οδηγός ανατέθηκε") {
        repo.assignOrderDriver(orderId, driverId)
        _state.value = _state.value.copy(assignOrderId = null)
    }

    fun closeCall(callId: String) = act("Κλήση έκλεισε") {
        repo.closeStoreCall(callId)
    }

    private fun act(okMsg: String, block: suspend () -> Unit) {
        viewModelScope.launch {
            _state.value = _state.value.copy(busy = true, error = null, info = null)
            runCatching { block() }
                .onSuccess {
                    _state.value = _state.value.copy(busy = false, info = okMsg)
                    loadAll()
                }
                .onFailure {
                    _state.value = _state.value.copy(busy = false, error = it.message)
                }
        }
    }

    fun filteredDrivers(): List<DriverUi> {
        val s = _state.value
        val q = s.query.trim().lowercase()
        return s.drivers.filter { d ->
            val matchQ = q.isEmpty() ||
                d.name.lowercase().contains(q) ||
                d.id.lowercase().contains(q) ||
                (d.phone?.contains(q) == true)
            val matchF = when (s.driverFilter) {
                "online" -> d.online && !d.onBreak
                "break" -> d.online && d.onBreak
                "offline" -> !d.online
                "ghost" -> d.callRole in setOf("K", "both")
                "inactive" -> !d.active
                else -> true
            }
            matchQ && matchF
        }
    }

    fun filteredOrders(): List<OrderRow> {
        val s = _state.value
        val q = s.query.trim().lowercase()
        val storeNames = s.stores.associate { it.id to it.name }
        return s.orders.filter { o ->
            val matchQ = q.isEmpty() ||
                o.id.lowercase().contains(q) ||
                (o.delivery_address?.lowercase()?.contains(q) == true) ||
                (storeNames[o.store_id ?: ""]?.lowercase()?.contains(q) == true)
            val matchF = when (s.orderFilter) {
                "kitchen" -> o.status in setOf("placed", "accepted", "preparing", "ready")
                "road" -> o.status in setOf("picked_up", "delivering")
                "unassigned" -> o.driver_id.isNullOrBlank() && o.status in setOf("ready", "placed", "accepted")
                else -> true
            }
            matchQ && matchF
        }
    }
}
