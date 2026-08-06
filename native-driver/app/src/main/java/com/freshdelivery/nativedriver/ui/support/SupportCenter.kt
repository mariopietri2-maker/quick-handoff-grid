package com.freshdelivery.nativedriver.ui.support

import android.content.Intent
import android.net.Uri
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
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
import androidx.compose.material.icons.automirrored.outlined.Send
import androidx.compose.material.icons.filled.ArrowBack
import androidx.compose.material.icons.outlined.Call
import androidx.compose.material.icons.outlined.Storefront
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
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.freshdelivery.nativedriver.data.LiveChatMessageRow
import com.freshdelivery.nativedriver.data.SupportTicketRow
import com.freshdelivery.nativedriver.data.TicketMessageRow
import com.freshdelivery.nativedriver.ui.DriverUiState
import com.freshdelivery.nativedriver.ui.theme.FreshAmber
import com.freshdelivery.nativedriver.ui.theme.FreshBlue
import com.freshdelivery.nativedriver.ui.theme.FreshError
import com.freshdelivery.nativedriver.ui.theme.FreshGreen
import com.freshdelivery.nativedriver.ui.theme.FreshGreenBright

/**
 * Unified Support Center — full-screen hub that combines Live Chat with support
 * and the ticket (Αιτήματα) system, plus quick driver/customer context actions.
 */
@Composable
fun SupportCenter(
    state: DriverUiState,
    onBack: () -> Unit,
    onSendLiveChat: (String) -> Unit,
    onOpenTicket: (SupportTicketRow) -> Unit,
    onCloseTicket: () -> Unit,
    onSendTicketChat: (String) -> Unit,
    onSubmitTicket: (String, String) -> Unit,
) {
    val context = LocalContext.current
    val cs = MaterialTheme.colorScheme
    var tab by remember { mutableStateOf("live") }
    var showNewTicket by remember { mutableStateOf(false) }

    fun call(phone: String?) {
        if (!phone.isNullOrBlank()) {
            context.startActivity(Intent(Intent.ACTION_DIAL, Uri.parse("tel:$phone")))
        }
    }

    Box(
        Modifier
            .fillMaxSize()
            .background(MaterialTheme.colorScheme.background)
            .imePadding()
            .navigationBarsPadding()
            .statusBarsPadding()
            .padding(horizontal = 16.dp),
    ) {
        Column(Modifier.fillMaxSize()) {
            // ── Header ──
            Row(
                Modifier.fillMaxWidth().padding(top = 8.dp, bottom = 6.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                IconButton(onClick = onBack) {
                    Icon(Icons.Filled.ArrowBack, contentDescription = "Πίσω", tint = cs.onBackground)
                }
                Column(Modifier.weight(1f)) {
                    Text("Υποστήριξη", style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold)
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Box(Modifier.size(7.dp).background(FreshGreen, CircleShape))
                        Spacer(Modifier.width(5.dp))
                        Text("Ομάδα διαθέσιμη 24/7", style = MaterialTheme.typography.bodySmall, color = FreshGreenBright)
                    }
                }
                SupportTabs(tab = tab, onTab = { tab = it })
            }

            // ── Driver / customer context cards ──
            Column(Modifier.fillMaxWidth()) {
                DriverContextCard(state = state, onCall = ::call)

                val trip = state.primaryTrip
                if (trip != null) {
                    Spacer(Modifier.height(8.dp))
                    CustomerContextCard(trip = trip, onCall = ::call)
                }
            }

            Spacer(Modifier.height(12.dp))

            Box(Modifier.fillMaxWidth().weight(1f)) {
                when {
                    tab == "live" -> LiveChatPanel(
                        state = state,
                        onSend = onSendLiveChat,
                    )
                    showNewTicket -> NewTicketPanel(
                        busy = state.busy,
                        onSubmit = { cat, desc ->
                            onSubmitTicket(cat, desc)
                            showNewTicket = false
                        },
                        onCancel = { showNewTicket = false },
                    )
                    state.chatTicketId != null -> TicketThreadPanel(
                        messages = state.chatMessages,
                        agents = state.chatAgents,
                        loading = state.chatLoading,
                        busy = state.busy,
                        onBack = onCloseTicket,
                        onSend = onSendTicketChat,
                    )
                    else -> TicketListPanel(
                        tickets = state.tickets,
                        onOpen = onOpenTicket,
                        onNew = { showNewTicket = true },
                    )
                }
            }
        }
    }
}

