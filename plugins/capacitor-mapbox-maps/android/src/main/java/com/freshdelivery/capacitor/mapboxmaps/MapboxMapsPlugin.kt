package com.freshdelivery.capacitor.mapboxmaps

import android.content.Intent
import com.getcapacitor.JSArray
import com.getcapacitor.JSObject
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin
import com.mapbox.common.MapboxOptions

@CapacitorPlugin(name = "MapboxMaps")
class MapboxMapsPlugin : Plugin() {

    private var accessToken: String? = null

    @PluginMethod
    fun initialize(call: PluginCall) {
        val token = call.getString("accessToken")
        if (token.isNullOrBlank()) {
            call.reject("accessToken is required")
            return
        }
        accessToken = token
        try {
            MapboxOptions.accessToken = token
        } catch (e: Exception) {
            call.reject("Failed to set Mapbox token: ${e.message}", e)
            return
        }
        call.resolve()
    }

    @PluginMethod
    fun isNativeAvailable(call: PluginCall) {
        val ret = JSObject()
        ret.put("available", true)
        call.resolve(ret)
    }

    @PluginMethod
    fun createMap(call: PluginCall) {
        val token = call.getString("accessToken") ?: accessToken
        if (!token.isNullOrBlank()) {
            try {
                MapboxOptions.accessToken = token
                accessToken = token
            } catch (_: Throwable) { /* already set */ }
        }
        if (MapboxOptions.accessToken.isNullOrBlank() && accessToken.isNullOrBlank()) {
            call.reject("Call initialize({ accessToken }) first, or pass accessToken in createMap")
            return
        }

        val id = call.getString("id") ?: "default"
        val fullScreen = call.getBoolean("fullScreen", true) == true
        val centerLat = call.getDouble("center.lat")
            ?: call.getObject("center")?.getDouble("lat")
            ?: 39.6650
        val centerLng = call.getDouble("center.lng")
            ?: call.getObject("center")?.getDouble("lng")
            ?: 20.8537
        val zoom = call.getDouble("zoom") ?: 14.0
        val styleUri = call.getString("styleUri")
            ?: "mapbox://styles/mapbox/streets-v12"

        if (!fullScreen) {
            // Embedded MapView-behind-WebView is phase 2. Full-screen is the supported path.
            call.reject("Embedded native maps (fullScreen:false) are not yet supported. Use fullScreen:true or mapbox-gl.")
            return
        }

        val intent = Intent(activity, MapboxMapActivity::class.java).apply {
            putExtra(MapboxMapActivity.EXTRA_MAP_ID, id)
            putExtra(MapboxMapActivity.EXTRA_LAT, centerLat)
            putExtra(MapboxMapActivity.EXTRA_LNG, centerLng)
            putExtra(MapboxMapActivity.EXTRA_ZOOM, zoom)
            putExtra(MapboxMapActivity.EXTRA_STYLE, styleUri)
            putExtra(MapboxMapActivity.EXTRA_TOKEN, accessToken ?: token)
            // Markers as JSON string
            call.getArray("markers")?.let { arr ->
                putExtra(MapboxMapActivity.EXTRA_MARKERS_JSON, arr.toString())
            }
        }
        activity.startActivity(intent)

        val ret = JSObject()
        ret.put("id", id)
        call.resolve(ret)
    }

    @PluginMethod
    fun setCamera(call: PluginCall) {
        // Full-screen activity owns the camera for v1; no-op when activity is closed.
        MapboxMapActivity.pendingCamera = call.data
        call.resolve()
    }

    @PluginMethod
    fun addMarkers(call: PluginCall) {
        MapboxMapActivity.pendingMarkers = call.getArray("markers")
        call.resolve()
    }

    @PluginMethod
    fun clearMarkers(call: PluginCall) {
        MapboxMapActivity.pendingClearMarkers = true
        call.resolve()
    }

    @PluginMethod
    fun removeMap(call: PluginCall) {
        MapboxMapActivity.instance?.finish()
        call.resolve()
    }
}
