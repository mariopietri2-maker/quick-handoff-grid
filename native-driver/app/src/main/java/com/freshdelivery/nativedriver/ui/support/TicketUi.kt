package com.freshdelivery.nativedriver.ui.support

import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.CreditCard
import androidx.compose.material.icons.outlined.DirectionsCar
import androidx.compose.material.icons.outlined.Navigation
import androidx.compose.material.icons.outlined.Person
import androidx.compose.material.icons.outlined.ShoppingBag
import androidx.compose.material.icons.outlined.Smartphone
import androidx.compose.material.icons.outlined.Warning
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import com.freshdelivery.nativedriver.ui.theme.FreshAmber
import com.freshdelivery.nativedriver.ui.theme.FreshBlue
import com.freshdelivery.nativedriver.ui.theme.FreshError
import com.freshdelivery.nativedriver.ui.theme.FreshGreen
import com.freshdelivery.nativedriver.ui.theme.FreshOrange
import com.freshdelivery.nativedriver.ui.theme.FreshPurple
import java.time.OffsetDateTime
import java.time.ZoneId

/**
 * Shared support-category metadata + ticket display helpers used by both the
 * Support Center and the Inbox ticket list so they never drift apart.
 */
data class SupportCategory(
    val key: String,
    val label: String,
    val hint: String,
    val icon: ImageVector,
    val color: Color,
    val urgent: Boolean = false,
)

val supportCategories = listOf(
    SupportCategory("emergency", "Έκτακτο", "Ατύχημα, ασφάλεια", Icons.Outlined.Warning, FreshError, urgent = true),
    SupportCategory("order_issue", "Παραγγελία", "Λάθος / λείπει προϊόν", Icons.Outlined.ShoppingBag, FreshAmber),
    SupportCategory("customer_issue", "Πελάτης", "Δεν απαντά, διεύθυνση", Icons.Outlined.Person, FreshBlue),
    SupportCategory("navigation", "Πλοήγηση", "Λάθος διαδρομή / GPS", Icons.Outlined.Navigation, FreshPurple),
    SupportCategory("vehicle_issue", "Όχημα", "Βλάβη, καύσιμα", Icons.Outlined.DirectionsCar, FreshOrange),
    SupportCategory("payment", "Πληρωμές", "Κέρδη, πορτοφόλι", Icons.Outlined.CreditCard, FreshGreen),
    SupportCategory("app_issue", "Εφαρμογή", "Bug, σφάλμα", Icons.Outlined.Smartphone, Color(0xFF64748B)),
)

fun supportCategory(key: String?): SupportCategory? =
    supportCategories.firstOrNull { it.key == key }

fun supportCategoryLabel(key: String?): String =
    supportCategory(key)?.label ?: (key?.takeIf { it.isNotBlank() } ?: "Αίτημα")

fun ticketStatusLabel(status: String?): String = when (status?.lowercase()) {
    "open" -> "Ανοιχτό"
    "in_progress" -> "Σε εξέλιξη"
    "pending" -> "Εκκρεμεί"
    "resolved", "closed" -> "Επιλύθηκε"
    else -> status?.takeIf { it.isNotBlank() } ?: "Ανοιχτό"
}

fun ticketStatusColor(status: String?): Color = when (status?.lowercase()) {
    "resolved", "closed" -> FreshGreen
    "in_progress", "pending" -> FreshAmber
    else -> FreshBlue
}

fun formatTicketTime(iso: String?): String {
    if (iso.isNullOrBlank()) return ""
    return runCatching {
        val dt = OffsetDateTime.parse(iso).atZoneSameInstant(ZoneId.systemDefault())
        "%02d/%02d %02d:%02d".format(dt.monthValue, dt.dayOfMonth, dt.hour, dt.minute)
    }.getOrDefault(iso.take(16).replace("T", " "))
}
