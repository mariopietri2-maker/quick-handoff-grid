package com.freshdelivery.nativecustomer.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.outlined.ArrowBack
import androidx.compose.material.icons.automirrored.outlined.Send
import androidx.compose.material.icons.outlined.SupportAgent
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.freshdelivery.nativecustomer.data.LiveChatMessageRow
import com.freshdelivery.nativecustomer.ui.theme.FreshBg
import com.freshdelivery.nativecustomer.ui.theme.FreshGreen
import com.freshdelivery.nativecustomer.ui.theme.FreshGreenDark
import com.freshdelivery.nativecustomer.ui.theme.FreshGreenSoft
import com.freshdelivery.nativecustomer.ui.theme.FreshInk
import com.freshdelivery.nativecustomer.ui.theme.FreshMuted
import com.freshdelivery.nativecustomer.ui.theme.FreshRose

/** Emerald v2 — customer live support chat (mirrors driver Live Chat panel). */
@Composable
fun SupportScreen(
    state: CustomerUiState,
    onBack: () -> Unit,
    onSend: (String) -> Unit,
) {
    var draft by remember { mutableStateOf("") }
    Column(
        Modifier
            .fillMaxSize()
            .background(FreshBg)
            .imePadding()
            .navigationBarsPadding()
            .statusBarsPadding()
            .padding(horizontal = 16.dp),
    ) {
        Row(
            Modifier
                .fillMaxWidth()
                .padding(top = 8.dp, bottom = 6.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            IconButton(onClick = onBack) {
                Icon(Icons.AutoMirrored.Outlined.ArrowBack, contentDescription = "Πίσω", tint = FreshInk)
            }
            Column(Modifier.weight(1f)) {
                Text(
                    "Υποστήριξη",
                    style = MaterialTheme.typography.titleMedium,
                    fontWeight = FontWeight.Bold,
                )
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Box(
                        Modifier
                            .size(7.dp)
                            .background(FreshGreen, CircleShape),
                    )
                    Spacer(Modifier.width(5.dp))
                    Text(
                        "Ομάδα διαθέσιμη 24/7",
                        style = MaterialTheme.typography.bodySmall,
                        color = FreshGreenDark,
                    )
                }
            }
            Box(
                Modifier
                    .size(40.dp)
                    .background(FreshGreenSoft, RoundedCornerShape(13.dp)),
                contentAlignment = Alignment.Center,
            ) {
                Icon(Icons.Outlined.SupportAgent, contentDescription = null, tint = FreshGreen, modifier = Modifier.size(20.dp))
            }
        }

        if (!state.liveChatError.isNullOrBlank()) {
            Text(
                state.liveChatError!!,
                color = FreshRose,
                fontSize = 12.sp,
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(vertical = 4.dp),
            )
        }

        Spacer(Modifier.height(8.dp))

        ThreadBox(
            loading = state.liveChatLoading,
            emptyText = "Συνδέθηκες με την ομάδα. Στείλε το πρώτο μήνυμα.",
            showEmpty = state.liveChatMessages.isEmpty(),
        ) {
            state.liveChatMessages.forEach { m ->
                ChatBubble(m, mine = m.sender_role == "customer")
            }
        }

        Row(
            Modifier
                .fillMaxWidth()
                .padding(vertical = 10.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            OutlinedTextField(
                value = draft,
                onValueChange = { draft = it },
                placeholder = { Text("Γράψε ένα μήνυμα…") },
                modifier = Modifier.weight(1f),
                shape = RoundedCornerShape(16.dp),
                maxLines = 4,
            )
            Spacer(Modifier.width(8.dp))
            IconButton(
                onClick = { onSend(draft); draft = "" },
                enabled = draft.isNotBlank(),
            ) {
                Box(
                    Modifier
                        .size(44.dp)
                        .background(FreshGreen, RoundedCornerShape(14.dp)),
                    contentAlignment = Alignment.Center,
                ) {
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

@Composable
private fun ColumnScope.ThreadBox(
    loading: Boolean,
    emptyText: String,
    showEmpty: Boolean,
    content: @Composable () -> Unit,
) {
    Box(
        Modifier
            .fillMaxWidth()
            .weight(1f)
            .background(Color.White, RoundedCornerShape(22.dp))
            .padding(vertical = 12.dp),
    ) {
        if (loading) {
            Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                CircularProgressIndicator(color = FreshGreen)
            }
        } else {
            Column(
                Modifier
                    .fillMaxSize()
                    .verticalScroll(rememberScrollState())
                    .padding(horizontal = 12.dp, vertical = 6.dp),
                verticalArrangement = Arrangement.spacedBy(8.dp),
            ) {
                content()
                if (showEmpty && emptyText.isNotBlank()) {
                    Text(
                        emptyText,
                        textAlign = TextAlign.Center,
                        color = FreshMuted,
                        fontSize = 13.sp,
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(vertical = 16.dp),
                    )
                }
            }
        }
    }
}

@Composable
private fun ChatBubble(message: LiveChatMessageRow, mine: Boolean) {
    val text = message.message?.takeIf { it.isNotBlank() } ?: "—"
    val bubbleColor = if (mine) FreshGreen else FreshGreenSoft
    val textColor = if (mine) Color.White else FreshInk
    Column(
        Modifier.fillMaxWidth(),
        horizontalAlignment = if (mine) Alignment.End else Alignment.Start,
    ) {
        if (!mine) {
            Text(
                agentName(message.sender_role),
                fontSize = 11.sp,
                color = FreshMuted,
                fontWeight = FontWeight.SemiBold,
                modifier = Modifier.padding(start = 2.dp, bottom = 2.dp),
            )
        }
        Column(
            Modifier
                .background(bubbleColor, RoundedCornerShape(16.dp))
                .padding(horizontal = 12.dp, vertical = 9.dp),
        ) {
            Text(text, color = textColor, fontSize = 14.sp, lineHeight = 19.sp)
            message.created_at?.takeIf { it.isNotBlank() }?.let {
                Spacer(Modifier.height(3.dp))
                Text(
                    it.take(16).replace("T", " "),
                    fontSize = 10.sp,
                    color = if (mine) Color.White.copy(alpha = 0.75f) else FreshMuted,
                )
            }
        }
    }
}

private fun agentName(role: String?): String = when (role) {
    "admin" -> "Admin"
    "support" -> "Υποστήριξη"
    else -> "Εκπρόσωπος"
}
