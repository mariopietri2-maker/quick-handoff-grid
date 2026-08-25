package com.freshdelivery.nativecustomer.ui

import androidx.compose.animation.core.FastOutSlowInEasing
import androidx.compose.animation.core.LinearOutSlowInEasing
import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.tween
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.Storefront
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.freshdelivery.nativecustomer.ui.theme.FreshGreen
import com.freshdelivery.nativecustomer.ui.theme.FreshTeal

/** Emerald v2 launch splash — mirrors web `#splash`. */
@Composable
fun SplashScreen(
    appName: String = "Fresh Delivery",
    tagline: String = "Fast · Fresh · Local",
) {
    val infinite = rememberInfiniteTransition(label = "splash")
    val ringScale by infinite.animateFloat(
        initialValue = 0.8f,
        targetValue = 1.7f,
        animationSpec = infiniteRepeatable(
            animation = tween(1_700, easing = LinearOutSlowInEasing),
            repeatMode = RepeatMode.Restart,
        ),
        label = "splashRing",
    )
    val barProgress by infinite.animateFloat(
        initialValue = 0f,
        targetValue = 1f,
        animationSpec = infiniteRepeatable(
            animation = tween(1_500, easing = FastOutSlowInEasing),
            repeatMode = RepeatMode.Restart,
        ),
        label = "splashBar",
    )
    Box(
        Modifier
            .fillMaxSize()
            .background(
                Brush.radialGradient(
                    colors = listOf(
                        Color(0xFF0FB876).copy(alpha = 0.22f),
                        Color(0xFF0A0D0C),
                    ),
                    radius = 1200f,
                ),
            )
            .background(Color(0xFF0A0D0C)),
        contentAlignment = Alignment.Center,
    ) {
        Column(horizontalAlignment = Alignment.CenterHorizontally) {
            Box(
                Modifier.size(96.dp),
                contentAlignment = Alignment.Center,
            ) {
                Box(
                    Modifier
                        .size(96.dp)
                        .graphicsLayer {
                            scaleX = ringScale
                            scaleY = ringScale
                        }
                        .border(
                            width = 2.dp,
                            color = Color(0xFFA3E635).copy(alpha = (1f - ringScale / 1.7f).coerceIn(0f, 0.6f)),
                            shape = RoundedCornerShape(32.dp),
                        ),
                )
                Box(
                    Modifier
                        .size(96.dp)
                        .shadow(26.dp, RoundedCornerShape(32.dp))
                        .clip(RoundedCornerShape(32.dp))
                        .background(Brush.linearGradient(listOf(Color(0xFF0B8F5F), FreshGreen, Color(0xFF2DD4BF))))
                        .border(0.5.dp, Color.White.copy(alpha = 0.3f), RoundedCornerShape(32.dp)),
                    contentAlignment = Alignment.Center,
                ) {
                    Icon(
                        Icons.Outlined.Storefront,
                        contentDescription = null,
                        tint = Color.White,
                        modifier = Modifier.size(44.dp),
                    )
                }
            }
            Spacer(Modifier.height(28.dp))
            Text(
                appName,
                color = Color.White,
                fontSize = 26.sp,
                fontWeight = FontWeight.Black,
                letterSpacing = (-0.5).sp,
            )
            Spacer(Modifier.height(6.dp))
            Text(
                tagline,
                color = Color(0xFF9CA3AF),
                fontSize = 13.sp,
            )
            Spacer(Modifier.height(32.dp))
            Box(
                Modifier
                    .width(160.dp)
                    .height(4.dp)
                    .clip(RoundedCornerShape(99.dp))
                    .background(Color.White.copy(alpha = 0.1f)),
            ) {
                Box(
                    Modifier
                        .fillMaxWidth(barProgress)
                        .fillMaxHeight()
                        .background(Brush.horizontalGradient(listOf(FreshGreen, FreshTeal))),
                )
            }
        }
    }
}
