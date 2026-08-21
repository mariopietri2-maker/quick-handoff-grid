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
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.AccountBalanceWallet
import androidx.compose.material.icons.outlined.LocalAtm
import androidx.compose.material.icons.outlined.Payments
import androidx.compose.material.icons.outlined.Refresh
import androidx.compose.material.icons.outlined.Schedule
import androidx.compose.material.icons.outlined.Today
import androidx.compose.material3.HorizontalDivider
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
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.freshdelivery.nativedriver.data.EarningRow
import com.freshdelivery.nativedriver.ui.DriverUiState
import com.freshdelivery.nativedriver.ui.theme.FreshAmber
import com.freshdelivery.nativedriver.ui.theme.FreshGreen
import com.freshdelivery.nativedriver.ui.theme.FreshGreenBright

/**
 * Simple driver money overview:
 * 1) Available balance (hero)
 * 2) Today / Week / Pending
 * 3) Customer cash you are holding (cap progress)
 * 4) Recent trips
 */
@Composable
fun MoneyScreen(
    state: DriverUiState,
    onRefresh: () -> Unit,
) {
    val money = state.money
    val available = money?.wallet?.available_balance ?: 0.0
    val pending = money?.wallet?.pending_balance ?: 0.0
    val today = money?.todayTotal ?: 0.0
    val week = money?.weekTotal ?: 0.0
    val todayTrips = money?.todayTrips ?: 0
    val cashHeld = state.cashBalance
    val cashCap = state.maxCashCap.coerceAtLeast(1.0)
    val cashPct = (cashHeld / cashCap).toFloat().coerceIn(0f, 1f)
    val recent = (money?.earnings ?: emptyList()).take(12)
    val cs = MaterialTheme.colorScheme

    Column(
        Modifier
            .fillMaxSize()
            .background(cs.background)
            .verticalScroll(rememberScrollState())
            .padding(horizontal = 16.dp, vertical = 12.dp),
    ) {
        // Header
        Row(
            Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Column {
                Text("Κέρδη", style = MaterialTheme.typography.headlineMedium, fontWeight = FontWeight.Bold)
                Text(
                    "Τι έχεις βγάλει και τι κρατάς σε μετρητά",
                    style = MaterialTheme.typography.bodySmall,
                    color = cs.onSurfaceVariant,
                )
            }
            IconButton(onClick = onRefresh) {
                Icon(Icons.Outlined.Refresh, contentDescription = "Ανανέωση")
            }
        }

        Spacer(Modifier.height(16.dp))

        // Hero: available
        Box(
            Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(24.dp))
                .background(
                    Brush.linearGradient(listOf(Color(0xFF059669), Color(0xFF047857))),
                )
                .padding(20.dp),
        ) {
            Column {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Icon(
                        Icons.Outlined.AccountBalanceWallet,
                        contentDescription = null,
                        tint = Color.White.copy(alpha = 0.9f),
                        modifier = Modifier.size(20.dp),
                    )
                    Spacer(Modifier.width(8.dp))
                    Text(
                        "Διαθέσιμο για ανάληψη",
                        color = Color.White.copy(alpha = 0.9f),
                        fontSize = 13.sp,
                        fontWeight = FontWeight.Medium,
                    )
                }
                Spacer(Modifier.height(8.dp))
                Text(
                    "€${"%.2f".format(available)}",
                    color = Color.White,
                    fontSize = 36.sp,
                    fontWeight = FontWeight.ExtraBold,
                )
                if (pending > 0.009) {
                    Spacer(Modifier.height(4.dp))
                    Text(
                        "€${"%.2f".format(pending)} σε εκκρεμότητα",
                        color = Color.White.copy(alpha = 0.8f),
                        fontSize = 13.sp,
                    )
                } else {
                    Spacer(Modifier.height(4.dp))
                    Text(
                        if (available >= 10) "Μπορείς να ζητήσεις ανάληψη"
                        else "Ελάχιστο ανάληψης €10",
                        color = Color.White.copy(alpha = 0.75f),
                        fontSize = 12.sp,
                    )
                }
            }
        }

        Spacer(Modifier.height(14.dp))

        // Stats row
        Row(
            Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.spacedBy(10.dp),
        ) {
            StatCard(
                icon = Icons.Outlined.Today,
                label = "Σήμερα",
                value = "€${"%.2f".format(today)}",
                hint = "$todayTrips παραδόσεις",
                accent = FreshGreen,
                modifier = Modifier.weight(1f),
            )
            StatCard(
                icon = Icons.Outlined.Payments,
                label = "Εβδομάδα",
                value = "€${"%.2f".format(week)}",
                hint = "σύνολο 7 ημερών",
                accent = FreshAmber,
                modifier = Modifier.weight(1f),
            )
        }

        Spacer(Modifier.height(18.dp))

        // Cash held
        Text("Μετρητά που κρατάς", fontWeight = FontWeight.Bold, fontSize = 17.sp)
        Spacer(Modifier.height(4.dp))
        Text(
            "Από παραδόσεις με πληρωμή μετρητά — μένουν σε εσένα, δεν μπαίνουν στα κέρδη.",
            style = MaterialTheme.typography.bodySmall,
            color = cs.onSurfaceVariant,
        )
        Spacer(Modifier.height(10.dp))
        Column(
            Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(18.dp))
                .background(cs.surface)
                .border(
                    1.dp,
                    if (state.cashCapped) cs.error.copy(alpha = 0.5f) else cs.outline.copy(alpha = 0.25f),
                    RoundedCornerShape(18.dp),
                )
                .padding(16.dp),
        ) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Box(
                    Modifier
                        .size(40.dp)
                        .clip(CircleShape)
                        .background(
                            if (state.cashCapped) cs.error.copy(alpha = 0.15f)
                            else FreshAmber.copy(alpha = 0.15f),
                        ),
                    contentAlignment = Alignment.Center,
                ) {
                    Icon(
                        Icons.Outlined.LocalAtm,
                        contentDescription = null,
                        tint = if (state.cashCapped) cs.error else FreshAmber,
                        modifier = Modifier.size(22.dp),
                    )
                }
                Spacer(Modifier.width(12.dp))
                Column(Modifier.weight(1f)) {
                    Text(
                        "€${"%.2f".format(cashHeld)}",
                        fontWeight = FontWeight.Bold,
                        fontSize = 20.sp,
                    )
                    Text(
                        "όριο €${"%.0f".format(cashCap)}",
                        style = MaterialTheme.typography.labelMedium,
                        color = cs.onSurfaceVariant,
                    )
                }
                if (state.cashCapped) {
                    Text(
                        "ΟΡΙΟ",
                        color = cs.error,
                        fontWeight = FontWeight.Bold,
                        fontSize = 12.sp,
                    )
                }
            }
            Spacer(Modifier.height(12.dp))
            LinearProgressIndicator(
                progress = { cashPct },
                modifier = Modifier
                    .fillMaxWidth()
                    .height(8.dp)
                    .clip(RoundedCornerShape(4.dp)),
                color = if (state.cashCapped) cs.error else FreshAmber,
                trackColor = cs.outline.copy(alpha = 0.2f),
            )
            if (state.cashCapped) {
                Spacer(Modifier.height(8.dp))
                Text(
                    "Έφτασες το όριο — δεν θα λάβεις νέες παραγγελίες μετρητών μέχρι το τέλος βάρδιας.",
                    style = MaterialTheme.typography.bodySmall,
                    color = cs.error,
                )
            }
        }

        Spacer(Modifier.height(20.dp))

        // Recent trips
        Row(
            Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Text("Τελευταίες παραδόσεις", fontWeight = FontWeight.Bold, fontSize = 17.sp)
            Text(
                "${recent.size}",
                style = MaterialTheme.typography.labelMedium,
                color = cs.onSurfaceVariant,
            )
        }
        Spacer(Modifier.height(10.dp))

        if (recent.isEmpty()) {
            Box(
                Modifier
                    .fillMaxWidth()
                    .clip(RoundedCornerShape(16.dp))
                    .background(cs.surface)
                    .border(1.dp, cs.outline.copy(alpha = 0.2f), RoundedCornerShape(16.dp))
                    .padding(20.dp),
                contentAlignment = Alignment.Center,
            ) {
                Text(
                    "Δεν υπάρχουν ακόμα παραδόσεις.",
                    color = cs.onSurfaceVariant,
                    style = MaterialTheme.typography.bodyMedium,
                )
            }
        } else {
            Column(
                Modifier
                    .fillMaxWidth()
                    .clip(RoundedCornerShape(18.dp))
                    .background(cs.surface)
                    .border(1.dp, cs.outline.copy(alpha = 0.2f), RoundedCornerShape(18.dp)),
            ) {
                recent.forEachIndexed { index, row ->
                    EarningLine(row)
                    if (index < recent.lastIndex) {
                        HorizontalDivider(
                            color = cs.outline.copy(alpha = 0.15f),
                            modifier = Modifier.padding(horizontal = 14.dp),
                        )
                    }
                }
            }
        }

        Spacer(Modifier.height(28.dp))
    }
}

