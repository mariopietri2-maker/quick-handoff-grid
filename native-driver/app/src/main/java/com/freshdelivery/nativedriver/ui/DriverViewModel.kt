package com.freshdelivery.nativedriver.ui

import android.app.Application
import android.media.AudioManager
import android.media.MediaPlayer
import android.media.RingtoneManager
import android.media.ToneGenerator
import android.os.Build
import android.os.VibrationEffect
import android.os.Vibrator
import android.os.VibratorManager
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import com.freshdelivery.nativedriver.R
import com.freshdelivery.nativedriver.data.ActiveTripUi
import com.freshdelivery.nativedriver.data.DriverNotificationRow
import com.freshdelivery.nativedriver.data.DriverPreferences
import com.freshdelivery.nativedriver.data.DriverProfileRow
import com.freshdelivery.nativedriver.data.DriverRepository
import com.freshdelivery.nativedriver.data.OpsHelper
import com.freshdelivery.nativedriver.data.DriverStateRow
import com.freshdelivery.nativedriver.data.DriverTab
import com.freshdelivery.nativedriver.data.LiveChatMessageRow
import com.freshdelivery.nativedriver.data.MoneyUi
import com.freshdelivery.nativedriver.data.OfferSoundId
import com.freshdelivery.nativedriver.data.OfferUi
import com.freshdelivery.nativedriver.data.PlatformSettingsRow
import com.freshdelivery.nativedriver.data.ProfileRow
import com.freshdelivery.nativedriver.data.ReferralRow
import com.freshdelivery.nativedriver.data.SupabaseProvider
import com.freshdelivery.nativedriver.data.SupportTicketRow
import com.freshdelivery.nativedriver.data.TicketMessageRow
import com.freshdelivery.nativedriver.data.StoreCallRow
import com.freshdelivery.nativedriver.data.ActiveStoreCallRow
import com.freshdelivery.nativedriver.data.StoreRow
import io.github.jan.supabase.realtime.PostgresAction
import com.freshdelivery.nativedriver.location.DriverGeo
import com.freshdelivery.nativedriver.location.DriverLocationService
import com.freshdelivery.nativedriver.location.DriverLocationTracker
import com.freshdelivery.nativedriver.push.DriverPushTokenHolder
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
import com.freshdelivery.nativedriver.push.StoreCallSignal

data class DriverSettings(
    val offerSound: Boolean = true,
    val vibration: Boolean = true,
    val keepScreenOn: Boolean = true,
    val notifyOffers: Boolean = true,
    val soundId: String = OfferSoundId.CLASSIC.id,
    val mapStyleLight: Boolean = false,
)

data class DriverUiState(
    val bootstrapping: Boolean = true,
    val signedIn: Boolean = false,
    val userId: String? = null,
    val profile: ProfileRow? = null,
    val driverProfile: DriverProfileRow? = null,
    val driverState: DriverStateRow? = null,
    val settings: PlatformSettingsRow = PlatformSettingsRow(),
    val settingsLocal: DriverSettings = DriverSettings(),
    val online: Boolean = false,
    val tab: DriverTab = DriverTab.Home,
    val offers: List<OfferUi> = emptyList(),
    val stackedOffers: List<OfferUi> = emptyList(),
    val activeTrips: List<ActiveTripUi> = emptyList(),
    val money: MoneyUi? = null,
    val notifications: List<DriverNotificationRow> = emptyList(),
    val tickets: List<SupportTicketRow> = emptyList(),
    val chatTicketId: String? = null,
    val chatMessages: List<TicketMessageRow> = emptyList(),
    val chatAgents: Map<String, String> = emptyMap(),
    val chatLoading: Boolean = false,
    val chatSubscribed: Boolean = false,
    val liveChatOpen: Boolean = false,
    val liveChatMessages: List<LiveChatMessageRow> = emptyList(),
    val liveChatAgents: Map<String, String> = emptyMap(),
    val liveChatLoading: Boolean = false,
    val liveChatSubscribed: Boolean = false,
    val liveChatError: String? = null,
    val supportOpen: Boolean = false,
    val mapStores: List<StoreRow> = emptyList(),
    val storeCounts: Map<String, Long> = emptyMap(),
    val referralCode: String? = null,
    val referrals: List<ReferralRow> = emptyList(),
    val geo: DriverGeo? = null,
    val busy: Boolean = false,
    val error: String? = null,
    val info: String? = null,
    val isOps: Boolean = false,
    val opsOpen: Boolean = false,
    val opsOrders: List<OfferUi> = emptyList(),
    val storeCalls: List<StoreCallRow> = emptyList(),
    val activeStoreCall: ActiveStoreCallRow? = null,
) {
    val driverActive: Boolean get() = driverProfile?.is_active != false
    val onBreak: Boolean get() = driverState?.on_break == true
    val cashBalance: Double get() = driverState?.shift_cash_balance ?: 0.0
    val maxCashCap: Double get() = settings.max_cash_cap ?: 200.0
    val cashCapped: Boolean get() = cashBalance >= maxCashCap
    val primaryTrip: ActiveTripUi? get() = activeTrips.firstOrNull()
    val isCallDriver: Boolean get() = driverProfile?.call_role == "K"
}

