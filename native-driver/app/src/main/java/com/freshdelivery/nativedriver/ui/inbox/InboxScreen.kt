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
import androidx.compose.material.icons.outlined.HeadsetMic
import androidx.compose.material.icons.outlined.MailOutline
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
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.freshdelivery.nativedriver.data.SupportTicketRow
import com.freshdelivery.nativedriver.ui.DriverUiState
import com.freshdelivery.nativedriver.ui.theme.FreshAmber
import com.freshdelivery.nativedriver.ui.theme.FreshGreen

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
    val unread = state.notifications.count { it.read_at == null }

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
            Column {
                Text("Inbox", style = MaterialTheme.typography.headlineMedium, fontWeight = FontWeight.Bold)
                Text(
                    if (unread > 0) "$unread αδιάβαστα" else "Μηνύματα & αιτήματα",
                    color = cs.onSurfaceVariant,
                    style = MaterialTheme.typography.bodyMedium,
                )
            }
            IconButton(onClick = onRefresh) {
                Icon(Icons.Outlined.Refresh, contentDescription = "Ανανέωση")
            }
        }
        Spacer(Modifier.height(14.dp))

        // Support tickets (email-style threads)
        val tickets = state.tickets
        Column(Modifier.fillMaxWidth()) {
            Row(
                Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Text(
                    "Υποστήριξη",
                    style = MaterialTheme.typography.titleSmall,
                    fontWeight = FontWeight.Bold,
                    color = cs.onSurfaceVariant,
                )
                Text(
                    "Νέο αίτημα →",
                    style = MaterialTheme.typography.labelMedium,
                    color = FreshGreen,
                    fontWeight = FontWeight.SemiBold,
                    modifier = Modifier
                        .clip(RoundedCornerShape(12.dp))
                        .clickable(onClick = onOpenSupport)
                        .padding(6.dp),
                )
            }
            Spacer(Modifier.height(8.dp))

            if (tickets.isEmpty()) {
                EmptyCard(
                    icon = {
                        Icon(
                            Icons.Outlined.HeadsetMic,
                            null,
                            tint = cs.onSurfaceVariant,
                            modifier = Modifier.size(36.dp),
                        )
                    },
                    title = "Καμία συνομιλία",
                    body = "Η ομάδα σου απαντά εδώ. Δημιούργησε ένα αίτημα αν χρειάζεσαι βοήθεια.",
                    action = onOpenSupport,
                )
            } else {
                tickets.forEach { t ->
                    val status = t.status?.lowercase()
                    val statusColor = when (status) {
                        "resolved", "closed" -> FreshGreen
                        "pending" -> FreshAmber
                        else -> cs.primary
                    }
                    Row(
                        Modifier
                            .fillMaxWidth()
                            .padding(vertical = 4.dp)
                            .clip(RoundedCornerShape(16.dp))
                            .background(cs.surface)
                            .border(1.dp, cs.outline.copy(alpha = 0.25f), RoundedCornerShape(16.dp))
                            .clickable { onOpenTicket(t) }
                            .padding(12.dp),
                        verticalAlignment = Alignment.CenterVertically,
                    ) {
                        Box(
                            Modifier
                                .size(38.dp)
                                .background(FreshGreen.copy(alpha = 0.12f), RoundedCornerShape(12.dp)),
                            contentAlignment = Alignment.Center,
                        ) {
                            Icon(Icons.Outlined.HeadsetMic, null, tint = FreshGreen, modifier = Modifier.size(20.dp))
                        }
                        Spacer(Modifier.size(12.dp))
                        Column(Modifier.weight(1f)) {
                            Text(
                                t.description?.take(48) ?: "Αίτημα υποστήριξης",
                                fontWeight = FontWeight.SemiBold,
                                style = MaterialTheme.typography.bodyMedium,
                                maxLines = 1,
                            )
                            Spacer(Modifier.height(2.dp))
                            Text(
                                t.updated_at?.take(16)?.replace("T", " ") ?: "",
                                style = MaterialTheme.typography.labelSmall,
                                color = cs.onSurfaceVariant,
                            )
                        }
                        Text(
                            when (status) {
                                "resolved", "closed" -> "Λύθηκε"
                                "pending" -> "Εκκρεμεί"
                                else -> t.status ?: "Ανοιχτό"
                            },
                            style = MaterialTheme.typography.labelSmall,
                            color = statusColor,
                            fontWeight = FontWeight.SemiBold,
                        )
                    }
                }
            }
        }

        Spacer(Modifier.height(20.dp))

        // Admin notifications
        Text(
            "Μηνύματα",
            style = MaterialTheme.typography.titleSmall,
            fontWeight = FontWeight.Bold,
            color = cs.onSurfaceVariant,
        )
        Spacer(Modifier.height(8.dp))

        if (state.notifications.isEmpty()) {
            EmptyCard(
                icon = {
                    Icon(Icons.Outlined.MailOutline, null, tint = cs.onSurfaceVariant, modifier = Modifier.size(36.dp))
                },
                title = "Κενό inbox",
                body = "Δεν υπάρχουν μηνύματα από το admin ακόμα.",
                action = null,
            )
        } else {
            state.notifications.forEach { n ->
                val isUnread = n.read_at == null
                val sevColor = when (n.severity?.lowercase()) {
                    "critical", "error", "high" -> cs.error
                    "warning" -> FreshAmber
                    else -> FreshGreen
                }
                Column(
                    Modifier
                        .fillMaxWidth()
                        .padding(vertical = 5.dp)
                        .clip(RoundedCornerShape(18.dp))
                        .background(cs.surface)
                        .border(
                            width = if (isUnread) 1.5.dp else 1.dp,
                            color = if (isUnread) sevColor.copy(alpha = 0.45f) else cs.outline.copy(alpha = 0.25f),
                            shape = RoundedCornerShape(18.dp),
                        )
                        .clickable {
                            expanded = if (expanded == n.id) null else n.id
                            if (isUnread) onMarkRead(n.id)
                        }
                        .padding(14.dp),
                ) {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        if (isUnread) {
                            Box(
                                Modifier
                                    .size(9.dp)
                                    .clip(CircleShape)
                                    .background(sevColor),
                            )
                            Spacer(Modifier.size(8.dp))
                        }
                        Text(
                            n.title ?: "Μήνυμα",
                            fontWeight = if (isUnread) FontWeight.Bold else FontWeight.SemiBold,
                            style = MaterialTheme.typography.titleSmall,
                            modifier = Modifier.weight(1f),
                        )
                        Text(
                            n.created_at?.take(10) ?: "",
                            style = MaterialTheme.typography.labelSmall,
                            color = cs.onSurfaceVariant,
                        )
                    }
                    if (expanded == n.id) {
                        Spacer(Modifier.height(8.dp))
                        Text(n.body ?: "—", style = MaterialTheme.typography.bodyMedium, color = cs.onSurface)
                    } else if (!n.body.isNullOrBlank()) {
                        Spacer(Modifier.height(4.dp))
                        Text(
                            n.body!!.take(90) + if (n.body!!.length > 90) "…" else "",
                            style = MaterialTheme.typography.bodySmall,
                            color = cs.onSurfaceVariant,
                        )
                    }
                }
            }
        }
        Spacer(Modifier.height(24.dp))
    }
}

@Composable
private fun EmptyCard(
    icon: @Composable () -> Unit,
    title: String,
    body: String,
    action: (() -> Unit)?,
) {
    val cs = MaterialTheme.colorScheme
    Column(
        Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(20.dp))
            .background(cs.surface)
            .padding(24.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        icon()
        Spacer(Modifier.height(10.dp))
        Text(title, style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.SemiBold)
        Spacer(Modifier.height(4.dp))
        Text(body, color = cs.onSurfaceVariant, style = MaterialTheme.typography.bodyMedium)
    }
}

fun ticketCallIconColor(status: String?): Color {
    return when (status?.lowercase()) {
        "resolved", "closed" -> FreshGreen
        "pending" -> FreshAmber
        else -> Color(0xFF276EF1)
    }
}