@Composable
private fun SupportTabs(tab: String, onTab: (String) -> Unit) {
    Row(
        Modifier
            .clip(RoundedCornerShape(12.dp))
            .background(MaterialTheme.colorScheme.surface, RoundedCornerShape(12.dp))
            .padding(3.dp),
        horizontalArrangement = Arrangement.spacedBy(3.dp),
    ) {
        SupportTab("live", "Live Chat", tab, onTab)
        SupportTab("tickets", "Αιτήματα", tab, onTab)
    }
}

@Composable
private fun SupportTab(label: String, text: String, current: String, onTab: (String) -> Unit) {
    val selected = current == label
    Text(
        text,
        fontSize = 11.sp,
        fontWeight = if (selected) FontWeight.Bold else FontWeight.Medium,
        color = if (selected) Color.White else MaterialTheme.colorScheme.onSurfaceVariant,
        textAlign = TextAlign.Center,
        modifier = Modifier
            .clip(RoundedCornerShape(9.dp))
            .background(if (selected) FreshGreen else Color.Transparent)
            .clickable { onTab(label) }
            .padding(horizontal = 10.dp, vertical = 6.dp),
    )
}

@Composable
private fun DriverContextCard(state: DriverUiState, onCall: (String?) -> Unit) {
    val cs = MaterialTheme.colorScheme
    Row(
        Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(18.dp))
            .background(cs.surface)
            .border(1.dp, cs.outline.copy(alpha = 0.25f), RoundedCornerShape(18.dp))
            .padding(12.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Box(
            Modifier
                .size(44.dp)
                .background(FreshGreen.copy(alpha = 0.15f), RoundedCornerShape(14.dp)),
            contentAlignment = Alignment.Center,
        ) {
            Text(
                state.profile?.full_name?.take(1)?.uppercase() ?: "Ο",
                fontSize = 20.sp,
                fontWeight = FontWeight.Bold,
                color = FreshGreenBright,
            )
        }
        Spacer(Modifier.width(12.dp))
        Column(Modifier.weight(1f)) {
            Text(
                state.profile?.full_name ?: "Οδηγός",
                fontWeight = FontWeight.SemiBold,
                fontSize = 14.sp,
            )
            Text(
                buildString {
                    append(state.driverProfile?.vehicle_type ?: "Όχημα")
                    state.driverProfile?.vehicle_plate?.let { append(" · $it") }
                    state.profile?.phone?.let { append(" · $it") }
                },
                fontSize = 12.sp,
                color = cs.onSurfaceVariant,
                maxLines = 1,
            )
        }
        IconButton(onClick = { onCall(state.profile?.phone) }) {
            Box(
                Modifier.size(38.dp).background(FreshGreen, RoundedCornerShape(12.dp)),
                contentAlignment = Alignment.Center,
            ) {
                Icon(Icons.Outlined.Call, contentDescription = "Κλήση οδηγού", tint = Color.White, modifier = Modifier.size(18.dp))
            }
        }
    }
}

