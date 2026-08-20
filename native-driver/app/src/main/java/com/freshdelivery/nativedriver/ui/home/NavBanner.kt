package com.freshdelivery.nativedriver.ui.home

import android.content.Intent
import android.net.Uri
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Navigation
import androidx.compose.material.icons.outlined.OpenInNew
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.freshdelivery.nativedriver.data.ActiveTripUi

@Composable
fun NavBanner(trip: ActiveTripUi, modifier: Modifier = Modifier) {
    val context = LocalContext.current
    val destLat = trip.order.delivery_latitude
    val destLng = trip.order.delivery_longitude
    val address = trip.order.delivery_address ?: "Προορισμός"
    val canNav = destLat != null && destLng != null
    Row(
        modifier = modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(12.dp))
            .background(Color(0xFF0F172A))
            .clickable(enabled = canNav) {
                if (canNav) {
                    val uri = Uri.parse("google.navigation:q=$destLat,$destLng&mode=d")
                    val intent = Intent(Intent.ACTION_VIEW, uri).apply { setPackage("com.google.android.apps.maps") }
                    runCatching { context.startActivity(intent) }.onFailure {
                        context.startActivity(Intent(Intent.ACTION_VIEW, Uri.parse("geo:$destLat,$destLng?q=$destLat,$destLng")))
                    }
                }
            }
            .padding(horizontal = 14.dp, vertical = 12.dp)
            .semantics { contentDescription = "Πλοήγηση προς $address" },
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.SpaceBetween,
    ) {
        Row(verticalAlignment = Alignment.CenterVertically, modifier = Modifier.weight(1f)) {
            Icon(Icons.Filled.Navigation, null, tint = Color(0xFF34D399), modifier = Modifier.size(28.dp))
            Spacer(Modifier.width(10.dp))
            Column {
                Text("Πλοήγηση", color = Color.White, fontWeight = FontWeight.SemiBold, fontSize = 14.sp)
                Text(address, color = Color(0xFF94A3B8), fontSize = 12.sp, maxLines = 1)
            }
        }
        Icon(Icons.Outlined.OpenInNew, "Άνοιγμα Google Maps", tint = Color(0xFF94A3B8), modifier = Modifier.size(20.dp))
    }
}
