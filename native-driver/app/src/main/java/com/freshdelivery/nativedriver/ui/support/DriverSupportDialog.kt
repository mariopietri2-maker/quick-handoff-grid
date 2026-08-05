package com.freshdelivery.nativedriver.ui.support

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.Add
import androidx.compose.material.icons.outlined.ArrowForward
import androidx.compose.material.icons.outlined.CarCrash
import androidx.compose.material.icons.outlined.CreditCard
import androidx.compose.material.icons.outlined.HeadsetMic
import androidx.compose.material.icons.outlined.Navigation
import androidx.compose.material.icons.outlined.Place
import androidx.compose.material.icons.outlined.PhoneAndroid
import androidx.compose.material.icons.outlined.ReceiptLong
import androidx.compose.material.icons.outlined.SupportAgent
import androidx.compose.material3.Button
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.window.Dialog
import androidx.compose.ui.window.DialogProperties
import com.freshdelivery.nativedriver.data.SupportTicketRow
import com.freshdelivery.nativedriver.ui.theme.FreshAmber
import com.freshdelivery.nativedriver.ui.theme.FreshBlue
import com.freshdelivery.nativedriver.ui.theme.FreshError
import com.freshdelivery.nativedriver.ui.theme.FreshGreen

private data class SupportCategory(
    val key: String,
    val label: String,
    val hint: String,
    val icon: ImageVector,
    val color: Color,
)

private val CATEGORIES = listOf(
    SupportCategory("emergency", "Έκτακτο", "Ατύχημα, ασφάλεια", Icons.Outlined.CarCrash, FreshError),
    SupportCategory("order_issue", "Παραγγελία", "Λάθος / λείπει προϊόν", Icons.Outlined.ReceiptLong, FreshAmber),
    SupportCategory("customer_issue", "Πελάτης", "Δεν απαντάει, διεύθυνση", Icons.Outlined.Place, FreshBlue),
    SupportCategory("navigation", "Πλοήγηση", "Λάθος διαδρομή / GPS", Icons.Outlined.Navigation, Color(0xFF6366F1)),
    SupportCategory("vehicle_issue", "Όχημα", "Βλάβη, καύσιμα", Icons.Outlined.CarCrash, Color(0xFFF97316)),
    SupportCategory("payment", "Πληρωμές", "Κέρδη, πορτοφόλι", Icons.Outlined.CreditCard, FreshGreen),
    SupportCategory("app_issue", "Εφαρμογή", "Bug, σφάλμα", Icons.Outlined.PhoneAndroid, Color(0xFF64748B)),
)

/**
 * Support hub: lists existing tickets (email-style) and lets the driver create a
 * new request. Tapping a ticket opens the shell-level [TicketChatDialog].
 */
@Composable
fun DriverSupportDialog(
    open: Boolean,
    submitting: Boolean,
    tickets: List<SupportTicketRow>,
    showNew: Boolean,
    onNewTicketSelected: () -> Unit,
    onDismissNew: () -> Unit,
    onOpenTicket: (SupportTicketRow) -> Unit,
    onCreateTicket: (category: String, description: String) -> Unit,
    onDismiss: () -> Unit,
) {
    if (!open) return
    val cs = MaterialTheme.colorScheme

    Dialog(onDismissRequest = onDismiss, properties = DialogProperties(usePlatformDefaultWidth = false)) {
        Box(
            Modifier
                .fillMaxWidth()
                .padding(16.dp)
                .background(cs.surface, RoundedCornerShape(24.dp))
                .padding(20.dp),
        ) {
            if (showNew) {
                NewTicketForm(
                    submitting = submitting,
                    onBack = onDismissNew,
                    onSubmit = onCreateTicket,
                    onDismiss = onDismiss,
                )
            } else {
                TicketList(
                    tickets = tickets,
                    onCreate = onNewTicketSelected,
                    onOpen = onOpenTicket,
                    onDismiss = onDismiss,
                )
            }
        }
    }
}