@Composable
private fun CustomerContextCard(
    trip: com.freshdelivery.nativedriver.data.ActiveTripUi,
    onCall: (String?) -> Unit,
) {
    val cs = MaterialTheme.colorScheme
    val order = trip.order
    val customerName = order.customer_name ?: "Πελάτης"
    val customerPhone = order.customer_phone
    Column(
        Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(18.dp))
            .background(cs.surface)
            .border(1.dp, cs.outline.copy(alpha = 0.25f), RoundedCornerShape(18.dp))
            .padding(12.dp),
    ) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Box(
                Modifier
                    .size(44.dp)
                    .background(FreshBlue.copy(alpha = 0.15f), RoundedCornerShape(14.dp)),
                contentAlignment = Alignment.Center,
            ) {
                Text(
                    customerName.take(1).uppercase(),
                    fontSize = 20.sp,
                    fontWeight = FontWeight.Bold,
                    color = FreshBlue,
                )
            }
            Spacer(Modifier.width(12.dp))
            Column(Modifier.weight(1f)) {
                Text(customerName, fontWeight = FontWeight.SemiBold, fontSize = 14.sp)
                Text(
                    order.delivery_address ?: "Παράδοση",
                    fontSize = 12.sp,
                    color = cs.onSurfaceVariant,
                    maxLines = 1,
                )
            }
            IconButton(onClick = { onCall(customerPhone) }) {
                Box(
                    Modifier.size(38.dp).background(FreshBlue, RoundedCornerShape(12.dp)),
                    contentAlignment = Alignment.Center,
                ) {
                    Icon(Icons.Outlined.Call, contentDescription = "Κλήση πελάτη", tint = Color.White, modifier = Modifier.size(18.dp))
                }
            }
        }
        trip.storeName?.let {
            Spacer(Modifier.height(8.dp))
            Row(verticalAlignment = Alignment.CenterVertically) {
                Icon(Icons.Outlined.Storefront, null, tint = FreshAmber, modifier = Modifier.size(15.dp))
                Spacer(Modifier.width(6.dp))
                Text(it, fontSize = 12.sp, color = cs.onSurfaceVariant, maxLines = 1)
            }
        }
    }
}

@Composable
private fun LiveChatPanel(state: DriverUiState, onSend: (String) -> Unit) {
    var draft by remember { mutableStateOf("") }
    Column(Modifier.fillMaxWidth()) {
        ThreadBox(
            loading = state.liveChatLoading,
            emptyText = "Συνδέθηκες με την ομάδα. Στείλε το πρώτο μήνυμα.",
        ) {
            if (state.liveChatMessages.isEmpty()) {
                Spacer(Modifier.height(4.dp))
            }
            state.liveChatMessages.forEach { m ->
                LiveBubble(m, mine = m.sender_role == "driver")
            }
        }
        Composer(
            draft = draft,
            onDraft = { draft = it },
            busy = state.busy,
            onSend = { onSend(draft); draft = "" },
        )
    }
}

@Composable
private fun TicketListPanel(
    tickets: List<SupportTicketRow>,
    onOpen: (SupportTicketRow) -> Unit,
    onNew: () -> Unit,
) {
    Column(
        Modifier.fillMaxWidth().verticalScroll(rememberScrollState()),
        horizontalAlignment = Alignment.Start,
    ) {
        Row(
            Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Text("Τα αιτήματά σου", fontSize = 13.sp, fontWeight = FontWeight.Bold, color = MaterialTheme.colorScheme.onSurfaceVariant)
            Text(
                "Νέο αίτημα",
                fontSize = 12.sp,
                fontWeight = FontWeight.Bold,
                color = FreshGreenBright,
                modifier = Modifier.clip(RoundedCornerShape(12.dp)).clickable(onClick = onNew).padding(6.dp),
            )
        }
        Spacer(Modifier.height(6.dp))
        if (tickets.isEmpty()) {
            Text(
                "Δεν υπάρχουν αιτήματα ακόμα.",
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                fontSize = 13.sp,
                modifier = Modifier.fillMaxWidth().padding(vertical = 14.dp),
            )
        } else {
            tickets.forEach { t ->
                val status = t.status?.lowercase()
                val color = when (status) {
                    "resolved", "closed" -> FreshGreen
                    "pending" -> FreshAmber
                    else -> MaterialTheme.colorScheme.primary
                }
                Row(
                    Modifier
                        .fillMaxWidth()
                        .padding(vertical = 4.dp)
                        .clip(RoundedCornerShape(16.dp))
                        .background(MaterialTheme.colorScheme.surface)
                        .border(1.dp, MaterialTheme.colorScheme.outline.copy(alpha = 0.25f), RoundedCornerShape(16.dp))
                        .clickable { onOpen(t) }
                        .padding(12.dp),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Text(t.description?.take(40) ?: "Αίτημα", fontWeight = FontWeight.SemiBold, fontSize = 13.sp, modifier = Modifier.weight(1f))
                    Text(
                        when (status) {
                            "resolved", "closed" -> "Λύθηκε"
                            "pending" -> "Εκκρεμεί"
                            else -> t.status ?: "Ανοιχτό"
                        },
                        fontSize = 11.sp,
                        fontWeight = FontWeight.SemiBold,
                        color = color,
                    )
                }
            }
        }
    }
}

