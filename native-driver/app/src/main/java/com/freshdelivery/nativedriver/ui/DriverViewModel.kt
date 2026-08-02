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
import com.freshdelivery.nativedriver.data.DriverStateRow
import com.freshdelivery.nativedriver.data.DriverTab
import com.freshdelivery.nativedriver.data.MoneyUi
import com.freshdelivery.nativedriver.data.OfferSoundId
import com.freshdelivery.nativedriver.data.OfferUi
import com.freshdelivery.nativedriver.data.PlatformSettingsRow
import com.freshdelivery.nativedriver.data.ProfileRow
import com.freshdelivery.nativedriver.data.ReferralRow
import com.freshdelivery.nativedriver.data.SupabaseProvider
import com.freshdelivery.nativedriver.data.SupportTicketRow
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

data class DriverSettings(
    val offerSound: Boolean = true,
    val vibration: Boolean = true,
    val keepScreenOn: Boolean = true,
    val notifyOffers: Boolean = true,
    val soundId: String = OfferSoundId.CLASSIC.id,
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
    val referralCode: String? = null,
    val referrals: List<ReferralRow> = emptyList(),
    val geo: DriverGeo? = null,
    val busy: Boolean = false,
    val error: String? = null,
    val info: String? = null,
) {
    val driverActive: Boolean get() = driverProfile?.is_active != false
    val onBreak: Boolean get() = driverState?.on_break == true
    val cashBalance: Double get() = driverState?.shift_cash_balance ?: 0.0
    val maxCashCap: Double get() = settings.max_cash_cap ?: 200.0
    val cashCapped: Boolean get() = cashBalance >= maxCashCap
    val primaryTrip: ActiveTripUi? get() = activeTrips.firstOrNull()
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

class DriverViewModel(app: Application) : AndroidViewModel(app) {
    private val repo = DriverRepository()
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
            ),
        ),
    )
    val state: StateFlow<DriverUiState> = _state.asStateFlow()

    private var pollJob: Job? = null
    private var mediaPlayer: MediaPlayer? = null
    private var lastOfferAlertKey: String? = null

    init {
        // Always try GPS for map pin (even offline) once signed in
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
            _state.value = _state.value.copy(
                profile = profile,
                driverProfile = driver,
                driverState = dState,
                settings = settings,
                online = dState.shift_started_at != null,
            )
            if (dState.shift_started_at != null) {
                DriverLocationService.start(getApplication())
                locationTracker.start()
            }
        }.onFailure { e ->
            _state.value = _state.value.copy(error = friendlyError(e))
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
                    _state.value = _state.value.copy(busy = false, error = friendlyError(e))
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
        }
    }

    fun setOnline(online: Boolean) {
        val uid = _state.value.userId ?: return
        if (online && !_state.value.driverActive) {
            _state.value = _state.value.copy(error = "Ο λογαριασμός περιμένει έγκριση")
            return
        }
        viewModelScope.launch {
            _state.value = _state.value.copy(online = online, error = null)
            runCatching {
                repo.setShiftStarted(uid, online)
                if (online) {
                    DriverLocationService.start(getApplication())
                    locationTracker.start()
                } else {
                    DriverLocationService.stop(getApplication())
                    repo.clearLocation(uid)
                }
                _state.value = _state.value.copy(driverState = repo.loadDriverState(uid))
            }.onFailure { e ->
                _state.value = _state.value.copy(
                    online = !online,
                    error = friendlyError(e),
                )
            }
            if (online) refreshWork()
        }
    }

    fun toggleBreak() {
        val uid = _state.value.userId ?: return
        val onBreak = _state.value.onBreak
        viewModelScope.launch {
            runCatching {
                if (onBreak) {
                    repo.updateDriverState(uid, mapOf("on_break" to false, "break_until" to null))
                } else {
                    val until = java.time.Instant.now().plusSeconds(15 * 60).toString()
                    repo.updateDriverState(uid, mapOf("on_break" to true, "break_until" to until))
                }
                _state.value = _state.value.copy(driverState = repo.loadDriverState(uid))
            }.onFailure { e ->
                _state.value = _state.value.copy(error = friendlyError(e))
            }
        }
    }

    fun refreshAll() {
        refreshWork()
        refreshMoney()
        refreshInbox()
        refreshReferral()
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
                val offers: List<OfferUi>
                val stacked: List<OfferUi>
                val blocked = dState.on_break == true ||
                    (dState.shift_cash_balance ?: 0.0) >= (settings.max_cash_cap ?: 200.0)
                if (trips.isNotEmpty()) {
                    offers = emptyList()
                    val remaining = (maxStack - trips.size).coerceAtLeast(0)
                    stacked = if (!blocked && remaining > 0) {
                        repo.fetchStackedOffers(
                            userId = uid,
                            activeStoreId = trips.first().order.store_id,
                            excludeOrderIds = trips.map { it.order.id }.toSet(),
                            limit = remaining,
                        )
                    } else emptyList()
                } else {
                    stacked = emptyList()
                    offers = if (!blocked && _state.value.online) repo.fetchPendingOffers(uid) else emptyList()
                }
                _state.value = _state.value.copy(
                    settings = settings,
                    driverState = dState,
                    driverProfile = driver,
                    activeTrips = trips,
                    offers = offers,
                    stackedOffers = stacked,
                    error = null,
                )
                maybeAlertOffers(offers + stacked)
            }.onFailure { e ->
                _state.value = _state.value.copy(error = friendlyError(e))
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
        viewModelScope.launch {
            _state.value = _state.value.copy(busy = true, error = null)
            runCatching {
                if (offerId.isNotBlank()) repo.acceptOffer(offerId)
                else if (!orderId.isNullOrBlank()) repo.claimOrder(orderId)
                else error("Missing offer")
            }.onSuccess {
                stopOfferSound()
                _state.value = _state.value.copy(busy = false, info = "Προσφορά αποδεκτή")
                refreshWork()
            }.onFailure { e ->
                _state.value = _state.value.copy(busy = false, error = friendlyError(e))
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
                    _state.value = _state.value.copy(busy = false, error = friendlyError(e))
                }
        }
    }

    fun advanceTrip(orderId: String, nextStatus: String) {
        viewModelScope.launch {
            _state.value = _state.value.copy(busy = true, error = null)
            runCatching { repo.transitionStatus(orderId, nextStatus) }
                .onSuccess {
                    _state.value = _state.value.copy(busy = false, info = "Status → $nextStatus")
                    refreshWork()
                    if (nextStatus == "delivered") refreshMoney()
                }
                .onFailure { e ->
                    _state.value = _state.value.copy(busy = false, error = friendlyError(e))
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
                    _state.value = _state.value.copy(busy = false, error = friendlyError(e))
                }
        }
    }

    fun markRead(id: String) {
        viewModelScope.launch {
            runCatching { repo.markNotificationRead(id) }
            refreshInbox()
        }
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
                _state.value = _state.value.copy(busy = false, error = friendlyError(e))
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
                delay(4_000)
                if (_state.value.signedIn) {
                    refreshWork()
                    if (_state.value.tab == DriverTab.Inbox) refreshInbox()
                }
            }
        }
    }

    private fun stopPolling() {
        pollJob?.cancel()
        pollJob = null
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
                    // stop after ~1.2s so alarm isn't endless
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
