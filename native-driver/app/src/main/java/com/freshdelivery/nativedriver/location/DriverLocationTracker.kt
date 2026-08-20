package com.freshdelivery.nativedriver.location

import android.Manifest
import android.annotation.SuppressLint
import android.content.Context
import android.content.pm.PackageManager
import android.location.Location
import android.os.Looper
import androidx.core.content.ContextCompat
import com.google.android.gms.location.LocationCallback
import com.google.android.gms.location.LocationRequest
import com.google.android.gms.location.LocationResult
import com.google.android.gms.location.LocationServices
import com.google.android.gms.location.Priority
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow

data class DriverGeo(
    val lat: Double,
    val lng: Double,
    val bearing: Float? = null,
    val accuracyM: Float? = null,
)

/**
 * Battery-aware fused location:
 * - ONLINE: balanced ~15s/25m (presence)
 * - ACTIVE: high accuracy ~2.5s/3m (trip tracking)
 */
class DriverLocationTracker(context: Context) {
    private val app = context.applicationContext
    private val client = LocationServices.getFusedLocationProviderClient(app)
    private val _geo = MutableStateFlow<DriverGeo?>(null)
    val geo: StateFlow<DriverGeo?> = _geo.asStateFlow()
    private var running = false
    private var currentMode: Mode = Mode.ONLINE
    enum class Mode { ONLINE, ACTIVE }

    private val callback = object : LocationCallback() {
        override fun onLocationResult(result: LocationResult) {
            val loc = result.lastLocation ?: return
            publish(loc)
        }
    }

    private fun hasPermission(): Boolean {
        val fine = ContextCompat.checkSelfPermission(app, Manifest.permission.ACCESS_FINE_LOCATION)
        val coarse = ContextCompat.checkSelfPermission(app, Manifest.permission.ACCESS_COARSE_LOCATION)
        return fine == PackageManager.PERMISSION_GRANTED || coarse == PackageManager.PERMISSION_GRANTED
    }

    @SuppressLint("MissingPermission")
    fun start(mode: Mode = Mode.ONLINE) {
        if (!hasPermission()) return
        if (running && currentMode == mode) return
        if (running) runCatching { client.removeLocationUpdates(callback) }
        running = true
        currentMode = mode
        val request = when (mode) {
            Mode.ACTIVE -> LocationRequest.Builder(Priority.PRIORITY_HIGH_ACCURACY, 2_500L)
                .setMinUpdateIntervalMillis(1_500L)
                .setMinUpdateDistanceMeters(3f)
                .setWaitForAccurateLocation(false)
                .setMaxUpdateDelayMillis(5_000L)
                .build()
            Mode.ONLINE -> LocationRequest.Builder(Priority.PRIORITY_BALANCED_POWER_ACCURACY, 15_000L)
                .setMinUpdateIntervalMillis(10_000L)
                .setMinUpdateDistanceMeters(25f)
                .setWaitForAccurateLocation(false)
                .setMaxUpdateDelayMillis(30_000L)
                .build()
        }
        runCatching {
            client.requestLocationUpdates(request, callback, Looper.getMainLooper())
            client.lastLocation.addOnSuccessListener { loc -> if (loc != null) publish(loc) }
        }.onFailure { running = false }
    }

    fun setActiveTrip(active: Boolean) {
        val desired = if (active) Mode.ACTIVE else Mode.ONLINE
        if (running) start(desired) else if (active) start(Mode.ACTIVE)
    }

    fun stop() {
        if (!running) return
        running = false
        runCatching { client.removeLocationUpdates(callback) }
    }

    private fun publish(loc: Location) {
        val bearing = when {
            loc.hasBearing() && loc.hasBearingAccuracy() && loc.bearingAccuracyDegrees < 45f -> loc.bearing
            loc.hasBearing() -> loc.bearing
            else -> null
        }
        _geo.value = DriverGeo(loc.latitude, loc.longitude, bearing, if (loc.hasAccuracy()) loc.accuracy else null)
    }
}
