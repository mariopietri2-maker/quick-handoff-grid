package com.freshdelivery.nativeadmin.ui

import android.annotation.SuppressLint
import android.graphics.Color
import android.os.Build
import android.view.ViewGroup
import android.webkit.WebChromeClient
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
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
import androidx.compose.ui.viewinterop.AndroidView
import com.freshdelivery.nativeadmin.data.DriverUi
import com.freshdelivery.nativeadmin.data.StoreRow
import org.json.JSONArray
import org.json.JSONObject

@SuppressLint("SetJavaScriptEnabled")
@Composable
fun DriverMapWebView(
    drivers: List<DriverUi>,
    stores: List<StoreRow>,
    modifier: Modifier = Modifier,
) {
    val payload = remember(drivers, stores) { buildPayload(drivers, stores) }
    var ready by remember { mutableStateOf(false) }
    var webRef by remember { mutableStateOf<WebView?>(null) }

    Box(modifier) {
        AndroidView(
            modifier = Modifier.fillMaxSize(),
            factory = { ctx ->
                WebView(ctx).apply {
                    setBackgroundColor(Color.parseColor("#1e293b"))
                    layoutParams = ViewGroup.LayoutParams(
                        ViewGroup.LayoutParams.MATCH_PARENT,
                        ViewGroup.LayoutParams.MATCH_PARENT,
                    )
                    settings.javaScriptEnabled = true
                    settings.domStorageEnabled = true
                    settings.cacheMode = WebSettings.LOAD_DEFAULT
                    settings.loadsImagesAutomatically = true
                    settings.mixedContentMode = WebSettings.MIXED_CONTENT_ALWAYS_ALLOW
                    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                        settings.safeBrowsingEnabled = false
                    }
                    webChromeClient = WebChromeClient()
                    webViewClient = object : WebViewClient() {
                        override fun onPageFinished(view: WebView?, url: String?) {
                            ready = true
                            inject(view, payload)
                        }
                    }
                    loadUrl("file:///android_asset/admin_map.html")
                    webRef = this
                }
            },
            update = { web ->
                if (ready) inject(web, payload)
            },
        )
        if (!ready) {
            CircularProgressIndicator(
                modifier = Modifier.align(Alignment.Center),
                color = androidx.compose.ui.graphics.Color(0xFFEA580C),
            )
        }
    }
}

private fun inject(web: WebView?, payload: String) {
    if (web == null) return
    val escaped = JSONObject.quote(payload)
    web.evaluateJavascript("window.setMapData && window.setMapData($escaped);", null)
}

private fun buildPayload(drivers: List<DriverUi>, stores: List<StoreRow>): String {
    val root = JSONObject()
    val dArr = JSONArray()
    drivers.forEach { d ->
        if (d.lat == null || d.lng == null) return@forEach
        dArr.put(
            JSONObject()
                .put("lat", d.lat)
                .put("lng", d.lng)
                .put("name", d.name)
                .put(
                    "status",
                    when {
                        !d.active -> "off"
                        d.online && d.onBreak -> "break"
                        d.online -> "online"
                        else -> "idle"
                    },
                )
                .put("role", d.callRole),
        )
    }
    val sArr = JSONArray()
    stores.forEach { s ->
        if (s.latitude == null || s.longitude == null) return@forEach
        sArr.put(
            JSONObject()
                .put("lat", s.latitude)
                .put("lng", s.longitude)
                .put("name", s.name)
                .put("open", s.is_active == true)
                .put("ghost", s.store_role == "N"),
        )
    }
    root.put("drivers", dArr)
    root.put("stores", sArr)
    return root.toString()
}
