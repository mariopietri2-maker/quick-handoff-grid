package com.freshdelivery.nativecustomer.ui.map

import android.annotation.SuppressLint
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.viewinterop.AndroidView
import com.freshdelivery.nativecustomer.BuildConfig
import org.json.JSONArray
import org.json.JSONObject

data class MapMarker(
    val lat: Double,
    val lng: Double,
    val label: String,
    val color: String,
)

@SuppressLint("SetJavaScriptEnabled")
@Composable
fun MapboxView(
    modifier: Modifier = Modifier,
    centerLat: Double?,
    centerLng: Double?,
    markers: List<MapMarker>,
) {
    val html = remember(centerLat, centerLng, markers) {
        buildMapHtml(
            token = BuildConfig.MAPBOX_TOKEN,
            lat = centerLat ?: 39.6650,
            lng = centerLng ?: 20.8537,
            markers = markers,
        )
    }
    var lastInjected by remember { mutableStateOf<String?>(null) }
    AndroidView(
        modifier = modifier,
        factory = { context ->
            WebView(context).apply {
                settings.javaScriptEnabled = true
                settings.domStorageEnabled = true
                settings.cacheMode = WebSettings.LOAD_DEFAULT
                webViewClient = WebViewClient()
                setBackgroundColor(0xFF0F172A.toInt())
            }
        },
        update = { webView ->
            if (lastInjected != html) {
                lastInjected = html
                webView.loadDataWithBaseURL(
                    "https://api.mapbox.com",
                    html,
                    "text/html",
                    "utf-8",
                    null,
                )
            }
        },
    )
}

private fun buildMapHtml(token: String, lat: Double, lng: Double, markers: List<MapMarker>): String {
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
    return """
<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1"/>
<script src="https://api.mapbox.com/mapbox-gl-js/v3.5.1/mapbox-gl.js"></script>
<link href="https://api.mapbox.com/mapbox-gl-js/v3.5.1/mapbox-gl.css" rel="stylesheet"/>
<style>
  html,body,#map{margin:0;padding:0;height:100%;background:#0f172a}
  .marker{width:14px;height:14px;border-radius:50%;border:2px solid #fff;box-shadow:0 0 0 2px rgba(0,0,0,.25)}
</style>
</head>
<body>
<div id="map"></div>
<script>
mapboxgl.accessToken = ${JSONObject.quote(token)};
const markers = $arr;
const map = new mapboxgl.Map({
  container: 'map',
  style: 'mapbox://styles/mapbox/streets-v12',
  center: [$lng, $lat],
  zoom: 13.2,
  attributionControl: false
});
markers.forEach(m => {
  const el = document.createElement('div');
  el.className = 'marker';
  el.style.background = m.color || '#22c55e';
  el.title = m.label || '';
  new mapboxgl.Marker(el).setLngLat([m.lng, m.lat]).addTo(map);
});
if (markers.length > 1) {
  const b = new mapboxgl.LngLatBounds();
  markers.forEach(m => b.extend([m.lng, m.lat]));
  map.fitBounds(b, { padding: 60, maxZoom: 15 });
}
</script>
</body>
</html>
""".trimIndent()
}
