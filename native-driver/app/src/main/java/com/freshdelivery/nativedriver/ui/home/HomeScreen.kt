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
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
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
import androidx.compose.material.icons.outlined.Navigation
import androidx.compose.material.icons.outlined.Person
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
import androidx.compose.runtime.remember
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
import com.freshdelivery.nativedriver.data.ActiveTripUi
import com.freshdelivery.nativedriver.data.OfferUi
import com.freshdelivery.nativedriver.ui.DriverUiState
import com.freshdelivery.nativedriver.ui.map.DriverMapView
import com.freshdelivery.nativedriver.ui.map.MapMarker
import kotlinx.coroutines.delay
import java.time.Duration
import java.time.Instant

private val GreenBtn = Color(0xFF1DB954)
private val TextDark = Color(0xFF1A1A1A)
private val TextMuted = Color(0xFF6B7280)

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
) {
    val context = LocalContext.current
    val primary = state.primaryTrip
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

    Box(Modifier.fillMaxSize().background(Color(0xFF1A2332))) {
        DriverMapView(
            modifier = Modifier.fillMaxSize(),
            centerLat = centerLat,
            centerLng = centerLng,
            markers = markers,
            userLat = state.geo?.lat,
            userLng = state.geo?.lng,
            userBearing = state.geo?.bearing,
        )

        // Top chrome — no Ops (admin-only)
        Row(
            Modifier
                .align(Alignment.TopCenter)
                .fillMaxWidth()
                .padding(horizontal = 12.dp, vertical = 10.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.SpaceBetween,
        ) {
            Box(
                Modifier
                    .size(42.dp)
                    .shadow(6.dp, CircleShape)
                    .clip(CircleShape)
                    .background(GreenBtn)
                    .clickable { onToggleOnline(!state.online) },
                contentAlignment = Alignment.Center,
            ) {
                Icon(Icons.Outlined.Person, null, tint = Color.White, modifier = Modifier.size(22.dp))
            }

            Row(
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(8.dp),
            ) {

                if (state.isOps) {
                    Row(
                        Modifier
                            .shadow(6.dp, RoundedCornerShape(22.dp))
                            .clip(RoundedCornerShape(22.dp))
                            .background(Color(0xFF1C1C1E))
                            .clickable(onClick = onOpenOps)
                            .padding(horizontal = 12.dp, vertical = 8.dp),
                        verticalAlignment = Alignment.CenterVertically,
                    ) {
                        Text(
                            "Ops",
                            color = Color.White,
                            fontWeight = FontWeight.SemiBold,
                            fontSize = 13.sp,
                        )
                    }
                }

                // Driver break control
                if (state.online) {
                    Row(
                        Modifier
                            .shadow(6.dp, RoundedCornerShape(22.dp))
                            .clip(RoundedCornerShape(22.dp))
                            .background(
                                if (state.onBreak) Color(0xFFFF8A00) else Color(0xFF1C1C1E),
                            )
                            .clickable(onClick = onToggleBreak)
                            .padding(horizontal = 12.dp, vertical = 8.dp),
                        verticalAlignment = Alignment.CenterVertically,
                    ) {
                        Text(
                            if (state.onBreak) "Τέλος διαλείμματος" else "Διάλειμμα",
                            color = Color.White,
                            fontWeight = FontWeight.SemiBold,
                            fontSize = 13.sp,
                        )
                    }
                }

                Row(
                    Modifier
                        .shadow(6.dp, RoundedCornerShape(24.dp))
                        .clip(RoundedCornerShape(24.dp))
                        .background(Color.White)
                        .padding(horizontal = 14.dp, vertical = 9.dp),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Box(
                        Modifier
                            .size(22.dp)
                            .clip(CircleShape)
                            .background(GreenBtn),
                        contentAlignment = Alignment.Center,
                    ) {
                        Text("⚡", fontSize = 12.sp)
                    }
                    Spacer(Modifier.width(8.dp))
                    Text("Fresh Delivery", fontWeight = FontWeight.Bold, fontSize = 14.sp, color = TextDark)
                }
            }

            Box(
                Modifier
                    .size(42.dp)
                    .shadow(6.dp, CircleShape)
                    .clip(CircleShape)
                    .background(GreenBtn),
                contentAlignment = Alignment.Center,
            ) {
                Icon(Icons.Outlined.HeadsetMic, null, tint = Color.White, modifier = Modifier.size(22.dp))
            }
        }

        Column(
            Modifier
                .align(Alignment.BottomCenter)
                .fillMaxWidth()
                .padding(horizontal = 10.dp, vertical = 8.dp),
        ) {
            err?.let { msg ->
                Row(
                    Modifier
                        .fillMaxWidth()
                        .padding(bottom = 8.dp)
                        .clip(RoundedCornerShape(16.dp))
                        .background(Color(0xFFFFEBEE))
                        .padding(horizontal = 14.dp, vertical = 10.dp),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Text(msg, color = Color(0xFFB71C1C), modifier = Modifier.weight(1f), fontSize = 13.sp)
                    OutlinedButton(onClick = { onClearMessages(); onRefresh() }, shape = RoundedCornerShape(14.dp)) {
                        Text("OK")
                    }
                }
            }

            when {
                !state.online -> {
                    Button(
                        onClick = { onToggleOnline(true) },
                        enabled = state.driverActive && !state.busy,
                        modifier = Modifier.fillMaxWidth().height(56.dp).shadow(12.dp, RoundedCornerShape(28.dp)),
                        shape = RoundedCornerShape(28.dp),
                        colors = ButtonDefaults.buttonColors(
                            containerColor = GreenBtn,
                            contentColor = Color.White,
                            disabledContainerColor = Color(0xFF9CA3AF),
                        ),
                    ) {
                        if (state.busy) CircularProgressIndicator(Modifier.size(22.dp), color = Color.White, strokeWidth = 2.dp)
                        else Text("Γίνε διαθέσιμος", fontWeight = FontWeight.Bold, fontSize = 17.sp)
                    }
                }

                hasTrip -> {
                    Card(
                        Modifier.fillMaxWidth().heightIn(max = 400.dp).shadow(16.dp, RoundedCornerShape(28.dp)),
                        shape = RoundedCornerShape(28.dp),
                        colors = CardDefaults.cardColors(containerColor = Color.White),
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
                                    onNavigate = { lat, lng, _ ->
                                        val uri = Uri.parse("google.navigation:q=$lat,$lng&mode=d")
                                        val intent = Intent(Intent.ACTION_VIEW, uri).setPackage("com.google.android.apps.maps")
                                        runCatching { context.startActivity(intent) }.onFailure {
                                            context.startActivity(
                                                Intent(
                                                    Intent.ACTION_VIEW,
                                                    Uri.parse("https://www.google.com/maps/dir/?api=1&destination=$lat,$lng"),
                                                ),
                                            )
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
                        colors = CardDefaults.cardColors(containerColor = Color.White),
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
        }
    }
}

@Composable
private fun Handle() {
    Box(Modifier.fillMaxWidth().padding(bottom = 10.dp), contentAlignment = Alignment.Center) {
        Box(
            Modifier.width(40.dp).height(4.dp).clip(RoundedCornerShape(2.dp)).background(Color(0xFFD1D5DB)),
        )
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
        colors = CardDefaults.cardColors(containerColor = Color.White),
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
                        color = Color(0xFF9CA3AF),
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
                Text(eur(payout), fontWeight = FontWeight.Bold, fontSize = 28.sp, color = GreenBtn)
            }

            Spacer(Modifier.height(10.dp))

            Row(
                horizontalArrangement = Arrangement.spacedBy(6.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                if (isCash) {
                    Chip("Μετρητά ${moneyPlain(cashAmount)}€", Color(0xFFFFF3E0), Color(0xFFE65100))
                }
                formatDistance(offer.order.distance_km)?.let {
                    Chip(it, Color(0xFFF3F4F6), TextMuted)
                }
                itemCount?.let {
                    Chip("$it", Color(0xFFF3F4F6), TextMuted)
                }
                Spacer(Modifier.weight(1f))
                Chip(
                    formatTimer(secondsLeft),
                    Color(0xFFF3F4F6),
                    if (secondsLeft <= 10) Color(0xFFE11900) else TextMuted,
                )
            }

            Spacer(Modifier.height(10.dp))
            LinearProgressIndicator(
                progress = { progress.coerceIn(0f, 1f) },
                modifier = Modifier.fillMaxWidth().height(4.dp).clip(RoundedCornerShape(2.dp)),
                color = if (secondsLeft <= 10) Color(0xFFE11900) else GreenBtn,
                trackColor = Color(0xFFE5E7EB),
            )

            Spacer(Modifier.height(14.dp))

            Row(verticalAlignment = Alignment.CenterVertically) {
                Icon(Icons.Outlined.Storefront, null, tint = Color(0xFFE65100), modifier = Modifier.size(18.dp))
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
                        .border(1.5.dp, Color(0xFFE5E7EB), CircleShape)
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

    Column(Modifier.fillMaxWidth()) {
        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
            Column(Modifier.weight(1f)) {
                Text(trip.storeName ?: "Κατάστημα", fontWeight = FontWeight.Bold, fontSize = 18.sp, color = TextDark)
                Text(statusLabel(status), color = GreenBtn, fontWeight = FontWeight.SemiBold, fontSize = 13.sp)
            }
            Text(eur(payout), fontWeight = FontWeight.Bold, fontSize = 22.sp, color = GreenBtn)
        }
        trip.storeAddress?.let {
            Text(it, fontSize = 13.sp, color = TextMuted, modifier = Modifier.padding(top = 2.dp))
        }
        trip.order.delivery_address?.let {
            Text("Παράδοση: $it", fontSize = 14.sp, color = TextDark, modifier = Modifier.padding(top = 6.dp))
        }
        if (trip.order.payment_method?.equals("cash", ignoreCase = true) == true) {
            Spacer(Modifier.height(6.dp))
            Chip("Είσπραξη ${eur(trip.order.total_amount ?: 0.0)}", Color(0xFFFFF3E0), Color(0xFFE65100))
        }

        Spacer(Modifier.height(12.dp))
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
