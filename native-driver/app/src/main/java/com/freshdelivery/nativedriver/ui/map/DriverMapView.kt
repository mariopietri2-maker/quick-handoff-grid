package com.freshdelivery.nativedriver.ui.map

import android.graphics.Bitmap
import android.graphics.Canvas
import android.graphics.Paint
import android.graphics.Path
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

private const val DEFAULT_LAT = 39.6650
private const val DEFAULT_LNG = 20.8537

/** Draws a navigation-arrow pin (points up = north); rotate with iconRotate = bearing. */
private fun createDriverArrowBitmap(size: Int = 96): Bitmap {
    val bmp = Bitmap.createBitmap(size, size, Bitmap.Config.ARGB_8888)
    val c = Canvas(bmp)
    val cx = size / 2f
    val cy = size / 2f

    // Soft glow disc
    val glow = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        color = android.graphics.Color.argb(60, 59, 130, 246)
        style = Paint.Style.FILL
    }
    c.drawCircle(cx, cy, size * 0.42f, glow)

    // White outline disc
    val disc = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        color = android.graphics.Color.WHITE
        style = Paint.Style.FILL
    }
    c.drawCircle(cx, cy, size * 0.28f, disc)

    // Blue filled arrow pointing up (north)
    val arrow = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        color = android.graphics.Color.parseColor("#2563EB")
        style = Paint.Style.FILL
    }
    val path = Path().apply {
        moveTo(cx, cy - size * 0.22f) // tip
        lineTo(cx + size * 0.14f, cy + size * 0.16f)
        lineTo(cx, cy + size * 0.06f)
        lineTo(cx - size * 0.14f, cy + size * 0.16f)
        close()
    }
    c.drawPath(path, arrow)
    return bmp
}

@Composable
fun DriverMapView(
    modifier: Modifier = Modifier,
    centerLat: Double?,
    centerLng: Double?,
    markers: List<MapMarker>,
    userLat: Double? = null,
    userLng: Double? = null,
    userBearing: Float? = null,
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

    LaunchedEffect(lat, lng, markers.size, userLat, userLng) {
        when {
            markers.size >= 2 -> {
                val first = markers.first()
                viewportState.setCameraOptions {
                    center(Point.fromLngLat(first.lng, first.lat))
                    zoom(12.8)
                }
            }
            userLat != null && userLng != null && markers.isEmpty() -> {
                viewportState.setCameraOptions {
                    center(Point.fromLngLat(userLng, userLat))
                    zoom(15.0)
                }
            }
            else -> {
                viewportState.setCameraOptions {
                    center(Point.fromLngLat(lng, lat))
                    zoom(13.2)
                }
            }
        }
    }

    val driverIcon = remember { createDriverArrowBitmap() }

    val annotations = remember(markers, userLat, userLng, userBearing) {
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
                val rotate = (userBearing ?: 0f).toDouble()
                add(
                    PointAnnotationOptions()
                        .withPoint(Point.fromLngLat(userLng, userLat))
                        .withIconImage(driverIcon)
                        .withIconSize(1.35)
                        .withIconRotate(rotate)
                        // icon-rotation-alignment is manager/layer-level only in Maps SDK 11.x;
                        // withIconRotate is enough for bearing-aligned driver arrow.
                        .withTextField("Εσύ")
                        .withTextSize(11.0)
                        .withTextOffset(listOf(0.0, 2.0))
                        .withTextColor("#93C5FD")
                        .withTextHaloColor("#0B0F14")
                        .withTextHaloWidth(1.2),
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