private fun friendlyError(t: Throwable?): String {
    val raw = t?.message ?: return "Κάτι πήγε στραβά"
    val lower = raw.lowercase()
    return when {
        "unable to resolve host" in lower ||
            "no address associated" in lower ||
            "unknownhost" in lower ->
            "Χωρίς σύνδεση στο διαδίκτυο. Έλεγξε Wi‑Fi / δεδομένα."
        "timeout" in lower || "timed out" in lower ->
            "Η σύνδεση άργησε. Δοκίμασε ξανά."
        "failed to connect" in lower || "connection refused" in lower ->
            "Δεν ήταν δυνατή η σύνδεση με τον διακομιστή."
        raw.length > 160 -> raw.take(140) + "…"
        else -> raw
    }
}

/** Classifies an exception as a technical failure (network/server) vs a validation message. */
private fun isTechnicalError(t: Throwable?): Boolean {
    val lower = t?.message?.lowercase() ?: return false
    return "unable to resolve host" in lower ||
        "no address associated" in lower ||
        "unknownhost" in lower ||
        "timeout" in lower ||
        "timed out" in lower ||
        "failed to connect" in lower ||
        "connection refused" in lower ||
        "server error (5" in lower ||
        "http status" in lower ||
        "relation does not exist" in lower ||
        "permission denied" in lower ||
        "row-level security" in lower ||
        "violates row-level" in lower ||
        "database error" in lower
}

class DriverViewModel(app: Application) : AndroidViewModel(app) {
    private val repo = DriverRepository()
    private val opsHelper = OpsHelper()
    private val prefs = DriverPreferences(app)
    private val locationTracker = DriverLocationTracker(app)
    private val _state = MutableStateFlow(
        DriverUiState(
            settingsLocal = DriverSettings(
                offerSound = prefs.offerSoundEnabled,
                vibration = prefs.vibrationEnabled,
                keepScreenOn = prefs.keepScreenOnOffers,
                notifyOffers = prefs.notifyNewOffers,
                soundId = prefs.offerSoundId,
                mapStyleLight = prefs.mapStyleLight,
            ),
        ),
    )
    val state: StateFlow<DriverUiState> = _state.asStateFlow()

    /**
     * Technical failures are logged to app_errors for the admin panel and hidden
     * from the driver (returns null). User-facing validation messages still show.
     */
    private fun handleError(context: String, e: Throwable?): String? {
        if (!isTechnicalError(e)) return friendlyError(e)
        val message = e?.message ?: friendlyError(e)
        viewModelScope.launch { runCatching { repo.logAppError(context, message) } }
        return null
    }

    private var pollJob: Job? = null
    private var chatJob: Job? = null
    private var liveChatJob: Job? = null
    /** Keeps driver_locations.updated_at fresh while online (admin Online + dispatch). */
    private var heartbeatJob: Job? = null
    private var mediaPlayer: MediaPlayer? = null
    private var lastOfferAlertKey: String? = null

