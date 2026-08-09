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
import androidx.compose.material.icons.automirrored.outlined.ArrowForward
import androidx.compose.material.icons.automirrored.outlined.Send
import androidx.compose.material.icons.outlined.CreditCard
import androidx.compose.material.icons.outlined.CurrencyExchange
import androidx.compose.material.icons.outlined.Description
import androidx.compose.material.icons.outlined.DirectionsBike
import androidx.compose.material.icons.outlined.LocationOn
import androidx.compose.material.icons.outlined.Schedule
import androidx.compose.material.icons.outlined.ShoppingBag
import androidx.compose.material.icons.outlined.Smartphone
import androidx.compose.material.icons.outlined.SupportAgent
import androidx.compose.material.icons.outlined.Warning
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.freshdelivery.nativecustomer.data.LiveChatMessageRow
import com.freshdelivery.nativecustomer.data.SupportTicketRow
import com.freshdelivery.nativecustomer.data.TicketMessageRow
import com.freshdelivery.nativecustomer.ui.theme.FreshBg
import com.freshdelivery.nativecustomer.ui.theme.FreshGreen
import com.freshdelivery.nativecustomer.ui.theme.FreshGreenDark
import com.freshdelivery.nativecustomer.ui.theme.FreshGreenSoft
import com.freshdelivery.nativecustomer.ui.theme.FreshInk
import com.freshdelivery.nativecustomer.ui.theme.FreshMuted
import com.freshdelivery.nativecustomer.ui.theme.FreshRose
import com.freshdelivery.nativecustomer.ui.theme.FreshRoseSoft

/** A problem the customer picks before support (urgent topics open live chat, others tickets). */
private data class SupportTopic(
    val key: String,
    val label: String,
    val hint: String,
    val color: Color,
    val icon: ImageVector,
)

private val SUPPORT_TOPICS = listOf(
    SupportTopic("late_delivery", "Καθυστέρηση", "Η παραγγελία αργεί", Color(0xFFFFA000), Icons.Outlined.Schedule),
    SupportTopic("missing_items", "Λείπουν", "Λείπει προϊόν από την τσάντα", Color(0xFFF57C00), Icons.Outlined.ShoppingBag),
    SupportTopic("wrong_order", "Λάθος", "Έλαβα λάθος παραγγελία", Color(0xFFE53935), Icons.Outlined.Warning),
    SupportTopic("address_issue", "Διεύθυνση", "Λάθος ή αλλαγή διεύθυνσης", Color(0xFF3949AB), Icons.Outlined.LocationOn),
    SupportTopic("driver_issue", "Οδηγός", "Πρόβλημα με τον οδηγό", Color(0xFF1E88E5), Icons.Outlined.DirectionsBike),
    SupportTopic("refund", "Επιστροφή", "Αίτημα επιστροφής χρημάτων", Color(0xFFFB8C00), Icons.Outlined.CurrencyExchange),
    SupportTopic("payment", "Πληρωμή", "Χρέωση, κουπόνι, πορτοφόλι", Color(0xFF00897B), Icons.Outlined.CreditCard),
    SupportTopic("app_issue", "Εφαρμογή", "Bug ή πρόβλημα στην εφαρμογή", Color(0xFF546E7A), Icons.Outlined.Smartphone),
)

private fun topicLabel(key: String?): String =
    SUPPORT_TOPICS.firstOrNull { it.key == key }?.label ?: "Γενικό"

private fun topicColor(key: String?): Color =
    SUPPORT_TOPICS.firstOrNull { it.key == key }?.color ?: FreshGreen

private fun topicIcon(key: String?): ImageVector? =
    SUPPORT_TOPICS.firstOrNull { it.key == key }?.icon

private fun ticketStatus(status: String?): Pair<String, Color> = when (status) {
    "resolved" -> "Επιλύθηκε" to FreshGreen
    "in_progress" -> "Σε εξέλιξη" to Color(0xFFB26A00)
    else -> "Ανοιχτό" to FreshRose
}

