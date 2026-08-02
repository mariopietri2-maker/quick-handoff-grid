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
import androidx.compose.material.icons.outlined.Refresh
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.FilterChip
import androidx.compose.material3.FilterChipDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Switch
import androidx.compose.material3.SwitchDefaults
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
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
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
                add(MapMarker(lat, lng, primary.storeName ?: "Store", "#00C853"))
            }
        }
        primary?.order?.delivery_latitude?.let { lat ->
            primary.order.delivery_longitude?.let { lng ->
                add(MapMarker(lat, lng, "Παράδοση", "#3B82F6"))
            }
        }
        state.offers.take(3).forEach { o ->
            o.storeLat?.let { lat ->
                o.storeLng?.let { lng ->
                    add(MapMarker(lat, lng, o.storeName ?: "Offer", "#FFB020"))
                }
            }
        }
    }
    val centerLat = markers.firstOrNull()?.lat ?: primary?.storeLat
    val centerLng = markers.firstOrNull()?.lng ?: primary?.storeLng
    val cs = MaterialTheme.colorScheme

    Column(Modifier.fillMaxSize().background(cs.background)) {
        // ── Map-first hero (Wolt / Uber style) ──────────────────────────
        Box(
            Modifier
                .fillMaxWidth()
                .height(320.dp)
                .background(Color(0xFF0B0F14)),
        ) {
            DriverMapView(
                modifier = Modifier.fillMaxSize(),
                centerLat = centerLat,
                centerLng = centerLng,
                markers = markers,
            )

            // Top gradient so floating controls stay legible
            Box(
                Modifier
                    .fillMaxWidth()
                    .height(88.dp)
                    .align(Alignment.TopCenter)
                    .background(
                        Brush.verticalGradient(
                            listOf(Color(0xCC0B0F14), Color.Transparent),
                        ),
                    ),
            )

            // Floating glass status bar
            Row(
                Modifier
                    .align(Alignment.TopCenter)
                    .fillMaxWidth()
                    .padding(horizontal = 14.dp, vertical = 12.dp)
                    .shadow(12.dp, RoundedCornerShape(28.dp))
                    .clip(RoundedCornerShape(28.dp))
                    .background(cs.surface.copy(alpha = 0.92f))
                    .border(1.dp, cs.outline.copy(alpha = 0.4f), RoundedCornerShape(28.dp))
                    .padding(horizontal = 14.dp, vertical = 10.dp),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.SpaceBetween,
            ) {
                Row(verticalAlignment = Alignment.CenterVertically, modifier = Modifier.weight(1f)) {
                    Box(
                        Modifier
                            .size(10.dp)
                            .clip(CircleShape)
                            .background(
                                if (state.online && !state.onBreak) FreshGreen else cs.onSurfaceVariant,
                            ),
                    )
                    Spacer(Modifier.width(10.dp))
                    Column {
                        Text(
                            if (state.online) "Διαθέσιμος" else "Εκτός σύνδεσης",
                            style = MaterialTheme.typography.titleSmall,
                            fontWeight = FontWeight.SemiBold,
                            color = if (state.online) FreshGreen else cs.onSurface,
                        )
                        val sub = when {
                            !state.driverActive -> "Αναμονή έγκρισης"
                            state.onBreak -> "Σε διάλειμμα"
                            state.cashCapped -> "Όριο μετρητών"
                            else -> null
                        }
                        if (sub != null) {
                            Text(
                                sub,
                                style = MaterialTheme.typography.labelSmall,
                                color = if (state.cashCapped) cs.error else FreshAmber,
                            )
                        }
                    }
                }
                Row(verticalAlignment = Alignment.CenterVertically) {
                    if (state.online) {
                        FilterChip(
                            selected = state.onBreak,
                            onClick = onToggleBreak,
                            label = {
                                Text(
                                    if (state.onBreak) "Τέλος" else "Διάλειμμα",
                                    style = MaterialTheme.typography.labelMedium,
                                )
                            },
                            colors = FilterChipDefaults.filterChipColors(
                                selectedContainerColor = FreshAmber.copy(alpha = 0.22f),
                                selectedLabelColor = FreshAmber,
                            ),
                            shape = RoundedCornerShape(20.dp),
                        )
                        Spacer(Modifier.width(6.dp))
                    }
                    Switch(
                        checked = state.online,
                        onCheckedChange = onToggleOnline,
                        enabled = state.driverActive && !state.busy,
                        colors = SwitchDefaults.colors(
                            checkedTrackColor = FreshGreen,
                            checkedThumbColor = Color.White,
                        ),
                    )
                    IconButton(onClick = onRefresh, modifier = Modifier.size(36.dp)) {
                        Icon(Icons.Outlined.Refresh, contentDescription = "Refresh", tint = cs.onSurfaceVariant)
                    }
                }
            }

            // Soft fade into content sheet
            Box(
                Modifier
                    .fillMaxWidth()
                    .height(56.dp)
                    .align(Alignment.BottomCenter)
                    .background(
                        Brush.verticalGradient(
                            listOf(Color.Transparent, cs.background),
                        ),
                    ),
            )
        }

        state.error?.let { msg ->
            Banner(msg, cs.errorContainer, cs.onErrorContainer, onClearMessages)
        }
        state.info?.let { msg ->
            Banner(msg, FreshGreen.copy(alpha = 0.15f), FreshGreen, onClearMessages)
        }

        Column(
            Modifier
                .fillMaxSize()
                .verticalScroll(rememberScrollState())
                .padding(horizontal = 16.dp, vertical = 4.dp),
        ) {
            if (state.busy) {
                LinearProgressIndicator(
                    Modifier.fillMaxWidth().clip(RoundedCornerShape(4.dp)),
                    color = FreshGreen,
                )
                Spacer(Modifier.height(12.dp))
            }

            if (state.activeTrips.isNotEmpty()) {
                SectionTitle("Ενεργή παράδοση")
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
                    Spacer(Modifier.height(12.dp))
                }
            }

            if (state.stackedOffers.isNotEmpty()) {
                SectionTitle("Stack · ίδιο κατάστημα")
                state.stackedOffers.forEach { offer ->
                    OfferCard(
                        offer = offer,
                        busy = state.busy,
                        timeoutSec = state.settings.dist_offer_timeout_seconds ?: 60,
                        onAccept = { onAccept(offer.offerId, offer.order.id) },
                        onDecline = { if (offer.offerId.isNotBlank()) onDecline(offer.offerId) },
                    )
                    Spacer(Modifier.height(12.dp))
                }
            }

            if (state.activeTrips.isEmpty()) {
                when {
                    !state.online -> EmptyState("Άνοιξε σε Διαθέσιμος για προσφορές.")
                    state.offers.isEmpty() -> EmptyState("Αναμονή προσφορών…\nΘα εμφανιστούν αυτόματα.")
                    else -> {
                        SectionTitle("Νέες προσφορές")
                        state.offers.forEach { offer ->
                            OfferCard(
                                offer = offer,
                                busy = state.busy,
                                timeoutSec = state.settings.dist_offer_timeout_seconds ?: 60,
                                onAccept = { onAccept(offer.offerId, null) },
                                onDecline = { onDecline(offer.offerId) },
                            )
                            Spacer(Modifier.height(12.dp))
                        }
                    }
                }
            }
            Spacer(Modifier.height(32.dp))
        }
    }
}

