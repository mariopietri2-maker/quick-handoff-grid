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
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Button
import androidx.compose.material3.Checkbox
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Switch
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import com.freshdelivery.nativedriver.data.ActiveTripUi
import com.freshdelivery.nativedriver.data.OfferUi
import com.freshdelivery.nativedriver.ui.DriverUiState
import com.freshdelivery.nativedriver.ui.map.DriverMapView
import com.freshdelivery.nativedriver.ui.map.MapMarker
import kotlinx.coroutines.delay
import java.time.Instant

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
    val trip = state.primaryTrip
    val markers = buildList {
        trip?.storeLat?.let { lat ->
            trip.storeLng?.let { lng ->
                add(MapMarker(lat, lng, trip.storeName ?: "Store", "#38bdf8"))
            }
        }
        trip?.order?.delivery_latitude?.let { lat ->
            trip.order.delivery_longitude?.let { lng ->
                add(MapMarker(lat, lng, "Delivery", "#22c55e"))
            }
        }
        state.offers.firstOrNull()?.let { o ->
            o.storeLat?.let { lat ->
                o.storeLng?.let { lng ->
                    add(MapMarker(lat, lng, o.storeName ?: "Store", "#f59e0b"))
                }
            }
            o.order.delivery_latitude?.let { lat ->
                o.order.delivery_longitude?.let { lng ->
                    add(MapMarker(lat, lng, "Customer", "#22c55e"))
                }
            }
        }
    }
    val centerLat = markers.firstOrNull()?.lat ?: trip?.storeLat
    val centerLng = markers.firstOrNull()?.lng ?: trip?.storeLng

    Box(Modifier.fillMaxSize()) {
        DriverMapView(
            modifier = Modifier.fillMaxSize(),
            centerLat = centerLat,
            centerLng = centerLng,
            markers = markers,
        )

        Column(
            modifier = Modifier
                .align(Alignment.BottomCenter)
                .fillMaxWidth()
                .clip(RoundedCornerShape(topStart = 22.dp, topEnd = 22.dp))
                .background(MaterialTheme.colorScheme.surface.copy(alpha = 0.96f))
                .padding(16.dp)
                .height(420.dp),
        ) {
            Row(
                Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Column {
                    Text(
                        if (state.online) "Διαθέσιμος" else "Εκτός σύνδεσης",
                        style = MaterialTheme.typography.titleLarge,
                        color = if (state.online) MaterialTheme.colorScheme.primary
                        else MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                    Text(
                        "Σήμερα €${"%.2f".format(state.money?.todayTotal ?: 0.0)}",
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                }
                Switch(
                    checked = state.online,
                    onCheckedChange = onToggleOnline,
                    enabled = state.driverActive && !state.busy,
                )
            }

            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                TextButton(onClick = onToggleBreak, enabled = state.online) {
                    Text(if (state.onBreak) "Τέλος διαλείμματος" else "Διάλειμμα")
                }
                TextButton(onClick = onRefresh) { Text("Ανανέωση") }
            }

            if (!state.driverActive) {
                Text("Περιμένεις έγκριση admin.", color = MaterialTheme.colorScheme.error)
            }
            if (state.onBreak) {
                Text("Είσαι σε διάλειμμα — χωρίς νέες προσφορές.", color = MaterialTheme.colorScheme.error)
            }
            if (state.cashCapped) {
                Text(
                    "Όριο μετρητών €${"%.0f".format(state.maxCashCap)} — παρέδωσε μετρητά για νέες παραγγελίες.",
                    color = MaterialTheme.colorScheme.error,
                )
            }
            if (!state.error.isNullOrBlank()) {
                Text(state.error, color = MaterialTheme.colorScheme.error)
                TextButton(onClick = onClearMessages) { Text("OK") }
            }
            if (!state.info.isNullOrBlank()) {
                Text(state.info, color = MaterialTheme.colorScheme.primary)
                TextButton(onClick = onClearMessages) { Text("OK") }
            }

            Column(
                Modifier
                    .weight(1f)
                    .verticalScroll(rememberScrollState()),
            ) {
                trip?.let {
                    Spacer(Modifier.height(8.dp))
                    ActiveTripCard(trip = it, busy = state.busy, onAdvance = onAdvance)
                }
                state.stackedOffers.forEach { offer ->
                    Spacer(Modifier.height(8.dp))
                    OfferCard(
                        offer = offer,
                        busy = state.busy,
                        timeoutSec = state.settings.dist_offer_timeout_seconds ?: 60,
                        onAccept = onAccept,
                        onDecline = onDecline,
                        stacked = true,
                    )
                }
                if (trip == null) {
                    if (state.offers.isEmpty()) {
                        Spacer(Modifier.height(12.dp))
                        Text(
                            when {
                                !state.online -> "Άνοιξε Διαθέσιμος για παραγγελίες."
                                state.onBreak || state.cashCapped -> "Δεν εμφανίζονται προσφορές τώρα."
                                else -> "Αναμονή για προσφορά…"
                            },
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                        )
                    } else {
                        state.offers.forEach { offer ->
                            Spacer(Modifier.height(8.dp))
                            OfferCard(
                                offer = offer,
                                busy = state.busy,
                                timeoutSec = state.settings.dist_offer_timeout_seconds ?: 60,
                                onAccept = onAccept,
                                onDecline = onDecline,
                                stacked = false,
                            )
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun OfferCard(
    offer: OfferUi,
    busy: Boolean,
    timeoutSec: Int,
    stacked: Boolean,
    onAccept: (offerId: String, orderId: String?) -> Unit,
    onDecline: (String) -> Unit,
) {
    var secondsLeft by remember(offer.offerId, offer.expiresAt) {
        mutableIntStateOf(secondsRemaining(offer.expiresAt, timeoutSec))
    }
    LaunchedEffect(offer.offerId, offer.expiresAt) {
        while (secondsLeft > 0) {
            delay(1000)
            secondsLeft = secondsRemaining(offer.expiresAt, timeoutSec)
        }
        if (offer.offerId.isNotBlank() && secondsLeft <= 0) {
            onDecline(offer.offerId)
        }
    }

    val order = offer.order
    val payout = (order.driver_payout ?: order.delivery_fee ?: 0.0) +
        (order.tip_amount ?: 0.0) + (order.driver_pool_bonus ?: 0.0)
    val isCash = order.payment_method.equals("cash", ignoreCase = true)

    Column(
        Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(16.dp))
            .background(MaterialTheme.colorScheme.background)
            .padding(14.dp),
    ) {
        Text(
            if (stacked) "Stacked προσφορά" else "Νέα προσφορά",
            style = MaterialTheme.typography.titleLarge,
        )
        if (offer.expiresAt != null) {
            Text(
                "Λήγει σε ${secondsLeft}δ",
                color = if (secondsLeft <= 15) MaterialTheme.colorScheme.error
                else MaterialTheme.colorScheme.primary,
            )
        }
        Text(offer.storeName ?: "Κατάστημα")
        Text(order.delivery_address ?: "—", color = MaterialTheme.colorScheme.onSurfaceVariant)
        offer.itemsSummary?.let {
            Text(it, color = MaterialTheme.colorScheme.onSurfaceVariant)
        }
        order.notes?.takeIf { it.isNotBlank() }?.let {
            Text("Σημείωση: $it", color = MaterialTheme.colorScheme.onSurfaceVariant)
        }
        Spacer(Modifier.height(6.dp))
        Text(
            buildString {
                append("€${"%.2f".format(payout)}")
                order.distance_km?.let { append(" · ${"%.1f".format(it)} χλμ") }
                if (isCash) append(" · ΜΕΤΡΗΤΑ")
                order.tip_amount?.takeIf { it > 0 }?.let { append(" · tip €${"%.2f".format(it)}") }
            },
            color = MaterialTheme.colorScheme.primary,
        )
        Spacer(Modifier.height(10.dp))
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            if (offer.offerId.isNotBlank()) {
                OutlinedButton(
                    onClick = { onDecline(offer.offerId) },
                    enabled = !busy,
                    modifier = Modifier.weight(1f),
                ) { Text("Απόρριψη") }
            }
            Button(
                onClick = { onAccept(offer.offerId, order.id) },
                enabled = !busy,
                modifier = Modifier.weight(1f),
            ) { Text("Αποδοχή") }
        }
    }
}

@Composable
private fun ActiveTripCard(
    trip: ActiveTripUi,
    busy: Boolean,
    onAdvance: (orderId: String, status: String) -> Unit,
) {
    val context = LocalContext.current
    val status = trip.order.status
    val isCash = trip.order.payment_method.equals("cash", ignoreCase = true)
    val cashDue = trip.order.total_amount ?: 0.0
    var cashConfirmed by remember(trip.order.id) { mutableStateOf(false) }

    val action: Pair<String, String>? = when (status) {
        "ready" -> "arrived" to "Έφτασα στο κατάστημα"
        "arrived" -> "picked_up" to "Παρέλαβα"
        "picked_up" -> "delivered" to "Παραδόθηκε"
        else -> null
    }
    val actionEnabled = when (status) {
        "ready", "arrived" -> true
        "picked_up" -> !isCash || cashConfirmed
        else -> false
    }

    Column(
        Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(16.dp))
            .background(MaterialTheme.colorScheme.background)
            .padding(14.dp),
    ) {
        Text("Ενεργή παράδοση", style = MaterialTheme.typography.titleLarge)
        Text("Status: $status", color = MaterialTheme.colorScheme.primary)
        Text(trip.storeName ?: "Κατάστημα")
        Text(trip.storeAddress ?: "", color = MaterialTheme.colorScheme.onSurfaceVariant)
        trip.itemsSummary?.let { Text(it, color = MaterialTheme.colorScheme.onSurfaceVariant) }
        Spacer(Modifier.height(6.dp))
        Text("Παράδοση")
        Text(trip.order.delivery_address ?: "—", color = MaterialTheme.colorScheme.onSurfaceVariant)
        trip.order.notes?.takeIf { it.isNotBlank() }?.let {
            Text("Σημείωση: $it")
        }

        Spacer(Modifier.height(8.dp))
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            trip.storePhone?.let { phone ->
                OutlinedButton(onClick = {
                    context.startActivity(Intent(Intent.ACTION_DIAL, Uri.parse("tel:$phone")))
                }) { Text("Κλήση καταστήματος") }
            }
            trip.order.customer_phone?.let { phone ->
                OutlinedButton(onClick = {
                    context.startActivity(Intent(Intent.ACTION_DIAL, Uri.parse("tel:$phone")))
                }) { Text("Κλήση πελάτη") }
            }
        }
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            val navLat = if (status == "picked_up") trip.order.delivery_latitude else trip.storeLat
            val navLng = if (status == "picked_up") trip.order.delivery_longitude else trip.storeLng
            if (navLat != null && navLng != null) {
                Button(onClick = {
                    val gmm = Uri.parse("google.navigation:q=$navLat,$navLng")
                    val intent = Intent(Intent.ACTION_VIEW, gmm).setPackage("com.google.android.apps.maps")
                    runCatching { context.startActivity(intent) }.onFailure {
                        context.startActivity(
                            Intent(Intent.ACTION_VIEW, Uri.parse("geo:$navLat,$navLng?q=$navLat,$navLng")),
                        )
                    }
                }) { Text("Πλοήγηση") }
            }
        }

        if (status in listOf("accepted", "preparing")) {
            Spacer(Modifier.height(8.dp))
            Text(
                "Περίμενε ready από το κατάστημα…",
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
        }

        if (status == "picked_up" && isCash) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Checkbox(checked = cashConfirmed, onCheckedChange = { cashConfirmed = it })
                Text("Επιβεβαιώνω μετρητά €${"%.2f".format(cashDue)}")
            }
        }

        if (status == "ready" || status == "arrived" || status == "picked_up") {
            Spacer(Modifier.height(8.dp))
            val label = action?.second ?: return@Column
            Button(
                onClick = { onAdvance(trip.order.id, action.first) },
                enabled = !busy && actionEnabled,
                modifier = Modifier.fillMaxWidth(),
            ) { Text(label) }
        }
    }
}

private fun secondsRemaining(expiresAt: String?, fallback: Int): Int {
    if (expiresAt.isNullOrBlank()) return fallback
    return runCatching {
        val ms = Instant.parse(expiresAt).toEpochMilli() - System.currentTimeMillis()
        (ms / 1000).toInt().coerceAtLeast(0)
    }.getOrDefault(fallback)
}
