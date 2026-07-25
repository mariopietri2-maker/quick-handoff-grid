package com.freshdelivery.nativedriver.ui

import android.app.Application
import android.media.MediaPlayer
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import com.freshdelivery.nativedriver.R
import com.freshdelivery.nativedriver.data.ActiveTripUi
import com.freshdelivery.nativedriver.data.DriverRepository
import com.freshdelivery.nativedriver.data.OfferUi
import com.freshdelivery.nativedriver.data.SupabaseProvider
import com.freshdelivery.nativedriver.location.DriverLocationService
import io.github.jan.supabase.auth.auth
import io.github.jan.supabase.auth.status.SessionStatus
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

data class DriverUiState(
    val bootstrapping: Boolean = true,
    val signedIn: Boolean = false,
    val userId: String? = null,
    val displayName: String? = null,
    val driverActive: Boolean = true,
    val online: Boolean = false,
    val offers: List<OfferUi> = emptyList(),
    val activeTrip: ActiveTripUi? = null,
    val busy: Boolean = false,
    val error: String? = null,
    val info: String? = null,
)

class DriverViewModel(app: Application) : AndroidViewModel(app) {
    private val repo = DriverRepository()
    private val _state = MutableStateFlow(DriverUiState())
    val state: StateFlow<DriverUiState> = _state.asStateFlow()

    private var pollJob: Job? = null
    private var realtimeJob: Job? = null
    private var mediaPlayer: MediaPlayer? = null
    private var lastOfferAlertKey: String? = null

    init {
        viewModelScope.launch {
            SupabaseProvider.client.auth.sessionStatus.collect { status ->
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
                        stopPolling()
                        _state.value = DriverUiState(bootstrapping = false, signedIn = false)
                    }
                    else -> Unit
                }
            }
        }
    }

    private suspend fun onSignedIn(userId: String) {
        val profile = runCatching { repo.loadProfile(userId) }.getOrNull()
        val driver = runCatching { repo.loadDriverProfile(userId) }.getOrNull()
        _state.value = _state.value.copy(
            displayName = profile?.full_name,
            driverActive = driver?.is_active != false,
        )
        refreshWork()
        startPolling()
        startRealtime(userId)
    }

    fun signIn(email: String, password: String) {
        viewModelScope.launch {
            _state.value = _state.value.copy(busy = true, error = null)
            runCatching { repo.signIn(email, password) }
                .onFailure { e ->
                    _state.value = _state.value.copy(
                        busy = false,
                        error = e.message ?: "Login failed",
                    )
                }
                .onSuccess {
                    _state.value = _state.value.copy(busy = false)
                }
        }
    }

    fun signOut() {
        viewModelScope.launch {
            setOnline(false)
            repo.signOut()
        }
    }

    fun setOnline(online: Boolean) {
        val uid = _state.value.userId ?: return
        viewModelScope.launch {
            _state.value = _state.value.copy(online = online, error = null)
            runCatching {
                repo.setShiftStarted(uid, online)
                if (online) {
                    DriverLocationService.start(getApplication())
                } else {
                    DriverLocationService.stop(getApplication())
                    repo.clearLocation(uid)
                }
            }.onFailure { e ->
                _state.value = _state.value.copy(
                    online = !online,
                    error = e.message ?: "Failed to update online state",
                )
            }
            if (online) refreshWork()
        }
    }

    fun refreshWork() {
        val uid = _state.value.userId ?: return
        viewModelScope.launch {
            runCatching {
                val trip = repo.fetchActiveTrip(uid)
                val offers = if (trip == null) repo.fetchPendingOffers(uid) else emptyList()
                _state.value = _state.value.copy(activeTrip = trip, offers = offers)
                maybeAlertOffers(offers)
            }.onFailure { e ->
                _state.value = _state.value.copy(error = e.message)
            }
        }
    }

    fun acceptOffer(offerId: String) {
        viewModelScope.launch {
            _state.value = _state.value.copy(busy = true, error = null)
            runCatching { repo.acceptOffer(offerId) }
                .onSuccess {
                    stopOfferSound()
                    _state.value = _state.value.copy(busy = false, info = "Προσφορά αποδεκτή")
                    refreshWork()
                }
                .onFailure { e ->
                    _state.value = _state.value.copy(
                        busy = false,
                        error = e.message ?: "Accept failed",
                    )
                    refreshWork()
                }
        }
    }

    fun declineOffer(offerId: String) {
        viewModelScope.launch {
            _state.value = _state.value.copy(busy = true, error = null)
            runCatching { repo.declineOffer(offerId) }
                .onSuccess {
                    stopOfferSound()
                    _state.value = _state.value.copy(busy = false)
                    refreshWork()
                }
                .onFailure { e ->
                    _state.value = _state.value.copy(
                        busy = false,
                        error = e.message ?: "Decline failed",
                    )
                }
        }
    }

    fun advanceTrip(nextStatus: String) {
        val orderId = _state.value.activeTrip?.order?.id ?: return
        viewModelScope.launch {
            _state.value = _state.value.copy(busy = true, error = null)
            runCatching { repo.transitionStatus(orderId, nextStatus) }
                .onSuccess {
                    _state.value = _state.value.copy(busy = false, info = "Status → $nextStatus")
                    refreshWork()
                }
                .onFailure { e ->
                    _state.value = _state.value.copy(
                        busy = false,
                        error = e.message ?: "Status update failed",
                    )
                }
        }
    }

    fun clearMessages() {
        _state.value = _state.value.copy(error = null, info = null)
    }

    private fun startPolling() {
        pollJob?.cancel()
        pollJob = viewModelScope.launch {
            while (true) {
                delay(8_000)
                if (_state.value.signedIn) refreshWork()
            }
        }
    }

    private fun stopPolling() {
        pollJob?.cancel()
        pollJob = null
        realtimeJob?.cancel()
        realtimeJob = null
        stopOfferSound()
    }

    private fun startRealtime(userId: String) {
        // MVP: polling every 8s is enough. Realtime can be added once filter API is wired.
        realtimeJob?.cancel()
        realtimeJob = null
    }

    private fun maybeAlertOffers(offers: List<OfferUi>) {
        val key = offers.joinToString(",") { it.offerId }
        if (key.isEmpty()) {
            lastOfferAlertKey = null
            stopOfferSound()
            return
        }
        if (key == lastOfferAlertKey) return
        lastOfferAlertKey = key
        playOfferSound()
    }

    private fun playOfferSound() {
        stopOfferSound()
        runCatching {
            mediaPlayer = MediaPlayer.create(getApplication(), R.raw.fresh_delivery)?.also {
                it.isLooping = false
                it.start()
            }
        }
    }

    private fun stopOfferSound() {
        runCatching {
            mediaPlayer?.stop()
            mediaPlayer?.release()
        }
        mediaPlayer = null
    }

    override fun onCleared() {
        stopPolling()
        super.onCleared()
    }
}
