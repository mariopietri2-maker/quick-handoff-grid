package com.freshdelivery.nativecustomer.ui.map

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import coil.compose.SubcomposeAsyncImage
import com.freshdelivery.nativecustomer.BuildConfig
import java.net.URLEncoder
import java.nio.charset.StandardCharsets

data class MapMarker(
    val lat: Double,
    val lng: Double,
    val label: String,
    val color: String,
)

private const val DEFAULT_LAT = 39.6650
private const val DEFAULT_LNG = 20.8537

/**
 * Customer tracking map — Mapbox **Static Images** (no WebGL / WebView).
 * Fixes the black screen on Track after order.
 *
 * Pins (from TrackTab):
 *  - Store  #F97316  as soon as tracking opens
 *  - Delivery #10B981 at geocoded / GPS address
 *  - Driver #7C6CFF only after accept (driverLocation set)
 */
@Composable
fun MapboxView(
    modifier: Modifier = Modifier,
    centerLat: Double?,
    centerLng: Double?,
    markers: List<MapMarker>,
) {
    val token = BuildConfig.MAPBOX_TOKEN
    val lat = centerLat ?: DEFAULT_LAT
    val lng = centerLng ?: DEFAULT_LNG

    val url = remember(lat, lng, markers) {
        buildStaticMapUrl(token, lat, lng, markers)
    }

    Box(modifier.background(Color(0xFFE8EEF2))) {
        SubcomposeAsyncImage(
            model = url,
            contentDescription = "Χάρτης παραγγελίας",
            modifier = Modifier.fillMaxSize(),
            contentScale = ContentScale.Crop,
            loading = {
                Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                    CircularProgressIndicator(color = Color(0xFF06C167))
                }
            },
            error = {
                Box(Modifier.fillMaxSize().background(Color(0xFFE8EEF2)))
            },
        )
    }
}

private fun buildStaticMapUrl(
    token: String,
    centerLat: Double,
    centerLng: Double,
    markers: List<MapMarker>,
): String {
    // pin-l+HEX(lng,lat) — Mapbox Static Images overlay
    val overlay = markers.joinToString(",") { m ->
        val hex = m.color.removePrefix("#").uppercase().filter { it.isLetterOrDigit() }.take(6)
            .ifBlank { "22C55E" }
        "pin-l+$hex(${m.lng},${m.lat})"
    }.ifBlank { null }

    val path = when {
        overlay != null && markers.size > 1 ->
            "https://api.mapbox.com/styles/v1/mapbox/streets-v12/static/$overlay/auto/800x1200@2x"
        overlay != null ->
            "https://api.mapbox.com/styles/v1/mapbox/streets-v12/static/$overlay/$centerLng,$centerLat,14.2,0/800x1200@2x"
        else ->
            "https://api.mapbox.com/styles/v1/mapbox/streets-v12/static/$centerLng,$centerLat,13.2,0/800x1200@2x"
    }

    val encodedToken = URLEncoder.encode(token, StandardCharsets.UTF_8)
    return if (markers.size > 1) {
        "$path?padding=80&access_token=$encodedToken"
    } else {
        "$path?access_token=$encodedToken"
    }
}
