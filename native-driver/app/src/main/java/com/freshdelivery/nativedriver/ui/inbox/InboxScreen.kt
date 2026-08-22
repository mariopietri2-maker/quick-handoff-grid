package com.freshdelivery.nativedriver.ui.inbox

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
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.Campaign
import androidx.compose.material.icons.outlined.NotificationsNone
import androidx.compose.material.icons.outlined.Refresh
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.freshdelivery.nativedriver.data.DriverNotificationRow
import com.freshdelivery.nativedriver.data.SupportTicketRow
import com.freshdelivery.nativedriver.ui.DriverUiState
import com.freshdelivery.nativedriver.ui.theme.FreshAmber
import com.freshdelivery.nativedriver.ui.theme.FreshGreen

/**
 * Inbox = news & announcements from admin.
 * Support tickets live under headphones (SupportCenter).
 */
@Composable
fun InboxScreen(
    state: DriverUiState,
    onMarkRead: (String) -> Unit,
    onRefresh: () -> Unit,
    onOpenSupport: () -> Unit,
    onOpenTicket: (SupportTicketRow) -> Unit,
) {
    var expanded by remember { mutableStateOf<String?>(null) }
    val cs = MaterialTheme.colorScheme
    val notifications = state.notifications
    val unread = notifications.count { it.read_at == null }

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
            Column {
                Text(
                    "Νέα",
                    style = MaterialTheme.typography.headlineMedium,
                    fontWeight = FontWeight.Bold,
                )
                Text(
                    when {
                        unread > 0 -> "$unread αδιάβαστα από το admin"
                        notifications.isEmpty() -> "Ανακοινώσεις από την ομάδα"
                        else -> "Όλα διαβασμένα"
                    },
                    color = cs.onSurfaceVariant,
                    style = MaterialTheme.typography.bodyMedium,
                )
            }
            IconButton(onClick = onRefresh) {
                Icon(Icons.Outlined.Refresh, contentDescription = "Ανανέωση")
            }
        }

        Spacer(Modifier.height(14.dp))

        // Unread summary chip
        if (unread > 0) {
            Row(
                Modifier
                    .fillMaxWidth()
                    .clip(RoundedCornerShape(14.dp))
                    .background(
                        Brush.linearGradient(
                            listOf(Color(0xFF00A854), Color(0xFF007A3D)),
                        ),
                    )
                    .padding(horizontal = 14.dp, vertical = 12.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Icon(
                    Icons.Outlined.Campaign,
                    contentDescription = null,
                    tint = Color.White,
                    modifier = Modifier.size(22.dp),
                )
                Spacer(Modifier.size(10.dp))
                Text(
                    if (unread == 1) "1 νέο μήνυμα από το admin"
                    else "$unread νέα μηνύματα από το admin",
                    color = Color.White,
                    fontWeight = FontWeight.SemiBold,
                    fontSize = 14.sp,
                )
            }
            Spacer(Modifier.height(14.dp))
        }

        if (notifications.isEmpty()) {
            EmptyNewsCard()
        } else {
            notifications.forEach { n ->
                NewsCard(
                    notification = n,
                    expanded = expanded == n.id,
                    onToggle = {
                        expanded = if (expanded == n.id) null else n.id
                        if (n.read_at == null) onMarkRead(n.id)
                    },
                )
                Spacer(Modifier.height(8.dp))
            }
        }

        Spacer(Modifier.height(24.dp))
    }
}