@Composable
private fun TicketList(
    tickets: List<SupportTicketRow>,
    onCreate: () -> Unit,
    onOpen: (SupportTicketRow) -> Unit,
    onDismiss: () -> Unit,
) {
    val cs = MaterialTheme.colorScheme
    Column(
        Modifier
            .fillMaxWidth()
            .verticalScroll(rememberScrollState()),
    ) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Box(
                Modifier
                    .size(44.dp)
                    .background(FreshGreen.copy(alpha = 0.15f), RoundedCornerShape(14.dp)),
                contentAlignment = Alignment.Center,
            ) {
                Icon(Icons.Outlined.SupportAgent, null, tint = FreshGreen, modifier = Modifier.size(24.dp))
            }
            Spacer(Modifier.size(12.dp))
            Column(Modifier.weight(1f)) {
                Text("Υποστήριξη Οδηγών", fontWeight = FontWeight.Bold, fontSize = 18.sp)
                Text("Συνομιλίες με την ομάδα", color = cs.onSurfaceVariant, fontSize = 12.sp)
            }
            TextButton(onClick = onDismiss) { Text("Κλείσιμο") }
        }

        Spacer(Modifier.height(14.dp))
        Button(
            onClick = onCreate,
            modifier = Modifier.fillMaxWidth().height(50.dp),
            shape = RoundedCornerShape(16.dp),
        ) {
            Icon(Icons.Outlined.Add, null, modifier = Modifier.size(18.dp))
            Spacer(Modifier.size(8.dp))
            Text("Νέο Αίτημα", fontWeight = FontWeight.Bold)
        }

        Spacer(Modifier.height(16.dp))
        Text("Τα αιτήματά σου", fontSize = 11.sp, fontWeight = FontWeight.Bold, color = cs.onSurfaceVariant)
        Spacer(Modifier.height(6.dp))

        if (tickets.isEmpty()) {
            Text(
                "Δεν υπάρχουν ακόμα αιτήματα. Πατήστε «Νέο Αίτημα» για να ξεκινήσετε συνομιλία.",
                color = cs.onSurfaceVariant,
                fontSize = 13.sp,
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(vertical = 12.dp),
            )
        } else {
            tickets.forEach { t ->
                val status = t.status?.lowercase()
                val statusLabel = when (status) {
                    "resolved", "closed" -> "Λύθηκε"
                    "pending" -> "Εκκρεμεί"
                    else -> t.status ?: "Ανοιχτό"
                }
                val statusColor = when (status) {
                    "resolved", "closed" -> FreshGreen
                    else -> cs.primary
                }
                Row(
                    Modifier
                        .fillMaxWidth()
                        .padding(vertical = 5.dp)
                        .background(cs.surfaceVariant.copy(alpha = 0.4f), RoundedCornerShape(16.dp))
                        .clickable { onOpen(t) }
                        .padding(14.dp),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Box(
                        Modifier
                            .size(40.dp)
                            .background(FreshGreen.copy(alpha = 0.12f), RoundedCornerShape(12.dp)),
                        contentAlignment = Alignment.Center,
                    ) {
                        Icon(Icons.Outlined.HeadsetMic, null, tint = FreshGreen, modifier = Modifier.size(20.dp))
                    }
                    Spacer(Modifier.size(12.dp))
                    Column(Modifier.weight(1f)) {
                        Text(
                            catLabel(t.category) ?: "Αίτημα",
                            fontWeight = FontWeight.SemiBold,
                            fontSize = 14.sp,
                        )
                        Text(
                            t.description?.take(60) ?: "Άνοιξε τη συνομιλία",
                            color = cs.onSurfaceVariant,
                            fontSize = 12.sp,
                            maxLines = 1,
                        )
                    }
                    Column(horizontalAlignment = Alignment.End) {
                        Text(statusLabel, fontSize = 10.sp, color = statusColor, fontWeight = FontWeight.SemiBold)
                        Spacer(Modifier.height(2.dp))
                        Icon(Icons.Outlined.ArrowForward, null, tint = cs.onSurfaceVariant, modifier = Modifier.size(16.dp))
                    }
                }
            }
        }
        Spacer(Modifier.height(8.dp))
    }
}