    init {
        viewModelScope.launch {
            locationTracker.geo.collect { g ->
                _state.value = _state.value.copy(geo = g)
                val uid = _state.value.userId
                if (g != null && uid != null && _state.value.online) {
                    runCatching {
                        repo.upsertLocation(uid, g.lat, g.lng, g.bearing?.toDouble(), null)
                    }
                }
            }
        }
        DriverPushTokenHolder.listener = { token ->
            val uid = _state.value.userId
            if (uid != null) {
                viewModelScope.launch { runCatching { repo.upsertPushToken(uid, token) } }
            }
        }
        // Instant store-call refresh: FCM data message (type=store_call) → refresh now.
        StoreCallSignal.listener = {
            viewModelScope.launch { runCatching { refreshWork() } }
        }
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
                        locationTracker.start()
                        if (uid != null) onSignedIn(uid)
                    }
                    is SessionStatus.NotAuthenticated -> {
                        stopPolling()
                        locationTracker.stop()
                        _state.value = DriverUiState(
                            bootstrapping = false,
                            signedIn = false,
                            settingsLocal = _state.value.settingsLocal,
                        )
                    }
                    else -> Unit
                }
            }
        }
    }

    fun updateSettings(s: DriverSettings) {
        prefs.offerSoundEnabled = s.offerSound
        prefs.vibrationEnabled = s.vibration
        prefs.keepScreenOnOffers = s.keepScreenOn
        prefs.notifyNewOffers = s.notifyOffers
        prefs.offerSoundId = s.soundId
        prefs.mapStyleLight = s.mapStyleLight
        _state.value = _state.value.copy(settingsLocal = s)
        if (!s.offerSound) stopOfferSound()
    }

    fun previewSound(soundId: String) {
        playSoundById(soundId)
    }

    private suspend fun onSignedIn(userId: String) {
        runCatching {
            val profile = repo.loadProfile(userId)
            val driver = repo.loadDriverProfile(userId)
            val dState = repo.loadDriverState(userId)
            val settings = repo.platformSettings()
            val roles = opsHelper.loadRoles(userId)
            val isOps = opsHelper.isElevated(roles)
            val online = dState.shift_started_at != null
            _state.value = _state.value.copy(
                profile = profile,
                driverProfile = driver,
                driverState = dState,
                settings = settings,
                online = online,
                isOps = isOps,
            )
            if (online) {
                DriverLocationService.start(getApplication(), onBreak = dState.on_break == true)
                locationTracker.start()
                pushPresence(userId)
                startPresenceHeartbeat()
            }
        }.onFailure { e ->
            _state.value = _state.value.copy(error = handleError("loadOnSignedIn", e))
        }
        registerFcm(userId)
        refreshAll()
        startPolling()
    }

    private fun registerFcm(userId: String) {
        viewModelScope.launch {
            runCatching {
                val token = DriverPushTokenHolder.pendingToken
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
                    _state.value = _state.value.copy(busy = false, error = handleError("signIn", e))
                }
                .onSuccess { _state.value = _state.value.copy(busy = false) }
        }
    }

    fun signOut() {
        viewModelScope.launch {
            setOnline(false)
            locationTracker.stop()
            repo.signOut()
        }
    }

    fun selectTab(tab: DriverTab) {
        _state.value = _state.value.copy(tab = tab)
        when (tab) {
            DriverTab.Money -> refreshMoney()
            DriverTab.Inbox -> refreshInbox()
            DriverTab.Referral -> refreshReferral()
            DriverTab.Profile -> Unit
            DriverTab.Home -> refreshWork()
            DriverTab.Settings -> Unit
        }
    }

    fun setOnline(online: Boolean) {
        val uid = _state.value.userId ?: return
        if (!online && _state.value.activeStoreCall != null) {
            _state.value = _state.value.copy(error = "Ολοκλήρωσε την ενεργή κλήση πρώτα")
            return
        }
        if (online && !_state.value.driverActive) {
            _state.value = _state.value.copy(error = "Ο λογαριασμός περιμένει έγκριση")
            return
        }
        viewModelScope.launch {
            _state.value = _state.value.copy(online = online, error = null)
            runCatching {
                repo.setShiftStarted(uid, online)
                if (online) {
                    DriverLocationService.start(getApplication(), onBreak = false)
                    locationTracker.start()
                    // Immediate GPS so admin Online flips without waiting for movement
                    pushPresence(uid)
                    startPresenceHeartbeat()
                } else {
                    stopPresenceHeartbeat()
                    DriverLocationService.stop(getApplication())
                    repo.clearLocation(uid)
                }
                _state.value = _state.value.copy(driverState = repo.loadDriverState(uid))
            }.onFailure { e ->
                if (!online) stopPresenceHeartbeat()
                _state.value = _state.value.copy(
                    online = !online,
                    error = handleError("setOnline", e),
                )
            }
            if (online) refreshWork()
        }
    }

    fun toggleBreak() {
        val uid = _state.value.userId ?: return
        val currentlyOnBreak = _state.value.onBreak
        viewModelScope.launch {
            runCatching {
                if (currentlyOnBreak) {
                    repo.updateDriverState(uid, mapOf("on_break" to false, "break_until" to null))
                } else {
                    val until = java.time.Instant.now().plusSeconds(15 * 60).toString()
                    repo.updateDriverState(uid, mapOf("on_break" to true, "break_until" to until))
                }
                val dState = repo.loadDriverState(uid)
                _state.value = _state.value.copy(driverState = dState)
                if (_state.value.online) {
                    DriverLocationService.updateBreak(getApplication(), onBreak = dState.on_break == true)
                }
            }.onFailure { e ->
                _state.value = _state.value.copy(error = handleError("toggleBreak", e))
            }
        }
    }

    fun refreshAll() {
        refreshWork()
        refreshMoney()
        refreshInbox()
        refreshReferral()
        refreshStoreMap()
    }

    /** Stores + their active order counts for the Home map. */
    fun refreshStoreMap() {
        viewModelScope.launch {
            runCatching {
                val stores = repo.fetchMapStores()
                val counts = repo.fetchStoreActiveCounts()
                _state.value = _state.value.copy(mapStores = stores, storeCounts = counts)
            }
        }
    }

    fun refreshWork() {
        val uid = _state.value.userId ?: return
        viewModelScope.launch {
            runCatching {
                val settings = repo.platformSettings()
                val dState = repo.loadDriverState(uid)
                val driver = repo.loadDriverProfile(uid)
                if (driver?.is_active == false && _state.value.online) {
                    setOnline(false)
                }
                val trips = repo.fetchActiveTrips(uid)
                val maxStack = settings.max_stacked_orders ?: 3
                val isK = driver?.call_role == "K"
                val offers: List<OfferUi>
                val stacked: List<OfferUi>
                val blocked = dState.on_break == true ||
                    (dState.shift_cash_balance ?: 0.0) >= (settings.max_cash_cap ?: 200.0)
                if (trips.isNotEmpty()) {
                    offers = emptyList()
                    val remaining = (maxStack - trips.size).coerceAtLeast(0)
                    stacked = if (!blocked && !isK && remaining > 0) {
                        repo.fetchStackedOffers(
                            userId = uid,
                            activeStoreId = trips.first().order.store_id,
                            excludeOrderIds = trips.map { it.order.id }.toSet(),
                            limit = remaining,
                        )
                    } else emptyList()
                } else {
                    stacked = emptyList()
                    // K-role drivers work ONLY store calls — never main-project orders
                    offers = if (!blocked && _state.value.online && !isK) repo.fetchPendingOffers(uid) else emptyList()
                }

                // Fetch store calls for K-role drivers
                val storeCalls = if (!blocked && _state.value.online && isK)
                    repo.fetchOpenStoreCalls() else emptyList()
                // Persistent active job card
                val activeStoreCall = if (_state.value.online && isK)
                    repo.fetchMyActiveStoreCall() else null

                _state.value = _state.value.copy(
                    settings = settings,
                    driverState = dState,
                    driverProfile = driver,
                    activeTrips = trips,
                    offers = offers,
                    stackedOffers = stacked,
                    storeCalls = storeCalls,
                    activeStoreCall = activeStoreCall,
                    error = null,
                )
                if (!isK) maybeAlertOffers(offers + stacked)
            }.onFailure { e ->
                _state.value = _state.value.copy(error = handleError("refreshWork", e))
            }
        }
    }

    fun refreshMoney() {
        val uid = _state.value.userId ?: return
        viewModelScope.launch {
            runCatching {
                _state.value = _state.value.copy(money = repo.fetchMoney(uid))
            }
        }
    }

    fun refreshInbox() {
        val uid = _state.value.userId ?: return
        viewModelScope.launch {
            runCatching {
                val (n, t) = repo.fetchInbox(uid)
                _state.value = _state.value.copy(notifications = n, tickets = t)
            }
        }
    }

    fun refreshReferral() {
        val uid = _state.value.userId ?: return
        viewModelScope.launch {
            runCatching {
                val (code, rows) = repo.fetchOrCreateReferral(uid)
                _state.value = _state.value.copy(referralCode = code, referrals = rows)
            }
        }
    }

    fun acceptOffer(offerId: String, orderId: String? = null) {
        val s = _state.value
        val removed = s.offers.firstOrNull { it.offerId == offerId }
            ?: s.stackedOffers.firstOrNull { it.offerId == offerId }
        // Optimistically dismiss the offer sheet so the driver gets instant feedback.
        _state.value = s.copy(
            offers = s.offers.filterNot { it.offerId == offerId },
            stackedOffers = s.stackedOffers.filterNot { it.offerId == offerId },
            busy = true,
            error = null,
        )
        stopOfferSound()
        viewModelScope.launch {
            runCatching {
                if (offerId.isNotBlank()) repo.acceptOffer(offerId)
                else if (!orderId.isNullOrBlank()) repo.claimOrder(orderId)
                else error("Missing offer")
            }.onSuccess {
                _state.value = _state.value.copy(busy = false, info = "Προσφορά αποδεκτή")
                refreshWork()
            }.onFailure { e ->
                _state.value = _state.value.copy(
                    busy = false,
                    error = handleError("acceptOffer", e),
                    offers = if (removed != null && _state.value.offers.none { it.offerId == removed.offerId }) {
                        (_state.value.offers + removed).sortedBy { it.expiresAt }
                    } else _state.value.offers,
                    stackedOffers = if (removed != null && _state.value.stackedOffers.none { it.offerId == removed.offerId }) {
                        (_state.value.stackedOffers + removed)
                    } else _state.value.stackedOffers,
                )
                refreshWork()
            }
        }
    }


    /** Accept a store call (K-role driver). */
    fun acceptStoreCall(callId: String) {
        val s = _state.value
        val removed = s.storeCalls.firstOrNull { it.id == callId }
        _state.value = s.copy(
            storeCalls = s.storeCalls.filterNot { it.id == callId },
            busy = true,
            error = null,
        )
        viewModelScope.launch {
            runCatching {
                val storeName = repo.acceptStoreCall(callId)
                _state.value = _state.value.copy(
                    busy = false,
                    info = "Αποδεκτή κλήση: $storeName",
                    activeStoreCall = ActiveStoreCallRow(call_id = callId, store_name = storeName),
                )
                refreshWork()
            }.onFailure { e ->
                _state.value = _state.value.copy(
                    busy = false,
                    error = handleError("acceptStoreCall", e),
                    storeCalls = if (removed != null && _state.value.storeCalls.none { it.id == removed.id }) {
                        (_state.value.storeCalls + removed)
                    } else _state.value.storeCalls,
                )
                refreshWork()
            }
        }
    }

    /** Finish the active store call (K-role driver). */
    fun completeActiveCall() {
        val call = _state.value.activeStoreCall ?: return
        _state.value = _state.value.copy(busy = true, error = null)
        viewModelScope.launch {
            runCatching {
                repo.completeStoreCall(call.call_id)
                _state.value = _state.value.copy(
                    busy = false,
                    info = "Η κλήση ολοκληρώθηκε",
                    activeStoreCall = null,
                )
                refreshWork()
            }.onFailure { e ->
                _state.value = _state.value.copy(
                    busy = false,
                    error = handleError("completeStoreCall", e),
                )
                refreshWork()
            }
        }
    }


    fun openOps() {
        if (!_state.value.isOps) return
        _state.value = _state.value.copy(opsOpen = true)
        refreshOps()
    }

    fun closeOps() {
        _state.value = _state.value.copy(opsOpen = false)
    }

    fun refreshOps() {
        if (!_state.value.isOps) return
        viewModelScope.launch {
            runCatching {
                val orders = opsHelper.fetchOpsOpenOrders()
                _state.value = _state.value.copy(opsOrders = orders)
            }.onFailure { e ->
                _state.value = _state.value.copy(error = handleError("refreshOps", e))
            }
        }
    }

    fun claimOpsOrder(orderId: String) {
        if (!_state.value.isOps) return
        viewModelScope.launch {
            _state.value = _state.value.copy(busy = true, error = null)
            runCatching { repo.claimOrder(orderId) }
                .onSuccess {
                    _state.value = _state.value.copy(busy = false, info = "Order claimed", opsOpen = false)
                    refreshWork()
                    refreshOps()
                }
                .onFailure { e ->
                    _state.value = _state.value.copy(busy = false, error = handleError("claimOpsOrder", e))
                    refreshOps()
                }
        }
    }

    fun declineOffer(offerId: String) {
        val s = _state.value
        val removed = s.offers.firstOrNull { it.offerId == offerId }
            ?: s.stackedOffers.firstOrNull { it.offerId == offerId }
        // Optimistically dismiss the offer sheet for instant feedback.
        _state.value = s.copy(
            offers = s.offers.filterNot { it.offerId == offerId },
            stackedOffers = s.stackedOffers.filterNot { it.offerId == offerId },
            busy = true,
            error = null,
        )
        stopOfferSound()
        viewModelScope.launch {
            runCatching { repo.declineOffer(offerId) }
                .onSuccess {
                    _state.value = _state.value.copy(busy = false)
                    refreshWork()
                }
                .onFailure { e ->
                    _state.value = _state.value.copy(
                        busy = false,
                        error = handleError("declineOffer", e),
                        offers = if (removed != null && _state.value.offers.none { it.offerId == removed.offerId }) {
                            (_state.value.offers + removed).sortedBy { it.expiresAt }
                        } else _state.value.offers,
                        stackedOffers = if (removed != null && _state.value.stackedOffers.none { it.offerId == removed.offerId }) {
                            (_state.value.stackedOffers + removed)
                        } else _state.value.stackedOffers,
                    )
                    refreshWork()
                }
        }
    }

    fun advanceTrip(orderId: String, nextStatus: String) {
        val s = _state.value
        // Optimistically advance the trip card so the button reacts instantly;
        // roll back to the previous status if the server rejects the transition.
        val before = s.activeTrips
        val after = if (nextStatus == "delivered") {
            s.activeTrips.filterNot { it.order.id == orderId }
        } else {
            s.activeTrips.map { trip ->
                if (trip.order.id == orderId) {
                    trip.copy(order = trip.order.copy(status = nextStatus))
                } else trip
            }
        }
        _state.value = s.copy(activeTrips = after, busy = true, error = null)
        viewModelScope.launch {
            runCatching { repo.transitionStatus(orderId, nextStatus) }
                .onSuccess {
                    _state.value = _state.value.copy(busy = false, info = "Status → $nextStatus")
                    refreshWork()
                    if (nextStatus == "delivered") refreshMoney()
                }
                .onFailure { e ->
                    _state.value = _state.value.copy(activeTrips = before, busy = false, error = handleError("advanceTrip", e))
                    refreshWork()
                }
        }
    }

    fun withdraw(amount: Double) {
        val uid = _state.value.userId ?: return
        viewModelScope.launch {
            _state.value = _state.value.copy(busy = true, error = null)
            runCatching { repo.requestWithdrawal(uid, amount) }
                .onSuccess {
                    _state.value = _state.value.copy(busy = false, info = "Αίτημα ανάληψης στάλθηκε")
                    refreshMoney()
                }
                .onFailure { e ->
                    _state.value = _state.value.copy(busy = false, error = handleError("withdraw", e))
                }
        }
    }

    fun markRead(id: String) {
        viewModelScope.launch {
            runCatching { repo.markNotificationRead(id) }
            refreshInbox()
        }
    }

    fun submitSupportTicket(category: String, description: String) {
        val uid = _state.value.userId ?: return
        viewModelScope.launch {
            _state.value = _state.value.copy(busy = true, error = null)
            runCatching { repo.createSupportTicket(uid, category, description) }
                .onSuccess { newId ->
                    _state.value = _state.value.copy(busy = false, info = "Ticket υποβλήθηκε ✓")
                    refreshInbox()
                    if (!newId.isNullOrBlank()) openChat(newId, submitFirst = true)
                }
                .onFailure { e ->
                    _state.value = _state.value.copy(busy = false, error = handleError("submitSupportTicket", e))
                }
        }
    }

    fun openChat(ticketId: String, submitFirst: Boolean = false) {
        if (_state.value.chatTicketId != ticketId) {
            closeChat()
            _state.value = _state.value.copy(chatTicketId = ticketId)
        }
        viewModelScope.launch {
            _state.value = _state.value.copy(chatLoading = true, error = null)
            runCatching { repo.fetchTicketMessages(ticketId) }
                .onSuccess { msgs ->
                    val agents = resolveAgents(msgs)
                    _state.value = _state.value.copy(
                        chatMessages = msgs,
                        chatAgents = agents,
                        chatLoading = false,
                    )
                }
                .onFailure { e ->
                    _state.value = _state.value.copy(chatLoading = false, error = handleError("openChat", e))
                }
            startChatSubscription(ticketId)
        }
        if (submitFirst) refreshInbox()
    }

    private suspend fun resolveAgents(msgs: List<TicketMessageRow>): Map<String, String> {
        val agentIds = msgs
            .filter { it.sender_role == "support" || it.sender_role == "admin" }
            .mapNotNull { it.sender_id }
            .distinct()
        return runCatching { repo.fetchAgents(agentIds) }.getOrDefault(emptyMap())
    }

    private fun startChatSubscription(ticketId: String) {
        chatJob?.cancel()
        chatJob = viewModelScope.launch {
            runCatching { repo.subscribeTicketMessages(ticketId) }
                .onSuccess { flow ->
                    _state.value = _state.value.copy(chatSubscribed = true)
                    flow.collect { _ -> refreshChatMessages(ticketId) }
                }
        }
    }

    private fun refreshChatMessages(ticketId: String) {
        val uid = _state.value.userId ?: return
        viewModelScope.launch {
            runCatching { repo.fetchTicketMessages(ticketId) }
                .onSuccess { msgs ->
                    val agents = resolveAgents(msgs)
                    _state.value = _state.value.copy(chatMessages = msgs, chatAgents = agents)
                }
        }
    }

    fun sendChatMessage(text: String) {
        val uid = _state.value.userId ?: return
        val ticketId = _state.value.chatTicketId ?: return
        val trimmed = text.trim()
        if (trimmed.isEmpty()) return
        viewModelScope.launch {
            runCatching { repo.sendTicketMessage(ticketId, uid, trimmed) }
                .onSuccess { refreshChatMessages(ticketId) }
                .onFailure { e -> _state.value = _state.value.copy(error = handleError("sendChatMessage", e)) }
        }
    }

    fun closeChat() {
        chatJob?.cancel()
        chatJob = null
        viewModelScope.launch {
            runCatching { repo.unsubscribeTicketMessages() }
            _state.value = _state.value.copy(
                chatTicketId = null,
                chatMessages = emptyList(),
                chatAgents = emptyMap(),
                chatLoading = false,
                chatSubscribed = false,
            )
        }
    }

    fun openLiveChat() {
        val uid = _state.value.userId ?: return
        if (_state.value.liveChatOpen) return
        _state.value = _state.value.copy(liveChatOpen = true, liveChatLoading = true, liveChatError = null)
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
                        liveChatError = handleError("openLiveChat", e),
                    )
                }
            startLiveChatSubscription(uid)
        }
    }

    /** Opens live chat from the headphone flow, seeding the first message. */
    fun startLiveChat(initialMessage: String?) {
        openLiveChat()
        val msg = initialMessage?.trim()
        if (!msg.isNullOrBlank()) sendLiveChatMessage(msg)
    }

    fun sendLiveChatMessage(text: String) {
        val uid = _state.value.userId ?: return
        val trimmed = text.trim()
        if (trimmed.isEmpty()) return
        viewModelScope.launch {
            runCatching { repo.sendLiveChatMessage(uid, uid, trimmed) }
                .onSuccess { refreshLiveChat(uid) }
                .onFailure { e ->
                    _state.value = _state.value.copy(
                        liveChatError = handleError("sendLiveChatMessage", e),
                    )
                }
        }
    }

    private fun startLiveChatSubscription(driverId: String) {
        liveChatJob?.cancel()
        liveChatJob = viewModelScope.launch {
            runCatching { repo.subscribeLiveChat(driverId) }
                .onSuccess { flow ->
                    _state.value = _state.value.copy(liveChatSubscribed = true)
                    flow.collect { _ -> refreshLiveChat(driverId) }
                }
        }
    }

    private fun refreshLiveChat(driverId: String) {
        viewModelScope.launch {
            runCatching { repo.fetchLiveChat(driverId) }
                .onSuccess { msgs -> _state.value = _state.value.copy(liveChatMessages = msgs) }
        }
    }

    fun closeLiveChat() {
        liveChatJob?.cancel()
        liveChatJob = null
        viewModelScope.launch {
            runCatching { repo.unsubscribeLiveChat() }
            _state.value = _state.value.copy(
                liveChatOpen = false,
                liveChatMessages = emptyList(),
                liveChatAgents = emptyMap(),
                liveChatLoading = false,
                liveChatSubscribed = false,
                liveChatError = null,
            )
        }
    }

    fun openSupport() {
        _state.value = _state.value.copy(supportOpen = true)
        openLiveChat()
    }

    fun closeSupport() {
        closeLiveChat()
        closeChat()
        _state.value = _state.value.copy(supportOpen = false)
    }

    fun saveProfile(fullName: String, phone: String, vehicleType: String, plate: String, iban: String) {
        val uid = _state.value.userId ?: return
        viewModelScope.launch {
            _state.value = _state.value.copy(busy = true, error = null)
            runCatching {
                repo.updateProfile(uid, fullName, phone)
                repo.updateDriverProfileExtras(uid, vehicleType, plate, iban)
                _state.value = _state.value.copy(
                    busy = false,
                    info = "Αποθηκεύτηκε",
                    profile = repo.loadProfile(uid),
                    driverProfile = repo.loadDriverProfile(uid),
                )
            }.onFailure { e ->
                _state.value = _state.value.copy(busy = false, error = handleError("saveProfile", e))
            }
        }
    }

    fun clearMessages() {
        _state.value = _state.value.copy(error = null, info = null)
    }

    /**
     * Admin Online requires driver_locations.updated_at within 10 minutes.
     * Fused location only updates on movement (≥3 m), so parked drivers need
     * a timed heartbeat that re-upserts the last known coordinates.
     */
    private fun startPresenceHeartbeat() {
        heartbeatJob?.cancel()
        heartbeatJob = viewModelScope.launch {
            while (true) {
                delay(45_000)
                val uid = _state.value.userId ?: continue
                if (!_state.value.online) continue
                pushPresence(uid)
            }
        }
    }

    private fun stopPresenceHeartbeat() {
        heartbeatJob?.cancel()
        heartbeatJob = null
    }

    private suspend fun pushPresence(userId: String) {
        val g = _state.value.geo
        if (g != null) {
            runCatching {
                repo.upsertLocation(userId, g.lat, g.lng, g.bearing?.toDouble(), null)
            }
        }
    }

    private fun startPolling() {
        pollJob?.cancel()
        pollJob = viewModelScope.launch {
            var tick = 0
            while (true) {
                delay(4_000)
                tick++
                if (_state.value.signedIn) {
                    refreshWork()
                    if (_state.value.tab == DriverTab.Inbox) refreshInbox()
                    // Keep store order badges fresh on the map even when offline.
                    if (tick % 5 == 0) refreshStoreMap()
                }
            }
        }
    }

    private fun stopPolling() {
        pollJob?.cancel()
        pollJob = null
        stopPresenceHeartbeat()
        stopOfferSound()
    }

    private fun maybeAlertOffers(offers: List<OfferUi>) {
        val key = offers.joinToString(",") { it.offerId.ifBlank { it.order.id } }
        if (key.isEmpty()) {
            lastOfferAlertKey = null
            stopOfferSound()
            return
        }
        if (key == lastOfferAlertKey) return
        lastOfferAlertKey = key
        val local = _state.value.settingsLocal
        if (local.offerSound) playSoundById(local.soundId)
        if (local.vibration) vibrateOffer()
    }

    private fun playSoundById(soundId: String) {
        stopOfferSound()
        val app = getApplication<Application>()
        when (OfferSoundId.fromId(soundId)) {
            OfferSoundId.CLASSIC -> runCatching {
                mediaPlayer = MediaPlayer.create(app, R.raw.fresh_delivery)?.also {
                    it.isLooping = false
                    it.start()
                }
            }
            OfferSoundId.CHIME -> runCatching {
                val uri = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION)
                mediaPlayer = MediaPlayer.create(app, uri)?.also {
                    it.isLooping = false
                    it.start()
                }
            }
            OfferSoundId.ALERT -> runCatching {
                val uri = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_ALARM)
                mediaPlayer = MediaPlayer.create(app, uri)?.also {
                    it.isLooping = false
                    it.start()
                    it.setOnCompletionListener { stopOfferSound() }
                    viewModelScope.launch {
                        delay(1200)
                        stopOfferSound()
                    }
                }
            }
            OfferSoundId.PING -> runCatching {
                val tg = ToneGenerator(AudioManager.STREAM_NOTIFICATION, 90)
                tg.startTone(ToneGenerator.TONE_PROP_BEEP2, 180)
                viewModelScope.launch {
                    delay(220)
                    tg.startTone(ToneGenerator.TONE_PROP_ACK, 160)
                    delay(200)
                    tg.release()
                }
            }
        }
    }

    private fun vibrateOffer() {
        runCatching {
            val app = getApplication<Application>()
            val vibrator = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                val vm = app.getSystemService(VibratorManager::class.java)
                vm?.defaultVibrator
            } else {
                @Suppress("DEPRECATION")
                app.getSystemService(Vibrator::class.java)
            } ?: return
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                vibrator.vibrate(VibrationEffect.createWaveform(longArrayOf(0, 200, 100, 200), -1))
            } else {
                @Suppress("DEPRECATION")
                vibrator.vibrate(longArrayOf(0, 200, 100, 200), -1)
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
        DriverPushTokenHolder.listener = null
        locationTracker.stop()
        stopPolling()
        super.onCleared()
    }
}
