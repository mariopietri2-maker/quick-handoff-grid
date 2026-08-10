package com.freshdelivery.nativedriver.ui.map

import android.content.Context
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
import coil.ImageLoader
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

/**
 * Square store photo box with the active-order count badge below it.
 * The box anchors to the store's map position; the badge shows its order count.
 */
private fun createStoreMarkerBitmap(photo: Bitmap?, name: String, count: Long): Bitmap {
    val box = 98f
    val radius = 21f
    val badgeW = 56f
    val badgeH = 34f
    val gap = 7f
    val w = box.toInt()
    val h = (box + gap + badgeH).toInt()
    val bmp = Bitmap.createBitmap(w, h, Bitmap.Config.ARGB_8888)
    val canvas = Canvas(bmp)

    val rect = RectF(0f, 0f, box, box)
    val hasOrders = count > 0

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
        canvas.drawRect(rect, Paint(Paint.ANTI_ALIAS_FLAG).apply { color = android.graphics.Color.parseColor("#1B211D") })
        val letter = (name.firstOrNull()?.toString() ?: "S").uppercase()
        val tp = Paint(Paint.ANTI_ALIAS_FLAG).apply {
            color = android.graphics.Color.WHITE
            textSize = 40f
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
            strokeWidth = 5f
            color = if (hasOrders) android.graphics.Color.parseColor("#2FE795") else android.graphics.Color.parseColor("#3A443D")
        },
    )

    val badgeLeft = w / 2f - badgeW / 2f
    val badgeTop = box + gap
    val badgeRect = RectF(badgeLeft, badgeTop, badgeLeft + badgeW, badgeTop + badgeH)
    canvas.drawRoundRect(
        badgeRect,
        badgeH / 2f,
        badgeH / 2f,
        Paint(Paint.ANTI_ALIAS_FLAG).apply {
            color = if (hasOrders) android.graphics.Color.parseColor("#06C167") else android.graphics.Color.parseColor("#2A322C")
        },
    )
    val textPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        color = android.graphics.Color.WHITE
        textSize = 19f
        textAlign = Paint.Align.CENTER
        typeface = Typeface.DEFAULT_BOLD
    }
    val textBaseline = badgeRect.centerY() - (textPaint.descent() + textPaint.ascent()) / 2f
    canvas.drawText(count.toString(), badgeRect.centerX(), textBaseline, textPaint)

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

    // Snap the camera to the driver's live position once, on the first GPS fix.
    // GPS ticks afterwards never move the camera so the driver can pan freely.
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

    // Snap the camera back to the driver's live GPS position when the
    // recenter button is pressed (recenterKey is bumped each press).
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

    // Turn-by-turn: follow the driver's live position with a pitched nav view
    // so the upcoming maneuver stays visible while the driver moves.
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

    // Re-center only on trip context changes (pin/trip/destination/route),
    // never on raw GPS updates.
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

    // Store marker icons are built off the UI thread (photo fetch + canvas draw).
    val context = LocalContext.current
    val imageLoader = remember(context) { context.imageLoader }
    val storeIcons by produceState<Map<String, Bitmap>>(initialValue = emptyMap(), storeMarkers) {
        value = withContext(Dispatchers.IO) {
            storeMarkers.associate { m ->
                val photo = m.imageUrl?.let { url ->
                    try {
                        val req = ImageRequest.Builder(context).data(url).allowHardware(false).build()
                        (imageLoader?.execute(req) as? SuccessResult)?.drawable?.toBitmapOrNull()
                    } catch (_: Throwable) {
                        null
                    }
                }
                m.id to createStoreMarkerBitmap(photo, m.name, m.count)
            }
        }
    }

    val storeAnnotations = remember(storeMarkers, storeIcons) {
        storeMarkers.mapNotNull { m ->
            storeIcons[m.id]?.let { icon ->
                PointAnnotationOptions()
                    .withPoint(Point.fromLngLat(m.lng, m.lat))
                    .withIconImage(icon)
                    .withIconSize(1.0)
            }
        }
    }

    // Static markers + destination only rebuild when their content changes,
    // not on every location tick.
    val staticAnnotations = remember(markers, destination) {
        buildList {
            markers.forEach { m ->
                add(
                    PointAnnotationOptions()
                        .withPoint(Point.fromLngLat(m.lng, m.lat))
                        .withIconSize(1.15)
                        .withTextField(m.label.take(18))
                        .withTextSize(11.0)
                        .withTextOffset(listOf(0.0, 1.5))
                        .withTextColor("#FFFFFF")
                        .withTextHaloColor("#0B0E0C")
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
                        .withTextHaloColor("#0B0E0C")
                        .withTextHaloWidth(1.6),
                )
            }
        }
    }

    // The driver's live arrow is isolated so it can move every GPS tick
    // without rebuilding the static markers.
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

    Box(modifier = modifier.background(Color(0xFF0B0E0C))) {
        MapboxMap(
            modifier = Modifier.fillMaxSize(),
            mapViewportState = viewportState,
            style = { MapStyle(style = "mapbox://styles/mapbox/dark-v11") },
            compass = {},
            scaleBar = {},
            logo = {},
            attribution = {},
        ) {
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
