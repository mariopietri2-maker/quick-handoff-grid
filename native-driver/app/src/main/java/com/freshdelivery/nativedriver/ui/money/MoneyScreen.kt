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
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.AccountBalanceWallet
import androidx.compose.material.icons.outlined.Info
import androidx.compose.material.icons.outlined.Payments
import androidx.compose.material.icons.outlined.Refresh
import androidx.compose.material.icons.outlined.Today
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
    onRefresh: () -> Unit,
) {
    val money = state.money
    val earningsBalance = money?.wallet?.available_balance ?: 0.0
    val pending = money?.wallet?.pending_balance ?: 0.0
    val customerCash = state.cashBalance
    val cashCap = state.maxCashCap
    val cashPct = ((customerCash / cashCap.coerceAtLeast(1.0))).toFloat().coerceIn(0f, 1f)
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

        Spacer(Modifier.height(6.dp))
        Text(
            "Δύο ξεχωριστά ποσά: τα κέρδη σου και τα μετρητά που εισέπραξες από πελάτες.",
            style = MaterialTheme.typography.bodySmall,
            color = cs.onSurfaceVariant,
        )

        // ═══════════════════════════════════════════════════════════
        // 1) DRIVER EARNINGS (wallet — yours to withdraw)
        // ═══════════════════════════════════════════════════════════
        Spacer(Modifier.height(16.dp))
        SectionLabel("Κέρδη οδηγού", "Δικά σου — μπορείς να κάνεις ανάληψη")

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
                    Text(
                        "Διαθέσιμο για ανάληψη",
                        color = Color.White.copy(alpha = 0.85f),
                        style = MaterialTheme.typography.labelLarge,
                    )
                }
                Spacer(Modifier.height(8.dp))
                Text(
                    "€${"%.2f".format(earningsBalance)}",
                    style = MaterialTheme.typography.displaySmall,
                    color = Color.White,
                    fontWeight = FontWeight.Bold,
                )
                if (pending > 0) {
                    Text(
                        "+€${"%.2f".format(pending)} εκκρεμεί (δεν είναι ακόμα διαθέσιμο)",
                        color = Color.White.copy(alpha = 0.75f),
                        style = MaterialTheme.typography.bodySmall,
                    )
                }
                if (earningsBalance < 10) {
                    Spacer(Modifier.height(14.dp))
                    Text(
                        "Ελάχιστο €10 για ανάληψη",
                        color = Color.White.copy(alpha = 0.7f),
                        style = MaterialTheme.typography.labelSmall,
                    )
                }
            }
        }

        Spacer(Modifier.height(12.dp))
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
                sub = "συνολικά κέρδη",
                modifier = Modifier.weight(1f),
            )
        }

        Spacer(Modifier.height(16.dp))
        Text("Ιστορικό κερδών", style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.SemiBold)
        Spacer(Modifier.height(8.dp))
        val earnings = money?.earnings.orEmpty()
        if (earnings.isEmpty()) {
            EmptyHint("Δεν υπάρχουν ακόμα κέρδη από παραδόσεις.")
        } else {
            earnings.take(20).forEach { e ->
                Row(
                    Modifier
                        .fillMaxWidth()
                        .padding(vertical = 4.dp)
                        .clip(RoundedCornerShape(14.dp))
                        .background(cs.surface)
                        .border(1.dp, cs.outline.copy(alpha = 0.25f), RoundedCornerShape(14.dp))
                        .padding(horizontal = 14.dp, vertical = 12.dp),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Column(Modifier.weight(1f)) {
                        Text(
                            e.created_at?.take(16)?.replace('T', ' ') ?: e.id.take(8),
                            style = MaterialTheme.typography.bodyMedium,
                        )
                        val parts = buildList {
                            e.base_pay?.takeIf { it > 0 }?.let { add("βάση €${"%.2f".format(it)}") }
                            e.tip?.takeIf { it > 0 }?.let { add("tip €${"%.2f".format(it)}") }
                            e.bonus?.takeIf { it > 0 }?.let { add("bonus €${"%.2f".format(it)}") }
                        }
                        if (parts.isNotEmpty()) {
                            Text(
                                parts.joinToString(" · "),
                                style = MaterialTheme.typography.labelSmall,
                                color = cs.onSurfaceVariant,
                            )
                        }
                    }
                    Text(
                        "+€${"%.2f".format(e.total ?: 0.0)}",
                        color = FreshGreen,
                        fontWeight = FontWeight.Bold,
                        style = MaterialTheme.typography.titleMedium,
                    )
                }
            }
        }

        Spacer(Modifier.height(14.dp))
        Text("Κινήσεις πορτοφολιού", style = MaterialTheme.typography.titleSmall, fontWeight = FontWeight.SemiBold)
        Spacer(Modifier.height(6.dp))
        val txs = money?.transactions.orEmpty()
        if (txs.isEmpty()) {
            EmptyHint("Καμία κίνηση πορτοφολιού.")
        } else {
            txs.take(15).forEach { tx ->
                Row(
                    Modifier
                        .fillMaxWidth()
                        .padding(vertical = 3.dp)
                        .clip(RoundedCornerShape(12.dp))
                        .background(cs.surface)
                        .padding(horizontal = 12.dp, vertical = 10.dp),
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

        // ═══════════════════════════════════════════════════════════
        // 2) CUSTOMER CASH (held — not yours)
        // ═══════════════════════════════════════════════════════════
        Spacer(Modifier.height(28.dp))
        SectionLabel("Μετρητά πελατών", "Είσπραξη — δεν είναι δικά σου κέρδη")

        Column(
            Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(24.dp))
                .background(cs.surface)
                .border(
                    width = 1.5.dp,
                    color = if (state.cashCapped) cs.error.copy(alpha = 0.55f) else FreshAmber.copy(alpha = 0.45f),
                    shape = RoundedCornerShape(24.dp),
                )
                .padding(18.dp),
        ) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Icon(
                    Icons.Outlined.Payments,
                    contentDescription = null,
                    tint = if (state.cashCapped) cs.error else FreshAmber,
                    modifier = Modifier.size(22.dp),
                )
                Spacer(Modifier.size(8.dp))
                Text(
                    "Μετρητά στη βάρδια",
                    style = MaterialTheme.typography.titleMedium,
                    fontWeight = FontWeight.SemiBold,
                )
            }
            Spacer(Modifier.height(8.dp))
            Text(
                "€${"%.2f".format(customerCash)}",
                style = MaterialTheme.typography.headlineLarge,
                fontWeight = FontWeight.Bold,
                color = if (state.cashCapped) cs.error else cs.onSurface,
            )
            Text(
                "Όριο €${"%.0f".format(cashCap)}",
                style = MaterialTheme.typography.bodySmall,
                color = cs.onSurfaceVariant,
            )
            Spacer(Modifier.height(12.dp))
            LinearProgressIndicator(
                progress = { cashPct },
                modifier = Modifier.fillMaxWidth().height(10.dp).clip(RoundedCornerShape(5.dp)),
                color = if (state.cashCapped) cs.error else FreshAmber,
                trackColor = cs.outline.copy(alpha = 0.25f),
            )
            Spacer(Modifier.height(12.dp))
            Row(
                Modifier
                    .fillMaxWidth()
                    .clip(RoundedCornerShape(14.dp))
                    .background(
                        if (state.cashCapped) cs.error.copy(alpha = 0.12f)
                        else FreshAmber.copy(alpha = 0.12f),
                    )
                    .padding(12.dp),
                verticalAlignment = Alignment.Top,
            ) {
                Icon(
                    Icons.Outlined.Info,
                    contentDescription = null,
                    tint = if (state.cashCapped) cs.error else FreshAmber,
                    modifier = Modifier.size(18.dp),
                )
                Spacer(Modifier.size(8.dp))
                Text(
if (state.cashCapped) {
                        "Έφτασες το όριο μετρητών στη βάρδια. Δεν θα λαμβάνεις νέες Cash προσφορές μέχρι να δηλώσεις στο app ότι τα μετρητά είναι πλέον δικά σου (τέλος βάρδιας)."
                    } else {
                        "Αυτά είναι μετρητά που πλήρωσαν οι πελάτες στις παραδόσεις Cash — τα κρατάς εσύ. Δεν μπαίνουν στον λογαριασμό των κερδών και δεν δίνεις τίποτα στο κατάστημα."
                    },
                    style = MaterialTheme.typography.bodySmall,
                    color = if (state.cashCapped) cs.error else cs.onSurface,
                )
            }
        }

        Spacer(Modifier.height(28.dp))
    }
}

@Composable
private fun SectionLabel(title: String, subtitle: String) {
    Text(title, style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.Bold)
    Text(
        subtitle,
        style = MaterialTheme.typography.bodySmall,
        color = MaterialTheme.colorScheme.onSurfaceVariant,
        modifier = Modifier.padding(bottom = 10.dp, top = 2.dp),
    )
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
