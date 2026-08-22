package com.freshdelivery.nativedriver.ui.money

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
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.freshdelivery.nativedriver.data.EarningRow
import com.freshdelivery.nativedriver.ui.DriverUiState
import com.freshdelivery.nativedriver.ui.theme.FreshAmber
import com.freshdelivery.nativedriver.ui.theme.FreshGreen
import java.time.Instant
import java.time.LocalDate
import java.time.ZoneId
import java.time.format.DateTimeFormatter

private enum class MoneyPeriod { Today, Week, All }

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

    var period by remember { mutableIntStateOf(0) } // 0=Today, 1=Week, 2=All

    val allEarnings = money?.earnings.orEmpty()
    val filtered = remember(allEarnings, period) {
        filterEarnings(allEarnings, MoneyPeriod.entries[period.coerceIn(0, 2)])
    }

    Column(
        Modifier
            .fillMaxSize()
            .background(cs.background)
            .verticalScroll(rememberScrollState())
            .padding(16.dp),
    ) {
        // Header
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

        // ── Hero: available balance (no withdraw button) ──
        Box(
            Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(24.dp))
                .background(
                    Brush.linearGradient(
                        listOf(Color(0xFF00A854), Color(0xFF007A3D)),
                    ),
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
                    Spacer(Modifier.size(8.dp))
                    Text(
                        "Διαθέσιμο για ανάληψη",
                        color = Color.White.copy(alpha = 0.85f),
                        style = MaterialTheme.typography.labelLarge,
                    )
                }
                Spacer(Modifier.height(6.dp))
                Text(
                    "€${"%.2f".format(earningsBalance)}",
                    style = MaterialTheme.typography.displaySmall,
                    color = Color.White,
                    fontWeight = FontWeight.Bold,
                )
                if (pending > 0) {
                    Spacer(Modifier.height(2.dp))
                    Text(
                        "+€${"%.2f".format(pending)} εκκρεμεί",
                        color = Color.White.copy(alpha = 0.75f),
                        style = MaterialTheme.typography.bodySmall,
                    )
                }
            }
        }

        Spacer(Modifier.height(12.dp))

        // ── Customer cash ──
        Column(
            Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(20.dp))
                .background(cs.surface)
                .border(
                    width = 1.5.dp,
                    color = if (state.cashCapped) cs.error.copy(alpha = 0.55f) else FreshAmber.copy(alpha = 0.45f),
                    shape = RoundedCornerShape(20.dp),
                )
                .padding(16.dp),
        ) {
            Row(
                Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Icon(
                        Icons.Outlined.Payments,
                        contentDescription = null,
                        tint = if (state.cashCapped) cs.error else FreshAmber,
                        modifier = Modifier.size(20.dp),
                    )
                    Spacer(Modifier.size(8.dp))
                    Text(
                        "Μετρητά πελατών",
                        style = MaterialTheme.typography.titleSmall,
                        fontWeight = FontWeight.SemiBold,
                        color = if (state.cashCapped) cs.error else FreshAmber,
                    )
                }
                Text(
                    "€${"%.2f".format(customerCash)} / €${"%.0f".format(cashCap)}",
                    style = MaterialTheme.typography.titleMedium,
                    fontWeight = FontWeight.Bold,
                    color = if (state.cashCapped) cs.error else cs.onSurface,
                )
            }
            Spacer(Modifier.height(10.dp))
            LinearProgressIndicator(
                progress = { cashPct },
                modifier = Modifier
                    .fillMaxWidth()
                    .height(8.dp)
                    .clip(RoundedCornerShape(4.dp)),
                color = if (state.cashCapped) cs.error else FreshAmber,
                trackColor = cs.outline.copy(alpha = 0.25f),
            )
            Spacer(Modifier.height(10.dp))
            Row(
                Modifier
                    .fillMaxWidth()
                    .clip(RoundedCornerShape(12.dp))
                    .background(
                        if (state.cashCapped) cs.error.copy(alpha = 0.12f)
                        else FreshAmber.copy(alpha = 0.12f),
                    )
                    .padding(10.dp),
                verticalAlignment = Alignment.Top,
            ) {
                Icon(
                    Icons.Outlined.Info,
                    contentDescription = null,
                    tint = if (state.cashCapped) cs.error else FreshAmber,
                    modifier = Modifier.size(16.dp),
                )
                Spacer(Modifier.size(8.dp))
                Text(
                    if (state.cashCapped) {
                        "Έφτασες το όριο μετρητών. Δεν θα λαμβάνεις νέες Cash προσφορές μέχρι τέλος βάρδιας."
                    } else {
                        "Μετρητά από Cash παραδόσεις — δεν είναι δικά σου κέρδη."
                    },
                    style = MaterialTheme.typography.bodySmall,
                    color = if (state.cashCapped) cs.error else cs.onSurface,
                )
            }
        }

        Spacer(Modifier.height(16.dp))

        // ── Period segmented control ──
        Row(
            Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(12.dp))
                .background(cs.surface)
                .border(1.dp, cs.outline.copy(alpha = 0.25f), RoundedCornerShape(12.dp))
                .padding(3.dp),
        ) {
            listOf("Σήμερα", "Εβδομάδα", "Όλα").forEachIndexed { i, label ->
                val selected = period == i
                Box(
                    Modifier
                        .weight(1f)
                        .clip(RoundedCornerShape(10.dp))
                        .background(if (selected) FreshGreen else Color.Transparent)
                        .clickable { period = i }
                        .padding(vertical = 10.dp),
                    contentAlignment = Alignment.Center,
                ) {
                    Text(
                        label,
                        style = MaterialTheme.typography.labelLarge,
                        fontWeight = if (selected) FontWeight.Bold else FontWeight.Medium,
                        color = if (selected) Color.White else cs.onSurfaceVariant,
                    )
                }
            }
        }

        // Period summary chips
        Spacer(Modifier.height(10.dp))
        val periodTotal = filtered.sumOf { it.total ?: 0.0 }
        Row(
            Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.spacedBy(8.dp),
        ) {
            SummaryChip(
                label = when (period) {
                    0 -> "Σήμερα"
                    1 -> "Εβδομάδα"
                    else -> "Σύνολο"
                },
                value = "€${"%.2f".format(if (period == 0) money?.todayTotal ?: periodTotal else if (period == 1) money?.weekTotal ?: periodTotal else periodTotal)}",
                modifier = Modifier.weight(1f),
            )
            SummaryChip(
                label = "Παραδόσεις",
                value = "${if (period == 0) money?.todayTrips ?: filtered.size else filtered.size}",
                modifier = Modifier.weight(1f),
            )
        }

        Spacer(Modifier.height(14.dp))

        // ── Earnings feed ──
        if (filtered.isEmpty()) {
            Text(
                "Δεν υπάρχουν κέρδη για αυτή την περίοδο.",
                color = cs.onSurfaceVariant,
                style = MaterialTheme.typography.bodyMedium,
                modifier = Modifier.padding(vertical = 16.dp),
            )
        } else {
            filtered.forEach { e ->
                EarningFeedCard(e)
                Spacer(Modifier.height(8.dp))
            }
        }

        Spacer(Modifier.height(24.dp))
    }
}

