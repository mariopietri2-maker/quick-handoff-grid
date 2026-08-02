package com.freshdelivery.nativedriver.ui.home

import android.content.Intent
import android.net.Uri
import androidx.compose.foundation.background
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
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Switch
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
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.freshdelivery.nativedriver.data.ActiveTripUi
import com.freshdelivery.nativedriver.data.OfferUi
import com.freshdelivery.nativedriver.ui.DriverUiState
import com.freshdelivery.nativedriver.ui.map.DriverMapView
import com.freshdelivery.nativedriver.ui.map.MapMarker
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
                add(MapMarker(lat, lng, primary.storeName ?: "Store", "#22c55e"))
            }
        }
        primary?.order?.delivery_latitude?.let { lat ->
            primary.order.delivery_longitude?.let { lng ->
                add(MapMarker(lat, lng, "Παράδοση", "#3b82f6"))
            }
        }
        state.offers.take(3).forEach { o ->
            o.storeLat?.let { lat ->
                o.storeLng?.let { lng ->
                    add(MapMarker(lat, lng, o.storeName ?: "Offer", "#f59e0b"))
                }
            }
        }
    }
    val centerLat = markers.firstOrNull()?.lat ?: primary?.storeLat
    val centerLng = markers.firstOrNull()?.lng ?: primary?.storeLng

    Column(Modifier.fillMaxSize()) {
        Row(
            Modifier
                .fillMaxWidth()
                .background(MaterialTheme.colorScheme.surface)
                .padding(horizontal = 16.dp, vertical = 10.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.SpaceBetween,
        ) {
            Column {
                Text(
                    if (state.online) "Διαθέσιμος" else "Εκτός σύνδεσης",
                    style = MaterialTheme.typography.titleMedium,
                    fontWeight = FontWeight.Bold,
                    color = if (state.online) Color(0xFF159A6A) else MaterialTheme.colorScheme.onSurface,
                )
                if (!state.driverActive) {
                    Text("Αναμονή έγκρισης", color = MaterialTheme.colorScheme.error, style = MaterialTheme.typography.bodySmall)
                } else if (state.onBreak) {
                    Text("Σε διάλειμμα", color = Color(0xFFF59E0B), style = MaterialTheme.typography.bodySmall)
                } else if (state.cashCapped) {
                    Text("Όριο μετρητών", color = MaterialTheme.colorScheme.error, style = MaterialTheme.typography.bodySmall)
                }
            }
            Row(verticalAlignment = Alignment.CenterVertically) {
                if (state.online) {
                    FilterChip(
                        selected = state.onBreak,
                        onClick = onToggleBreak,
                        label = { Text(if (state.onBreak) "Τέλος διαλ." else "Διάλειμμα") },
                    )
                    Spacer(Modifier.width(8.dp))
                }
                Switch(
                    checked = state.online,
                    onCheckedChange = onToggleOnline,
                    enabled = state.driverActive && !state.busy,
                )
                IconButton(onClick = onRefresh) {
                    Icon(Icons.Outlined.Refresh, contentDescription = "Refresh")
                }
            }
        }

        Box(
            Modifier
                .fillMaxWidth()
                .height(220.dp)
                .background(Color(0xFF0F172A)),
        ) {
            DriverMapView(
                modifier = Modifier.fillMaxSize(),
                centerLat = centerLat,
                centerLng = centerLng,
                markers = markers,
            )
        }

        state.error?.let { msg ->
            Row(
                Modifier
                    .fillMaxWidth()
                    .background(MaterialTheme.colorScheme.errorContainer)
                    .padding(12.dp),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Text(msg, color = MaterialTheme.colorScheme.onErrorContainer, modifier = Modifier.weight(1f))
                OutlinedButton(onClick = onClearMessages) { Text("OK") }
            }
        }
        state.info?.let { msg ->
            Row(
                Modifier
                    .fillMaxWidth()
                    .background(Color(0xFF159A6A).copy(alpha = 0.15f))
                    .padding(12.dp),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Text(msg, color = Color(0xFF159A6A), modifier = Modifier.weight(1f))
                OutlinedButton(onClick = onClearMessages) { Text("OK") }
            }
        }

        Column(
            Modifier
                .fillMaxSize()
                .verticalScroll(rememberScrollState())
                .padding(16.dp),
        ) {
            if (state.busy) {
                LinearProgressIndicator(Modifier.fillMaxWidth())
                Spacer(Modifier.height(8.dp))
            }

            if (state.activeTrips.isNotEmpty()) {
                Text("Ενεργή παράδοση", style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.Bold)
                Spacer(Modifier.height(8.dp))
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
                    Spacer(Modifier.height(10.dp))
                }
            }

            if (state.stackedOffers.isNotEmpty()) {
                Text("Επιπλέον παραγγελίες (ίδιο κατάστημα)", style = MaterialTheme.typography.titleMedium)
                Spacer(Modifier.height(6.dp))
                state.stackedOffers.forEach { offer ->
                    OfferCard(
                        offer = offer,
                        busy = state.busy,
                        timeoutSec = state.settings.dist_offer_timeout_seconds ?: 60,
                        onAccept = { onAccept(offer.offerId, offer.order.id) },
                        onDecline = { if (offer.offerId.isNotBlank()) onDecline(offer.offerId) },
                    )
                    Spacer(Modifier.height(8.dp))
                }
            }

            if (state.activeTrips.isEmpty()) {
                if (!state.online) {
                    Card(
                        Modifier.fillMaxWidth(),
                        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceVariant),
                    ) {
                        Text(
                            "Άνοιξε σε Διαθέσιμος για να λαμβάνεις προσφορές.",
                            Modifier.padding(16.dp),
                            style = MaterialTheme.typography.bodyLarge,
                        )
                    }
                } else if (state.offers.isEmpty()) {
                    Card(
                        Modifier.fillMaxWidth(),
                        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceVariant),
                    ) {
                        Column(Modifier.padding(16.dp), horizontalAlignment = Alignment.CenterHorizontally) {
                            Text("Αναμονή προσφορών…", style = MaterialTheme.typography.titleMedium)
                            Text("Θα εμφανιστούν εδώ αυτόματα.", color = MaterialTheme.colorScheme.onSurfaceVariant)
                        }
                    }
                } else {
                    Text("Νέες προσφορές", style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.Bold)
                    Spacer(Modifier.height(8.dp))
                    state.offers.forEach { offer ->
                        OfferCard(
                            offer = offer,
                            busy = state.busy,
                            timeoutSec = state.settings.dist_offer_timeout_seconds ?: 60,
                            onAccept = { onAccept(offer.offerId, null) },
                            onDecline = { onDecline(offer.offerId) },
                        )
                        Spacer(Modifier.height(10.dp))
                    }
                }
            }

            Spacer(Modifier.height(24.dp))
        }
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

    Card(
        Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(16.dp),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
        elevation = CardDefaults.cardElevation(defaultElevation = 2.dp),
    ) {
        Column(Modifier.padding(14.dp)) {
            Row(
                Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Text(
                    offer.storeName ?: "Κατάστημα",
                    style = MaterialTheme.typography.titleMedium,
                    fontWeight = FontWeight.Bold,
                )
                Text(
                    eur(payout),
                    style = MaterialTheme.typography.titleLarge,
                    color = Color(0xFF159A6A),
                    fontWeight = FontWeight.Bold,
                )
            }
            if (!offer.storeAddress.isNullOrBlank()) {
                Text(offer.storeAddress!!, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
            }
            if (!offer.order.delivery_address.isNullOrBlank()) {
                Text("→ " + offer.order.delivery_address, style = MaterialTheme.typography.bodyMedium)
            }
            offer.order.distance_km?.let {
                Text(km(it), style = MaterialTheme.typography.bodySmall)
            }
            if (!offer.itemsSummary.isNullOrBlank()) {
                Text(offer.itemsSummary!!, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
            }
            if (offer.order.payment_method?.equals("cash", ignoreCase = true) == true) {
                Text("Μετρητά", color = Color(0xFFF59E0B), style = MaterialTheme.typography.labelLarge)
            }

            Spacer(Modifier.height(8.dp))
            LinearProgressIndicator(
                progress = { progress.coerceIn(0f, 1f) },
                modifier = Modifier
                    .fillMaxWidth()
                    .height(6.dp)
                    .clip(RoundedCornerShape(3.dp)),
                color = if (secondsLeft <= 10) MaterialTheme.colorScheme.error else Color(0xFF159A6A),
            )
            Text(secondsLeft.toString() + "s", style = MaterialTheme.typography.labelSmall)

            Spacer(Modifier.height(10.dp))
            Row(
                Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(8.dp),
            ) {
                OutlinedButton(
                    onClick = onDecline,
                    enabled = !busy && offer.offerId.isNotBlank(),
                    modifier = Modifier.weight(1f),
                ) { Text("Απόρριψη") }
                Button(
                    onClick = onAccept,
                    enabled = !busy,
                    modifier = Modifier.weight(1f),
                    colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF159A6A)),
                ) {
                    if (busy) CircularProgressIndicator(Modifier.size(18.dp), color = Color.White, strokeWidth = 2.dp)
                    else Text("Αποδοχή")
                }
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

    Card(
        Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(16.dp),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
        elevation = CardDefaults.cardElevation(defaultElevation = 3.dp),
    ) {
        Column(Modifier.padding(14.dp)) {
            Row(
                Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
            ) {
                Column(Modifier.weight(1f)) {
                    Text(trip.storeName ?: "Κατάστημα", style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold)
                    Text(statusLabel(status), color = Color(0xFF159A6A), style = MaterialTheme.typography.labelLarge)
                }
                Text(eur(payout), style = MaterialTheme.typography.titleLarge, color = Color(0xFF159A6A), fontWeight = FontWeight.Bold)
            }
            trip.storeAddress?.let { Text(it, style = MaterialTheme.typography.bodySmall) }
            trip.order.delivery_address?.let { Text("Παράδοση: " + it, style = MaterialTheme.typography.bodyMedium) }
            trip.itemsSummary?.let { Text(it, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant) }
            if (trip.order.payment_method?.equals("cash", ignoreCase = true) == true) {
                Text(
                    "Είσπραξη μετρητών " + eur(trip.order.total_amount ?: 0.0),
                    color = Color(0xFFF59E0B),
                    fontWeight = FontWeight.SemiBold,
                )
            }

            Spacer(Modifier.height(10.dp))
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                val storeLat = trip.storeLat
                val storeLng = trip.storeLng
                if (storeLat != null && storeLng != null && status in listOf("accepted", "preparing", "ready", "arrived")) {
                    OutlinedButton(onClick = { onNavigate(storeLat, storeLng, trip.storeName ?: "Store") }) {
                        Icon(Icons.Outlined.Navigation, contentDescription = null, Modifier.size(18.dp))
                        Spacer(Modifier.width(4.dp))
                        Text("Κατάστημα")
                    }
                }
                val dLat = trip.order.delivery_latitude
                val dLng = trip.order.delivery_longitude
                if (dLat != null && dLng != null && status in listOf("picked_up", "arrived")) {
                    OutlinedButton(onClick = { onNavigate(dLat, dLng, "Παράδοση") }) {
                        Icon(Icons.Outlined.Navigation, contentDescription = null, Modifier.size(18.dp))
                        Spacer(Modifier.width(4.dp))
                        Text("Πελάτης")
                    }
                }
                val phone = trip.order.customer_phone ?: trip.storePhone
                if (!phone.isNullOrBlank()) {
                    OutlinedButton(onClick = { onCall(phone) }) {
                        Icon(Icons.Outlined.Call, contentDescription = null, Modifier.size(18.dp))
                        Spacer(Modifier.width(4.dp))
                        Text("Κλήση")
                    }
                }
            }

            if (next != null && nextLabel != null) {
                Spacer(Modifier.height(10.dp))
                Button(
                    onClick = { onAdvance(trip.order.id, next) },
                    enabled = !busy,
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(48.dp),
                    colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF159A6A)),
                ) {
                    if (busy) CircularProgressIndicator(Modifier.size(20.dp), color = Color.White, strokeWidth = 2.dp)
                    else Text(nextLabel)
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
