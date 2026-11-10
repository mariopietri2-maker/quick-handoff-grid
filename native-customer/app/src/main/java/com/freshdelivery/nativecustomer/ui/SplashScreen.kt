package com.freshdelivery.nativecustomer.ui

import androidx.compose.animation.core.FastOutSlowInEasing
import androidx.compose.animation.core.LinearEasing
import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.tween
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.geometry.CornerRadius
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.drawscope.rotate
import androidx.compose.ui.graphics.drawscope.translate
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import kotlin.math.sin

/**
 * Launch splash — Fresh2GO stamp: orange app icon, white delivery bag,
 * souvlaki / crepe / pizza slice animate out of the bag (matches merch mark).
 */
@Composable
fun SplashScreen(
    appName: String = "Fresh2GO",
    tagline: String = "Fresh Meals. Fast Delivery.",
) {
    val infinite = rememberInfiniteTransition(label = "splash")

    // Full loop ~3.2s: food rises out, holds, settles
    val t by infinite.animateFloat(
        initialValue = 0f,
        targetValue = 1f,
        animationSpec = infiniteRepeatable(
            animation = tween(3200, easing = LinearEasing),
            repeatMode = RepeatMode.Restart,
        ),
        label = "progress",
    )

    // Soft pulse on the icon
    val pulse by infinite.animateFloat(
        initialValue = 0.98f,
        targetValue = 1.02f,
        animationSpec = infiniteRepeatable(
            animation = tween(1400, easing = FastOutSlowInEasing),
            repeatMode = RepeatMode.Reverse,
        ),
        label = "pulse",
    )

    // Loading dots
    val dotPhase by infinite.animateFloat(
        initialValue = 0f,
        targetValue = 3f,
        animationSpec = infiniteRepeatable(
            animation = tween(900, easing = LinearEasing),
            repeatMode = RepeatMode.Restart,
        ),
        label = "dots",
    )

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(Color.White),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center,
    ) {
        Box(
            modifier = Modifier
                .size(168.dp)
                .graphicsLayer {
                    scaleX = pulse
                    scaleY = pulse
                }
                .shadow(16.dp, RoundedCornerShape(40.dp))
                .clip(RoundedCornerShape(40.dp))
                .background(
                    Brush.linearGradient(
                        colors = listOf(
                            Color(0xFFF4A125),
                            Color(0xFFFF8A3D),
                            Color(0xFFEA580C),
                        ),
                    ),
                ),
            contentAlignment = Alignment.Center,
        ) {
            // Animated bag + food (design-space 64×64)
            Canvas(Modifier.size(140.dp)) {
                val s = size.minDimension / 64f
                val progress = t

                // Rise curve: 0→0.35 pop up, 0.35→0.7 hold, 0.7→1 settle slightly
                fun rise(delay: Float, amount: Float): Float {
                    val p = ((progress - delay) / 0.35f).coerceIn(0f, 1f)
                    val eased = FastOutSlowInEasing.transform(p)
                    val settle = if (progress > 0.7f) {
                        1f - 0.08f * ((progress - 0.7f) / 0.3f).coerceIn(0f, 1f)
                    } else 1f
                    return -amount * s * eased * settle
                }

                fun alphaIn(delay: Float): Float {
                    return ((progress - delay) / 0.2f).coerceIn(0f, 1f)
                }

                // --- Food BEHIND bag rim (drawn first) ---
                // Souvlaki (left)
                translate(left = 0f, top = rise(0.05f, 18f)) {
                    val a = alphaIn(0.05f)
                    // stick
                    drawLine(
                        color = Color(0xFFB8956A).copy(alpha = a),
                        start = Offset(18f * s, 22f * s),
                        end = Offset(22f * s, 8f * s),
                        strokeWidth = 1.4f * s,
                        cap = StrokeCap.Round,
                    )
                    // meat cubes
                    val meat = Color(0xFF8B4513).copy(alpha = a)
                    val meatHi = Color(0xFFA0522D).copy(alpha = a)
                    for (i in 0..2) {
                        val y = (18f - i * 4.2f) * s
                        drawRoundRect(
                            color = if (i % 2 == 0) meat else meatHi,
                            topLeft = Offset(16.5f * s, y),
                            size = Size(5.5f * s, 3.8f * s),
                            cornerRadius = CornerRadius(1.2f * s),
                        )
                    }
                    // pita disc
                    drawCircle(
                        color = Color(0xFFE8C99B).copy(alpha = a * 0.95f),
                        radius = 5.5f * s,
                        center = Offset(16f * s, 24f * s),
                    )
                    drawCircle(
                        color = Color(0xFFD4B483).copy(alpha = a * 0.5f),
                        radius = 5.5f * s,
                        center = Offset(16f * s, 24f * s),
                        style = Stroke(width = 0.8f * s),
                    )
                }

                // Crepe (center)
                translate(left = 0f, top = rise(0.12f, 20f)) {
                    val a = alphaIn(0.12f)
                    rotate(degrees = -8f, pivot = Offset(32f * s, 18f * s)) {
                        // cone
                        val cone = Path().apply {
                            moveTo(32f * s, 6f * s)
                            lineTo(24f * s, 26f * s)
                            lineTo(40f * s, 26f * s)
                            close()
                        }
                        drawPath(cone, Color(0xFFE8C070).copy(alpha = a))
                        // filling
                        drawCircle(Color(0xFF7CB342).copy(alpha = a), 2f * s, Offset(30f * s, 12f * s))
                        drawCircle(Color(0xFFE57373).copy(alpha = a), 1.6f * s, Offset(34f * s, 13f * s))
                        drawCircle(Color.White.copy(alpha = a), 1.4f * s, Offset(32f * s, 10f * s))
                    }
                }

                // Pizza (right)
                translate(left = 0f, top = rise(0.08f, 17f)) {
                    val a = alphaIn(0.08f)
                    rotate(degrees = 18f, pivot = Offset(48f * s, 20f * s)) {
                        val slice = Path().apply {
                            moveTo(48f * s, 8f * s)
                            lineTo(40f * s, 26f * s)
                            lineTo(56f * s, 26f * s)
                            close()
                        }
                        drawPath(slice, Color(0xFFF5D08A).copy(alpha = a))
                        // cheese layer
                        val cheese = Path().apply {
                            moveTo(48f * s, 11f * s)
                            lineTo(42f * s, 24f * s)
                            lineTo(54f * s, 24f * s)
                            close()
                        }
                        drawPath(cheese, Color(0xFFFFE082).copy(alpha = a * 0.9f))
                        // pepperoni
                        drawCircle(Color(0xFFC62828).copy(alpha = a), 1.8f * s, Offset(46f * s, 16f * s))
                        drawCircle(Color(0xFFC62828).copy(alpha = a), 1.5f * s, Offset(50f * s, 18f * s))
                        drawCircle(Color(0xFFC62828).copy(alpha = a), 1.3f * s, Offset(47.5f * s, 21f * s))
                    }
                }

                // Soft steam
                if (progress > 0.2f) {
                    val sa = ((sin((progress * 6f).toDouble()).toFloat() + 1f) / 2f) * 0.45f
                    drawCircle(Color.White.copy(alpha = sa), 1.2f * s, Offset(28f * s, 6f * s))
                    drawCircle(Color.White.copy(alpha = sa * 0.7f), 1f * s, Offset(36f * s, 4f * s))
                }

                // --- White shopping bag (front) ---
                // Handle
                drawPath(
                    path = Path().apply {
                        moveTo(24f * s, 34f * s)
                        quadraticBezierTo(32f * s, 22f * s, 40f * s, 34f * s)
                    },
                    color = Color.White,
                    style = Stroke(width = 3.2f * s, cap = StrokeCap.Round),
                )
                // Bag body
                drawRoundRect(
                    color = Color.White,
                    topLeft = Offset(16f * s, 32f * s),
                    size = Size(32f * s, 26f * s),
                    cornerRadius = CornerRadius(5f * s, 5f * s),
                )
                // Orange brand line
                drawRoundRect(
                    color = Color(0xFFFF8A3D),
                    topLeft = Offset(24f * s, 44f * s),
                    size = Size(16f * s, 2.2f * s),
                    cornerRadius = CornerRadius(1.2f * s),
                )
            }
        }

        Spacer(Modifier.height(28.dp))

        // Wordmark: Fresh2GO + .GR pill
        Row(verticalAlignment = Alignment.CenterVertically) {
            Text("Fresh", color = Color(0xFF111111), fontWeight = FontWeight.ExtraBold, fontSize = 28.sp)
            Text("2", color = Color(0xFFFF6B00), fontWeight = FontWeight.ExtraBold, fontSize = 28.sp)
            Text("GO", color = Color(0xFFF4A125), fontWeight = FontWeight.ExtraBold, fontSize = 28.sp)
            Spacer(Modifier.size(8.dp))
            Box(
                Modifier
                    .clip(RoundedCornerShape(8.dp))
                    .background(Color(0xFFFF8A3D))
                    .size(height = 26.dp, width = 40.dp),
                contentAlignment = Alignment.Center,
            ) {
                Text(".GR", color = Color.White, fontWeight = FontWeight.Bold, fontSize = 12.sp)
            }
        }

        Spacer(Modifier.height(10.dp))
        Text(
            tagline,
            color = Color(0xFF9CA3AF),
            fontWeight = FontWeight.Medium,
            fontSize = 14.sp,
        )

        Spacer(Modifier.height(28.dp))
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            for (i in 0..2) {
                val active = (dotPhase.toInt() % 3) == i
                Box(
                    Modifier
                        .size(if (active) 9.dp else 7.dp)
                        .clip(CircleShape)
                        .background(
                            if (active) Color(0xFFFF8A3D) else Color(0xFFFF8A3D).copy(alpha = 0.28f),
                        ),
                )
            }
        }
    }
}
