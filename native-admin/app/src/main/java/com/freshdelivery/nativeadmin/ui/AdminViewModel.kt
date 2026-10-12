package com.freshdelivery.nativeadmin.ui

import android.app.Application
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import com.freshdelivery.nativeadmin.data.AdminRepository
import com.freshdelivery.nativeadmin.data.DriverUi
import com.freshdelivery.nativeadmin.data.OpsSnapshot
import com.freshdelivery.nativeadmin.data.OrderRow
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
    val error: String? = null,
    val info: String? = null,
    val tab: Int = 0,
    val drivers: List<DriverUi> = emptyList(),
    val orders: List<OrderRow> = emptyList(),
    val stores: List<StoreRow> = emptyList(),
    val snapshot: OpsSnapshot = OpsSnapshot(0, 0, 0, 0),
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
                        isAdmin = false,
                        bootstrapping = false,
                        error = "Μόνο λογαριασμοί admin",
                    )
                }
            } else {
                _state.value = _state.value.copy(bootstrapping = false)
            }
        }
    }

    fun signIn(email: String, password: String) {
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
        _state.value = _state.value.copy(tab = tab)
    }

    fun refresh() {
        viewModelScope.launch { loadAll() }
    }

    private fun startPolling() {
        pollJob?.cancel()
        pollJob = viewModelScope.launch {
            while (isActive) {
                loadAll()
                delay(8_000)
            }
        }
    }

    private suspend fun loadAll() {
        runCatching {
            val drivers = repo.loadDrivers()
            val orders = repo.loadOpenOrders()
            val stores = repo.loadStores()
            val snap = repo.snapshot(drivers, orders, stores)
            _state.value = _state.value.copy(
                drivers = drivers,
                orders = orders,
                stores = stores,
                snapshot = snap,
                error = null,
            )
        }.onFailure { e ->
            _state.value = _state.value.copy(error = e.message)
        }
    }

    fun forceEndShift(driverId: String) {
        viewModelScope.launch {
            _state.value = _state.value.copy(busy = true)
            runCatching { repo.forceEndShift(driverId) }
                .onSuccess {
                    _state.value = _state.value.copy(busy = false, info = "Shift τερματίστηκε")
                    loadAll()
                }
                .onFailure {
                    _state.value = _state.value.copy(busy = false, error = it.message)
                }
        }
    }

    fun setDriverActive(driverId: String, active: Boolean) {
        viewModelScope.launch {
            _state.value = _state.value.copy(busy = true)
            runCatching { repo.setDriverActive(driverId, active) }
                .onSuccess {
                    _state.value = _state.value.copy(busy = false, info = if (active) "Οδηγός ενεργός" else "Οδηγός ανενεργός")
                    loadAll()
                }
                .onFailure {
                    _state.value = _state.value.copy(busy = false, error = it.message)
                }
        }
    }

    fun forceOrderStatus(orderId: String, status: String) {
        viewModelScope.launch {
            _state.value = _state.value.copy(busy = true)
            runCatching { repo.forceOrderStatus(orderId, status) }
                .onSuccess {
                    _state.value = _state.value.copy(busy = false, info = "Status → $status")
                    loadAll()
                }
                .onFailure {
                    _state.value = _state.value.copy(busy = false, error = it.message)
                }
        }
    }
}
