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
    /** Degrees clockwise from north; null if unknown. */
    val bearing: Float? = null,
    val accuracyM: Float? = null,
)

/**
 * Continuous fused location + bearing for the driver map pin.
 */
class DriverLocationTracker(context: Context) {
    private val app = context.applicationContext
    private val client = LocationServices.getFusedLocationProviderClient(app)
    private val _geo = MutableStateFlow<DriverGeo?>(null)
    val geo: StateFlow<DriverGeo?> = _geo.asStateFlow()

    private var running = false
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
    fun start() {
        if (running || !hasPermission()) return
        running = true
        val request = LocationRequest.Builder(Priority.PRIORITY_HIGH_ACCURACY, 2_500L)
            .setMinUpdateIntervalMillis(1_500L)
            .setMinUpdateDistanceMeters(3f)
            .setWaitForAccurateLocation(false)
            .build()
        runCatching {
            client.requestLocationUpdates(request, callback, Looper.getMainLooper())
            client.lastLocation.addOnSuccessListener { loc ->
                if (loc != null) publish(loc)
            }
        }.onFailure { running = false }
    }

    fun stop() {
        if (!running) return
        running = false
        runCatching { client.removeLocationUpdates(callback) }
    }

    private fun publish(loc: Location) {
        val bearing = if (loc.hasBearing() && loc.bearingAccuracyDegrees < 45f || loc.hasBearing()) {
            loc.bearing
        } else null
        _geo.value = DriverGeo(
            lat = loc.latitude,
            lng = loc.longitude,
            bearing = bearing,
            accuracyM = if (loc.hasAccuracy()) loc.accuracy else null,
        )
    }
}
