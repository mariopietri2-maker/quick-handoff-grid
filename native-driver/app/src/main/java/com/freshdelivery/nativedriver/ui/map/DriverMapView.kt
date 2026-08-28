package com.freshdelivery.nativedriver.ui.map

import android.graphics.Bitmap
import android.graphics.BitmapShader
import android.graphics.Canvas
import android.graphics.Matrix
import android.graphics.Paint
import android.graphics.Path
import android.graphics.RectF
import android.graphics.Shader
import android.graphics.Typeface
import android.graphics.drawable.BitmapDrawable
import android.graphics.drawable.Drawable
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.produceState
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import coil.imageLoader
import coil.request.ImageRequest
import coil.request.SuccessResult
import com.mapbox.geojson.Point
import com.mapbox.maps.extension.compose.MapboxMap
import com.mapbox.maps.extension.compose.animation.viewport.rememberMapViewportState
import com.mapbox.maps.extension.compose.annotation.generated.PointAnnotationGroup
import com.mapbox.maps.extension.compose.annotation.generated.PolylineAnnotationGroup
import com.mapbox.maps.extension.compose.style.MapStyle
import com.mapbox.maps.plugin.annotation.generated.PointAnnotationOptions
import com.mapbox.maps.plugin.annotation.generated.PolylineAnnotationOptions
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext

data class MapMarker(
    val lat: Double,
    val lng: Double,
    val label: String,
    val color: String,
)

