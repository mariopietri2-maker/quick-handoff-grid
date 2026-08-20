package com.freshdelivery.nativedriver.ui.home

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Bolt
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp

@Composable
fun SurgeBanner(multiplier: Double? = null, waitBonusEuro: Double? = null, modifier: Modifier = Modifier) {
    val hasSurge = multiplier != null && multiplier > 1.0
    val hasWait = waitBonusEuro != null && waitBonusEuro > 0
    if (!hasSurge && !hasWait) return
    val label = buildString {
        if (hasSurge) append("Surge ×${"%.1f".format(multiplier)}")
        if (hasSurge && hasWait) append(" · ")
        if (hasWait) append("+€${"%.2f".format(waitBonusEuro)} αναμονή")
    }
    Row(
        modifier = modifier.fillMaxWidth().clip(RoundedCornerShape(10.dp)).background(Color(0xFF7C3AED))
            .padding(horizontal = 12.dp, vertical = 8.dp).semantics { contentDescription = label },
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Icon(Icons.Filled.Bolt, null, tint = Color(0xFFFDE68A), modifier = Modifier.size(20.dp))
        Spacer(Modifier.width(8.dp))
        Text(label, color = Color.White, fontWeight = FontWeight.SemiBold, fontSize = 13.sp)
    }
}
