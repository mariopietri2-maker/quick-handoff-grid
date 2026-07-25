package com.freshdelivery.nativedriver.ui.inbox

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.freshdelivery.nativedriver.ui.DriverUiState

@Composable
fun InboxScreen(
    state: DriverUiState,
    onMarkRead: (String) -> Unit,
    onRefresh: () -> Unit,
) {
    var expanded by remember { mutableStateOf<String?>(null) }

    Column(
        Modifier
            .fillMaxSize()
            .verticalScroll(rememberScrollState())
            .padding(16.dp),
    ) {
        Text("Inbox", style = MaterialTheme.typography.headlineLarge)
        Text("Μηνύματα admin & support", color = MaterialTheme.colorScheme.onSurfaceVariant)
        Spacer(Modifier.height(12.dp))

        if (state.notifications.isEmpty()) {
            Text("Δεν υπάρχουν μηνύματα.", color = MaterialTheme.colorScheme.onSurfaceVariant)
        }
        state.notifications.forEach { n ->
            val unread = n.read_at == null
            Column(
                Modifier
                    .fillMaxWidth()
                    .padding(vertical = 4.dp)
                    .clip(RoundedCornerShape(14.dp))
                    .background(MaterialTheme.colorScheme.surface)
                    .clickable {
                        expanded = if (expanded == n.id) null else n.id
                        if (unread) onMarkRead(n.id)
                    }
                    .padding(12.dp),
            ) {
                Text(
                    n.title ?: "Μήνυμα",
                    fontWeight = if (unread) FontWeight.Bold else FontWeight.Normal,
                )
                Text(
                    n.created_at?.take(16) ?: "",
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
                if (expanded == n.id) {
                    Spacer(Modifier.height(6.dp))
                    Text(n.body ?: "")
                }
            }
        }

        Spacer(Modifier.height(16.dp))
        Text("Support tickets", style = MaterialTheme.typography.titleLarge)
        state.tickets.forEach { t ->
            Column(
                Modifier
                    .fillMaxWidth()
                    .padding(vertical = 4.dp)
                    .clip(RoundedCornerShape(14.dp))
                    .background(MaterialTheme.colorScheme.surface)
                    .padding(12.dp),
            ) {
                Text(t.category ?: "Ticket", fontWeight = FontWeight.SemiBold)
                Text(t.status ?: "", color = MaterialTheme.colorScheme.primary)
                Text(t.description ?: "", color = MaterialTheme.colorScheme.onSurfaceVariant)
            }
        }

        Spacer(Modifier.height(12.dp))
        OutlinedButton(onClick = onRefresh) { Text("Ανανέωση") }
    }
}
