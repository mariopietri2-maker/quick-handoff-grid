package com.freshdelivery.nativedriver.ui.support

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.outlined.Send
import androidx.compose.material.icons.filled.ArrowBack
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.window.Dialog
import androidx.compose.ui.window.DialogProperties
import com.freshdelivery.nativedriver.data.TicketMessageRow
import com.freshdelivery.nativedriver.ui.theme.FreshGreen
import androidx.compose.foundation.lazy.rememberLazyListState

@Composable
fun TicketChatDialog(
    ticketCategory: String?,
    messages: List<TicketMessageRow>,
    agents: Map<String, String>,
    loading: Boolean,
    busy: Boolean,
    onBack: () -> Unit,
    onSend: (String) -> Unit,
) {
    var draft by rememberSaveable { mutableStateOf("") }
    val normalizedDraft = draft.trim()
    val listState = rememberLazyListState()

    LaunchedEffect(messages.size) {
        if (messages.isNotEmpty()) {
            listState.scrollToItem(messages.lastIndex)
        }
    }

    Dialog(
        onDismissRequest = onBack,
        properties = DialogProperties(
            usePlatformDefaultWidth = false,
            dismissOnBackPress = true,
            dismissOnClickOutside = false,
        ),
    ) {
        Column(
            Modifier
                .fillMaxSize()
                .background(MaterialTheme.colorScheme.background)
                .navigationBarsPadding()
                .imePadding()
                .padding(horizontal = 16.dp),
        ) {
            // Header
            Row(
                Modifier
                    .fillMaxWidth()
                    .padding(top = 10.dp, bottom = 6.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                IconButton(onClick = onBack) {
                    Icon(Icons.Filled.ArrowBack, contentDescription = "Πίσω", tint = MaterialTheme.colorScheme.onBackground)
                }
                Column(Modifier.weight(1f)) {
                    Text(
                        "Συνομιλία Υποστήριξης",
                        style = MaterialTheme.typography.titleMedium,
                        fontWeight = FontWeight.Bold,
                    )
                    Text(
                        ticketCategory?.let { "Αίτημα · $it" } ?: "Αίτημα υποστήριξης",
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                }
            }

            // Thread
            Box(
                Modifier
                    .weight(1f)
                    .fillMaxWidth()
                    .background(MaterialTheme.colorScheme.surface, RoundedCornerShape(22.dp))
                    .padding(vertical = 12.dp),
            ) {
                if (loading) {
                    Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                        CircularProgressIndicator(color = FreshGreen)
                    }
                } else {
                    LazyColumn(
                        Modifier
                            .fillMaxSize()
                            .padding(horizontal = 12.dp, vertical = 6.dp),
                        state = listState,
                        verticalArrangement = Arrangement.spacedBy(8.dp),
                    ) {
                        if (messages.isEmpty()) {
                            item {
                                Column {
                                    Spacer(Modifier.height(8.dp))
                                    Text(
                                        "Στείλε ένα μήνυμα στην ομάδα για να ξεκινήσει η συζήτηση.",
                                        textAlign = TextAlign.Center,
                                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                                        fontSize = 13.sp,
                                        modifier = Modifier
                                            .fillMaxWidth()
                                            .padding(vertical = 24.dp),
                                    )
                                }
                            }
                        }
                        items(
                            items = messages,
                            key = { messageKey(it) },
                        ) { m ->
                            val mine = m.sender_role == "driver"
                            ChatBubble(
                                message = m,
                                mine = mine,
                                senderName = agentDisplayName(m, agents),
                            )
                        }
                        item { Spacer(Modifier.height(4.dp)) }
                    }
                }
            }

            // Composer
            Row(
                Modifier
                    .fillMaxWidth()
                    .padding(vertical = 10.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                OutlinedTextField(
                    value = draft,
                    onValueChange = { draft = it.take(500) },
                    placeholder = { Text("Γράψε ένα μήνυμα…") },
                    modifier = Modifier.weight(1f),
                    shape = RoundedCornerShape(16.dp),
                    maxLines = 4,
                )
                Spacer(Modifier.width(8.dp))
                IconButton(
                    onClick = {
                        if (normalizedDraft.isNotBlank() && !busy) {
                            onSend(normalizedDraft)
                            draft = ""
                        }
                    },
                    enabled = normalizedDraft.isNotBlank() && !busy,
                ) {
                    Box(
                        Modifier
                            .size(44.dp)
                            .background(FreshGreen, RoundedCornerShape(14.dp)),
                        contentAlignment = Alignment.Center,
                    ) {
                        if (busy) {
                            CircularProgressIndicator(
                                Modifier.size(20.dp),
                                color = Color.White,
                                strokeWidth = 2.dp,
                            )
                        } else {
                            Icon(
                                Icons.AutoMirrored.Outlined.Send,
                                contentDescription = "Αποστολή",
                                tint = Color.White,
                                modifier = Modifier.size(20.dp),
                            )
                        }
                    }
                }
            }
        }
    }
}

private fun messageKey(message: TicketMessageRow): String =
    "${message.id}|${message.created_at.orEmpty()}"

private fun agentDisplayName(m: TicketMessageRow, agents: Map<String, String>): String? {
    if (m.sender_role == "driver") return null
    val fallback = when (m.sender_role) {
        "admin" -> "Admin"
        "support" -> "Υποστήριξη"
        else -> "Εκπρόσωπος"
    }
    val full = m.sender_id?.let { agents[it] }.orEmpty()
    if (full.isBlank()) return fallback
    val parts = full.trim().split(Regex("\\s+"))
    return if (parts.size == 1) parts[0] else "${parts[0]} ${parts[1].take(1)}."
}

@Composable
private fun ChatBubble(
    message: TicketMessageRow,
    mine: Boolean,
    senderName: String?,
) {
    val bubbleColor = if (mine) FreshGreen else MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.6f)
    val textColor = if (mine) Color.White else MaterialTheme.colorScheme.onSurface
    Column(
        Modifier.fillMaxWidth(),
        horizontalAlignment = if (mine) Alignment.End else Alignment.Start,
    ) {
        if (!mine && !senderName.isNullOrBlank()) {
            Text(
                senderName,
                fontSize = 11.sp,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                fontWeight = FontWeight.SemiBold,
                modifier = Modifier.padding(start = 2.dp, bottom = 2.dp),
            )
        }
        Column(
            Modifier
                .background(bubbleColor, RoundedCornerShape(if (mine) 16.dp else 16.dp))
                .padding(horizontal = 12.dp, vertical = 9.dp),
        ) {
            Text(
                message.message?.takeIf { it.isNotBlank() } ?: "—",
                color = textColor,
                fontSize = 14.sp,
                lineHeight = 19.sp,
            )
            message.created_at?.takeIf { it.isNotBlank() }?.let {
                Spacer(Modifier.height(3.dp))
                Text(
                    it.take(16).replace("T", " "),
                    fontSize = 10.sp,
                    color = if (mine) Color.White.copy(alpha = 0.75f) else Color.Gray,
                )
            }
        }
    }
}