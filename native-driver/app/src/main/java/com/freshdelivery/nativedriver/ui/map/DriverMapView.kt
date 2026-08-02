package com.freshdelivery.nativedriver.ui.map

import android.annotation.SuppressLint
import android.graphics.Color as AndroidColor
import android.view.ViewGroup
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
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
import androidx.compose.ui.viewinterop.AndroidView
import com.freshdelivery.nativedriver.BuildConfig
import com.freshdelivery.nativedriver.ui.theme.FreshGreen
import org.json.JSONArray
import org.json.JSONObject

data class MapMarker(
    val lat: Double,
    val lng: Double,
    val label: String,
    val color: String,
)

/** Ioannina city center — default when GPS / trip coords are missing. */
private const val DEFAULT_LAT = 39.6650
private const val DEFAULT_LNG = 20.8537

@SuppressLint("SetJavaScriptEnabled")
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
    val html = remember(lat, lng, markers, userLat, userLng) {
        buildMapHtml(
            token = BuildConfig.MAPBOX_TOKEN,
            lat = lat,
            lng = lng,
            markers = markers,
            userLat = userLat,
            userLng = userLng,
        )
    }
    var loading by remember { mutableStateOf(true) }

    Box(modifier = modifier.background(Color(0xFF0B0F14))) {
        AndroidView(
            modifier = Modifier.fillMaxSize(),
            factory = { context ->
                WebView(context).apply {
                    layoutParams = ViewGroup.LayoutParams(
                        ViewGroup.LayoutParams.MATCH_PARENT,
                        ViewGroup.LayoutParams.MATCH_PARENT,
                    )
                    settings.javaScriptEnabled = true
                    settings.domStorageEnabled = true
                    settings.cacheMode = WebSettings.LOAD_DEFAULT
                    settings.setSupportZoom(false)
                    settings.builtInZoomControls = false
                    settings.displayZoomControls = false
                    settings.mediaPlaybackRequiresUserGesture = false
                    // Prevent white flash before dark map tiles load
                    setBackgroundColor(AndroidColor.parseColor("#0B0F14"))
                    webViewClient = object : WebViewClient() {
                        override fun onPageFinished(view: WebView?, url: String?) {
                            loading = false
                        }
                    }
                }
            },
            update = { webView ->
                webView.loadDataWithBaseURL(
                    "https://api.mapbox.com",
                    html,
                    "text/html",
                    "utf-8",
                    null,
                )
            },
        )
        if (loading) {
            CircularProgressIndicator(
                modifier = Modifier.align(Alignment.Center),
                color = FreshGreen,
                strokeWidth = androidx.compose.ui.unit.Dp(2.5f),
            )
        }
    }
}

private fun buildMapHtml(
    token: String,
    lat: Double,
    lng: Double,
    markers: List<MapMarker>,
    userLat: Double?,
    userLng: Double?,
): String {
    val arr = JSONArray()
    markers.forEach { m ->
        arr.put(
            JSONObject()
                .put("lat", m.lat)
                .put("lng", m.lng)
                .put("label", m.label)
                .put("color", m.color),
        )
    }
    val userJson = if (userLat != null && userLng != null) {
        """{"lat":$userLat,"lng":$userLng}"""
    } else {
        "null"
    }
    return """
<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no"/>
<script src="https://api.mapbox.com/mapbox-gl-js/v3.5.1/mapbox-gl.js"></script>
<link href="https://api.mapbox.com/mapbox-gl-js/v3.5.1/mapbox-gl.css" rel="stylesheet"/>
<style>
  html,body,#map{margin:0;padding:0;height:100%;width:100%;background:#0b0f14;overflow:hidden}
  .marker{width:16px;height:16px;border-radius:50%;border:2.5px solid #fff;box-shadow:0 2px 8px rgba(0,0,0,.45)}
  .user-dot{
    width:18px;height:18px;border-radius:50%;
    background:#3B82F6;border:3px solid #fff;
    box-shadow:0 0 0 6px rgba(59,130,246,.28),0 2px 10px rgba(0,0,0,.4);
  }
  .mapboxgl-ctrl-attrib,.mapboxgl-ctrl-logo{display:none!important}
</style>
</head>
<body>
<div id="map"></div>
<script>
mapboxgl.accessToken = ${JSONObject.quote(token)};
const markers = $arr;
const user = $userJson;
const map = new mapboxgl.Map({
  container: 'map',
  style: 'mapbox://styles/mapbox/dark-v11',
  center: [$lng, $lat],
  zoom: 13.4,
  attributionControl: false,
  logoPosition: 'bottom-right',
  pitch: 0,
  antialias: true
});
map.on('load', () => {
  markers.forEach(m => {
    const el = document.createElement('div');
    el.className = 'marker';
    el.style.background = m.color || '#00C853';
    el.title = m.label || '';
    new mapboxgl.Marker({element: el, anchor: 'center'})
      .setLngLat([m.lng, m.lat])
      .setPopup(new mapboxgl.Popup({offset: 12, closeButton: false}).setText(m.label || ''))
      .addTo(map);
  });
  if (user) {
    const el = document.createElement('div');
    el.className = 'user-dot';
    new mapboxgl.Marker({element: el, anchor: 'center'})
      .setLngLat([user.lng, user.lat])
      .addTo(map);
  }
  const points = markers.map(m => [m.lng, m.lat]);
  if (user) points.push([user.lng, user.lat]);
  if (points.length > 1) {
    const b = new mapboxgl.LngLatBounds();
    points.forEach(p => b.extend(p));
    map.fitBounds(b, { padding: 56, maxZoom: 15, duration: 600 });
  }
});
</script>
</body>
</html>
""".trimIndent()
}
