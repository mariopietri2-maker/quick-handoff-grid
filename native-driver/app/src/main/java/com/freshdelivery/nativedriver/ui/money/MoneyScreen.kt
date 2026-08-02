package com.freshdelivery.nativedriver.ui.money

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
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.AccountBalanceWallet
import androidx.compose.material.icons.outlined.Payments
import androidx.compose.material.icons.outlined.Refresh
import androidx.compose.material.icons.outlined.Today
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.freshdelivery.nativedriver.ui.DriverUiState
import com.freshdelivery.nativedriver.ui.theme.FreshAmber
import com.freshdelivery.nativedriver.ui.theme.FreshGreen

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
    val cashPct = ((cash / cap.coerceAtLeast(1.0))).toFloat().coerceIn(0f, 1f)
    val cs = MaterialTheme.colorScheme

    Column(
        Modifier
            .fillMaxSize()
            .background(cs.background)
            .verticalScroll(rememberScrollState())
            .padding(16.dp),
    ) {
        Row(
            Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Text("Χρήματα", style = MaterialTheme.typography.headlineMedium, fontWeight = FontWeight.Bold)
            IconButton(onClick = onRefresh) {
                Icon(Icons.Outlined.Refresh, contentDescription = "Ανανέωση")
            }
        }
        Spacer(Modifier.height(12.dp))

        // Wallet hero
        Box(
            Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(28.dp))
                .background(
                    Brush.linearGradient(
                        listOf(Color(0xFF00A854), Color(0xFF007A3D)),
                    ),
                )
                .padding(22.dp),
        ) {
            Column {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Icon(
                        Icons.Outlined.AccountBalanceWallet,
                        contentDescription = null,
                        tint = Color.White.copy(alpha = 0.9f),
                        modifier = Modifier.size(22.dp),
                    )
                    Spacer(Modifier.size(8.dp))
                    Text("Διαθέσιμο υπόλοιπο", color = Color.White.copy(alpha = 0.85f), style = MaterialTheme.typography.labelLarge)
                }
                Spacer(Modifier.height(8.dp))
                Text(
                    "€${"%.2f".format(balance)}",
                    style = MaterialTheme.typography.displaySmall,
                    color = Color.White,
                    fontWeight = FontWeight.Bold,
                )
                if (pending > 0) {
                    Text("+€${"%.2f".format(pending)} εκκρεμεί", color = Color.White.copy(alpha = 0.75f))
                }
                Spacer(Modifier.height(14.dp))
                Button(
                    onClick = { if (balance >= 10) onWithdraw(balance) },
                    enabled = !state.busy && balance >= 10,
                    colors = ButtonDefaults.buttonColors(
                        containerColor = Color.White,
                        contentColor = Color(0xFF007A3D),
                        disabledContainerColor = Color.White.copy(alpha = 0.4f),
                    ),
                    shape = RoundedCornerShape(16.dp),
                    modifier = Modifier.fillMaxWidth().height(50.dp),
                ) {
                    Text("Αίτημα ανάληψης", fontWeight = FontWeight.Bold)
                }
                if (balance < 10) {
                    Spacer(Modifier.height(6.dp))
                    Text("Ελάχιστο €10 για ανάληψη", color = Color.White.copy(alpha = 0.7f), style = MaterialTheme.typography.labelSmall)
                }
            }
        }

        Spacer(Modifier.height(14.dp))

        // Today / week stats
        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(12.dp)) {
            StatMini(
                icon = { Icon(Icons.Outlined.Today, null, tint = FreshGreen, modifier = Modifier.size(20.dp)) },
                label = "Σήμερα",
                value = "€${"%.2f".format(money?.todayTotal ?: 0.0)}",
                sub = "${money?.todayTrips ?: 0} παραδόσεις",
                modifier = Modifier.weight(1f),
            )
            StatMini(
                icon = { Icon(Icons.Outlined.Payments, null, tint = FreshAmber, modifier = Modifier.size(20.dp)) },
                label = "Εβδομάδα",
                value = "€${"%.2f".format(money?.weekTotal ?: 0.0)}",
                sub = "συνολικά",
                modifier = Modifier.weight(1f),
            )
        }

        Spacer(Modifier.height(14.dp))

        // Cash shift
        Column(
            Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(22.dp))
                .background(cs.surface)
                .border(1.dp, cs.outline.copy(alpha = 0.35f), RoundedCornerShape(22.dp))
                .padding(16.dp),
        ) {
            Text("Μετρητά βάρδιας", style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.SemiBold)
            Spacer(Modifier.height(4.dp))
            Text(
                "€${"%.2f".format(cash)} / €${"%.0f".format(cap)}",
                style = MaterialTheme.typography.headlineSmall,
                color = if (state.cashCapped) cs.error else cs.onSurface,
            )
            Spacer(Modifier.height(10.dp))
            LinearProgressIndicator(
                progress = { cashPct },
                modifier = Modifier.fillMaxWidth().height(8.dp).clip(RoundedCornerShape(4.dp)),
                color = if (state.cashCapped) cs.error else FreshGreen,
                trackColor = cs.outline.copy(alpha = 0.25f),
            )
            if (state.cashCapped) {
                Spacer(Modifier.height(8.dp))
                Text(
                    "Έφτασες το όριο — χωρίς νέες προσφορές μέχρι παράδοση μετρητών.",
                    color = cs.error,
                    style = MaterialTheme.typography.bodySmall,
                )
            }
        }

        Spacer(Modifier.height(18.dp))
        Text("Παραδόσεις", style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.SemiBold)
        Spacer(Modifier.height(8.dp))
        val earnings = money?.earnings.orEmpty()
        if (earnings.isEmpty()) {
            EmptyHint("Δεν υπάρχουν ακόμα παραδόσεις.")
        } else {
            earnings.take(20).forEach { e ->
                Row(
                    Modifier
                        .fillMaxWidth()
                        .padding(vertical = 8.dp)
                        .clip(RoundedCornerShape(14.dp))
                        .background(cs.surface)
                        .padding(horizontal = 14.dp, vertical = 12.dp),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Column {
                        Text(e.created_at?.take(16)?.replace('T', ' ') ?: e.id.take(8), style = MaterialTheme.typography.bodyMedium)
                        val parts = buildList {
                            e.base_pay?.takeIf { it > 0 }?.let { add("βάση €${"%.2f".format(it)}") }
                            e.tip?.takeIf { it > 0 }?.let { add("tip €${"%.2f".format(it)}") }
                            e.bonus?.takeIf { it > 0 }?.let { add("bonus €${"%.2f".format(it)}") }
                        }
                        if (parts.isNotEmpty()) {
                            Text(parts.joinToString(" · "), style = MaterialTheme.typography.labelSmall, color = cs.onSurfaceVariant)
                        }
                    }
                    Text(
                        "€${"%.2f".format(e.total ?: 0.0)}",
                        color = FreshGreen,
                        fontWeight = FontWeight.Bold,
                        style = MaterialTheme.typography.titleMedium,
                    )
                }
            }
        }

        Spacer(Modifier.height(18.dp))
        Text("Κινήσεις πορτοφολιού", style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.SemiBold)
        Spacer(Modifier.height(8.dp))
        val txs = money?.transactions.orEmpty()
        if (txs.isEmpty()) {
            EmptyHint("Καμία κίνηση ακόμα.")
        } else {
            txs.take(20).forEach { tx ->
                Row(
                    Modifier
                        .fillMaxWidth()
                        .padding(vertical = 6.dp)
                        .clip(RoundedCornerShape(14.dp))
                        .background(cs.surface)
                        .padding(horizontal = 14.dp, vertical = 12.dp),
                    horizontalArrangement = Arrangement.SpaceBetween,
                ) {
                    Column(Modifier.weight(1f)) {
                        Text(tx.description ?: tx.type, style = MaterialTheme.typography.bodyMedium)
                        Text(
                            listOfNotNull(tx.status, tx.created_at?.take(10)).joinToString(" · "),
                            style = MaterialTheme.typography.labelSmall,
                            color = cs.onSurfaceVariant,
                        )
                    }
                    Text(
                        "€${"%.2f".format(tx.amount)}",
                        fontWeight = FontWeight.SemiBold,
                        color = if (tx.amount >= 0) FreshGreen else cs.error,
                    )
                }
            }
        }
        Spacer(Modifier.height(24.dp))
    }
}

@Composable
private fun StatMini(
    icon: @Composable () -> Unit,
    label: String,
    value: String,
    sub: String,
    modifier: Modifier = Modifier,
) {
    val cs = MaterialTheme.colorScheme
    Column(
        modifier
            .clip(RoundedCornerShape(20.dp))
            .background(cs.surface)
            .border(1.dp, cs.outline.copy(alpha = 0.3f), RoundedCornerShape(20.dp))
            .padding(14.dp),
    ) {
        icon()
        Spacer(Modifier.height(8.dp))
        Text(label, style = MaterialTheme.typography.labelMedium, color = cs.onSurfaceVariant)
        Text(value, style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.Bold)
        Text(sub, style = MaterialTheme.typography.labelSmall, color = cs.onSurfaceVariant)
    }
}

@Composable
private fun EmptyHint(text: String) {
    Text(
        text,
        color = MaterialTheme.colorScheme.onSurfaceVariant,
        style = MaterialTheme.typography.bodyMedium,
        modifier = Modifier.padding(vertical = 8.dp),
    )
}
