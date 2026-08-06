package com.freshdelivery.nativedriver.ui.home

import android.content.Intent
import android.net.Uri
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Check
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.outlined.Call
import androidx.compose.material.icons.outlined.HeadsetMic
import androidx.compose.material.icons.outlined.MyLocation
import androidx.compose.material.icons.outlined.Navigation
import androidx.compose.material.icons.outlined.Place
import androidx.compose.material.icons.outlined.Storefront
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.freshdelivery.nativedriver.BuildConfig
import com.freshdelivery.nativedriver.data.ActiveTripUi
import com.freshdelivery.nativedriver.data.OfferUi
import com.freshdelivery.nativedriver.ui.DriverUiState
import com.freshdelivery.nativedriver.ui.map.DriverMapView
import com.freshdelivery.nativedriver.ui.map.MapMarker
import com.freshdelivery.nativedriver.ui.theme.FreshAmber
import com.freshdelivery.nativedriver.ui.theme.FreshError
import com.freshdelivery.nativedriver.ui.theme.FreshGreen
import com.freshdelivery.nativedriver.ui.theme.FreshGreenBright
import com.freshdelivery.nativedriver.ui.theme.FreshOrange
import com.mapbox.geojson.Point
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL
import java.time.Duration
import java.time.Instant

private val GreenBtn = Color(0xFF06C167)
private val TextDark = Color(0xFFF0F4F1)
private val TextMuted = Color(0xFF9AA6A0)
private val SurfaceCard = Color(0xFF151A17)
private val TrackFill = Color(0xFF1F2521)

private fun eur(v: Double): String = "%.2f".format(v) + "€"
private fun moneyPlain(v: Double): String = "%.2f".format(v)

private fun friendlyError(raw: String?): String? {
    if (raw.isNullOrBlank()) return null
    val lower = raw.lowercase()
    return when {
        "unable to resolve host" in lower || "unknownhost" in lower ->
            "Χωρίς σύνδεση. Έλεγξε Wi‑Fi / δεδομένα."
        "timeout" in lower -> "Η σύνδεση άργησε. Δοκίμασε ξανά."
        raw.length > 120 -> raw.take(100) + "…"
        else -> raw
    }
}

private fun formatDistance(km: Double?): String? {
    if (km == null) return null
    return if (km < 1.0) "${(km * 1000).toInt()} μ" else "%.1f km".format(km)
}

private fun formatTimer(seconds: Int): String {
    val m = seconds / 60
    val s = seconds % 60
    return "%d:%02d".format(m, s)
}

/** In-app route shown on the Mapbox map — no Google Maps / external apps involved. */
private data class RouteResult(
    val points: List<Point>,
    val distanceMeters: Double,
    val durationSeconds: Long,
)

private suspend fun fetchRoute(
    startLat: Double,
    startLng: Double,
    endLat: Double,
    endLng: Double,
): RouteResult? = withContext(Dispatchers.IO) {
    val url = "https://api.mapbox.com/directions/v5/mapbox/driving/" +
        "$startLng,$startLat;$endLng,$endLat?overview=full&geometries=polyline6&access_token=${BuildConfig.MAPBOX_TOKEN}"
    runCatching {
        val conn = (URL(url).openConnection() as HttpURLConnection).apply {
            connectTimeout = 8000
            readTimeout = 8000
        }
        try {
            val json = conn.inputStream.bufferedReader().use { it.readText() }
            val root = JSONObject(json)
            val routes = root.optJSONArray("routes") ?: return@runCatching null
            if (routes.length() == 0) return@runCatching null
            val route = routes.getJSONObject(0)
            val points = decodePolyline6(route.getString("geometry"))
            val leg = route.optJSONArray("legs")?.optJSONObject(0)
            RouteResult(
                points = points,
                distanceMeters = leg?.optDouble("distance", 0.0) ?: 0.0,
                durationSeconds = leg?.optLong("duration", 0L) ?: 0L,
            )
        } finally {
            conn.disconnect()
        }
    }.getOrNull()
}

