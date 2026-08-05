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
import com.freshdelivery.nativedriver.ui.DriverUiState
import com.freshdelivery.nativedriver.ui.theme.FreshAmber
import com.freshdelivery.nativedriver.ui.theme.FreshGreen

@Composable
fun InboxScreen(
    state: DriverUiState,
    onMarkRead: (String) -> Unit,
    onRefresh: () -> Unit,
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
                    if (unread > 0) "$unread αδιάβαστα" else "Μηνύματα",
                    color = cs.onSurfaceVariant,
                    style = MaterialTheme.typography.bodyMedium,
                )
            }
            IconButton(onClick = onRefresh) {
                Icon(Icons.Outlined.Refresh, contentDescription = "Ανανέωση")
            }
        }
        Spacer(Modifier.height(14.dp))

        if (state.notifications.isEmpty()) {
            EmptyCard(
                icon = { Icon(Icons.Outlined.MailOutline, null, tint = cs.onSurfaceVariant, modifier = Modifier.size(36.dp)) },
                title = "Κενό inbox",
                body = "Δεν υπάρχουν μηνύματα από το admin ακόμα.",
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
