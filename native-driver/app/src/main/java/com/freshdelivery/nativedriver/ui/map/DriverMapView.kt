package com.freshdelivery.nativedriver.ui.map

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.remember
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import com.mapbox.geojson.Point
import com.mapbox.maps.extension.compose.MapboxMap
import com.mapbox.maps.extension.compose.animation.viewport.rememberMapViewportState
import com.mapbox.maps.extension.compose.annotation.generated.PointAnnotationGroup
import com.mapbox.maps.extension.compose.style.MapStyle
import com.mapbox.maps.plugin.annotation.generated.PointAnnotationOptions

data class MapMarker(
    val lat: Double,
    val lng: Double,
    val label: String,
    val color: String,
)

/** Ioannina city center — default when GPS / trip coords are missing. */
private const val DEFAULT_LAT = 39.6650
private const val DEFAULT_LNG = 20.8537

/**
 * Native Mapbox Maps SDK (Compose extension) — dark style, gesture-ready.
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

    val viewportState = rememberMapViewportState {
        setCameraOptions {
            center(Point.fromLngLat(lng, lat))
            zoom(13.2)
            pitch(0.0)
        }
    }

    // Re-center when trip / offer coords change
    LaunchedEffect(lat, lng, markers.size) {
        if (markers.size >= 2) {
            // Keep simple center on first marker for now; fitBounds needs MapEffect
            val first = markers.first()
            viewportState.setCameraOptions {
                center(Point.fromLngLat(first.lng, first.lat))
                zoom(12.8)
            }
        } else {
            viewportState.setCameraOptions {
                center(Point.fromLngLat(lng, lat))
                zoom(13.2)
            }
        }
    }

    val annotations = remember(markers, userLat, userLng) {
        buildList {
            markers.forEach { m ->
                add(
                    PointAnnotationOptions()
                        .withPoint(Point.fromLngLat(m.lng, m.lat))
                        .withIconSize(1.15)
                        .withTextField(m.label.take(18))
                        .withTextSize(11.0)
                        .withTextOffset(listOf(0.0, 1.4))
                        .withTextColor("#F1F5F9")
                        .withTextHaloColor("#0B0F14")
                        .withTextHaloWidth(1.2),
                )
            }
            if (userLat != null && userLng != null) {
                add(
                    PointAnnotationOptions()
                        .withPoint(Point.fromLngLat(userLng, userLat))
                        .withIconSize(1.0)
                        .withTextField("Εσύ")
                        .withTextSize(10.0)
                        .withTextOffset(listOf(0.0, 1.3))
                        .withTextColor("#3B82F6")
                        .withTextHaloColor("#0B0F14")
                        .withTextHaloWidth(1.0),
                )
            }
        }
    }

    Box(modifier = modifier.background(Color(0xFF0B0F14))) {
        MapboxMap(
            modifier = Modifier.fillMaxSize(),
            mapViewportState = viewportState,
            style = { MapStyle(style = "mapbox://styles/mapbox/dark-v11") },
            compass = {},
            scaleBar = {},
            logo = {},
            attribution = {},
        ) {
            if (annotations.isNotEmpty()) {
                PointAnnotationGroup(annotations = annotations)
            }
        }
    }
}