@Composable
private fun TicketThreadPanel(
    messages: List<TicketMessageRow>,
    agents: Map<String, String>,
    loading: Boolean,
    busy: Boolean,
    onBack: () -> Unit,
    onSend: (String) -> Unit,
) {
    var draft by remember { mutableStateOf("") }
    Column(Modifier.fillMaxWidth()) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Text(
                "Συνομιλία αιτήματος",
                fontSize = 13.sp,
                fontWeight = FontWeight.Bold,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                modifier = Modifier.weight(1f),
            )
            Text(
                "Πίσω στα αιτήματα",
                fontSize = 12.sp,
                fontWeight = FontWeight.Bold,
                color = FreshGreenBright,
                modifier = Modifier.clip(RoundedCornerShape(12.dp)).clickable(onClick = onBack).padding(6.dp),
            )
        }
        Spacer(Modifier.height(4.dp))
        ThreadBox(loading = loading, emptyText = "Στείλε ένα μήνυμα στην ομάδα.") {
            messages.forEach { m ->
                TicketBubble(m, mine = m.sender_role == "driver", senderName = agentDisplayName(m, agents))
            }
        }
        Composer(
            draft = draft,
            onDraft = { draft = it },
            busy = busy,
            onSend = { onSend(draft); draft = "" },
        )
    }
}

@Composable
private fun NewTicketPanel(
    busy: Boolean,
    onSubmit: (String, String) -> Unit,
    onCancel: () -> Unit,
) {
    var category by remember { mutableStateOf<String?>(null) }
    var description by remember { mutableStateOf("") }
    val cs = MaterialTheme.colorScheme
    Column(
        Modifier.fillMaxWidth().verticalScroll(rememberScrollState()),
        horizontalAlignment = Alignment.Start,
    ) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Text("Νέο Αίτημα", fontSize = 14.sp, fontWeight = FontWeight.Bold, modifier = Modifier.weight(1f))
            Text(
                "Ακύρωση",
                fontSize = 12.sp,
                fontWeight = FontWeight.Bold,
                color = cs.onSurfaceVariant,
                modifier = Modifier.clip(RoundedCornerShape(12.dp)).clickable(onClick = onCancel).padding(6.dp),
            )
        }
        Spacer(Modifier.height(8.dp))
        Text("Κατηγορία", fontSize = 11.sp, color = cs.onSurfaceVariant, fontWeight = FontWeight.Bold)
        Spacer(Modifier.height(6.dp))
        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(6.dp)) {
            CategoryChip("Παραγγελία", FreshAmber, category == "order", { category = "order" }, Modifier.weight(1f))
            CategoryChip("Πληρωμές", FreshGreen, category == "payment", { category = "payment" }, Modifier.weight(1f))
            CategoryChip("Έκτακτο", FreshError, category == "emergency", { category = "emergency" }, Modifier.weight(1f))
            CategoryChip("Άλλο", FreshBlue, category == "other", { category = "other" }, Modifier.weight(1f))
        }
        Spacer(Modifier.height(10.dp))
        OutlinedTextField(
            value = description,
            onValueChange = { description = it },
            placeholder = { Text("Περιγράψτε το πρόβλημά σας…") },
            minLines = 3,
            maxLines = 5,
            modifier = Modifier.fillMaxWidth(),
            shape = RoundedCornerShape(14.dp),
        )
        Spacer(Modifier.height(12.dp))
        androidx.compose.material3.Button(
            onClick = { category?.let { onSubmit(it, description.trim()) } },
            enabled = category != null && description.isNotBlank() && !busy,
            modifier = Modifier.fillMaxWidth().height(50.dp),
            shape = RoundedCornerShape(16.dp),
        ) {
            if (busy) {
                CircularProgressIndicator(Modifier.size(18.dp), color = Color.White, strokeWidth = 2.dp)
            } else {
                Text("Υποβολή Αιτήματος", fontWeight = FontWeight.Bold)
            }
        }
    }
}

