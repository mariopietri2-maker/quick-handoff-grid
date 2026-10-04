package com.freshdelivery.nativecustomer.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
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
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.freshdelivery.nativecustomer.ui.theme.FreshChip
import com.freshdelivery.nativecustomer.ui.theme.FreshGreen
import com.freshdelivery.nativecustomer.ui.theme.FreshGreenDark
import com.freshdelivery.nativecustomer.ui.theme.FreshInk

@Composable
internal fun FreshCartBar(
    count: Int,
    total: Double,
    onClick: () -> Unit,
    minOrder: Double = 0.0,
) {
    val needMore = minOrder > 0 && total < minOrder
    val progress = if (minOrder > 0) (total / minOrder).toFloat().coerceIn(0f, 1f) else 1f
    Column(
        Modifier
            .fillMaxWidth()
            .padding(horizontal = 12.dp, vertical = 6.dp),
    ) {
        if (needMore) {
            Surface(
                color = Color.White,
                shape = RoundedCornerShape(16.dp),
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(bottom = 8.dp)
                    .shadow(6.dp, RoundedCornerShape(16.dp)),
            ) {
                Column(Modifier.padding(horizontal = 14.dp, vertical = 10.dp)) {
                    Text(
                        "Πρόσθεσε €%.2f για ελάχιστη παραγγελία".format(minOrder - total),
                        color = FreshInk,
                        fontWeight = FontWeight.SemiBold,
                        style = MaterialTheme.typography.labelLarge,
                    )
                    Spacer(Modifier.height(8.dp))
                    Box(
                        Modifier
                            .fillMaxWidth()
                            .height(5.dp)
                            .clip(RoundedCornerShape(3.dp))
                            .background(FreshChip),
                    ) {
                        Box(
                            Modifier
                                .fillMaxWidth(progress)
                                .height(5.dp)
                                .clip(RoundedCornerShape(3.dp))
                                .background(FreshGreen),
                        )
                    }
                }
            }
        }
        Box(
            Modifier
                .fillMaxWidth()
                .height(54.dp)
                .shadow(10.dp, RoundedCornerShape(14.dp))
                .clip(RoundedCornerShape(14.dp))
                .background(FreshGreen)
                .clickable(onClick = onClick),
        ) {
            Row(
                Modifier
                    .fillMaxSize()
                    .padding(horizontal = 10.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Box(
                    Modifier
                        .size(34.dp)
                        .clip(RoundedCornerShape(8.dp))
                        .background(Color.White),
                    contentAlignment = Alignment.Center,
                ) {
                    Text(
                        "$count",
                        color = FreshGreenDark,
                        fontWeight = FontWeight.Bold,
                        fontSize = 15.sp,
                    )
                }
                Text(
                    "Καλάθι",
                    color = Color.White,
                    fontWeight = FontWeight.Bold,
                    fontSize = 17.sp,
                    modifier = Modifier.weight(1f),
                    textAlign = TextAlign.Center,
                )
                Text(
                    "%.2f€".format(total),
                    color = Color.White,
                    fontWeight = FontWeight.Bold,
                    fontSize = 16.sp,
                    modifier = Modifier.padding(end = 6.dp),
                )
            }
        }
    }
}