private fun decodePolyline6(encoded: String): List<Point> {
    val points = mutableListOf<Point>()
    var index = 0
    var lat = 0
    var lng = 0
    while (index < encoded.length) {
        var result = 0
        var shift = 0
        var b: Int
        do {
            b = encoded[index++].code - 63
            result = result or ((b and 0x1f) shl shift)
            shift += 5
        } while (b >= 0x20)
        lat += if (result and 1 != 0) (result shr 1).inv() else result shr 1
        result = 0
        shift = 0
        do {
            b = encoded[index++].code - 63
            result = result or ((b and 0x1f) shl shift)
            shift += 5
        } while (b >= 0x20)
        lng += if (result and 1 != 0) (result shr 1).inv() else result shr 1
        points.add(Point.fromLngLat(lng / 1e6, lat / 1e6))
    }
    return points
}

@Composable
fun HomeScreen(
    state: DriverUiState,
    onToggleOnline: (Boolean) -> Unit,
    onToggleBreak: () -> Unit,
    onAccept: (offerId: String, orderId: String?) -> Unit,
    onDecline: (String) -> Unit,
    onAdvance: (orderId: String, status: String) -> Unit,
    onRefresh: () -> Unit,
    onClearMessages: () -> Unit,
    onOpenOps: () -> Unit = {},
    onOpenSupport: () -> Unit = {},
) {
    val context = LocalContext.current
    val primary = state.primaryTrip
    val scope = rememberCoroutineScope()
    var navRoute by remember { mutableStateOf<List<Point>>(emptyList()) }
    var navDest by remember { mutableStateOf<MapMarker?>(null) }
    var navDistM by remember { mutableStateOf<Double?>(null) }
    var navDurS by remember { mutableStateOf<Long?>(null) }
    var navLoading by remember { mutableStateOf(false) }
    var navFailed by remember { mutableStateOf(false) }
    var recenterKey by remember { mutableIntStateOf(0) }
    val markers = buildList {
        primary?.storeLat?.let { lat ->
            primary.storeLng?.let { lng ->
                add(MapMarker(lat, lng, primary.storeName ?: "Store", "#06C167"))
            }
        }
        primary?.order?.delivery_latitude?.let { lat ->
            primary.order.delivery_longitude?.let { lng ->
                add(MapMarker(lat, lng, "Πελάτης", "#276EF1"))
            }
        }
        state.offers.take(2).forEach { o ->
            o.storeLat?.let { lat ->
                o.storeLng?.let { lng ->
                    add(MapMarker(lat, lng, o.storeName ?: "Offer", "#FF8A00"))
                }
            }
        }
    }
    val centerLat = markers.firstOrNull()?.lat ?: primary?.storeLat ?: state.geo?.lat
    val centerLng = markers.firstOrNull()?.lng ?: primary?.storeLng ?: state.geo?.lng
    val err = friendlyError(state.error)
    val hasOffer = state.online && state.activeTrips.isEmpty() && state.offers.isNotEmpty()
    val hasTrip = state.activeTrips.isNotEmpty()

    // Clear in-app Mapbox navigation when the trip moves to the next step.
    LaunchedEffect(primary?.order?.status) {
        navRoute = emptyList()
        navDest = null
        navDistM = null
        navDurS = null
        navFailed = false
    }

    Box(Modifier.fillMaxSize().background(Color(0xFF0B0E0C))) {
        DriverMapView(
            modifier = Modifier.fillMaxSize(),
            centerLat = centerLat,
            centerLng = centerLng,
            markers = markers,
            userLat = state.geo?.lat,
            userLng = state.geo?.lng,
            userBearing = state.geo?.bearing,
            route = navRoute,
            destination = navDest,
            recenterKey = recenterKey,
        )

        // Top chrome — brand status pill centered between the global menu and the
        // right-side action stack (Support, Ops, Recenter).
        Row(
            Modifier
                .align(Alignment.TopCenter)
                .fillMaxWidth()
                .statusBarsPadding()
                .padding(horizontal = 12.dp, vertical = 10.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Row(
                Modifier.weight(1f),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(8.dp),
            ) {
                Spacer(Modifier.width(0.dp))
            }

            Box(
                Modifier
                    .weight(1f)
                    .align(Alignment.Top),
                contentAlignment = Alignment.Center,
            ) {
                Row(
                    Modifier
                        .shadow(6.dp, RoundedCornerShape(24.dp))
                        .clip(RoundedCornerShape(24.dp))
                        .background(
                            when {
                                state.online -> GreenBtn
                                state.busy -> Color(0xFF2F8A63)
                                else -> SurfaceCard
                            },
                        )
                        .border(
                            1.dp,
                            if (state.online) Color.Transparent else Color(0xFF2A322C),
                            RoundedCornerShape(24.dp),
                        )
                        .padding(horizontal = 14.dp, vertical = 9.dp),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Box(
                        Modifier
                            .size(8.dp)
                            .clip(CircleShape)
                            .background(if (state.online) Color.White else Color(0xFF67716B)),
                    )
                    Spacer(Modifier.width(8.dp))
                    Text(
                        when {
                            !state.online -> "Εκτός υπηρεσίας"
                            hasTrip -> "Σε παράδοση"
                            state.busy -> "Διαθέσιμος…"
                            else -> "Διαθέσιμος"
                        },
                        color = if (state.online) Color.White else TextDark,
                        fontWeight = FontWeight.Bold,
                        fontSize = 13.sp,
                    )
                }
            }

            Row(
                Modifier.weight(1f),
                verticalAlignment = Alignment.Top,
                horizontalArrangement = Arrangement.End,
            ) {
                Column(
                    horizontalAlignment = Alignment.CenterHorizontally,
                    verticalArrangement = Arrangement.spacedBy(8.dp),
                ) {
                    Box(
                        Modifier
                            .size(42.dp)
                            .shadow(6.dp, CircleShape)
                            .clip(CircleShape)
                            .background(SurfaceCard)
                            .border(1.dp, Color(0xFF2A322C), CircleShape)
                            .clickable(onClick = onOpenSupport),
                        contentAlignment = Alignment.Center,
                    ) {
                        Icon(Icons.Outlined.HeadsetMic, null, tint = FreshGreenBright, modifier = Modifier.size(22.dp))
                    }
                    if (state.isOps) {
                        Box(
                            Modifier
                                .size(42.dp)
                                .shadow(6.dp, CircleShape)
                                .clip(CircleShape)
                                .background(SurfaceCard)
                                .border(1.dp, Color(0xFF2A322C), CircleShape)
                                .clickable(onClick = onOpenOps),
                            contentAlignment = Alignment.Center,
                        ) {
                            Icon(Icons.Outlined.Storefront, null, tint = FreshAmber, modifier = Modifier.size(22.dp))
                        }
                    }
                    Box(
                        Modifier
                            .size(42.dp)
                            .shadow(6.dp, CircleShape)
                            .clip(CircleShape)
                            .background(SurfaceCard)
                            .border(1.dp, Color(0xFF2A322C), CircleShape)
                            .clickable { recenterKey++ },
                        contentAlignment = Alignment.Center,
                    ) {
                        Icon(Icons.Outlined.MyLocation, null, tint = FreshGreenBright, modifier = Modifier.size(22.dp))
                    }
                }
            }
        }

        // Bottom dock — status card + slide-to-go-available control
        Column(
            Modifier
                .align(Alignment.BottomCenter)
                .fillMaxWidth()
                .navigationBarsPadding()
                .padding(horizontal = 10.dp, vertical = 8.dp)
                .padding(bottom = 12.dp),
        ) {
            err?.let { msg ->
                Row(
                    Modifier
                        .fillMaxWidth()
                        .padding(bottom = 8.dp)
                        .clip(RoundedCornerShape(16.dp))
                        .background(Color(0xFF3A1418))
                        .border(1.dp, FreshError.copy(alpha = 0.4f), RoundedCornerShape(16.dp))
                        .padding(horizontal = 14.dp, vertical = 10.dp),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Text(msg, color = Color(0xFFFFB4B9), modifier = Modifier.weight(1f), fontSize = 13.sp)
                    OutlinedButton(onClick = { onClearMessages(); onRefresh() }, shape = RoundedCornerShape(14.dp)) {
                        Text("OK")
                    }
                }
            }

            navDest?.let { dest ->
                NavBanner(
                    label = dest.label,
                    distanceMeters = navDistM,
                    durationSeconds = navDurS,
                    loading = navLoading,
                    failed = navFailed,
                    onClose = {
                        navDest = null
                        navRoute = emptyList()
                        navDistM = null
                        navDurS = null
                        navFailed = false
                    },
                )
                Spacer(Modifier.height(10.dp))
            }

            when {
                !state.online -> {
                    Card(
                        Modifier.fillMaxWidth().shadow(12.dp, RoundedCornerShape(24.dp)),
                        shape = RoundedCornerShape(24.dp),
                        colors = CardDefaults.cardColors(containerColor = SurfaceCard),
                        elevation = CardDefaults.cardElevation(0.dp),
                    ) {
                        Column(
                            Modifier.fillMaxWidth().padding(vertical = 22.dp, horizontal = 16.dp),
                            horizontalAlignment = Alignment.CenterHorizontally,
                        ) {
                            Text("Εκτός υπηρεσίας", fontWeight = FontWeight.Bold, fontSize = 17.sp, color = TextDark)
                            Spacer(Modifier.height(4.dp))
                            Text(
                                "Δεν λαμβάνεις νέες προσφορές. Σύρε δεξιά για να γίνεις διαθέσιμος.",
                                fontSize = 13.sp,
                                color = TextMuted,
                                textAlign = TextAlign.Center,
                            )
                        }
                    }
                }

                hasTrip -> {
                    Card(
                        Modifier.fillMaxWidth().heightIn(max = 460.dp).shadow(16.dp, RoundedCornerShape(28.dp)),
                        shape = RoundedCornerShape(28.dp),
                        colors = CardDefaults.cardColors(containerColor = SurfaceCard),
                        elevation = CardDefaults.cardElevation(0.dp),
                    ) {
                        Column(
                            Modifier.fillMaxWidth().verticalScroll(rememberScrollState()).padding(18.dp),
                        ) {
                            Handle()
                            state.activeTrips.forEach { trip ->
                                ActiveTripCard(
                                    trip = trip,
                                    busy = state.busy,
                                    onAdvance = onAdvance,
                                    onCall = { phone ->
                                        if (!phone.isNullOrBlank()) {
                                            context.startActivity(Intent(Intent.ACTION_DIAL, Uri.parse("tel:$phone")))
                                        }
                                    },
                                    onNavigate = { lat, lng, label ->
                                        navDest = MapMarker(lat, lng, label, "#06C167")
                                        navRoute = emptyList()
                                        navDistM = null
                                        navDurS = null
                                        navFailed = false
                                        val startLat = state.geo?.lat
                                        val startLng = state.geo?.lng
                                        if (startLat != null && startLng != null) {
                                            navLoading = true
                                            scope.launch {
                                                val res = fetchRoute(startLat, startLng, lat, lng)
                                                navLoading = false
                                                if (res != null) {
                                                    navRoute = res.points
                                                    navDistM = res.distanceMeters
                                                    navDurS = res.durationSeconds
                                                } else {
                                                    navFailed = true
                                                }
                                            }
                                        }
                                    },
                                )
                            }
                        }
                    }
                }

                hasOffer -> {
                    state.offers.take(1).forEach { offer ->
                        OfferSheet(
                            offer = offer,
                            busy = state.busy,
                            timeoutSec = state.settings.dist_offer_timeout_seconds ?: 60,
                            onAccept = { onAccept(offer.offerId, null) },
                            onDecline = { onDecline(offer.offerId) },
                        )
                    }
                }

                else -> {
                    Card(
                        Modifier.fillMaxWidth().shadow(12.dp, RoundedCornerShape(24.dp)),
                        shape = RoundedCornerShape(24.dp),
                        colors = CardDefaults.cardColors(containerColor = SurfaceCard),
                        elevation = CardDefaults.cardElevation(0.dp),
                    ) {
                        Column(
                            Modifier.fillMaxWidth().padding(vertical = 22.dp, horizontal = 16.dp),
                            horizontalAlignment = Alignment.CenterHorizontally,
                        ) {
                            Text(
                                if (state.onBreak) "Σε διάλειμμα" else "Αναμονή παραγγελιών…",
                                fontWeight = FontWeight.Bold,
                                fontSize = 17.sp,
                                color = TextDark,
                            )
                            Spacer(Modifier.height(4.dp))
                            Text(
                                if (state.onBreak) "Δεν λαμβάνεις νέες προσφορές."
                                else "Θα εμφανιστούν αυτόματα όταν υπάρχει κοντινή παραγγελία.",
                                fontSize = 13.sp,
                                color = TextMuted,
                                textAlign = TextAlign.Center,
                            )
                        }
                    }
                }
            }

            Spacer(Modifier.height(10.dp))
            SlideToggle(
                isOn = state.online,
                enabled = state.driverActive && !state.busy,
                onToggle = onToggleOnline,
            )
        }
    }
}

@Composable
private fun Handle() {
    Box(Modifier.fillMaxWidth().padding(bottom = 10.dp), contentAlignment = Alignment.Center) {
        Box(
            Modifier.width(40.dp).height(4.dp).clip(RoundedCornerShape(2.dp)).background(Color(0xFF3A423C)),
        )
    }
}

@Composable
private fun NavBanner(
    label: String,
    distanceMeters: Double?,
    durationSeconds: Long?,
    loading: Boolean,
    failed: Boolean,
    onClose: () -> Unit,
) {
    Card(
        Modifier.fillMaxWidth().shadow(12.dp, RoundedCornerShape(20.dp)),
        shape = RoundedCornerShape(20.dp),
        colors = CardDefaults.cardColors(containerColor = SurfaceCard),
        elevation = CardDefaults.cardElevation(0.dp),
    ) {
        Row(
            Modifier.fillMaxWidth().padding(horizontal = 14.dp, vertical = 12.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Box(
                Modifier
                    .size(38.dp)
                    .clip(RoundedCornerShape(12.dp))
                    .background(FreshGreen.copy(alpha = 0.14f)),
                contentAlignment = Alignment.Center,
            ) {
                Icon(Icons.Outlined.Navigation, null, tint = GreenBtn, modifier = Modifier.size(20.dp))
            }
            Spacer(Modifier.width(10.dp))
            Column(Modifier.weight(1f)) {
                Text("Οδηγίες Mapbox", fontSize = 12.sp, fontWeight = FontWeight.SemiBold, color = TextMuted)
                Text(
                    when {
                        loading -> "Υπολογισμός διαδρομής…"
                        failed -> "Δεν βρέθηκε διαδρομή — δείχνω τον προορισμό στον χάρτη."
                        else -> buildString {
                            append(label)
                            distanceMeters?.let { d ->
                                append(" · ")
                                append(if (d < 1000) "${d.toInt()} μ" else "%.1f km".format(d / 1000))
                            }
                            durationSeconds?.let { t ->
                                append(" · ${(t / 60).coerceAtLeast(1)} λεπτά")
                            }
                        }
                    },
                    fontSize = 13.sp,
                    fontWeight = FontWeight.Bold,
                    color = TextDark,
                )
            }
            Spacer(Modifier.width(8.dp))
            Box(
                Modifier
                    .size(30.dp)
                    .clip(CircleShape)
                    .clickable(onClick = onClose),
                contentAlignment = Alignment.Center,
            ) {
                Icon(Icons.Filled.Close, null, tint = TextMuted, modifier = Modifier.size(18.dp))
            }
        }
    }
}

@Composable
private fun OfferSheet(
    offer: OfferUi,
    busy: Boolean,
    timeoutSec: Int,
    onAccept: () -> Unit,
    onDecline: () -> Unit,
) {
    val expiresAt = remember(offer.expiresAt) {
        offer.expiresAt?.let { runCatching { Instant.parse(it) }.getOrNull() }
    }
    var secondsLeft by remember(offer.offerId, offer.expiresAt) { mutableIntStateOf(timeoutSec) }

    LaunchedEffect(offer.offerId, offer.expiresAt) {
        while (true) {
            val left = if (expiresAt != null) {
                Duration.between(Instant.now(), expiresAt).seconds.toInt().coerceAtLeast(0)
            } else secondsLeft
            secondsLeft = left
            if (left <= 0) break
            delay(1000)
            if (expiresAt == null) secondsLeft = (secondsLeft - 1).coerceAtLeast(0)
        }
    }

    val payout = (offer.order.driver_payout ?: 0.0) +
        (offer.order.tip_amount ?: 0.0) +
        (offer.order.driver_pool_bonus ?: 0.0)
    val progress = if (timeoutSec > 0) secondsLeft.toFloat() / timeoutSec else 0f
    val isCash = offer.order.payment_method?.equals("cash", ignoreCase = true) == true
    val cashAmount = offer.order.total_amount ?: 0.0
    val orderCode = offer.order.store_order_number?.toString() ?: offer.order.id.takeLast(4)
    val itemCount = offer.itemsSummary
        ?.split(",", "·", "+")
        ?.map { it.trim() }
        ?.count { it.isNotBlank() }
        ?.takeIf { it > 0 }

    Card(
        Modifier.fillMaxWidth().shadow(20.dp, RoundedCornerShape(28.dp)),
        shape = RoundedCornerShape(28.dp),
        colors = CardDefaults.cardColors(containerColor = SurfaceCard),
        elevation = CardDefaults.cardElevation(0.dp),
    ) {
        Column(Modifier.padding(horizontal = 18.dp, vertical = 14.dp)) {
            Handle()

            Row(
                Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.Top,
            ) {
                Column(Modifier.weight(1f).padding(end = 8.dp)) {
                    Text(
                        "ΝΕΑ ΠΡΟΣΦΟΡΑ · #$orderCode",
                        fontSize = 12.sp,
                        fontWeight = FontWeight.SemiBold,
                        color = TextMuted,
                        letterSpacing = 0.3.sp,
                    )
                    Spacer(Modifier.height(4.dp))
                    Text(
                        offer.storeName ?: "Κατάστημα",
                        fontWeight = FontWeight.Bold,
                        fontSize = 22.sp,
                        color = TextDark,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis,
                    )
                }
                Column(horizontalAlignment = Alignment.End) {
                    Text("Κέρδος", fontSize = 11.sp, color = TextMuted, fontWeight = FontWeight.SemiBold)
                    Text(eur(payout), fontWeight = FontWeight.Bold, fontSize = 28.sp, color = FreshGreenBright)
                }
            }

            Spacer(Modifier.height(10.dp))

            Row(
                horizontalArrangement = Arrangement.spacedBy(6.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                if (isCash) {
                    Chip("Μετρητά ${moneyPlain(cashAmount)}€", Color(0xFF3A2C10), FreshAmber)
                }
                formatDistance(offer.order.distance_km)?.let {
                    Chip(it, TrackFill, TextMuted)
                }
                itemCount?.let {
                    Chip("$it", TrackFill, TextMuted)
                }
                Spacer(Modifier.weight(1f))
                Chip(
                    formatTimer(secondsLeft),
                    TrackFill,
                    if (secondsLeft <= 10) Color(0xFFFF6B6B) else TextMuted,
                )
            }

            Spacer(Modifier.height(10.dp))
            LinearProgressIndicator(
                progress = { progress.coerceIn(0f, 1f) },
                modifier = Modifier.fillMaxWidth().height(4.dp).clip(RoundedCornerShape(2.dp)),
                color = if (secondsLeft <= 10) Color(0xFFFF6B6B) else GreenBtn,
                trackColor = TrackFill,
            )

            Spacer(Modifier.height(14.dp))

            Row(verticalAlignment = Alignment.CenterVertically) {
                Icon(Icons.Outlined.Storefront, null, tint = FreshOrange, modifier = Modifier.size(18.dp))
                Spacer(Modifier.width(8.dp))
                Text(
                    buildString {
                        append(offer.storeName ?: "Κατάστημα")
                        if (!offer.storeAddress.isNullOrBlank()) {
                            append(" · ")
                            append(offer.storeAddress)
                        }
                    },
                    fontSize = 13.sp,
                    color = TextDark,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                    modifier = Modifier.weight(1f),
                )
            }

            if (!offer.order.delivery_address.isNullOrBlank()) {
                Spacer(Modifier.height(8.dp))
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Icon(Icons.Outlined.Place, null, tint = GreenBtn, modifier = Modifier.size(18.dp))
                    Spacer(Modifier.width(8.dp))
                    Text(
                        offer.order.delivery_address!!,
                        fontSize = 13.sp,
                        color = TextDark,
                        maxLines = 2,
                        overflow = TextOverflow.Ellipsis,
                        modifier = Modifier.weight(1f),
                    )
                }
            }

            Spacer(Modifier.height(16.dp))

            Row(
                Modifier.fillMaxWidth(),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(12.dp),
            ) {
                Box(
                    Modifier
                        .size(52.dp)
                        .clip(CircleShape)
                        .border(1.5.dp, Color(0xFF3A423C), CircleShape)
                        .background(TrackFill)
                        .clickable(enabled = !busy && offer.offerId.isNotBlank(), onClick = onDecline),
                    contentAlignment = Alignment.Center,
                ) {
                    Icon(Icons.Filled.Close, null, tint = TextMuted, modifier = Modifier.size(22.dp))
                }
                Button(
                    onClick = onAccept,
                    enabled = !busy,
                    modifier = Modifier.weight(1f).height(52.dp),
                    shape = RoundedCornerShape(28.dp),
                    colors = ButtonDefaults.buttonColors(containerColor = GreenBtn, contentColor = Color.White),
                ) {
                    if (busy) {
                        CircularProgressIndicator(Modifier.size(20.dp), color = Color.White, strokeWidth = 2.dp)
                    } else {
                        Icon(Icons.Filled.Check, null, modifier = Modifier.size(20.dp))
                        Spacer(Modifier.width(8.dp))
                        Text("Αποδοχή · ${eur(payout)}", fontWeight = FontWeight.Bold, fontSize = 16.sp)
                    }
                }
            }
        }
    }
}

@Composable
private fun Chip(text: String, bg: Color, fg: Color) {
    Text(
        text,
        fontSize = 12.sp,
        fontWeight = FontWeight.SemiBold,
        color = fg,
        modifier = Modifier.background(bg, RoundedCornerShape(20.dp)).padding(horizontal = 10.dp, vertical = 5.dp),
    )
}

/** Uber Eats-style 3-step trip progress: Παραλαβή → Οδήγηση → Παράδοση. */
private fun tripStepIndex(status: String): Int = when (status) {
    "accepted", "preparing", "ready" -> 0
    "arrived" -> 1
    "picked_up" -> 2
    else -> 2
}

private fun tripStepLabel(index: Int): String = when (index) {
    0 -> "Παραλαβή"
    1 -> "Στο κατάστημα"
    else -> "Παράδοση"
}

@Composable
private fun TripProgress(currentStep: Int) {
    Row(
        Modifier.fillMaxWidth().padding(vertical = 2.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        (0..2).forEach { i ->
            val done = i < currentStep
            val active = i == currentStep
            val color = when {
                done -> GreenBtn
                active -> FreshGreenBright
                else -> Color(0xFF3A423C)
            }
            Column(Modifier.weight(1f), horizontalAlignment = Alignment.CenterHorizontally) {
                Box(
                    Modifier
                        .size(22.dp)
                        .clip(CircleShape)
                        .background(if (done || active) color else Color(0xFF1F2521))
                        .border(if (done) 0.dp else 1.5.dp, if (active) color else Color(0xFF3A423C), CircleShape),
                    contentAlignment = Alignment.Center,
                ) {
                    if (done) {
                        Icon(Icons.Filled.Check, null, tint = Color.White, modifier = Modifier.size(13.dp))
                    } else if (active) {
                        Text("${i + 1}", color = Color.White, fontSize = 11.sp, fontWeight = FontWeight.Bold)
                    }
                }
                Spacer(Modifier.height(4.dp))
                Text(
                    tripStepLabel(i),
                    fontSize = 10.sp,
                    color = if (done || active) TextDark else TextMuted,
                    fontWeight = if (active) FontWeight.Bold else FontWeight.Medium,
                )
            }
            if (i < 2) {
                Box(
                    Modifier
                        .weight(0.5f)
                        .height(2.dp)
                        .clip(RoundedCornerShape(1.dp))
                        .background(
                            if (i < currentStep) GreenBtn
                            else if (i == currentStep) GreenBtn.copy(alpha = 0.35f)
                            else Color(0xFF3A423C),
                        ),
                )
            }
        }
    }
}

@Composable
private fun ActiveTripCard(
    trip: ActiveTripUi,
    busy: Boolean,
    onAdvance: (orderId: String, status: String) -> Unit,
    onCall: (String?) -> Unit,
    onNavigate: (lat: Double, lng: Double, label: String) -> Unit,
) {
    val status = trip.order.status
    val next = nextStatus(status)
    val nextLabel = nextActionLabel(status)
    val payout = (trip.order.driver_payout ?: 0.0) +
        (trip.order.tip_amount ?: 0.0) +
        (trip.order.driver_pool_bonus ?: 0.0)
    val currentStep = tripStepIndex(status)

    Column(Modifier.fillMaxWidth()) {
        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
            Column(Modifier.weight(1f)) {
                Text(trip.storeName ?: "Κατάστημα", fontWeight = FontWeight.Bold, fontSize = 18.sp, color = TextDark)
                Text(statusLabel(status), color = FreshGreenBright, fontWeight = FontWeight.SemiBold, fontSize = 13.sp)
            }
            Text(eur(payout), fontWeight = FontWeight.Bold, fontSize = 22.sp, color = FreshGreenBright)
        }
        trip.storeAddress?.let {
            Text(it, fontSize = 13.sp, color = TextMuted, modifier = Modifier.padding(top = 2.dp))
        }
        trip.order.delivery_address?.let {
            Text("Παράδοση: $it", fontSize = 14.sp, color = TextDark, modifier = Modifier.padding(top = 6.dp))
        }
        if (trip.order.payment_method?.equals("cash", ignoreCase = true) == true) {
            Spacer(Modifier.height(6.dp))
            Chip("Είσπραξη ${eur(trip.order.total_amount ?: 0.0)}", Color(0xFF3A2C10), FreshAmber)
        }

        Spacer(Modifier.height(14.dp))
        TripProgress(currentStep)

        Spacer(Modifier.height(14.dp))
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            val storeLat = trip.storeLat
            val storeLng = trip.storeLng
            if (storeLat != null && storeLng != null && status in listOf("accepted", "preparing", "ready", "arrived")) {
                OutlinedButton(onClick = { onNavigate(storeLat, storeLng, trip.storeName ?: "Store") }, shape = RoundedCornerShape(14.dp)) {
                    Icon(Icons.Outlined.Navigation, null, Modifier.size(16.dp))
                    Spacer(Modifier.width(4.dp))
                    Text("Πλοήγηση")
                }
            }
            val dLat = trip.order.delivery_latitude
            val dLng = trip.order.delivery_longitude
            if (dLat != null && dLng != null && status in listOf("picked_up", "arrived")) {
                OutlinedButton(onClick = { onNavigate(dLat, dLng, "Παράδοση") }, shape = RoundedCornerShape(14.dp)) {
                    Icon(Icons.Outlined.Navigation, null, Modifier.size(16.dp))
                    Spacer(Modifier.width(4.dp))
                    Text("Πελάτης")
                }
            }
            val phone = trip.order.customer_phone ?: trip.storePhone
            if (!phone.isNullOrBlank()) {
                OutlinedButton(onClick = { onCall(phone) }, shape = RoundedCornerShape(14.dp)) {
                    Icon(Icons.Outlined.Call, null, Modifier.size(16.dp))
                    Spacer(Modifier.width(4.dp))
                    Text("Κλήση")
                }
            }
        }

        if (next != null && nextLabel != null) {
            Spacer(Modifier.height(14.dp))
            Button(
                onClick = { onAdvance(trip.order.id, next) },
                enabled = !busy,
                modifier = Modifier.fillMaxWidth().height(54.dp),
                shape = RoundedCornerShape(28.dp),
                colors = ButtonDefaults.buttonColors(containerColor = GreenBtn, contentColor = Color.White),
            ) {
                if (busy) CircularProgressIndicator(Modifier.size(20.dp), color = Color.White, strokeWidth = 2.dp)
                else Text(nextLabel, fontWeight = FontWeight.Bold, fontSize = 16.sp)
            }
        }
    }
}

private fun statusLabel(status: String): String = when (status) {
    "accepted", "preparing" -> "Προς κατάστημα"
    "ready" -> "Έτοιμη για παραλαβή"
    "arrived" -> "Στο κατάστημα"
    "picked_up" -> "Καθοδόν προς πελάτη"
    else -> status
}

private fun nextStatus(status: String): String? = when (status) {
    "accepted", "preparing", "ready" -> "arrived"
    "arrived" -> "picked_up"
    "picked_up" -> "delivered"
    else -> null
}

private fun nextActionLabel(status: String): String? = when (status) {
    "accepted", "preparing", "ready" -> "Έφτασα στο κατάστημα"
    "arrived" -> "Παρέλαβα"
    "picked_up" -> "Παρέδωσα"
    else -> null
}