@Composable
private fun SectionTitle(text: String) {
    Text(
        text,
        style = MaterialTheme.typography.titleLarge,
        modifier = Modifier.padding(bottom = 10.dp, top = 4.dp),
    )
}

@Composable
private fun EmptyState(text: String) {
    Card(
        Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(24.dp),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceVariant),
        elevation = CardDefaults.cardElevation(0.dp),
    ) {
        Column(Modifier.padding(28.dp), horizontalAlignment = Alignment.CenterHorizontally) {
            Text(
                text,
                style = MaterialTheme.typography.bodyLarge,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
        }
    }
}

@Composable
private fun Banner(msg: String, bg: Color, fg: Color, onClear: () -> Unit) {
    Row(
        Modifier.fillMaxWidth().background(bg).padding(horizontal = 16.dp, vertical = 12.dp),
        horizontalArrangement = Arrangement.SpaceBetween,
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Text(msg, color = fg, modifier = Modifier.weight(1f), style = MaterialTheme.typography.bodyMedium)
        OutlinedButton(onClick = onClear, shape = RoundedCornerShape(20.dp)) { Text("OK") }
    }
}

@Composable
private fun OfferCard(
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
            } else {
                secondsLeft
            }
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
    val cs = MaterialTheme.colorScheme

    Card(
        Modifier
            .fillMaxWidth()
            .border(1.dp, cs.outline.copy(alpha = 0.5f), RoundedCornerShape(24.dp)),
        shape = RoundedCornerShape(24.dp),
        colors = CardDefaults.cardColors(containerColor = cs.surfaceVariant),
        elevation = CardDefaults.cardElevation(defaultElevation = 0.dp),
    ) {
        Column(Modifier.padding(18.dp)) {
            Row(
                Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.Top,
            ) {
                Column(Modifier.weight(1f)) {
                    Text(
                        offer.storeName ?: "Κατάστημα",
                        style = MaterialTheme.typography.titleMedium,
                    )
                    if (!offer.storeAddress.isNullOrBlank()) {
                        Text(offer.storeAddress!!, style = MaterialTheme.typography.bodySmall, color = cs.onSurfaceVariant)
                    }
                }
                Column(horizontalAlignment = Alignment.End) {
                    Text(eur(payout), style = MaterialTheme.typography.headlineMedium, color = FreshGreen)
                    Text(
                        "${secondsLeft}s",
                        style = MaterialTheme.typography.labelMedium,
                        color = if (secondsLeft <= 10) cs.error else cs.onSurfaceVariant,
                    )
                }
            }
            if (!offer.order.delivery_address.isNullOrBlank()) {
                Spacer(Modifier.height(8.dp))
                Text("→ " + offer.order.delivery_address, style = MaterialTheme.typography.bodyMedium)
            }
            Row(Modifier.padding(top = 6.dp), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                offer.order.distance_km?.let { Pill(km(it)) }
                if (offer.order.payment_method?.equals("cash", ignoreCase = true) == true) {
                    Pill("Μετρητά", FreshAmber)
                }
            }
            if (!offer.itemsSummary.isNullOrBlank()) {
                Text(
                    offer.itemsSummary!!,
                    style = MaterialTheme.typography.bodySmall,
                    color = cs.onSurfaceVariant,
                    modifier = Modifier.padding(top = 6.dp),
                )
            }

            Spacer(Modifier.height(12.dp))
            LinearProgressIndicator(
                progress = { progress.coerceIn(0f, 1f) },
                modifier = Modifier.fillMaxWidth().height(5.dp).clip(RoundedCornerShape(3.dp)),
                color = if (secondsLeft <= 10) cs.error else FreshGreen,
                trackColor = cs.outline.copy(alpha = 0.35f),
            )

            Spacer(Modifier.height(14.dp))
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                OutlinedButton(
                    onClick = onDecline,
                    enabled = !busy && offer.offerId.isNotBlank(),
                    modifier = Modifier.weight(1f).height(52.dp),
                    shape = RoundedCornerShape(16.dp),
                ) { Text("Απόρριψη") }
                Button(
                    onClick = onAccept,
                    enabled = !busy,
                    modifier = Modifier.weight(1.2f).height(52.dp),
                    shape = RoundedCornerShape(16.dp),
                    colors = ButtonDefaults.buttonColors(containerColor = FreshGreen, contentColor = Color.Black),
                ) {
                    if (busy) CircularProgressIndicator(Modifier.size(18.dp), color = Color.Black, strokeWidth = 2.dp)
                    else Text("Αποδοχή", fontWeight = FontWeight.Bold)
                }
            }
        }
    }
}