@Composable
private fun StatCard(
    icon: ImageVector,
    label: String,
    value: String,
    hint: String,
    accent: Color,
    modifier: Modifier = Modifier,
) {
    val cs = MaterialTheme.colorScheme
    Column(
        modifier
            .clip(RoundedCornerShape(18.dp))
            .background(cs.surface)
            .border(1.dp, cs.outline.copy(alpha = 0.22f), RoundedCornerShape(18.dp))
            .padding(14.dp),
    ) {
        Icon(icon, contentDescription = null, tint = accent, modifier = Modifier.size(20.dp))
        Spacer(Modifier.height(8.dp))
        Text(label, style = MaterialTheme.typography.labelMedium, color = cs.onSurfaceVariant)
        Text(value, fontWeight = FontWeight.Bold, fontSize = 20.sp)
        Text(hint, style = MaterialTheme.typography.labelSmall, color = cs.onSurfaceVariant)
    }
}

@Composable
private fun EarningLine(row: EarningRow) {
    val cs = MaterialTheme.colorScheme
    val total = row.total ?: 0.0
    val tip = row.tip ?: 0.0
    val base = row.base_pay ?: 0.0
    val whenText = row.created_at?.replace("T", " ")?.take(16) ?: "—"

    Row(
        Modifier
            .fillMaxWidth()
            .padding(horizontal = 14.dp, vertical = 12.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Box(
            Modifier
                .size(36.dp)
                .clip(CircleShape)
                .background(FreshGreen.copy(alpha = 0.12f)),
            contentAlignment = Alignment.Center,
        ) {
            Icon(
                Icons.Outlined.Schedule,
                contentDescription = null,
                tint = FreshGreenBright,
                modifier = Modifier.size(18.dp),
            )
        }
        Spacer(Modifier.width(12.dp))
        Column(Modifier.weight(1f)) {
            Text(
                whenText,
                fontWeight = FontWeight.SemiBold,
                fontSize = 14.sp,
            )
            val parts = buildList {
                if (base > 0) add("βάση €${"%.2f".format(base)}")
                if (tip > 0) add("φιλοδώρημα €${"%.2f".format(tip)}")
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
            "+€${"%.2f".format(total)}",
            fontWeight = FontWeight.Bold,
            color = FreshGreenBright,
            fontSize = 15.sp,
        )
    }
}
