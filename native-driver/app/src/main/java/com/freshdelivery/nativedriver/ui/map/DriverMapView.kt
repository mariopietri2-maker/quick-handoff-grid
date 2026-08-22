package com.freshdelivery.nativedriver.ui.map

import android.graphics.Bitmap
import android.graphics.BitmapShader
import android.graphics.BlurMaskFilter
import android.graphics.Canvas
import android.graphics.Matrix
import android.graphics.Paint
import android.graphics.Path
import android.graphics.Shader
import android.graphics.Typeface
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.produceState
import androidx.compose.runtime.remember
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import coil.imageLoader
import coil.request.ImageRequest
import coil.request.SuccessResult
import com.mapbox.geojson.Point
import com.mapbox.maps.extension.compose.MapboxMap
import com.mapbox.maps.extension.compose.animation.viewport.rememberMapViewportState
import com.mapbox.maps.extension.compose.annotation.generated.PointAnnotationGroup
import com.mapbox.maps.extension.compose.style.MapStyle
import com.mapbox.maps.plugin.annotation.generated.PointAnnotationOptions
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext

data class MapMarker(val lat: Double, val lng: Double, val label: String, val color: String)

/** Store pin: compact circle + unoffered order count under the icon. */
data class StoreMapMarker(
    val id: String,
    val lat: Double,
    val lng: Double,
    val name: String,
    val imageUrl: String?,
    val count: Long,
)

private fun createStoreMarkerBitmap(photo: Bitmap?, name: String, count: Long): Bitmap {
    val hasOrders = count > 0
    val size = 42f
    val pad = 3f
    val countH = if (hasOrders) 16f else 0f
    val w = (size + pad * 2).toInt()
    val h = (size + pad * 2 + countH).toInt()
    val bmp = Bitmap.createBitmap(w, h, Bitmap.Config.ARGB_8888)
    val canvas = Canvas(bmp)
    val cx = pad + size / 2f
    val cy = pad + size / 2f
    val r = size / 2f

    canvas.drawCircle(cx, cy, r + 2.2f, Paint(Paint.ANTI_ALIAS_FLAG).apply {
        color = android.graphics.Color.parseColor("#40000000")
        maskFilter = BlurMaskFilter(2.5f, BlurMaskFilter.Blur.NORMAL)
    })
    canvas.drawCircle(cx, cy, r, Paint(Paint.ANTI_ALIAS_FLAG).apply {
        color = android.graphics.Color.WHITE
    })
    val inner = r - 2.0f
    val clip = Path().apply { addCircle(cx, cy, inner, Path.Direction.CW) }
    canvas.save()
    canvas.clipPath(clip)
    if (photo != null) {
        val shader = BitmapShader(photo, Shader.TileMode.CLAMP, Shader.TileMode.CLAMP)
        val scale = maxOf((inner * 2f) / photo.width, (inner * 2f) / photo.height)
        val matrix = Matrix().apply {
            setScale(scale, scale)
            postTranslate(cx - photo.width * scale / 2f, cy - photo.height * scale / 2f)
        }
        shader.setLocalMatrix(matrix)
        canvas.drawCircle(cx, cy, inner, Paint(Paint.ANTI_ALIAS_FLAG).apply { this.shader = shader })
    } else {
        canvas.drawCircle(cx, cy, inner, Paint(Paint.ANTI_ALIAS_FLAG).apply {
            color = android.graphics.Color.parseColor("#0F3D2A")
        })
        val letter = (name.firstOrNull()?.toString() ?: "S").uppercase()
        val tp = Paint(Paint.ANTI_ALIAS_FLAG).apply {
            color = android.graphics.Color.parseColor("#2FE795")
            textSize = 17f
            textAlign = Paint.Align.CENTER
            typeface = Typeface.DEFAULT_BOLD
        }
        val baseline = cy - (tp.descent() + tp.ascent()) / 2f
        canvas.drawText(letter, cx, baseline, tp)
    }
    canvas.restore()
    canvas.drawCircle(cx, cy, r - 1.0f, Paint(Paint.ANTI_ALIAS_FLAG).apply {
        style = Paint.Style.STROKE
        strokeWidth = 2f
        color = if (hasOrders) android.graphics.Color.parseColor("#2FE795")
        else android.graphics.Color.parseColor("#06C167")
    })
    if (hasOrders) {
        val label = if (count > 9) "9+" else count.toString()
        val pillH = 14f
        val pillW = if (label.length > 1) 22f else 16f
        val px = cx
        val py = pad + size + pillH / 2f + 1f
        canvas.drawRoundRect(
            px - pillW / 2f - 1f, py - pillH / 2f - 1f,
            px + pillW / 2f + 1f, py + pillH / 2f + 1f,
            pillH, pillH,
            Paint(Paint.ANTI_ALIAS_FLAG).apply { color = android.graphics.Color.WHITE },
        )
        canvas.drawRoundRect(
            px - pillW / 2f, py - pillH / 2f,
            px + pillW / 2f, py + pillH / 2f,
            pillH, pillH,
            Paint(Paint.ANTI_ALIAS_FLAG).apply {
                color = android.graphics.Color.parseColor("#06C167")
            },
        )
        val tp = Paint(Paint.ANTI_ALIAS_FLAG).apply {
            color = android.graphics.Color.WHITE
            textSize = if (label.length > 1) 9.5f else 10.5f
            textAlign = Paint.Align.CENTER
            typeface = Typeface.DEFAULT_BOLD
        }
        val baseline = py - (tp.descent() + tp.ascent()) / 2f
        canvas.drawText(label, px, baseline, tp)
    }
    return bmp
}

@Composable
fun DriverMapView(
    modifier: Modifier = Modifier,
    storeMarkers: List<StoreMapMarker> = emptyList(),
    markers: List<MapMarker> = emptyList(),
    lightStyle: Boolean = false,
) {
    val styleUri = if (lightStyle) "mapbox://styles/mapbox/light-v11" else "mapbox://styles/mapbox/dark-v11"
    val viewportState = rememberMapViewportState {}
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
                    val req = ImageRequest.Builder(context).data(url).allowHardware(false).size(256).build()
                    (imageLoader.execute(req) as? SuccessResult)?.drawable?.let { d ->
                        Bitmap.createBitmap(d.intrinsicWidth.coerceAtLeast(1), d.intrinsicHeight.coerceAtLeast(1), Bitmap.Config.ARGB_8888).also { b ->
                            val c = Canvas(b)
                            d.setBounds(0, 0, c.width, c.height)
                            d.draw(c)
                        }
                    }
                } catch (_: Throwable) { null }
                if (photo != null) {
                    value = value + (m.id to createStoreMarkerBitmap(photo, m.name, m.count))
                }
            }
        }
    }
    val storeAnnotations = remember(storeMarkers, storeIcons) {
        storeMarkers.mapNotNull { m ->
            val icon = storeIcons[m.id] ?: return@mapNotNull null
            PointAnnotationOptions()
                .withPoint(Point.fromLngLat(m.lng, m.lat))
                .withIconImage(icon)
                .withIconSize(1.0)
                .withIconOffset(listOf(0.0, if (m.count > 0) -6.0 else 0.0))
        }
    }
    MapboxMap(
        modifier = modifier.fillMaxSize(),
        mapViewportState = viewportState,
    ) {
        MapStyle(style = styleUri)
        PointAnnotationGroup(annotations = storeAnnotations)
    }
}