@Composable
private fun Pill(text: String, color: Color = MaterialTheme.colorScheme.onSurfaceVariant) {
    Text(
        text,
        style = MaterialTheme.typography.labelMedium,
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
    val cs = MaterialTheme.colorScheme

    Card(
        Modifier
            .fillMaxWidth()
            .border(1.dp, FreshGreen.copy(alpha = 0.35f), RoundedCornerShape(24.dp)),
        shape = RoundedCornerShape(24.dp),
        colors = CardDefaults.cardColors(containerColor = cs.surfaceVariant),
        elevation = CardDefaults.cardElevation(0.dp),
    ) {
        Column(Modifier.padding(18.dp)) {
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                Column(Modifier.weight(1f)) {
                    Text(trip.storeName ?: "Κατάστημα", style = MaterialTheme.typography.titleMedium)
                    Text(statusLabel(status), color = FreshGreen, style = MaterialTheme.typography.labelLarge)
                }
                Text(eur(payout), style = MaterialTheme.typography.headlineMedium, color = FreshGreen)
            }
            trip.storeAddress?.let { Text(it, style = MaterialTheme.typography.bodySmall, color = cs.onSurfaceVariant) }
            trip.order.delivery_address?.let {
                Text("Παράδοση: $it", style = MaterialTheme.typography.bodyMedium, modifier = Modifier.padding(top = 4.dp))
            }
            trip.itemsSummary?.let {
                Text(it, style = MaterialTheme.typography.bodySmall, color = cs.onSurfaceVariant)
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
                        Text("Κατάστημα")
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
                    modifier = Modifier.fillMaxWidth().height(54.dp),
                    shape = RoundedCornerShape(16.dp),
                    colors = ButtonDefaults.buttonColors(containerColor = FreshGreen, contentColor = Color.Black),
                ) {
                    if (busy) CircularProgressIndicator(Modifier.size(20.dp), color = Color.Black, strokeWidth = 2.dp)
                    else Text(nextLabel, fontWeight = FontWeight.Bold)
                }
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
