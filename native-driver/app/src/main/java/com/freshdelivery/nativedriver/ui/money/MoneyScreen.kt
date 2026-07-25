package com.freshdelivery.nativedriver.ui.money

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
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
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.dp
import com.freshdelivery.nativedriver.ui.DriverUiState

@Composable
fun MoneyScreen(
    state: DriverUiState,
    onWithdraw: (Double) -> Unit,
    onRefresh: () -> Unit,
) {
    val money = state.money
    val balance = money?.wallet?.available_balance ?: 0.0
    val pending = money?.wallet?.pending_balance ?: 0.0
    val cash = state.cashBalance
    val cap = state.maxCashCap
    val cashPct = ((cash / cap.coerceAtLeast(1.0)) * 100).toFloat().coerceIn(0f, 100f)

    Column(
        Modifier
            .fillMaxSize()
            .verticalScroll(rememberScrollState())
            .padding(16.dp),
    ) {
        Text("Χρήματα", style = MaterialTheme.typography.headlineLarge)
        Spacer(Modifier.height(12.dp))

        Column(
            Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(22.dp))
                .background(Color(0xFF159A6A))
                .padding(18.dp),
        ) {
            Text("Διαθέσιμο υπόλοιπο", color = Color.White.copy(alpha = 0.8f))
            Text(
                "€${"%.2f".format(balance)}",
                style = MaterialTheme.typography.headlineLarge,
                color = Color.White,
            )
            if (pending > 0) {
                Text("+€${"%.2f".format(pending)} εκκρεμεί", color = Color.White.copy(alpha = 0.75f))
            }
            Text(
                "Εβδομάδα €${"%.2f".format(money?.weekTotal ?: 0.0)} · Σήμερα €${"%.2f".format(money?.todayTotal ?: 0.0)} (${money?.todayTrips ?: 0})",
                color = Color.White.copy(alpha = 0.75f),
            )
            Spacer(Modifier.height(10.dp))
            Button(
                onClick = { if (balance >= 10) onWithdraw(balance) },
                enabled = !state.busy && balance >= 10,
            ) { Text("Αίτημα ανάληψης") }
        }

        Spacer(Modifier.height(14.dp))
        Column(
            Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(16.dp))
                .background(MaterialTheme.colorScheme.surface)
                .padding(14.dp),
        ) {
            Text("Μετρητά βάρδιας", style = MaterialTheme.typography.titleLarge)
            Text("€${"%.2f".format(cash)} / €${"%.0f".format(cap)}")
            Spacer(Modifier.height(8.dp))
            LinearProgressIndicator(
                progress = { cashPct / 100f },
                modifier = Modifier.fillMaxWidth(),
            )
            if (state.cashCapped) {
                Text("Έφτασες το όριο — χωρίς νέες προσφορές.", color = MaterialTheme.colorScheme.error)
            }
        }

        Spacer(Modifier.height(14.dp))
        Text("Παραδόσεις", style = MaterialTheme.typography.titleLarge)
        (money?.earnings ?: emptyList()).forEach { e ->
            Row(
                Modifier
                    .fillMaxWidth()
                    .padding(vertical = 6.dp),
                horizontalArrangement = Arrangement.SpaceBetween,
            ) {
                Text(e.created_at?.take(16) ?: e.id.take(8))
                Text("€${"%.2f".format(e.total ?: 0.0)}", color = MaterialTheme.colorScheme.primary)
            }
        }

        Spacer(Modifier.height(14.dp))
        Text("Κινήσεις", style = MaterialTheme.typography.titleLarge)
        (money?.transactions ?: emptyList()).forEach { tx ->
            Row(
                Modifier
                    .fillMaxWidth()
                    .padding(vertical = 6.dp),
                horizontalArrangement = Arrangement.SpaceBetween,
            ) {
                Text(tx.description ?: tx.type)
                Text("€${"%.2f".format(tx.amount)}")
            }
        }

        Spacer(Modifier.height(12.dp))
        OutlinedButton(onClick = onRefresh) { Text("Ανανέωση") }
    }
}
