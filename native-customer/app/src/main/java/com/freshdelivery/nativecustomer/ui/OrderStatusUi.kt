package com.freshdelivery.nativecustomer.ui

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.freshdelivery.nativecustomer.ui.theme.FreshChip
import com.freshdelivery.nativecustomer.ui.theme.FreshGreen
import com.freshdelivery.nativecustomer.ui.theme.FreshGreenDark
import com.freshdelivery.nativecustomer.ui.theme.FreshGreenSoft
import com.freshdelivery.nativecustomer.ui.theme.FreshInk
import com.freshdelivery.nativecustomer.ui.theme.FreshMuted
import com.freshdelivery.nativecustomer.ui.theme.FreshRose
import com.freshdelivery.nativecustomer.ui.theme.FreshRoseSoft
import com.freshdelivery.nativecustomer.ui.theme.FreshViolet
import com.freshdelivery.nativecustomer.ui.theme.FreshVioletSoft

@Composable
internal fun SummaryLine(label: String, amount: Double) {
    Row(
        Modifier
            .fillMaxWidth()
            .padding(vertical = 3.dp),
        horizontalArrangement = Arrangement.SpaceBetween,
    ) {
        Text(label, color = FreshMuted)
        Text("€" + "%.2f".format(amount), fontWeight = FontWeight.SemiBold)
    }
}

internal fun statusLabel(status: String): String = when (status) {
    "placed" -> "Καταχωρήθηκε"
    "pending" -> "Σε αναμονή"
    "accepted", "confirmed" -> "Αποδεκτή"
    "preparing" -> "Ετοιμάζεται"
    "ready" -> "Έτοιμη"
    "picked_up", "on_the_way", "in_transit" -> "Καθ' οδόν"
    "delivered" -> "Παραδόθηκε"
    "cancelled" -> "Ακυρώθηκε"
    "rejected" -> "Απορρίφθηκε"
    "refunded" -> "Επιστροφή χρημάτων"
    else -> status
}

internal fun statusColors(status: String): Pair<Color, Color> = when {
    status in listOf("pending", "accepted", "confirmed", "preparing", "ready", "picked_up", "on_the_way", "in_transit") ->
        FreshVioletSoft to FreshViolet
    status == "delivered" -> FreshGreenSoft to FreshGreenDark
    status in listOf("cancelled", "rejected", "refunded") -> FreshRoseSoft to FreshRose
    else -> FreshChip to FreshInk
}

@Composable
internal fun StatusPill(status: String) {
    val (bg, fg) = statusColors(status)
    Surface(
        color = bg,
        shape = RoundedCornerShape(10.dp),
    ) {
        Text(
            statusLabel(status),
            color = fg,
            fontWeight = FontWeight.Bold,
            style = MaterialTheme.typography.labelMedium,
            modifier = Modifier.padding(horizontal = 10.dp, vertical = 5.dp),
        )
    }
}


internal fun paymentStatusLabel(method: String?, status: String?, orderStatus: String?): String? {
    val m = method?.lowercase().orEmpty()
    if (m != "card" && m != "stripe") {
        if (m == "cash") return "Πληρωμή: μετρητά"
        return null
    }
    val ps = status?.lowercase().orEmpty()
    return when {
        ps in setOf("paid", "succeeded", "complete", "completed") -> "Πληρώθηκε με κάρτα ✓"
        orderStatus != null && orderStatus !in setOf("pending", "placed") && ps !in setOf("failed", "unpaid") ->
            "Πληρώθηκε με κάρτα ✓"
        ps in setOf("failed", "canceled", "cancelled") -> "Πληρωμή απέτυχε"
        else -> "Αναμονή πληρωμής κάρτας"
    }
}

internal fun isOrderPaid(method: String?, paymentStatus: String?, orderStatus: String?): Boolean {
    val m = method?.lowercase().orEmpty()
    if (m == "cash" || m == "cod") return true
    val ps = paymentStatus?.lowercase().orEmpty()
    if (ps in setOf("paid", "succeeded", "complete", "completed")) return true
    if (orderStatus != null && orderStatus !in setOf("pending", "placed")) return m == "card" || m == "stripe" || m.isEmpty()
    return false
}