@Composable
private fun NewsCard(
    notification: DriverNotificationRow,
    expanded: Boolean,
    onToggle: () -> Unit,
) {
    val cs = MaterialTheme.colorScheme
    val isUnread = notification.read_at == null
    val sev = notification.severity?.lowercase()
    val sevColor = when (sev) {
        "critical", "error", "high" -> cs.error
        "warning" -> FreshAmber
        else -> FreshGreen
    }
    val sevLabel = when (sev) {
        "critical", "error", "high" -> "Σημαντικό"
        "warning" -> "Προσοχή"
        else -> "Νέα"
    }

    Column(
        Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(18.dp))
            .background(cs.surface)
            .border(
                width = if (isUnread) 1.5.dp else 1.dp,
                color = if (isUnread) sevColor.copy(alpha = 0.5f) else cs.outline.copy(alpha = 0.25f),
                shape = RoundedCornerShape(18.dp),
            )
            .clickable(onClick = onToggle)
            .padding(14.dp),
    ) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            // Admin badge
            Box(
                Modifier
                    .size(40.dp)
                    .background(sevColor.copy(alpha = 0.15f), RoundedCornerShape(12.dp)),
                contentAlignment = Alignment.Center,
            ) {
                Icon(
                    Icons.Outlined.Campaign,
                    contentDescription = null,
                    tint = sevColor,
                    modifier = Modifier.size(20.dp),
                )
            }
            Spacer(Modifier.size(12.dp))
            Column(Modifier.weight(1f)) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    if (isUnread) {
                        Box(
                            Modifier
                                .size(8.dp)
                                .clip(CircleShape)
                                .background(sevColor),
                        )
                        Spacer(Modifier.size(6.dp))
                    }
                    Text(
                        notification.title ?: "Ανακοίνωση",
                        fontWeight = if (isUnread) FontWeight.Bold else FontWeight.SemiBold,
                        style = MaterialTheme.typography.titleSmall,
                        maxLines = 2,
                    )
                }
                Spacer(Modifier.height(2.dp))
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Text(
                        sevLabel,
                        fontSize = 11.sp,
                        fontWeight = FontWeight.SemiBold,
                        color = sevColor,
                    )
                    Text(" · ", color = cs.onSurfaceVariant, fontSize = 11.sp)
                    Text(
                        formatNewsDate(notification.created_at),
                        style = MaterialTheme.typography.labelSmall,
                        color = cs.onSurfaceVariant,
                    )
                    Text(" · Admin", style = MaterialTheme.typography.labelSmall, color = cs.onSurfaceVariant)
                }
            }
        }

        val body = notification.body
        if (!body.isNullOrBlank()) {
            Spacer(Modifier.height(10.dp))
            if (expanded) {
                Text(
                    body,
                    style = MaterialTheme.typography.bodyMedium,
                    color = cs.onSurface,
                    lineHeight = 20.sp,
                )
            } else {
                Text(
                    body.take(110) + if (body.length > 110) "…" else "",
                    style = MaterialTheme.typography.bodySmall,
                    color = cs.onSurfaceVariant,
                    lineHeight = 18.sp,
                )
            }
        }
    }
}

@Composable
private fun EmptyNewsCard() {
    val cs = MaterialTheme.colorScheme
    Column(
        Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(20.dp))
            .background(cs.surface)
            .border(1.dp, cs.outline.copy(alpha = 0.25f), RoundedCornerShape(20.dp))
            .padding(28.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        Icon(
            Icons.Outlined.NotificationsNone,
            contentDescription = null,
            tint = cs.onSurfaceVariant,
            modifier = Modifier.size(40.dp),
        )
        Spacer(Modifier.height(12.dp))
        Text(
            "Δεν υπάρχουν νέα",
            style = MaterialTheme.typography.titleMedium,
            fontWeight = FontWeight.SemiBold,
        )
        Spacer(Modifier.height(4.dp))
        Text(
            "Όταν το admin στείλει ανακοίνωση, θα εμφανιστεί εδώ.",
            color = cs.onSurfaceVariant,
            style = MaterialTheme.typography.bodyMedium,
        )
    }
}

private fun formatNewsDate(iso: String?): String {
    if (iso.isNullOrBlank()) return ""
    return try {
        val cleaned = iso.replace('T', ' ').take(16)
        // "2026-08-22 14:32" → "22/08 · 14:32"
        val datePart = cleaned.take(10)
        val timePart = cleaned.drop(11).take(5)
        val parts = datePart.split("-")
        if (parts.size == 3) {
            "${parts[2]}/${parts[1]} · $timePart"
        } else {
            cleaned
        }
    } catch (_: Exception) {
        iso.take(10)
    }
}
