package com.freshdelivery.nativedriver.ui.home

import android.content.Intent
import android.net.Uri
import androidx.compose.foundation.background
import androidx.compose.foundation.border
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
import androidx.compose.material.icons.outlined.Call
import androidx.compose.material.icons.outlined.Navigation
import androidx.compose.material.icons.outlined.PowerSettingsNew
import androidx.compose.material.icons.outlined.Refresh
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.MaterialTheme
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
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.freshdelivery.nativedriver.data.ActiveTripUi
import com.freshdelivery.nativedriver.data.OfferUi
import com.freshdelivery.nativedriver.ui.DriverUiState
import com.freshdelivery.nativedriver.ui.map.DriverMapView
import com.freshdelivery.nativedriver.ui.map.MapMarker
import com.freshdelivery.nativedriver.ui.theme.FreshAmber
import com.freshdelivery.nativedriver.ui.theme.FreshGreen
import kotlinx.coroutines.delay
import java.time.Duration
import java.time.Instant

private fun eur(v: Double): String = "€" + "%.2f".format(v)
private fun km(v: Double): String = "%.1f".format(v) + " km"

private fun friendlyError(raw: String?): String? {
    if (raw.isNullOrBlank()) return null
    val lower = raw.lowercase()
    return when {
        "unable to resolve host" in lower || "no address associated" in lower || "unknownhost" in lower ->
            "Χωρίς σύνδεση. Έλεγξε Wi‑Fi / δεδομένα."
        "timeout" in lower -> "Η σύνδεση άργησε. Δοκίμασε ξανά."
        raw.length > 120 -> raw.take(100) + "…"
        else -> raw
    }
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
                    add(MapMarker(lat, lng, o.storeName ?: "Offer", "#FFC043"))
                }
            }
        }
    }
    val centerLat = markers.firstOrNull()?.lat ?: primary?.storeLat ?: state.geo?.lat
    val centerLng = markers.firstOrNull()?.lng ?: primary?.storeLng ?: state.geo?.lng
    val err = friendlyError(state.error)
    val hasOffer = state.online && state.activeTrips.isEmpty() && state.offers.isNotEmpty()
    val hasTrip = state.activeTrips.isNotEmpty()

    Box(Modifier.fillMaxSize().background(Color(0xFFE8EEF2))) {
        DriverMapView(
            modifier = Modifier.fillMaxSize(),
            centerLat = centerLat,
            centerLng = centerLng,
            markers = markers,
            userLat = state.geo?.lat,
            userLng = state.geo?.lng,
            userBearing = state.geo?.bearing,
        )

        // ── Top status pill (eFood-style) ─────────────────────────────
        Row(
            Modifier
                .align(Alignment.TopCenter)
                .fillMaxWidth()
                .padding(horizontal = 12.dp, vertical = 10.dp)
                .shadow(10.dp, RoundedCornerShape(28.dp))
                .clip(RoundedCornerShape(28.dp))
                .background(Color.White)
                .padding(horizontal = 14.dp, vertical = 10.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.SpaceBetween,
        ) {
            Row(verticalAlignment = Alignment.CenterVertically, modifier = Modifier.weight(1f)) {
                Box(
                    Modifier
                        .size(12.dp)
                        .clip(CircleShape)
                        .background(
                            when {
                                state.online && !state.onBreak -> FreshGreen
                                state.onBreak -> FreshAmber
                                else -> Color(0xFFBDBDBD)
                            },
                        ),
                )
                Spacer(Modifier.width(10.dp))
                Column {
                    Text(
                        when {
                            !state.online -> "Εκτός σύνδεσης"
                            state.onBreak -> "Σε διάλειμμα"
                            else -> "Διαθέσιμος"
                        },
                        fontWeight = FontWeight.Bold,
                        fontSize = 16.sp,
                        color = Color(0xFF111111),
                    )
                    val sub = when {
                        !state.driverActive -> "Αναμονή έγκρισης"
                        state.cashCapped -> "Όριο μετρητών"
                        state.online && state.geo != null -> "Έτοιμος για παραγγελίες"
                        state.online -> "Αναμονή GPS…"
                        else -> "Πάτα Γίνε διαθέσιμος"
                    }
                    Text(sub, fontSize = 12.sp, color = Color(0xFF6B6B6B))
                }
            }
            Row(verticalAlignment = Alignment.CenterVertically) {
                if (state.online) {
                    OutlinedButton(
                        onClick = onToggleBreak,
                        shape = RoundedCornerShape(20.dp),
                        modifier = Modifier.height(36.dp),
                    ) {
                        Text(
                            if (state.onBreak) "Τέλος" else "Διάλειμμα",
                            fontSize = 12.sp,
                            color = if (state.onBreak) FreshAmber else Color(0xFF333333),
                        )
                    }
                    Spacer(Modifier.width(6.dp))
                }
                IconButton(
                    onClick = { onToggleOnline(!state.online) },
                    enabled = state.driverActive && !state.busy,
                    modifier = Modifier
                        .size(40.dp)
                        .clip(CircleShape)
                        .background(if (state.online) Color(0xFFFFEBEE) else FreshGreen.copy(alpha = 0.15f)),
                ) {
                    Icon(
                        Icons.Outlined.PowerSettingsNew,
                        contentDescription = if (state.online) "Offline" else "Online",
                        tint = if (state.online) Color(0xFFE11900) else FreshGreen,
                    )
                }
                IconButton(onClick = onRefresh, modifier = Modifier.size(36.dp)) {
                    Icon(Icons.Outlined.Refresh, null, tint = Color(0xFF6B6B6B))
                }
            }
        }

        // ── Bottom layer ───────────────────────────────────────────────
        Column(
            Modifier
                .align(Alignment.BottomCenter)
                .fillMaxWidth()
                .padding(horizontal = 12.dp, vertical = 10.dp),
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
                // Offline: big eFood-style go-online button
                !state.online -> {
                    Button(
                        onClick = { onToggleOnline(true) },
                        enabled = state.driverActive && !state.busy,
                        modifier = Modifier
                            .fillMaxWidth()
                            .height(58.dp)
                            .shadow(12.dp, RoundedCornerShape(18.dp)),
                        shape = RoundedCornerShape(18.dp),
                        colors = ButtonDefaults.buttonColors(
                            containerColor = FreshGreen,
                            contentColor = Color.White,
                            disabledContainerColor = Color(0xFFBDBDBD),
                        ),
                    ) {
                        if (state.busy) {
                            CircularProgressIndicator(Modifier.size(22.dp), color = Color.White, strokeWidth = 2.dp)
                        } else {
                            Text("Γίνε διαθέσιμος", fontWeight = FontWeight.Bold, fontSize = 18.sp)
                        }
                    }
                    if (!state.driverActive) {
                        Text(
                            "Ο λογαριασμός περιμένει έγκριση",
                            color = Color(0xFFE11900),
                            fontSize = 13.sp,
                            modifier = Modifier.fillMaxWidth().padding(top = 8.dp),
                            textAlign = TextAlign.Center,
                        )
                    }
                }

                // Active trip sheet
                hasTrip -> {
                    Card(
                        Modifier.fillMaxWidth().heightIn(max = 380.dp).shadow(16.dp, RoundedCornerShape(24.dp)),
                        shape = RoundedCornerShape(24.dp),
                        colors = CardDefaults.cardColors(containerColor = Color.White),
                        elevation = CardDefaults.cardElevation(0.dp),
                    ) {
                        Column(
                            Modifier
                                .fillMaxWidth()
                                .verticalScroll(rememberScrollState())
                                .padding(18.dp),
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
                            state.stackedOffers.forEach { offer ->
                                Spacer(Modifier.height(10.dp))
                                OfferCard(
                                    offer = offer,
                                    busy = state.busy,
                                    timeoutSec = state.settings.dist_offer_timeout_seconds ?: 60,
                                    onAccept = { onAccept(offer.offerId, offer.order.id) },
                                    onDecline = { if (offer.offerId.isNotBlank()) onDecline(offer.offerId) },
                                )
                            }
                        }
                    }
                }

                // New offer — dominant sheet
                hasOffer -> {
                    Card(
                        Modifier.fillMaxWidth().shadow(20.dp, RoundedCornerShape(24.dp)),
                        shape = RoundedCornerShape(24.dp),
                        colors = CardDefaults.cardColors(containerColor = Color.White),
                        elevation = CardDefaults.cardElevation(0.dp),
                    ) {
                        Column(Modifier.padding(18.dp)) {
                            Handle()
                            Text(
                                "Νέα παραγγελία",
                                fontWeight = FontWeight.Bold,
                                fontSize = 14.sp,
                                color = Color(0xFF6B6B6B),
                            )
                            Spacer(Modifier.height(8.dp))
                            state.offers.take(1).forEach { offer ->
                                OfferCard(
                                    offer = offer,
                                    busy = state.busy,
                                    timeoutSec = state.settings.dist_offer_timeout_seconds ?: 60,
                                    onAccept = { onAccept(offer.offerId, null) },
                                    onDecline = { onDecline(offer.offerId) },
                                    dominant = true,
                                )
                            }
                        }
                    }
                }

                // Online waiting
                else -> {
                    Card(
                        Modifier.fillMaxWidth().shadow(12.dp, RoundedCornerShape(22.dp)),
                        shape = RoundedCornerShape(22.dp),
                        colors = CardDefaults.cardColors(containerColor = Color.White),
                        elevation = CardDefaults.cardElevation(0.dp),
                    ) {
                        Column(
                            Modifier.fillMaxWidth().padding(vertical = 20.dp, horizontal = 16.dp),
                            horizontalAlignment = Alignment.CenterHorizontally,
                        ) {
                            Text(
                                if (state.onBreak) "Σε διάλειμμα" else "Αναμονή παραγγελιών…",
                                fontWeight = FontWeight.Bold,
                                fontSize = 17.sp,
                                color = Color(0xFF111111),
                            )
                            Spacer(Modifier.height(4.dp))
                            Text(
                                if (state.onBreak) {
                                    "Δεν λαμβάνεις νέες προσφορές."
                                } else {
                                    "Θα εμφανιστούν αυτόματα όταν υπάρχει κοντινή παραγγελία."
                                },
                                fontSize = 13.sp,
                                color = Color(0xFF6B6B6B),
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
    Box(
        Modifier
            .fillMaxWidth()
            .padding(bottom = 12.dp),
        contentAlignment = Alignment.Center,
    ) {
        Box(
            Modifier
                .width(36.dp)
                .height(4.dp)
                .clip(RoundedCornerShape(2.dp))
                .background(Color(0xFFD0D0D0)),
        )
    }
}

@Composable
private fun OfferCard(
    offer: OfferUi,
    busy: Boolean,
    timeoutSec: Int,
    onAccept: () -> Unit,
    onDecline: () -> Unit,
    dominant: Boolean = false,
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

    Column(Modifier.fillMaxWidth()) {
        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
            Column(Modifier.weight(1f)) {
                Text(
                    offer.storeName ?: "Κατάστημα",
                    fontWeight = FontWeight.Bold,
                    fontSize = if (dominant) 18.sp else 16.sp,
                    color = Color(0xFF111111),
                )
                if (!offer.storeAddress.isNullOrBlank()) {
                    Text(offer.storeAddress!!, fontSize = 13.sp, color = Color(0xFF6B6B6B))
                }
            }
            Column(horizontalAlignment = Alignment.End) {
                Text(
                    eur(payout),
                    fontWeight = FontWeight.Bold,
                    fontSize = if (dominant) 28.sp else 22.sp,
                    color = FreshGreen,
                )
                Text(
                    "${secondsLeft}s",
                    fontSize = 13.sp,
                    fontWeight = FontWeight.SemiBold,
                    color = if (secondsLeft <= 10) Color(0xFFE11900) else Color(0xFF6B6B6B),
                )
            }
        }
        if (!offer.order.delivery_address.isNullOrBlank()) {
            Spacer(Modifier.height(8.dp))
            Text("→ " + offer.order.delivery_address, fontSize = 14.sp, color = Color(0xFF333333))
        }
        Row(Modifier.padding(top = 8.dp), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            offer.order.distance_km?.let { Pill(km(it)) }
            if (offer.order.payment_method?.equals("cash", ignoreCase = true) == true) {
                Pill("Μετρητά", FreshAmber)
            }
        }
        if (!offer.itemsSummary.isNullOrBlank()) {
            Text(
                offer.itemsSummary!!,
                fontSize = 12.sp,
                color = Color(0xFF6B6B6B),
                modifier = Modifier.padding(top = 6.dp),
            )
        }
        Spacer(Modifier.height(10.dp))
        LinearProgressIndicator(
            progress = { progress.coerceIn(0f, 1f) },
            modifier = Modifier.fillMaxWidth().height(5.dp).clip(RoundedCornerShape(3.dp)),
            color = if (secondsLeft <= 10) Color(0xFFE11900) else FreshGreen,
            trackColor = Color(0xFFE8E8E8),
        )
        Spacer(Modifier.height(14.dp))
        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(10.dp)) {
            OutlinedButton(
                onClick = onDecline,
                enabled = !busy && offer.offerId.isNotBlank(),
                modifier = Modifier.weight(1f).height(if (dominant) 56.dp else 50.dp),
                shape = RoundedCornerShape(16.dp),
            ) { Text("Απόρριψη", fontWeight = FontWeight.SemiBold) }
            Button(
                onClick = onAccept,
                enabled = !busy,
                modifier = Modifier.weight(1.4f).height(if (dominant) 56.dp else 50.dp),
                shape = RoundedCornerShape(16.dp),
                colors = ButtonDefaults.buttonColors(containerColor = FreshGreen, contentColor = Color.White),
            ) {
                if (busy) CircularProgressIndicator(Modifier.size(18.dp), color = Color.White, strokeWidth = 2.dp)
                else Text("Αποδοχή", fontWeight = FontWeight.Bold, fontSize = if (dominant) 17.sp else 15.sp)
            }
        }
    }
}

@Composable
private fun Pill(text: String, color: Color = Color(0xFF6B6B6B)) {
    Text(
        text,
        fontSize = 12.sp,
        fontWeight = FontWeight.SemiBold,
        color = color,
        modifier = Modifier
            .background(color.copy(alpha = 0.12f), RoundedCornerShape(20.dp))
            .padding(horizontal = 10.dp, vertical = 4.dp),
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
        // Step indicator (eFood-style)
        Row(
            Modifier.fillMaxWidth().padding(bottom = 12.dp),
            horizontalArrangement = Arrangement.SpaceBetween,
        ) {
            listOf("Παραλαβή", "Καθοδόν", "Παράδοση").forEachIndexed { i, label ->
                val active = when (i) {
                    0 -> status in listOf("accepted", "preparing", "ready", "arrived")
                    1 -> status == "picked_up"
                    else -> status == "delivered"
                }
                val done = when (i) {
                    0 -> status in listOf("picked_up", "delivered")
                    1 -> status == "delivered"
                    else -> false
                }
                Column(horizontalAlignment = Alignment.CenterHorizontally, modifier = Modifier.weight(1f)) {
                    Box(
                        Modifier
                            .size(10.dp)
                            .clip(CircleShape)
                            .background(
                                when {
                                    done || active -> FreshGreen
                                    else -> Color(0xFFD0D0D0)
                                },
                            ),
                    )
                    Spacer(Modifier.height(4.dp))
                    Text(
                        label,
                        fontSize = 11.sp,
                        fontWeight = if (active) FontWeight.Bold else FontWeight.Normal,
                        color = if (active || done) Color(0xFF111111) else Color(0xFF9E9E9E),
                    )
                }
            }
        }

        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
            Column(Modifier.weight(1f)) {
                Text(trip.storeName ?: "Κατάστημα", fontWeight = FontWeight.Bold, fontSize = 17.sp, color = Color(0xFF111111))
                Text(statusLabel(status), color = FreshGreen, fontWeight = FontWeight.SemiBold, fontSize = 13.sp)
            }
            Text(eur(payout), fontWeight = FontWeight.Bold, fontSize = 22.sp, color = FreshGreen)
        }
        trip.storeAddress?.let {
            Text(it, fontSize = 13.sp, color = Color(0xFF6B6B6B), modifier = Modifier.padding(top = 2.dp))
        }
        trip.order.delivery_address?.let {
            Text("Παράδοση: $it", fontSize = 14.sp, color = Color(0xFF333333), modifier = Modifier.padding(top = 6.dp))
        }
        if (trip.order.payment_method?.equals("cash", ignoreCase = true) == true) {
            Spacer(Modifier.height(6.dp))
            Pill("Είσπραξη " + eur(trip.order.total_amount ?: 0.0), FreshAmber)
        }

        Spacer(Modifier.height(12.dp))
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            val storeLat = trip.storeLat
            val storeLng = trip.storeLng
            if (storeLat != null && storeLng != null && status in listOf("accepted", "preparing", "ready", "arrived")) {
                OutlinedButton(
                    onClick = { onNavigate(storeLat, storeLng, trip.storeName ?: "Store") },
                    shape = RoundedCornerShape(14.dp),
                ) {
                    Icon(Icons.Outlined.Navigation, null, Modifier.size(16.dp))
                    Spacer(Modifier.width(4.dp))
                    Text("Πλοήγηση")
                }
            }
            val dLat = trip.order.delivery_latitude
            val dLng = trip.order.delivery_longitude
            if (dLat != null && dLng != null && status in listOf("picked_up", "arrived")) {
                OutlinedButton(
                    onClick = { onNavigate(dLat, dLng, "Παράδοση") },
                    shape = RoundedCornerShape(14.dp),
                ) {
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
                modifier = Modifier.fillMaxWidth().height(56.dp),
                shape = RoundedCornerShape(16.dp),
                colors = ButtonDefaults.buttonColors(containerColor = FreshGreen, contentColor = Color.White),
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
