package com.freshdelivery.nativedriver.ui.home

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
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Switch
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.unit.dp
import com.freshdelivery.nativedriver.data.ActiveTripUi
import com.freshdelivery.nativedriver.data.OfferUi
import com.freshdelivery.nativedriver.ui.DriverUiState

@Composable
fun HomeScreen(
    state: DriverUiState,
    onToggleOnline: (Boolean) -> Unit,
    onAccept: (String) -> Unit,
    onDecline: (String) -> Unit,
    onAdvance: (String) -> Unit,
    onRefresh: () -> Unit,
    onSignOut: () -> Unit,
    onClearMessages: () -> Unit,
) {
    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(MaterialTheme.colorScheme.background)
            .padding(16.dp),
    ) {
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Column {
                Text("Fresh Driver", style = MaterialTheme.typography.titleLarge)
                Text(
                    state.displayName ?: "Οδηγός",
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }
            TextButton(onClick = onSignOut) { Text("Έξοδος") }
        }

        Spacer(Modifier.height(12.dp))

        Row(
            modifier = Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(16.dp))
                .background(MaterialTheme.colorScheme.surface)
                .padding(16.dp),
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
                    "Native location service",
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }
            Switch(
                checked = state.online,
                onCheckedChange = onToggleOnline,
                enabled = state.driverActive && !state.busy,
            )
        }

        if (!state.driverActive) {
            Spacer(Modifier.height(12.dp))
            Text(
                "Ο λογαριασμός σου περιμένει έγκριση admin.",
                color = MaterialTheme.colorScheme.error,
            )
        }

        if (!state.error.isNullOrBlank()) {
            Spacer(Modifier.height(8.dp))
            Text(state.error, color = MaterialTheme.colorScheme.error)
            TextButton(onClick = onClearMessages) { Text("OK") }
        }
        if (!state.info.isNullOrBlank()) {
            Spacer(Modifier.height(8.dp))
            Text(state.info, color = MaterialTheme.colorScheme.primary)
            TextButton(onClick = onClearMessages) { Text("OK") }
        }

        Spacer(Modifier.height(8.dp))
        TextButton(onClick = onRefresh, enabled = !state.busy) { Text("Ανανέωση") }

        Column(
            modifier = Modifier
                .weight(1f)
                .verticalScroll(rememberScrollState()),
        ) {
            state.activeTrip?.let { trip ->
                Spacer(Modifier.height(12.dp))
                ActiveTripCard(trip = trip, busy = state.busy, onAdvance = onAdvance)
            }

            if (state.activeTrip == null) {
                if (state.offers.isEmpty()) {
                    Spacer(Modifier.height(24.dp))
                    Box(
                        modifier = Modifier
                            .fillMaxWidth()
                            .clip(RoundedCornerShape(16.dp))
                            .background(MaterialTheme.colorScheme.surface)
                            .padding(20.dp),
                    ) {
                        Text(
                            if (state.online) "Αναμονή για προσφορά…"
                            else "Άνοιξε Διαθέσιμος για να λάβεις παραγγελίες.",
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                        )
                    }
                } else {
                    state.offers.forEach { offer ->
                        Spacer(Modifier.height(12.dp))
                        OfferCard(
                            offer = offer,
                            busy = state.busy,
                            onAccept = onAccept,
                            onDecline = onDecline,
                        )
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
    onAccept: (String) -> Unit,
    onDecline: (String) -> Unit,
) {
    val order = offer.order
    val payout = order.driver_payout ?: order.delivery_fee
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(16.dp))
            .background(MaterialTheme.colorScheme.surface)
            .padding(16.dp),
    ) {
        Text("Νέα προσφορά", style = MaterialTheme.typography.titleLarge)
        Spacer(Modifier.height(6.dp))
        Text(offer.storeName ?: "Κατάστημα")
        Text(
            order.delivery_address ?: "—",
            color = MaterialTheme.colorScheme.onSurfaceVariant,
        )
        Spacer(Modifier.height(8.dp))
        Text(
            buildString {
                if (payout != null) append("€${"%.2f".format(payout)} · ")
                if (order.distance_km != null) append("${"%.1f".format(order.distance_km)} χλμ · ")
                append(order.payment_method ?: "")
            },
            color = MaterialTheme.colorScheme.primary,
        )
        Spacer(Modifier.height(14.dp))
        Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
            OutlinedButton(
                onClick = { onDecline(offer.offerId) },
                enabled = !busy,
                modifier = Modifier.weight(1f),
            ) { Text("Απόρριψη") }
            Button(
                onClick = { onAccept(offer.offerId) },
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
    onAdvance: (String) -> Unit,
) {
    val status = trip.order.status
    // Same rule as Capacitor driver: arrive only after store is ready.
    val action: Pair<String, String>? = when (status) {
        "ready" -> "arrived" to "Έφτασα στο κατάστημα"
        "arrived" -> "picked_up" to "Παρέλαβα"
        "picked_up" -> "delivered" to "Παραδόθηκε"
        else -> null
    }

    Column(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(16.dp))
            .background(MaterialTheme.colorScheme.surface)
            .padding(16.dp),
    ) {
        Text("Ενεργή παράδοση", style = MaterialTheme.typography.titleLarge)
        Spacer(Modifier.height(6.dp))
        Text("Status: $status", color = MaterialTheme.colorScheme.primary)
        Text(trip.storeName ?: "Κατάστημα")
        Text(trip.storeAddress ?: "", color = MaterialTheme.colorScheme.onSurfaceVariant)
        Spacer(Modifier.height(8.dp))
        Text("Παράδοση σε")
        Text(
            trip.order.delivery_address ?: "—",
            color = MaterialTheme.colorScheme.onSurfaceVariant,
        )
        Spacer(Modifier.height(14.dp))
        if (action != null) {
            Button(
                onClick = { onAdvance(action.first) },
                enabled = !busy,
                modifier = Modifier.fillMaxWidth(),
            ) { Text(action.second) }
        } else {
            Text(
                "Περίμενε το κατάστημα να σημαδέψει ready…",
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
        }
    }
}
