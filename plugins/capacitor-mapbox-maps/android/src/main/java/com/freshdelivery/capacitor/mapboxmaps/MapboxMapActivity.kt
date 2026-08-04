package com.freshdelivery.capacitor.mapboxmaps

import android.graphics.Color
import android.os.Bundle
import android.view.Gravity
import android.widget.FrameLayout
import android.widget.ImageButton
import androidx.appcompat.app.AppCompatActivity
import com.getcapacitor.JSArray
import com.getcapacitor.JSObject
import com.mapbox.geojson.Point
import com.mapbox.maps.CameraOptions
import com.mapbox.maps.MapView
import com.mapbox.maps.Style
import com.mapbox.maps.plugin.annotation.annotations
import com.mapbox.maps.plugin.annotation.generated.PointAnnotationOptions
import com.mapbox.maps.plugin.annotation.generated.createPointAnnotationManager
import com.mapbox.common.MapboxOptions
import org.json.JSONArray

/**
 * Full-screen native Mapbox map. Opened by MapboxMapsPlugin.createMap({ fullScreen: true }).
 */
class MapboxMapActivity : AppCompatActivity() {

    companion object {
        const val EXTRA_MAP_ID = "map_id"
        const val EXTRA_LAT = "lat"
        const val EXTRA_LNG = "lng"
        const val EXTRA_ZOOM = "zoom"
        const val EXTRA_STYLE = "style"
        const val EXTRA_TOKEN = "token"
        const val EXTRA_MARKERS_JSON = "markers_json"

        @Volatile var instance: MapboxMapActivity? = null
        @Volatile var pendingCamera: JSObject? = null
        @Volatile var pendingMarkers: JSArray? = null
        @Volatile var pendingClearMarkers: Boolean = false
    }

    private var mapView: MapView? = null

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        instance = this

        val token = intent.getStringExtra(EXTRA_TOKEN)
        if (!token.isNullOrBlank()) {
            try {
                MapboxOptions.accessToken = token
            } catch (_: Throwable) { /* already set */ }
        }

        val root = FrameLayout(this)
        root.setBackgroundColor(Color.parseColor("#0f172a"))

        mapView = MapView(this)
        root.addView(
            mapView,
            FrameLayout.LayoutParams(
                FrameLayout.LayoutParams.MATCH_PARENT,
                FrameLayout.LayoutParams.MATCH_PARENT,
            ),
        )

        val close = ImageButton(this).apply {
            setImageResource(android.R.drawable.ic_menu_close_clear_cancel)
            setBackgroundColor(Color.parseColor("#CC0f172a"))
            setColorFilter(Color.WHITE)
            setOnClickListener { finish() }
            contentDescription = "Close map"
        }
        val closeLp = FrameLayout.LayoutParams(120, 120).apply {
            gravity = Gravity.TOP or Gravity.END
            topMargin = 48
            marginEnd = 24
        }
        root.addView(close, closeLp)

        setContentView(root)

        val lat = intent.getDoubleExtra(EXTRA_LAT, 39.6650)
        val lng = intent.getDoubleExtra(EXTRA_LNG, 20.8537)
        val zoom = intent.getDoubleExtra(EXTRA_ZOOM, 14.0)
        val styleUri = intent.getStringExtra(EXTRA_STYLE) ?: Style.MAPBOX_STREETS

        mapView?.mapboxMap?.loadStyle(styleUri) { _ ->
            mapView?.mapboxMap?.setCamera(
                CameraOptions.Builder()
                    .center(Point.fromLngLat(lng, lat))
                    .zoom(zoom)
                    .build(),
            )
            applyMarkersJson(intent.getStringExtra(EXTRA_MARKERS_JSON))
        }
    }

    private fun applyMarkersJson(json: String?) {
        if (json.isNullOrBlank()) return
        val mapView = mapView ?: return
        try {
            val arr = JSONArray(json)
            val manager = mapView.annotations.createPointAnnotationManager()
            for (i in 0 until arr.length()) {
                val o = arr.getJSONObject(i)
                val mLat = o.optDouble("lat", Double.NaN)
                val mLng = o.optDouble("lng", Double.NaN)
                if (mLat.isNaN() || mLng.isNaN()) continue
                val opts = PointAnnotationOptions()
                    .withPoint(Point.fromLngLat(mLng, mLat))
                    .withIconSize(1.2)
                manager.create(opts)
            }
        } catch (_: Throwable) { /* ignore bad marker payload */ }
    }

    override fun onStart() {
        super.onStart()
        mapView?.onStart()
    }

    override fun onStop() {
        super.onStop()
        mapView?.onStop()
    }

    override fun onLowMemory() {
        super.onLowMemory()
        mapView?.onLowMemory()
    }

    override fun onDestroy() {
        if (instance === this) instance = null
        mapView?.onDestroy()
        mapView = null
        super.onDestroy()
    }
}
