package com.freshdelivery.nativeadmin.ui

import android.annotation.SuppressLint
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.ui.Modifier
import androidx.compose.ui.viewinterop.AndroidView
import com.freshdelivery.nativeadmin.data.DriverUi
import com.freshdelivery.nativeadmin.data.StoreRow
import org.json.JSONArray
import org.json.JSONObject

/** Leaflet + OSM map — no Mapbox token required. Centered on Ioannina. */
@SuppressLint("SetJavaScriptEnabled")
@Composable
fun DriverMapWebView(
    drivers: List<DriverUi>,
    stores: List<StoreRow>,
    modifier: Modifier = Modifier,
    focusLat: Double? = null,
    focusLng: Double? = null,
) {
    val html = remember(drivers, stores, focusLat, focusLng) {
        buildMapHtml(drivers, stores, focusLat, focusLng)
    }
    AndroidView(
        modifier = modifier,
        factory = { ctx ->
            WebView(ctx).apply {
                settings.javaScriptEnabled = true
                settings.domStorageEnabled = true
                webViewClient = WebViewClient()
                loadDataWithBaseURL("https://leafletjs.com", html, "text/html", "UTF-8", null)
            }
        },
        update = { web ->
            web.loadDataWithBaseURL("https://leafletjs.com", html, "text/html", "UTF-8", null)
        },
    )
}

private fun buildMapHtml(
    drivers: List<DriverUi>,
    stores: List<StoreRow>,
    focusLat: Double?,
    focusLng: Double?,
): String {
    val pts = JSONArray()
    drivers.forEach { d ->
        val lat = d.lat ?: return@forEach
        val lng = d.lng ?: return@forEach
        pts.put(
            JSONObject()
                .put("lat", lat)
                .put("lng", lng)
                .put("name", d.name)
                .put("status", when {
                    !d.active -> "off"
                    d.online && d.onBreak -> "break"
                    d.online -> "online"
                    else -> "idle"
                })
                .put("role", d.callRole),
        )
    }
    val storePts = JSONArray()
    stores.forEach { s ->
        val lat = s.latitude ?: return@forEach
        val lng = s.longitude ?: return@forEach
        storePts.put(
            JSONObject()
                .put("lat", lat)
                .put("lng", lng)
                .put("name", s.name)
                .put("open", s.is_active == true)
                .put("ghost", s.store_role == "N"),
        )
    }
    val centerLat = focusLat ?: 39.6650
    val centerLng = focusLng ?: 20.8537
    return """
<!DOCTYPE html>
<html><head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1"/>
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"/>
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
<style>
  html,body,#map{height:100%;margin:0;padding:0}
  .pin{border-radius:50%;border:2px solid #fff;width:16px;height:16px;box-shadow:0 1px 4px rgba(0,0,0,.35)}
  .online{background:#10b981}.break{background:#f59e0b}.idle{background:#9ca3af}.off{background:#ef4444}
  .store{width:12px;height:12px;border-radius:3px;background:#ea580c;border:2px solid #fff}
  .store.ghost{background:#7c3aed}.store.closed{opacity:.45}
</style>
</head><body>
<div id="map"></div>
<script>
const drivers = $pts;
const stores = $storePts;
const map = L.map('map',{zoomControl:true}).setView([$centerLat,$centerLng], 13);
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{
  maxZoom:19, attribution:'© OSM'
}).addTo(map);
const group = L.featureGroup();
stores.forEach(s=>{
  const ic = L.divIcon({className:'', html:`<div class="store ${s.ghost?'ghost':''} ${s.open?'':'closed'}"></div>`, iconSize:[12,12]});
  L.marker([s.lat,s.lng],{icon:ic}).bindPopup(`<b>${s.name}</b><br>${s.ghost?'Ghost Store':'Partner'}${s.open?' · OPEN':' · CLOSED'}`).addTo(group);
});
drivers.forEach(d=>{
  const ic = L.divIcon({className:'', html:`<div class="pin ${d.status}"></div>`, iconSize:[16,16]});
  L.marker([d.lat,d.lng],{icon:ic}).bindPopup(`<b>${d.name}</b><br>${d.status} · ${d.role}`).addTo(group);
});
group.addTo(map);
if(group.getLayers().length){ map.fitBounds(group.getBounds().pad(0.2)); }
</script>
</body></html>
""".trimIndent()
}