/** A store on the driver map: square photo box + active-order count badge. */
data class StoreMapMarker(
    val id: String,
    val lat: Double,
    val lng: Double,
    val name: String,
    val imageUrl: String?,
    val count: Long,
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

private fun Drawable.toBitmapOrNull(): Bitmap? = when (this) {
    is BitmapDrawable -> bitmap
    else -> null
}

/** Red/yellow/green traffic-light icon shown at real signalized intersections. */
private fun createTrafficLightBitmap(size: Int = 44): Bitmap {
    val bmp = Bitmap.createBitmap(size, size, Bitmap.Config.ARGB_8888)
    val c = Canvas(bmp)
    val boxW = size * 0.62f
    val boxH = size * 0.9f
    val left = (size - boxW) / 2f
    val top = (size - boxH) / 2f
    val box = RectF(left, top, left + boxW, top + boxH)
    val radius = boxW * 0.25f
    c.drawRoundRect(box, radius, radius, Paint(Paint.ANTI_ALIAS_FLAG).apply {
        color = android.graphics.Color.parseColor("#14181F")
        style = Paint.Style.FILL
    })
    c.drawRoundRect(box, radius, radius, Paint(Paint.ANTI_ALIAS_FLAG).apply {
        color = android.graphics.Color.WHITE
        style = Paint.Style.STROKE
        strokeWidth = size * 0.04f
    })
    val lampR = boxW * 0.19f
    val cx = box.centerX()
    val lampColors = listOf("#EF4444", "#F59E0B", "#22C55E")
    val lampT = listOf(0.24f, 0.5f, 0.76f)
    lampT.forEachIndexed { i, t ->
        c.drawCircle(cx, box.top + boxH * t, lampR, Paint(Paint.ANTI_ALIAS_FLAG).apply {
            color = android.graphics.Color.parseColor(lampColors[i])
        })
    }
    return bmp
}

/**
 * Large store photo tile + order-count badge for map readability.
 * Draws a bright letter placeholder immediately so pins appear before photos load.
 */
private fun createStoreMarkerBitmap(photo: Bitmap?, name: String, count: Long): Bitmap {
    // Larger pin so stores stay readable on the driver map; count badge always visible.
    val box = 104f
    val radius = 22f
    val badgeH = 32f
    val gap = 6f
    val pad = 6f
    val countLabel = if (count > 99) "99+" else count.toString()
    val badgeW = maxOf(48f, 18f + countLabel.length * 14f)
    val w = (box + pad * 2).toInt()
    val h = (pad + box + gap + badgeH + pad).toInt()
    val bmp = Bitmap.createBitmap(w, h, Bitmap.Config.ARGB_8888)
    val canvas = Canvas(bmp)

    val rect = RectF(pad, pad, pad + box, pad + box)
    val hasOrders = count > 0

    canvas.drawRoundRect(
        RectF(rect.left - 3f, rect.top - 3f, rect.right + 3f, rect.bottom + 3f),
        radius + 2f,
        radius + 2f,
        Paint(Paint.ANTI_ALIAS_FLAG).apply {
            color = android.graphics.Color.argb(if (hasOrders) 140 else 90, 6, 193, 103)
            style = Paint.Style.FILL
        },
    )

    val clip = Path().apply { addRoundRect(rect, radius, radius, Path.Direction.CW) }
    canvas.save()
    canvas.clipPath(clip)
    if (photo != null) {
        val shader = BitmapShader(photo, Shader.TileMode.CLAMP, Shader.TileMode.CLAMP)
        val scale = maxOf(rect.width() / photo.width, rect.height() / photo.height)
        val matrix = Matrix().apply {
            setScale(scale, scale)
            postTranslate(
                rect.centerX() - photo.width * scale / 2f,
                rect.centerY() - photo.height * scale / 2f,
            )
        }
        shader.setLocalMatrix(matrix)
        canvas.drawRect(rect, Paint(Paint.ANTI_ALIAS_FLAG).apply { this.shader = shader })
    } else {
        canvas.drawRect(rect, Paint(Paint.ANTI_ALIAS_FLAG).apply {
            color = android.graphics.Color.parseColor("#0B2E20")
        })
        val letter = (name.firstOrNull()?.toString() ?: "S").uppercase()
        val tp = Paint(Paint.ANTI_ALIAS_FLAG).apply {
            color = android.graphics.Color.parseColor("#2FE795")
            textSize = 42f
            textAlign = Paint.Align.CENTER
            typeface = Typeface.DEFAULT_BOLD
        }
        val baseline = rect.centerY() - (tp.descent() + tp.ascent()) / 2f
        canvas.drawText(letter, rect.centerX(), baseline, tp)
    }
    canvas.restore()

    canvas.drawRoundRect(
        rect,
        radius,
        radius,
        Paint(Paint.ANTI_ALIAS_FLAG).apply {
            style = Paint.Style.STROKE
            strokeWidth = 5.5f
            color = android.graphics.Color.WHITE
        },
    )
    canvas.drawRoundRect(
        rect,
        radius,
        radius,
        Paint(Paint.ANTI_ALIAS_FLAG).apply {
            style = Paint.Style.STROKE
            strokeWidth = 3f
            color = if (hasOrders) android.graphics.Color.parseColor("#2FE795")
            else android.graphics.Color.parseColor("#06C167")
        },
    )

    val badgeLeft = w / 2f - badgeW / 2f
    val badgeTop = pad + box + gap
    val badgeRect = RectF(badgeLeft, badgeTop, badgeLeft + badgeW, badgeTop + badgeH)
    canvas.drawRoundRect(
        badgeRect,
        badgeH / 2f,
        badgeH / 2f,
        Paint(Paint.ANTI_ALIAS_FLAG).apply {
            color = if (hasOrders) android.graphics.Color.parseColor("#06C167")
            else android.graphics.Color.parseColor("#1A2420")
        },
    )
    canvas.drawRoundRect(
        badgeRect,
        badgeH / 2f,
        badgeH / 2f,
        Paint(Paint.ANTI_ALIAS_FLAG).apply {
            style = Paint.Style.STROKE
            strokeWidth = 2.2f
            color = android.graphics.Color.WHITE
        },
    )
    val textPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        color = android.graphics.Color.WHITE
        textSize = 18f
        textAlign = Paint.Align.CENTER
        typeface = Typeface.DEFAULT_BOLD
    }
    val textBaseline = badgeRect.centerY() - (textPaint.descent() + textPaint.ascent()) / 2f
    canvas.drawText(countLabel, badgeRect.centerX(), textBaseline, textPaint)

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
    recenterKey: Int = 0,
    storeMarkers: List<StoreMapMarker> = emptyList(),
    followUser: Boolean = false,
    lightStyle: Boolean = false,
    trafficSignals: List<Point> = emptyList(),
) {
    val lat = centerLat ?: userLat ?: DEFAULT_LAT
    val lng = centerLng ?: userLng ?: DEFAULT_LNG

    val textColor = if (lightStyle) "#1A1F1C" else "#FFFFFF"
    val haloColor = if (lightStyle) "#FFFFFF" else "#0B0E0C"

    val viewportState = rememberMapViewportState {
        setCameraOptions {
            center(Point.fromLngLat(lng, lat))
            zoom(13.5)
            pitch(0.0)
        }
    }

    var initialCentered by remember { mutableStateOf(false) }
    LaunchedEffect(userLat, userLng) {
        if (!initialCentered && userLat != null && userLng != null) {
            initialCentered = true
            viewportState.setCameraOptions {
                center(Point.fromLngLat(userLng, userLat))
                zoom(14.5)
            }
        }
    }

    LaunchedEffect(recenterKey) {
        if (recenterKey > 0) {
            val rLat = userLat ?: centerLat ?: DEFAULT_LAT
            val rLng = userLng ?: centerLng ?: DEFAULT_LNG
            viewportState.setCameraOptions {
                center(Point.fromLngLat(rLng, rLat))
                zoom(14.5)
            }
        }
    }

    LaunchedEffect(followUser, userLat, userLng) {
        if (followUser && userLat != null && userLng != null) {
            viewportState.setCameraOptions {
                center(Point.fromLngLat(userLng, userLat))
                zoom(15.2)
                pitch(50.0)
                bearing(0.0)
            }
        }
    }

    LaunchedEffect(markers.size, destination, route.size, followUser) {
        when {
            followUser -> Unit
            destination != null -> {
                viewportState.setCameraOptions {
                    center(Point.fromLngLat(destination.lng, destination.lat))
                    zoom(14.0)
                    pitch(0.0)
                    bearing(0.0)
                }
            }
            markers.isNotEmpty() -> {
                val first = markers.first()
                viewportState.setCameraOptions {
                    center(Point.fromLngLat(first.lng, first.lat))
                    zoom(13.2)
                    pitch(0.0)
                    bearing(0.0)
                }
            }
        }
    }

    val driverIcon = remember { createDriverArrowBitmap() }
    val destIcon = remember { createDestinationPinBitmap() }
    val trafficLightIcon = remember { createTrafficLightBitmap() }

    // Show letter placeholders immediately, then upgrade with photos as they load.
    val context = LocalContext.current
    val imageLoader = remember(context) { context.imageLoader }
    val storeIcons by produceState<Map<String, Bitmap>>(initialValue = emptyMap(), storeMarkers) {
        val placeholders = storeMarkers.associate { m ->
            m.id to createStoreMarkerBitmap(null, m.name, m.count)
        }
        value = placeholders
        withContext(Dispatchers.IO) {
            storeMarkers.forEach { m ->
                val url = m.imageUrl ?: return@forEach
                val photo = try {
                    val req = ImageRequest.Builder(context)
                        .data(url)
                        .allowHardware(false)
                        .size(256)
                        .build()
                    (imageLoader.execute(req) as? SuccessResult)?.drawable?.toBitmapOrNull()
                } catch (_: Throwable) {
                    null
                }
                if (photo != null) {
                    val upgraded = createStoreMarkerBitmap(photo, m.name, m.count)
                    value = value + (m.id to upgraded)
                }
            }
        }
    }

    val storeAnnotations = remember(storeMarkers, storeIcons, textColor, haloColor) {
        storeMarkers.mapNotNull { m ->
            val icon = storeIcons[m.id] ?: return@mapNotNull null
            PointAnnotationOptions()
                .withPoint(Point.fromLngLat(m.lng, m.lat))
                .withIconImage(icon)
                .withIconSize(1.35)
                .withTextField(
                    if (m.count > 0) "${m.count} · ${m.name.take(14)}" else m.name.take(16),
                )
                .withTextSize(12.0)
                .withTextOffset(listOf(0.0, 2.35))
                .withTextColor(textColor)
                .withTextHaloColor(haloColor)
                .withTextHaloWidth(2.0)
        }
    }

    val staticAnnotations = remember(markers, destination, lightStyle) {
        buildList {
            markers.forEach { m ->
                add(
                    PointAnnotationOptions()
                        .withPoint(Point.fromLngLat(m.lng, m.lat))
                        .withIconSize(1.15)
                        .withTextField(m.label.take(18))
                        .withTextSize(11.0)
                        .withTextOffset(listOf(0.0, 1.5))
                        .withTextColor(textColor)
                        .withTextHaloColor(haloColor)
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
                        .withTextColor("#2FE795")
                        .withTextHaloColor(haloColor)
                        .withTextHaloWidth(1.6),
                )
            }
        }
    }

    val driverAnnotations = if (userLat != null && userLng != null) {
        listOf(
            PointAnnotationOptions()
                .withPoint(Point.fromLngLat(userLng, userLat))
                .withIconImage(driverIcon)
                .withIconSize(1.4)
                .withIconRotate((userBearing ?: 0f).toDouble()),
        )
    } else {
        emptyList()
    }

    val trafficSignalAnnotations = remember(trafficSignals) {
        trafficSignals.map { p ->
            PointAnnotationOptions()
                .withPoint(p)
                .withIconImage(trafficLightIcon)
                .withIconSize(0.6)
        }
    }

    Box(modifier = modifier.background(if (lightStyle) Color(0xFFF4F6F4) else Color(0xFF0B0E0C))) {
        MapboxMap(
            modifier = Modifier.fillMaxSize(),
            mapViewportState = viewportState,
            style = {
                MapStyle(style = if (lightStyle) "mapbox://styles/mapbox/light-v11" else "mapbox://styles/mapbox/dark-v11")
            },
            compass = {},
            scaleBar = {},
            logo = {},
            attribution = {},
        ) {
            if (trafficSignalAnnotations.isNotEmpty()) {
                PointAnnotationGroup(annotations = trafficSignalAnnotations)
            }
            if (storeAnnotations.isNotEmpty()) {
                PointAnnotationGroup(annotations = storeAnnotations)
            }
            if (staticAnnotations.isNotEmpty()) {
                PointAnnotationGroup(annotations = staticAnnotations)
            }
            if (driverAnnotations.isNotEmpty()) {
                PointAnnotationGroup(annotations = driverAnnotations)
            }
            if (route.isNotEmpty()) {
                PolylineAnnotationGroup(
                    annotations = listOf(
                        PolylineAnnotationOptions()
                            .withPoints(route)
                            .withLineColor("#2FE795")
                            .withLineWidth(4.0),
                    ),
                )
            }
        }
    }
}
