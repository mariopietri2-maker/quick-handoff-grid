package com.freshdelivery.nativedriver.ui.map

import android.net.Uri
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.unit.dp
import coil.compose.AsyncImage
import coil.compose.AsyncImagePainter
import com.freshdelivery.nativedriver.BuildConfig
import com.freshdelivery.nativedriver.ui.theme.FreshGreen

data class MapMarker(
    val lat: Double,
    val lng: Double,
    val label: String,
    val color: String,
)

/** Ioannina city center — default when GPS / trip coords are missing. */
private const val DEFAULT_LAT = 39.6650
private const val DEFAULT_LNG = 20.8537

private fun fmt5(v: Double): String = String.format("%.5f", v)

/**
 * Reliable map surface using Mapbox Static Images API.
 * No WebView — tiles always load via Coil HTTP image request.
 */
@Composable
fun DriverMapView(
    modifier: Modifier = Modifier,
    centerLat: Double?,
    centerLng: Double?,
    markers: List<MapMarker>,
    userLat: Double? = null,
    userLng: Double? = null,
) {
    val lat = centerLat ?: userLat ?: DEFAULT_LAT
    val lng = centerLng ?: userLng ?: DEFAULT_LNG
    val density = LocalDensity.current
    val widthPx = with(density) { 720.dp.roundToPx().coerceIn(400, 1280) }
    val heightPx = with(density) { 640.dp.roundToPx().coerceIn(300, 1280) }

    val url = remember(lat, lng, markers, userLat, userLng, widthPx, heightPx) {
        buildStaticMapUrl(
            token = BuildConfig.MAPBOX_TOKEN,
            lat = lat,
            lng = lng,
            markers = markers,
            userLat = userLat,
            userLng = userLng,
            width = widthPx,
            height = heightPx,
        )
    }

    var loading by remember(url) { mutableStateOf(true) }

    Box(modifier = modifier.background(Color(0xFF0B0F14))) {
        AsyncImage(
            model = url,
            contentDescription = "Map",
            modifier = Modifier.fillMaxSize(),
            contentScale = ContentScale.Crop,
            onState = { state ->
                loading = state is AsyncImagePainter.State.Loading ||
                    state is AsyncImagePainter.State.Empty
            },
        )
        if (loading) {
            CircularProgressIndicator(
                modifier = Modifier.align(Alignment.Center),
                color = FreshGreen,
                strokeWidth = 2.5.dp,
            )
        }
    }
}

/**
 * Mapbox Static Images URL with optional pin overlays.
 * https://docs.mapbox.com/api/maps/static-images/
 */
private fun buildStaticMapUrl(
    token: String,
    lat: Double,
    lng: Double,
    markers: List<MapMarker>,
    userLat: Double?,
    userLng: Double?,
    width: Int,
    height: Int,
): String {
    val overlays = mutableListOf<String>()
    markers.forEach { m ->
        val hex = m.color.removePrefix("#").uppercase().take(6)
        overlays += "pin-s+$hex(${fmt5(m.lng)},${fmt5(m.lat)})"
    }
    if (userLat != null && userLng != null) {
        overlays += "pin-s+3B82F6(${fmt5(userLng)},${fmt5(userLat)})"
    }

    val overlayPath = if (overlays.isEmpty()) "" else overlays.joinToString(",") + "/"

    val position = if (markers.size + (if (userLat != null) 1 else 0) >= 2) {
        "auto"
    } else {
        "${fmt5(lng)},${fmt5(lat)},13.2,0"
    }

    return Uri.parse(
        "https://api.mapbox.com/styles/v1/mapbox/dark-v11/static/" +
            overlayPath +
            position +
            "/${width}x${height}@2x",
    ).buildUpon()
        .appendQueryParameter("access_token", token)
        .appendQueryParameter("attribution", "false")
        .appendQueryParameter("logo", "false")
        .build()
        .toString()
}