/** Supabase timestamps are UTC ISO-8601 — render them in the device's local time. */
private fun shortTime(ts: String?): String =
    ts?.takeIf { it.isNotBlank() }?.let {
        runCatching {
            java.time.format.DateTimeFormatter.ofPattern("dd/MM HH:mm")
                .withZone(java.time.ZoneId.systemDefault())
                .format(java.time.Instant.parse(it))
        }.getOrNull() ?: it.take(16).replace("T", " ")
    } ?: ""

/** Emerald v2 — customer support: urgent live chat (wrong order) + async tickets (everything else). */
@Composable
fun SupportScreen(
    state: CustomerUiState,
    onBack: () -> Unit,
    onSend: (String) -> Unit,
    onSelectTopic: (String) -> Unit,
    onClearTopic: () -> Unit = {},
    onShowMyTickets: () -> Unit = {},
    onOpenTicket: (SupportTicketRow) -> Unit = {},
    onSubmitTicket: (String) -> Unit = {},
    onSendTicket: (String) -> Unit = {},
    snackbar: androidx.compose.material3.SnackbarHostState? = null,
) {
    var draft by remember { mutableStateOf("") }
    var ticketDraft by remember { mutableStateOf("") }

    // Preserve drafts across failed sends; clear once the flow actually moves on.
    LaunchedEffect(state.supportView) {
        if (state.supportView == SupportView.Topics || state.supportView == SupportView.Ticket) {
            ticketDraft = ""
        }
        if (state.supportView == SupportView.Topics) {
            draft = ""
        }
    }
    LaunchedEffect(state.liveChatMessages.size) {
        if (state.liveChatMessages.isNotEmpty() && draft.isNotBlank()) {
            val lastSender = state.liveChatMessages.lastOrNull()?.sender_id
            if (lastSender == state.userId) draft = ""
        }
    }
    LaunchedEffect(state.ticketMessages.size) {
        if (state.ticketMessages.isNotEmpty() && ticketDraft.isNotBlank()) {
            val lastSender = state.ticketMessages.lastOrNull()?.sender_id
            if (lastSender == state.userId) ticketDraft = ""
        }
    }

    val view = state.supportView
    val title = when (view) {
        SupportView.Topics -> "Υποστήριξη"
        SupportView.Compose -> "Νέο αίτημα"
        SupportView.MyTickets -> "Οι συνομιλίες μου"
        SupportView.Live -> "Ζωντανή Συνομιλία"
        SupportView.Ticket -> "Ticket"
    }
    val subtitle = when (view) {
        SupportView.Live -> "Επείγον — σε πραγματικό χρόνο"
        SupportView.Ticket -> "Η ομάδα θα απαντήσει γραπτώς"
        SupportView.Compose -> "Η ομάδα θα απαντήσει γραπτώς"
        SupportView.MyTickets -> "Ιστορικό αιτημάτων"
        SupportView.Topics -> "Ομάδα διαθέσιμη 24/7"
    }
    val headerBack: () -> Unit = when (view) {
        SupportView.Topics -> onBack
        SupportView.Live -> onBack
        else -> onClearTopic
    }

    Column(
        Modifier
            .fillMaxSize()
            .background(FreshBg)
            .imePadding()
            .navigationBarsPadding()
            .statusBarsPadding()
            .padding(horizontal = 16.dp),
    ) {
        if (snackbar != null) {
            androidx.compose.material3.SnackbarHost(snackbar)
        }
        Row(
            Modifier
                .fillMaxWidth()
                .padding(top = 8.dp, bottom = 6.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            IconButton(onClick = headerBack) {
                Icon(Icons.AutoMirrored.Outlined.ArrowBack, contentDescription = "Πίσω", tint = FreshInk)
            }
            Column(Modifier.weight(1f)) {
                Text(
                    title,
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
                        subtitle,
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

        when (view) {
            SupportView.Topics -> TopicsView(
                tickets = state.tickets,
                onSelectTopic = onSelectTopic,
                onShowMyTickets = onShowMyTickets,
            )

            SupportView.Compose -> ComposeView(
                topic = state.ticketTopic,
                description = ticketDraft,
                onDescriptionChange = { ticketDraft = it },
                pending = state.ticketPending,
                error = state.ticketError,
                onBack = onClearTopic,
                onSubmit = { onSubmitTicket(ticketDraft) },
            )

            SupportView.MyTickets -> MyTicketsView(
                tickets = state.tickets,
                loading = state.ticketLoading,
                error = state.ticketError,
                onOpen = onOpenTicket,
            )

            SupportView.Live -> LiveChatView(
                state = state,
                draft = draft,
                onDraftChange = { draft = it },
                onSend = { onSend(draft) },
                onClearTopic = onClearTopic,
            )

            SupportView.Ticket -> TicketView(
                state = state,
                draft = ticketDraft,
                onDraftChange = { ticketDraft = it },
                onSend = { onSendTicket(ticketDraft) },
            )
        }
    }
}

@Composable
private fun ColumnScope.TopicsView(
    tickets: List<SupportTicketRow>,
    onSelectTopic: (String) -> Unit,
    onShowMyTickets: () -> Unit,
) {
    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
        if (tickets.isNotEmpty()) {
            val openCount = tickets.count { it.status != "resolved" }
            Surface(
                onClick = onShowMyTickets,
                color = FreshGreenSoft.copy(alpha = 0.6f),
                shape = RoundedCornerShape(16.dp),
                modifier = Modifier.fillMaxWidth(),
            ) {
                Row(Modifier.padding(14.dp), verticalAlignment = Alignment.CenterVertically) {
                    Box(
                        Modifier
                            .size(40.dp)
                            .background(FreshGreen, RoundedCornerShape(12.dp)),
                        contentAlignment = Alignment.Center,
                    ) {
                        Icon(Icons.Outlined.Description, contentDescription = null, tint = Color.White, modifier = Modifier.size(20.dp))
                    }
                    Spacer(Modifier.width(12.dp))
                    Column(Modifier.weight(1f)) {
                        Text("Οι συνομιλίες μου", fontWeight = FontWeight.Bold)
                        Text(
                            if (openCount > 0) "$openCount ενεργά · ιστορικό αιτημάτων" else "Όλα τα αιτήματα επιλύθηκαν",
                            style = MaterialTheme.typography.bodySmall,
                            color = FreshMuted,
                        )
                    }
                    Icon(Icons.AutoMirrored.Outlined.ArrowForward, contentDescription = null, tint = FreshGreen)
                }
            }
        }

        Text("Τι πρόβλημα έχεις;", style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold)
        Text(
            "Επείγοντα ανοίγουν ζωντανή συνομιλία · τα υπόλοιπα γίνονται αίτημα με γραπτή απάντηση.",
            style = MaterialTheme.typography.bodySmall,
            color = FreshMuted,
        )
        Spacer(Modifier.height(6.dp))
        SUPPORT_TOPICS.forEach { t ->
            Surface(
                onClick = { onSelectTopic(t.key) },
                color = FreshGreenSoft.copy(alpha = 0.55f),
                shape = RoundedCornerShape(16.dp),
                modifier = Modifier.fillMaxWidth(),
            ) {
                Row(Modifier.padding(14.dp), verticalAlignment = Alignment.CenterVertically) {
                    Box(
                        Modifier
                            .size(40.dp)
                            .background(t.color, RoundedCornerShape(12.dp)),
                        contentAlignment = Alignment.Center,
                    ) {
                        Icon(t.icon, contentDescription = null, tint = Color.White, modifier = Modifier.size(20.dp))
                    }
                    Spacer(Modifier.width(12.dp))
                    Column(Modifier.weight(1f)) {
                        Text(t.label, fontWeight = FontWeight.Bold)
                        Text(t.hint, style = MaterialTheme.typography.bodySmall, color = FreshMuted)
                    }
                    Icon(Icons.AutoMirrored.Outlined.ArrowForward, contentDescription = null, tint = FreshGreen)
                }
            }
        }
    }
}

@Composable
private fun ColumnScope.ComposeView(
    topic: String?,
    description: String,
    onDescriptionChange: (String) -> Unit,
    pending: Boolean,
    error: String?,
    onBack: () -> Unit,
    onSubmit: () -> Unit,
) {
    Surface(
        color = FreshGreenSoft,
        shape = RoundedCornerShape(14.dp),
        modifier = Modifier
            .fillMaxWidth()
            .padding(vertical = 4.dp),
    ) {
        Row(
            Modifier.padding(horizontal = 12.dp, vertical = 8.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Box(
                Modifier
                    .size(28.dp)
                    .background(topicColor(topic), RoundedCornerShape(9.dp)),
                contentAlignment = Alignment.Center,
            ) {
                topicIcon(topic)?.let {
                    Icon(it, contentDescription = null, tint = Color.White, modifier = Modifier.size(16.dp))
                }
            }
            Spacer(Modifier.width(8.dp))
            Column(Modifier.weight(1f)) {
                Text("Θέμα", fontSize = 10.sp, color = FreshMuted)
                Text(topicLabel(topic), fontWeight = FontWeight.SemiBold, style = MaterialTheme.typography.bodySmall)
            }
            TextButton(onClick = onBack) {
                Text("Αλλαγή", color = FreshGreen, fontSize = 12.sp)
            }
        }
    }

    if (!error.isNullOrBlank()) {
        Text(
            error,
            color = FreshRose,
            fontSize = 12.sp,
            modifier = Modifier
                .fillMaxWidth()
                .padding(vertical = 4.dp),
        )
    }

    Spacer(Modifier.height(10.dp))
    Text(
        "Περιέγραψε το πρόβλημα",
        style = MaterialTheme.typography.titleSmall,
        fontWeight = FontWeight.Bold,
    )
    Spacer(Modifier.height(8.dp))
    OutlinedTextField(
        value = description,
        onValueChange = onDescriptionChange,
        placeholder = { Text("Περιέγραψε αναλυτικά — παραγγελία, ώρα, ό,τι βοηθάει…") },
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(16.dp),
        minLines = 5,
        maxLines = 8,
        enabled = !pending,
    )
    Spacer(Modifier.height(14.dp))
    Surface(
        onClick = onSubmit,
        enabled = description.isNotBlank() && !pending,
        color = FreshGreen,
        shape = RoundedCornerShape(16.dp),
        modifier = Modifier.fillMaxWidth(),
    ) {
        Box(Modifier.padding(vertical = 14.dp), contentAlignment = Alignment.Center) {
            Text(
                if (pending) "Αποστολή…" else "Αποστολή αιτήματος",
                color = Color.White,
                fontWeight = FontWeight.Bold,
            )
        }
    }
}

@Composable
private fun ColumnScope.MyTicketsView(
    tickets: List<SupportTicketRow>,
    loading: Boolean,
    error: String?,
    onOpen: (SupportTicketRow) -> Unit,
) {
    if (loading && tickets.isEmpty()) {
        Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
            CircularProgressIndicator(color = FreshGreen)
        }
        return
    }
    if (tickets.isEmpty()) {
        Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
            Text(
                "Δεν έχετε υποβάλει αιτήματα ακόμα.",
                color = FreshMuted,
                fontSize = 13.sp,
                textAlign = TextAlign.Center,
                modifier = Modifier.fillMaxWidth(),
            )
        }
        return
    }
    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
        tickets.forEach { t ->
            val (statusLabel, statusColor) = ticketStatus(t.status)
            Surface(
                onClick = { onOpen(t) },
                color = Color.White,
                shape = RoundedCornerShape(16.dp),
                modifier = Modifier.fillMaxWidth(),
            ) {
                Row(Modifier.padding(14.dp), verticalAlignment = Alignment.CenterVertically) {
                    Column(Modifier.weight(1f)) {
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Text(topicLabel(t.category), fontWeight = FontWeight.Bold)
                            Spacer(Modifier.weight(1f))
                            Surface(color = statusColor.copy(alpha = 0.15f), shape = RoundedCornerShape(8.dp)) {
                                Text(
                                    statusLabel,
                                    color = statusColor,
                                    fontSize = 11.sp,
                                    fontWeight = FontWeight.Bold,
                                    modifier = Modifier.padding(horizontal = 8.dp, vertical = 3.dp),
                                )
                            }
                        }
                        t.description?.takeIf { it.isNotBlank() }?.let {
                            Spacer(Modifier.height(4.dp))
                            Text(
                                it,
                                style = MaterialTheme.typography.bodySmall,
                                color = FreshMuted,
                                maxLines = 2,
                                overflow = TextOverflow.Ellipsis,
                            )
                        }
                        Spacer(Modifier.height(3.dp))
                        Text(shortTime(t.created_at), fontSize = 11.sp, color = FreshMuted)
                    }
                    Icon(Icons.AutoMirrored.Outlined.ArrowForward, contentDescription = null, tint = FreshGreen)
                }
            }
        }
        if (!error.isNullOrBlank()) {
            Text(error, color = FreshRose, fontSize = 12.sp, modifier = Modifier.fillMaxWidth())
        }
    }
}

