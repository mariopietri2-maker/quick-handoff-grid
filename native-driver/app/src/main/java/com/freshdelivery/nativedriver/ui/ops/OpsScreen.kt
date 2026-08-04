package com.freshdelivery.nativedriver.ui.ops

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.Close
import androidx.compose.material.icons.outlined.Refresh
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.freshdelivery.nativedriver.data.OfferUi

private val GreenBtn = Color(0xFF1DB954)
private val TextDark = Color(0xFF1A1A1A)
private val TextMuted = Color(0xFF6B7280)

private fun eur(v: Double): String = "%.2f".format(v) + "€"

@Composable
fun OpsScreen(
    orders: List<OfferUi>,
    busy: Boolean,
    onClaim: (orderId: String) -> Unit,
    onRefresh: () -> Unit,
    onClose: () -> Unit,
) {
    Column(
        Modifier
            .fillMaxSize()
            .background(Color(0xFFF3F4F6))
            .padding(top = 8.dp),
    ) {
        Row(
            Modifier
                .fillMaxWidth()
                .padding(horizontal = 12.dp, vertical = 8.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            IconButton(onClick = onClose) {
                Icon(Icons.Outlined.Close, contentDescription = "Close")
            }
            Column(Modifier.weight(1f)) {
                Text("Ops", fontWeight = FontWeight.Bold, fontSize = 20.sp, color = TextDark)
                Text(
                    "${orders.size} διαθέσιμες παραγγελίες",
                    fontSize = 13.sp,
                    color = TextMuted,
                )
            }
            IconButton(onClick = onRefresh) {
                Icon(Icons.Outlined.Refresh, contentDescription = "Refresh")
            }
        }

        if (orders.isEmpty()) {
            Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                Text("Καμία ανοιχτή παραγγελία", color = TextMuted)
            }
        } else {
            LazyColumn(
                Modifier.fillMaxSize().padding(horizontal = 12.dp),
                verticalArrangement = Arrangement.spacedBy(10.dp),
            ) {
                items(orders, key = { it.order.id }) { offer ->
                    OpsOrderCard(
                        offer = offer,
                        busy = busy,
                        onClaim = { onClaim(offer.order.id) },
                    )
                }
                item { Spacer(Modifier.height(24.dp)) }
            }
        }
    }
}

@Composable
private fun OpsOrderCard(
    offer: OfferUi,
    busy: Boolean,
    onClaim: () -> Unit,
) {
    val payout = (offer.order.driver_payout ?: 0.0) +
        (offer.order.tip_amount ?: 0.0) +
        (offer.order.driver_pool_bonus ?: 0.0)
    val code = offer.order.store_order_number?.toString() ?: offer.order.id.takeLast(4)
    val isCash = offer.order.payment_method?.equals("cash", ignoreCase = true) == true

    Card(
        Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(18.dp),
        colors = CardDefaults.cardColors(containerColor = Color.White),
        elevation = CardDefaults.cardElevation(2.dp),
    ) {
        Column(Modifier.padding(14.dp)) {
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                Column(Modifier.weight(1f)) {
                    Text(
                        "#$code · ${offer.order.status}",
                        fontSize = 12.sp,
                        color = TextMuted,
                        fontWeight = FontWeight.SemiBold,
                    )
                    Text(
                        offer.storeName ?: "Κατάστημα",
                        fontWeight = FontWeight.Bold,
                        fontSize = 17.sp,
                        color = TextDark,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis,
                    )
                }
                Text(eur(payout), fontWeight = FontWeight.Bold, fontSize = 18.sp, color = GreenBtn)
            }
            if (!offer.storeAddress.isNullOrBlank()) {
                Text(offer.storeAddress!!, fontSize = 12.sp, color = TextMuted, maxLines = 1, overflow = TextOverflow.Ellipsis)
            }
            if (!offer.order.delivery_address.isNullOrBlank()) {
                Text(
                    "→ ${offer.order.delivery_address}",
                    fontSize = 13.sp,
                    color = TextDark,
                    maxLines = 2,
                    overflow = TextOverflow.Ellipsis,
                    modifier = Modifier.padding(top = 4.dp),
                )
            }
            Row(
                Modifier.padding(top = 8.dp),
                horizontalArrangement = Arrangement.spacedBy(6.dp),
            ) {
                if (isCash) {
                    Tag("Μετρητά ${eur(offer.order.total_amount ?: 0.0)}", Color(0xFFFFF3E0), Color(0xFFE65100))
                }
                offer.order.distance_km?.let {
                    Tag("%.1f km".format(it), Color(0xFFF3F4F6), TextMuted)
                }
                if (!offer.order.driver_id.isNullOrBlank()) {
                    Tag("Έχει οδηγό", Color(0xFFFFEBEE), Color(0xFFC62828))
                }
            }
            Spacer(Modifier.height(10.dp))
            Button(
                onClick = onClaim,
                enabled = !busy,
                modifier = Modifier.fillMaxWidth().height(46.dp),
                shape = RoundedCornerShape(14.dp),
                colors = ButtonDefaults.buttonColors(containerColor = GreenBtn, contentColor = Color.White),
            ) {
                if (busy) CircularProgressIndicator(Modifier.size(18.dp), color = Color.White, strokeWidth = 2.dp)
                else Text("Ανάληψη παραγγελίας", fontWeight = FontWeight.Bold)
            }
        }
    }
}

@Composable
private fun Tag(text: String, bg: Color, fg: Color) {
    Text(
        text,
        fontSize = 11.sp,
        fontWeight = FontWeight.SemiBold,
        color = fg,
        modifier = Modifier
            .clip(RoundedCornerShape(12.dp))
            .background(bg)
            .padding(horizontal = 8.dp, vertical = 4.dp),
    )
}
