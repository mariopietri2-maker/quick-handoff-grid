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
import androidx.compose.material.icons.outlined.CarCrash
import androidx.compose.material.icons.outlined.CreditCard
import androidx.compose.material.icons.outlined.HeadsetMic
import androidx.compose.material.icons.outlined.Navigation
import androidx.compose.material.icons.outlined.Place
import androidx.compose.material.icons.outlined.PhoneAndroid
import androidx.compose.material.icons.outlined.ReceiptLong
import androidx.compose.material.icons.outlined.SupportAgent
import androidx.compose.material3.CircularProgressIndicator
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
import androidx.compose.ui.text.style.TextAlign
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
    val urgent: Boolean = false,
)

private val CATEGORIES = listOf(
    SupportCategory("emergency", "Έκτακτο", "Ατύχημα, ασφάλεια", Icons.Outlined.CarCrash, FreshError, urgent = true),
    SupportCategory("order_issue", "Παραγγελία", "Λάθος / λείπει προϊόν", Icons.Outlined.ReceiptLong, FreshAmber),
    SupportCategory("customer_issue", "Πελάτης", "Δεν απαντάει, διεύθυνση", Icons.Outlined.Place, FreshBlue),
    SupportCategory("navigation", "Πλοήγηση", "Λάθος διαδρομή / GPS", Icons.Outlined.Navigation, Color(0xFF6366F1)),
    SupportCategory("vehicle_issue", "Όχημα", "Βλάβη, καύσιμα", Icons.Outlined.CarCrash, Color(0xFFF97316)),
    SupportCategory("payment", "Πληρωμές", "Κέρδη, πορτοφόλι", Icons.Outlined.CreditCard, FreshGreen),
    SupportCategory("app_issue", "Εφαρμογή", "Bug, σφάλμα", Icons.Outlined.PhoneAndroid, Color(0xFF64748B)),
)

@Composable
fun DriverSupportDialog(
    open: Boolean,
    onDismiss: () -> Unit,
    tickets: List<SupportTicketRow>,
    submitting: Boolean,
    onSubmit: (category: String, description: String) -> Unit,
) {
    if (!open) return
    var category by remember { mutableStateOf<String?>(null) }
    var description by remember { mutableStateOf("") }
    val cs = MaterialTheme.colorScheme

    Dialog(onDismissRequest = onDismiss, properties = DialogProperties(usePlatformDefaultWidth = false)) {
        Box(
            Modifier
                .fillMaxWidth()
                .padding(16.dp)
                .background(cs.surface, RoundedCornerShape(24.dp))
                .padding(20.dp),
        ) {
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
                        androidx.compose.material3.Icon(
                            Icons.Outlined.SupportAgent,
                            null,
                            tint = FreshGreen,
                            modifier = Modifier.size(24.dp),
                        )
                    }
                    Spacer(Modifier.size(12.dp))
                    Column(Modifier.weight(1f)) {
                        Text("Υποστήριξη Οδηγών", fontWeight = FontWeight.Bold, fontSize = 18.sp)
                        Text("Διαθέσιμοι 24/7 · μέσος χρόνος < 5 λ", color = cs.onSurfaceVariant, fontSize = 12.sp)
                    }
                    TextButton(onClick = onDismiss) {
                        Text("Κλείσιμο")
                    }
                }

                if (tickets.isNotEmpty()) {
                    Spacer(Modifier.height(16.dp))
                    Text(
                        "Ανοιχτά tickets: ${tickets.count { it.status != "resolved" }}",
                        color = FreshGreen,
                        fontSize = 12.sp,
                        fontWeight = FontWeight.SemiBold,
                    )
                }

                Spacer(Modifier.height(16.dp))
                Text(
                    "Νέο Αίτημα",
                    color = cs.onSurfaceVariant,
                    fontSize = 11.sp,
                    fontWeight = FontWeight.Bold,
                )
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
                    placeholder = { Text("Περιγράψτε το πρόβλημά σας με λεπτομέρεια...") },
                    minLines = 3,
                    maxLines = 5,
                    modifier = Modifier.fillMaxWidth(),
                    shape = RoundedCornerShape(14.dp),
                )

                Spacer(Modifier.height(14.dp))
                androidx.compose.material3.Button(
                    onClick = { category?.let { onSubmit(it, description.trim()) } },
                    enabled = category != null && description.isNotBlank() && !submitting,
                    modifier = Modifier.fillMaxWidth().height(52.dp),
                    shape = RoundedCornerShape(16.dp),
                ) {
                    if (submitting) {
                        CircularProgressIndicator(Modifier.size(20.dp), color = Color.White, strokeWidth = 2.dp)
                    } else {
                        androidx.compose.material3.Icon(Icons.Outlined.HeadsetMic, null, modifier = Modifier.size(20.dp))
                        Spacer(Modifier.size(8.dp))
                        Text("Υποβολή & Άνοιγμα Συνομιλίας", fontWeight = FontWeight.Bold)
                    }
                }
                Spacer(Modifier.height(6.dp))
                Text(
                    "Οι συνομιλίες σας εμφανίζονται στο Inbox.",
                    color = cs.onSurfaceVariant,
                    fontSize = 11.sp,
                    textAlign = TextAlign.Center,
                    modifier = Modifier.fillMaxWidth(),
                )
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
            androidx.compose.material3.Icon(cat.icon, null, tint = cat.color, modifier = Modifier.size(16.dp))
        }
        Spacer(Modifier.height(6.dp))
        Text(cat.label, fontSize = 11.sp, fontWeight = FontWeight.SemiBold, maxLines = 1)
        Text(cat.hint, fontSize = 9.sp, color = cs.onSurfaceVariant, maxLines = 1)
    }
}
