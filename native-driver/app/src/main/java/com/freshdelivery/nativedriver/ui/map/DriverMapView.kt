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
import com.mapbox.maps.extension.compose.annotation.generated.PolylineAnnotationGroup
import com.mapbox.maps.extension.compose.style.MapStyle
import com.mapbox.maps.plugin.annotation.generated.PointAnnotationOptions
import com.mapbox.maps.plugin.annotation.generated.PolylineAnnotationOptions

data class MapMarker(
    val lat: Double,
    val lng: Double,
    val label: String,
    val color: String,
)

private const val DEFAULT_LAT = 39.6650
private const val DEFAULT_LNG = 20.8537

private fun createDriverArrowBitmap(size: Int = 96): Bitmap {
    val bmp = Bitmap.createBitmap(size, size, Bitmap.Config.ARGB_8888)
    val c = Canvas(bmp)
    val cx = size / 2f
    val cy = size / 2f

    val glow = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        color = android.graphics.Color.argb(90, 6, 193, 103)
        style = Paint.Style.FILL
    }
    c.drawCircle(cx, cy, size * 0.42f, glow)

    val disc = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        color = android.graphics.Color.WHITE
        style = Paint.Style.FILL
    }
    c.drawCircle(cx, cy, size * 0.30f, disc)

    val arrow = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        color = android.graphics.Color.parseColor("#06C167")
        style = Paint.Style.FILL
    }
    val path = Path().apply {
        moveTo(cx, cy - size * 0.22f)
        lineTo(cx + size * 0.14f, cy + size * 0.16f)
        lineTo(cx, cy + size * 0.06f)
        lineTo(cx - size * 0.14f, cy + size * 0.16f)
        close()
    }
    c.drawPath(path, arrow)
    return bmp
}

private fun createDestinationPinBitmap(size: Int = 64): Bitmap {
    val bmp = Bitmap.createBitmap(size, size, Bitmap.Config.ARGB_8888)
    val c = Canvas(bmp)
    val cx = size / 2f
    val cy = size / 2f

    val ring = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        color = android.graphics.Color.WHITE
        style = Paint.Style.FILL
    }
    c.drawCircle(cx, cy, size * 0.48f, ring)

    val fill = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        color = android.graphics.Color.parseColor("#06C167")
        style = Paint.Style.FILL
    }
    c.drawCircle(cx, cy, size * 0.38f, fill)

    val dot = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        color = android.graphics.Color.WHITE
        style = Paint.Style.FILL
    }
    c.drawCircle(cx, cy, size * 0.13f, dot)
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
    route: List<Point> = emptyList(),
    destination: MapMarker? = null,
) {
    val lat = centerLat ?: userLat ?: DEFAULT_LAT
    val lng = centerLng ?: userLng ?: DEFAULT_LNG

    val viewportState = rememberMapViewportState {
        setCameraOptions {
            center(Point.fromLngLat(lng, lat))
            zoom(13.5)
            pitch(0.0)
        }
    }

    LaunchedEffect(lat, lng, markers.size, userLat, userLng, destination, route.size) {
        when {
            destination != null -> {
                viewportState.setCameraOptions {
                    center(Point.fromLngLat(destination.lng, destination.lat))
                    zoom(14.0)
                }
            }
            markers.isNotEmpty() -> {
                val first = markers.first()
                viewportState.setCameraOptions {
                    center(Point.fromLngLat(first.lng, first.lat))
                    zoom(13.2)
                }
            }
            userLat != null && userLng != null -> {
                viewportState.setCameraOptions {
                    center(Point.fromLngLat(userLng, userLat))
                    zoom(14.5)
                }
            }
            else -> {
                viewportState.setCameraOptions {
                    center(Point.fromLngLat(lng, lat))
                    zoom(13.5)
                }
            }
        }
    }

    val driverIcon = remember { createDriverArrowBitmap() }
    val destIcon = remember { createDestinationPinBitmap() }

    val annotations = remember(markers, userLat, userLng, userBearing, destination) {
        buildList {
            markers.forEach { m ->
                add(
                    PointAnnotationOptions()
                        .withPoint(Point.fromLngLat(m.lng, m.lat))
                        .withIconSize(1.15)
                        .withTextField(m.label.take(18))
                        .withTextSize(11.0)
                        .withTextOffset(listOf(0.0, 1.5))
                        .withTextColor("#1A1A1A")
                        .withTextHaloColor("#FFFFFF")
                        .withTextHaloWidth(1.6),
                )
            }
            destination?.let { d ->
                add(
                    PointAnnotationOptions()
                        .withPoint(Point.fromLngLat(d.lng, d.lat))
                        .withIconImage(destIcon)
                        .withIconSize(1.2)
                        .withTextField(d.label.take(18))
                        .withTextSize(11.0)
                        .withTextOffset(listOf(0.0, 2.2))
                        .withTextColor("#00864B")
                        .withTextHaloColor("#FFFFFF")
                        .withTextHaloWidth(1.6),
                )
            }
            if (userLat != null && userLng != null) {
                add(
                    PointAnnotationOptions()
                        .withPoint(Point.fromLngLat(userLng, userLat))
                        .withIconImage(driverIcon)
                        .withIconSize(1.4)
                        .withIconRotate((userBearing ?: 0f).toDouble()),
                )
            }
        }
    }

    Box(modifier = modifier.background(Color(0xFFE8EAED))) {
        MapboxMap(
            modifier = Modifier.fillMaxSize(),
            mapViewportState = viewportState,
            style = { MapStyle(style = "mapbox://styles/mapbox/light-v11") },
            compass = {},
            scaleBar = {},
            logo = {},
            attribution = {},
        ) {
            if (annotations.isNotEmpty()) {
                PointAnnotationGroup(annotations = annotations)
            }
            if (route.isNotEmpty()) {
                PolylineAnnotationGroup(
                    annotations = listOf(
                        PolylineAnnotationOptions()
                            .withPoints(route)
                            .withLineColor("#06C167")
                            .withLineWidth(4.0),
                    ),
                )
            }
        }
    }
}