@Composable
private fun SummaryChip(
    label: String,
    value: String,
    modifier: Modifier = Modifier,
) {
    val cs = MaterialTheme.colorScheme
    Column(
        modifier
            .clip(RoundedCornerShape(14.dp))
            .background(cs.surface)
            .border(1.dp, cs.outline.copy(alpha = 0.25f), RoundedCornerShape(14.dp))
            .padding(horizontal = 14.dp, vertical = 10.dp),
    ) {
        Text(label, style = MaterialTheme.typography.labelSmall, color = cs.onSurfaceVariant)
        Text(value, style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold)
    }
}

@Composable
private fun EarningFeedCard(e: EarningRow) {
    val cs = MaterialTheme.colorScheme
    val timeLabel = formatEarningTime(e.created_at)
    val idShort = e.order_id?.takeLast(6)?.uppercase() ?: e.id.take(8)

    val parts = buildList {
        e.base_pay?.takeIf { it > 0 }?.let { add("βάση €${"%.2f".format(it)}") }
        e.tip?.takeIf { it > 0 }?.let { add("tip €${"%.2f".format(it)}") }
        e.bonus?.takeIf { it > 0 }?.let { add("bonus €${"%.2f".format(it)}") }
    }

    Column(
        Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(14.dp))
            .background(cs.surface)
            .border(1.dp, cs.outline.copy(alpha = 0.25f), RoundedCornerShape(14.dp))
            .padding(horizontal = 14.dp, vertical = 12.dp),
    ) {
        Row(
            Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Text(
                "$timeLabel · #$idShort",
                style = MaterialTheme.typography.bodyMedium,
                fontWeight = FontWeight.Medium,
            )
            Text(
                "+€${"%.2f".format(e.total ?: 0.0)}",
                color = FreshGreen,
                fontWeight = FontWeight.Bold,
                style = MaterialTheme.typography.titleMedium,
            )
        }
        if (parts.isNotEmpty()) {
            Spacer(Modifier.height(4.dp))
            Text(
                parts.joinToString(" + "),
                style = MaterialTheme.typography.labelSmall,
                color = cs.onSurfaceVariant,
            )
        }
    }
}

private fun formatEarningTime(iso: String?): String {
    if (iso.isNullOrBlank()) return "—"
    return try {
        val instant = Instant.parse(iso.replace(' ', 'T').let {
            if (it.endsWith("Z") || it.contains('+')) it else it + "Z"
        }.take(19).let { s ->
            // tolerate "2026-08-22T14:32:00" or with Z
            if (s.length >= 19) Instant.parse(s.take(19) + "Z") else Instant.parse(iso)
        })
        val zoned = instant.atZone(ZoneId.systemDefault())
        zoned.format(DateTimeFormatter.ofPattern("HH:mm"))
    } catch (_: Exception) {
        iso.take(16).replace('T', ' ').takeLast(5)
    }
}

private fun filterEarnings(list: List<EarningRow>, period: MoneyPeriod): List<EarningRow> {
    if (period == MoneyPeriod.All) return list
    val zone = ZoneId.systemDefault()
    val today = LocalDate.now(zone)
    val weekStart = today.minusDays(6)
    return list.filter { e ->
        val d = parseEarningDate(e.created_at, zone) ?: return@filter period == MoneyPeriod.All
        when (period) {
            MoneyPeriod.Today -> d == today
            MoneyPeriod.Week -> !d.isBefore(weekStart) && !d.isAfter(today)
            MoneyPeriod.All -> true
        }
    }
}

private fun parseEarningDate(iso: String?, zone: ZoneId): LocalDate? {
    if (iso.isNullOrBlank()) return null
    return try {
        val cleaned = iso.replace(' ', 'T')
        val instant = try {
            Instant.parse(if (cleaned.endsWith("Z") || '+' in cleaned) cleaned else cleaned.take(19) + "Z")
        } catch (_: Exception) {
            Instant.parse(cleaned.take(19) + "Z")
        }
        instant.atZone(zone).toLocalDate()
    } catch (_: Exception) {
        null
    }
}