@Composable
private fun NewTicketForm(
    submitting: Boolean,
    onBack: () -> Unit,
    onSubmit: (String, String) -> Unit,
    onDismiss: () -> Unit,
) {
    var category by remember { mutableStateOf<String?>(null) }
    var description by remember { mutableStateOf("") }
    val cs = MaterialTheme.colorScheme

    Column(
        Modifier
            .fillMaxWidth()
            .verticalScroll(rememberScrollState()),
    ) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Box(
                Modifier
                    .size(44.dp)
                    .background(FreshGreen.copy(alpha = 0.15f), RoundedCornerShape(14.dp)),
                contentAlignment = Alignment.Center,
            ) {
                Icon(Icons.Outlined.SupportAgent, null, tint = FreshGreen, modifier = Modifier.size(24.dp))
            }
            Spacer(Modifier.size(12.dp))
            Column(Modifier.weight(1f)) {
                Text("Νέο Αίτημα", fontWeight = FontWeight.Bold, fontSize = 18.sp)
                Text("Διαθέσιμοι 24/7", color = cs.onSurfaceVariant, fontSize = 12.sp)
            }
            TextButton(onClick = onDismiss) { Text("Κλείσιμο") }
        }

        Spacer(Modifier.height(14.dp))
        TextButton(onClick = onBack) {
            Text("← Πίσω στα αιτήματα")
        }

        Spacer(Modifier.height(14.dp))
        Text("Κατηγορία", color = cs.onSurfaceVariant, fontSize = 11.sp, fontWeight = FontWeight.Bold)
        Spacer(Modifier.height(8.dp))

        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            CATEGORIES.take(4).forEach { cat ->
                CategoryCell(
                    cat = cat,
                    selected = category == cat.key,
                    onClick = { category = cat.key },
                    modifier = Modifier.weight(1f),
                )
            }
        }
        Spacer(Modifier.height(8.dp))
        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            CATEGORIES.drop(4).forEach { cat ->
                CategoryCell(
                    cat = cat,
                    selected = category == cat.key,
                    onClick = { category = cat.key },
                    modifier = Modifier.weight(1f),
                )
            }
        }

        Spacer(Modifier.height(16.dp))
        OutlinedTextField(
            value = description,
            onValueChange = { description = it },
            placeholder = { Text("Περιγράψτε το πρόβλημά σας...") },
            minLines = 3,
            maxLines = 5,
            modifier = Modifier.fillMaxWidth(),
            shape = RoundedCornerShape(14.dp),
        )

        Spacer(Modifier.height(14.dp))
        Button(
            onClick = { category?.let { onSubmit(it, description.trim()) } },
            enabled = category != null && description.isNotBlank() && !submitting,
            modifier = Modifier.fillMaxWidth().height(52.dp),
            shape = RoundedCornerShape(16.dp),
        ) {
            if (submitting) {
                CircularProgressIndicator(Modifier.size(20.dp), color = Color.White, strokeWidth = 2.dp)
            } else {
                Icon(Icons.Outlined.HeadsetMic, null, modifier = Modifier.size(20.dp))
                Spacer(Modifier.size(8.dp))
                Text("Υποβολή Αιτήματος", fontWeight = FontWeight.Bold)
            }
        }
    }
}

@Composable
private fun CategoryCell(
    cat: SupportCategory,
    selected: Boolean,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
) {
    val cs = MaterialTheme.colorScheme
    Column(
        modifier
            .background(if (selected) cat.color.copy(alpha = 0.18f) else cs.surfaceVariant.copy(alpha = 0.4f))
            .border(
                width = if (selected) 1.5.dp else 1.dp,
                color = if (selected) cat.color else cs.outline.copy(alpha = 0.2f),
                shape = RoundedCornerShape(14.dp),
            )
            .clickable(onClick = onClick)
            .padding(vertical = 10.dp, horizontal = 6.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        Box(
            Modifier
                .size(30.dp)
                .background(cat.color.copy(alpha = 0.2f), RoundedCornerShape(10.dp)),
            contentAlignment = Alignment.Center,
        ) {
            Icon(cat.icon, null, tint = cat.color, modifier = Modifier.size(16.dp))
        }
        Spacer(Modifier.height(6.dp))
        Text(cat.label, fontSize = 11.sp, fontWeight = FontWeight.SemiBold, maxLines = 1)
        Text(cat.hint, fontSize = 9.sp, color = cs.onSurfaceVariant, maxLines = 1)
    }
}

private fun catLabel(key: String?): String? {
    if (key == null) return null
    return CATEGORIES.firstOrNull { it.key == key }?.label ?: key
}