@Composable
private fun CategoryChip(label: String, color: Color, selected: Boolean, onClick: () -> Unit, modifier: Modifier = Modifier) {
    Box(
        modifier
            .clip(RoundedCornerShape(12.dp))
            .background(if (selected) color.copy(alpha = 0.2f) else MaterialTheme.colorScheme.surface)
            .border(1.dp, if (selected) color else MaterialTheme.colorScheme.outline.copy(alpha = 0.25f), RoundedCornerShape(12.dp))
            .clickable(onClick = onClick)
            .padding(vertical = 10.dp),
        contentAlignment = Alignment.Center,
    ) {
        Text(label, fontSize = 11.sp, fontWeight = FontWeight.SemiBold, color = if (selected) color else MaterialTheme.colorScheme.onSurfaceVariant)
    }
}

@Composable
private fun ColumnScope.ThreadBox(
    loading: Boolean,
    emptyText: String,
    content: @Composable () -> Unit,
) {
    Box(
        Modifier
            .fillMaxWidth()
            .weight(1f)
            .background(MaterialTheme.colorScheme.surface, RoundedCornerShape(22.dp))
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
                if (emptyText.isNotBlank()) {
                    Text(
                        emptyText,
                        textAlign = TextAlign.Center,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                        fontSize = 13.sp,
                        modifier = Modifier.fillMaxWidth().padding(vertical = 16.dp),
                    )
                }
            }
        }
    }
}

@Composable
private fun Composer(
    draft: String,
    onDraft: (String) -> Unit,
    busy: Boolean,
    onSend: () -> Unit,
) {
    Row(
        Modifier.fillMaxWidth().padding(vertical = 10.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        OutlinedTextField(
            value = draft,
            onValueChange = onDraft,
            placeholder = { Text("Γράψε ένα μήνυμα…") },
            modifier = Modifier.weight(1f),
            shape = RoundedCornerShape(16.dp),
            maxLines = 4,
        )
        Spacer(Modifier.width(8.dp))
        IconButton(onClick = onSend, enabled = draft.isNotBlank() && !busy) {
            Box(
                Modifier.size(44.dp).background(FreshGreen, RoundedCornerShape(14.dp)),
                contentAlignment = Alignment.Center,
            ) {
                if (busy) {
                    CircularProgressIndicator(Modifier.size(20.dp), color = Color.White, strokeWidth = 2.dp)
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

@Composable
private fun LiveBubble(message: LiveChatMessageRow, mine: Boolean) {
    Bubble(
        mine = mine,
        text = message.message?.takeIf { it.isNotBlank() } ?: "—",
        time = message.created_at,
        senderName = null,
    )
}

@Composable
private fun TicketBubble(message: TicketMessageRow, mine: Boolean, senderName: String?) {
    Bubble(
        mine = mine,
        text = message.message?.takeIf { it.isNotBlank() } ?: "—",
        time = message.created_at,
        senderName = if (mine) null else senderName,
    )
}

@Composable
private fun Bubble(mine: Boolean, text: String, time: String?, senderName: String?) {
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
                .background(bubbleColor, RoundedCornerShape(16.dp))
                .padding(horizontal = 12.dp, vertical = 9.dp),
        ) {
            Text(text, color = textColor, fontSize = 14.sp, lineHeight = 19.sp)
            time?.takeIf { it.isNotBlank() }?.let {
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