@Composable
private fun ColumnScope.LiveChatView(
    state: CustomerUiState,
    draft: String,
    onDraftChange: (String) -> Unit,
    onSend: () -> Unit,
    onClearTopic: () -> Unit,
) {
    val topic = state.liveChatTopic
    Surface(
        color = FreshGreenSoft,
        shape = RoundedCornerShape(14.dp),
        modifier = Modifier
            .fillMaxWidth()
            .padding(vertical = 4.dp),
    ) {
        Row(
            Modifier.padding(horizontal = 12.dp, vertical = 8.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Box(
                Modifier
                    .size(28.dp)
                    .background(topicColor(topic), RoundedCornerShape(9.dp)),
                contentAlignment = Alignment.Center,
            ) {
                topicIcon(topic)?.let {
                    Icon(it, contentDescription = null, tint = Color.White, modifier = Modifier.size(16.dp))
                }
            }
            Spacer(Modifier.width(8.dp))
            Column(Modifier.weight(1f)) {
                Text("Θέμα", fontSize = 10.sp, color = FreshMuted)
                Text(topicLabel(topic), fontWeight = FontWeight.SemiBold, style = MaterialTheme.typography.bodySmall)
            }
            TextButton(onClick = onClearTopic) {
                Text(
                    if (state.liveChatClosed) "Νέο αίτημα" else "Αλλαγή",
                    color = FreshGreen,
                    fontSize = 12.sp,
                )
            }
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

    if (state.liveChatClosed) {
        Surface(
            color = FreshRoseSoft,
            shape = RoundedCornerShape(14.dp),
            modifier = Modifier
                .fillMaxWidth()
                .padding(top = 8.dp),
        ) {
            Row(
                Modifier.padding(horizontal = 12.dp, vertical = 10.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Icon(Icons.Outlined.Warning, contentDescription = null, tint = FreshRose, modifier = Modifier.size(18.dp))
                Spacer(Modifier.width(8.dp))
                Text(
                    "Η συνομιλία έκλεισε από την υποστήριξη. Ξεκίνα νέο αίτημα για να συνεχίσεις.",
                    style = MaterialTheme.typography.bodySmall,
                    color = FreshRose,
                )
            }
        }
    }

    SendBar(
        value = draft,
        onValueChange = onDraftChange,
        onSend = onSend,
        enabled = !state.liveChatClosed,
        placeholder = if (state.liveChatClosed) "Συνομιλία κλειστή" else "Γράψε ένα μήνυμα…",
    )
}

@Composable
private fun ColumnScope.TicketView(
    state: CustomerUiState,
    draft: String,
    onDraftChange: (String) -> Unit,
    onSend: () -> Unit,
) {
    val ticket = state.activeTicket
    if (ticket == null) {
        Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
            Text("Καμία ενεργή συνομιλία.", color = FreshMuted, fontSize = 13.sp)
        }
        return
    }
    val (statusLabel, statusColor) = ticketStatus(ticket.status)
    Surface(
        color = FreshGreenSoft,
        shape = RoundedCornerShape(14.dp),
        modifier = Modifier
            .fillMaxWidth()
            .padding(vertical = 4.dp),
    ) {
        Row(
            Modifier.padding(horizontal = 12.dp, vertical = 8.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Box(
                Modifier
                    .size(28.dp)
                    .background(topicColor(ticket.category), RoundedCornerShape(9.dp)),
                contentAlignment = Alignment.Center,
            ) {
                topicIcon(ticket.category)?.let {
                    Icon(it, contentDescription = null, tint = Color.White, modifier = Modifier.size(16.dp))
                }
            }
            Spacer(Modifier.width(8.dp))
            Column(Modifier.weight(1f)) {
                Text("Ticket #${ticket.id.take(8)}", fontSize = 10.sp, color = FreshMuted)
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Text(topicLabel(ticket.category), fontWeight = FontWeight.SemiBold, style = MaterialTheme.typography.bodySmall)
                    Spacer(Modifier.width(8.dp))
                    Surface(color = statusColor.copy(alpha = 0.15f), shape = RoundedCornerShape(8.dp)) {
                        Text(
                            statusLabel,
                            color = statusColor,
                            fontSize = 10.sp,
                            fontWeight = FontWeight.Bold,
                            modifier = Modifier.padding(horizontal = 6.dp, vertical = 2.dp),
                        )
                    }
                }
            }
        }
    }

    if (!state.ticketError.isNullOrBlank()) {
        Text(
            state.ticketError!!,
            color = FreshRose,
            fontSize = 12.sp,
            modifier = Modifier
                .fillMaxWidth()
                .padding(vertical = 4.dp),
        )
    }

    Spacer(Modifier.height(8.dp))

    ThreadBox(
        loading = state.ticketLoading,
        emptyText = "Αίτημα σε αναμονή. Η ομάδα θα απαντήσει εδώ.",
        showEmpty = state.ticketMessages.isEmpty(),
    ) {
        state.ticketMessages.forEach { m ->
            TicketBubble(m, mine = m.sender_id == state.userId)
        }
    }

    SendBar(
        value = draft,
        onValueChange = onDraftChange,
        onSend = onSend,
        enabled = true,
        placeholder = "Γράψε ένα μήνυμα…",
    )
}

@Composable
private fun SendBar(
    value: String,
    onValueChange: (String) -> Unit,
    onSend: () -> Unit,
    enabled: Boolean,
    placeholder: String,
) {
    Row(
        Modifier
            .fillMaxWidth()
            .padding(vertical = 10.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        OutlinedTextField(
            value = value,
            onValueChange = onValueChange,
            placeholder = { Text(placeholder) },
            enabled = enabled,
            modifier = Modifier.weight(1f),
            shape = RoundedCornerShape(16.dp),
            maxLines = 4,
        )
        Spacer(Modifier.width(8.dp))
        IconButton(
            onClick = onSend,
            enabled = enabled && value.isNotBlank(),
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
private fun ChatBubble(message: LiveChatMessageRow, mine: Boolean) =
    Bubble(message.message?.takeIf { it.isNotBlank() } ?: "—", mine, message.sender_role, message.created_at)

@Composable
private fun TicketBubble(message: TicketMessageRow, mine: Boolean) =
    Bubble(message.message?.takeIf { it.isNotBlank() } ?: "—", mine, message.sender_role, message.created_at)

@Composable
private fun Bubble(text: String, mine: Boolean, role: String?, createdAt: String?) {
    val bubbleColor = if (mine) FreshGreen else FreshGreenSoft
    val textColor = if (mine) Color.White else FreshInk
    Column(
        Modifier.fillMaxWidth(),
        horizontalAlignment = if (mine) Alignment.End else Alignment.Start,
    ) {
        if (!mine) {
            Text(
                agentName(role),
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
            createdAt?.takeIf { it.isNotBlank() }?.let {
                Spacer(Modifier.height(3.dp))
                Text(
                    shortTime(createdAt),
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
