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

/**
 * Launch splash — website-style basket logo:
 * lid opens, burger / souvlaki / crepe pop up, soft loading dots (no scan bar).
 */
@Composable
fun SplashScreen(
    appName: String = "Fresh2GO",
    tagline: String = "Fresh Meals. Fast Delivery.",
) {
    val infinite = rememberInfiniteTransition(label = "splash")

    // 0 → 1 loop over 3.5s (matches web AnimatedBasketLogo timing)
    val t by infinite.animateFloat(
        initialValue = 0f,
        targetValue = 1f,
        animationSpec = infiniteRepeatable(
            animation = tween(3_500, easing = LinearEasing),
            repeatMode = RepeatMode.Restart,
        ),
        label = "cycle",
    )

    // Soft enter for mark + copy
    val enter by infinite.animateFloat(
        initialValue = 0f,
        targetValue = 1f,
        animationSpec = infiniteRepeatable(
            animation = tween(900, easing = FastOutSlowInEasing),
            repeatMode = RepeatMode.Restart,
        ),
        label = "enterUnused",
    )
    // One-shot style opacity via clamped first-cycle feel — keep mark fully visible
    val markAlpha = 1f
    val markScale = 1f

    val dotPhase by infinite.animateFloat(
        initialValue = 0f,
        targetValue = 1f,
        animationSpec = infiniteRepeatable(
            animation = tween(1_200, easing = FastOutSlowInEasing),
            repeatMode = RepeatMode.Restart,
        ),
        label = "dots",
    )

    Box(
        Modifier
            .fillMaxSize()
            .background(Color(0xFF0A0C10)),
        contentAlignment = Alignment.Center,
    ) {
        // Soft orange ambient glow
        Box(
            Modifier
                .size(240.dp)
                .graphicsLayer { alpha = 0.55f }
                .background(
                    Brush.radialGradient(
                        colors = listOf(
                            Color(0xFFEA580C).copy(alpha = 0.22f),
                            Color.Transparent,
                        ),
                    ),
                    shape = CircleShape,
                ),
        )

        Column(horizontalAlignment = Alignment.CenterHorizontally) {
            Box(
                Modifier
                    .size(132.dp)
                    .shadow(28.dp, RoundedCornerShape(32.dp))
                    .clip(RoundedCornerShape(32.dp)),
                contentAlignment = Alignment.Center,
            ) {
                AnimatedBasketMark(progress = t, modifier = Modifier.fillMaxSize())
            }

            Spacer(Modifier.height(32.dp))

            Text(
                appName.ifBlank { "Fresh2GO" },
                color = Color.White,
                fontSize = 28.sp,
                fontWeight = FontWeight.Bold,
                letterSpacing = (-0.5).sp,
            )
            Spacer(Modifier.height(8.dp))
            Text(
                tagline.ifBlank { "Fresh Meals. Fast Delivery." },
                color = Color(0xFF64748B),
                fontSize = 13.sp,
            )

            Spacer(Modifier.height(28.dp))

            // Soft dots — not a scanning bar
            Row(
                horizontalArrangement = Arrangement.spacedBy(8.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                repeat(3) { i ->
                    val phase = (dotPhase + i * 0.22f) % 1f
                    val a = 0.25f + 0.75f * (1f - kotlin.math.abs(phase - 0.5f) * 2f).coerceIn(0f, 1f)
                    val s = 0.85f + 0.2f * a
                    Box(
                        Modifier
                            .size((6 * s).dp)
                            .graphicsLayer { alpha = a }
                            .background(Color(0xFFEA580C), CircleShape),
                    )
                }
            }
        }
    }
}

/**
 * Canvas recreation of website AnimatedBasketLogo (lid + foods).
 * [progress] is 0f..1f over one 3.5s cycle.
 */
@Composable
private fun AnimatedBasketMark(
    progress: Float,
    modifier: Modifier = Modifier,
) {
    // Lid: open to -55° by 0.3, hold to 0.75, close by 1.0
    val lidAngle = when {
        progress < 0.3f -> -55f * (progress / 0.3f)
        progress < 0.75f -> -55f
        else -> -55f * (1f - (progress - 0.75f) / 0.25f)
    }

    fun foodY(start: Float, peak: Float, holdEnd: Float, rise: Float): Float {
        return when {
            progress < start -> 0f
            progress < peak -> -rise * ((progress - start) / (peak - start))
            progress < holdEnd -> -rise
            else -> -rise * (1f - (progress - holdEnd) / (1f - holdEnd).coerceAtLeast(0.01f))
        }
    }

    fun foodAlpha(appear: Float, holdEnd: Float, gone: Float): Float {
        return when {
            progress < appear -> 0f
            progress < appear + 0.08f -> (progress - appear) / 0.08f
            progress < holdEnd -> 1f
            progress < gone -> 1f - (progress - holdEnd) / (gone - holdEnd).coerceAtLeast(0.01f)
            else -> 0f
        }.coerceIn(0f, 1f)
    }

    val burgerY = foodY(0.05f, 0.25f, 0.7f, 16f)
    val burgerA = foodAlpha(0.12f, 0.72f, 0.95f)
    val souvY = foodY(0.08f, 0.28f, 0.68f, 18f)
    val souvA = foodAlpha(0.15f, 0.7f, 0.93f)
    val crepeY = foodY(0.1f, 0.3f, 0.66f, 14f)
    val crepeA = foodAlpha(0.18f, 0.68f, 0.91f)

    Canvas(modifier = modifier) {
        val w = size.width
        val h = size.height
        val s = w / 64f // scale from 64x64 design space

        // Brand gradient background
        drawRoundRect(
            brush = Brush.linearGradient(
                colors = listOf(
                    Color(0xFFF4A125),
                    Color(0xFFFF8A3D),
                    Color(0xFFE94E8F),
                ),
                start = Offset.Zero,
                end = Offset(w, h),
            ),
            cornerRadius = CornerRadius(16f * s, 16f * s),
        )

        // Basket body
        drawRoundRect(
            color = Color(0xFFF8F5F0),
            topLeft = Offset(16f * s, 30f * s),
            size = Size(32f * s, 20f * s),
            cornerRadius = CornerRadius(5f * s, 5f * s),
        )
        // Weave lines
        listOf(34f, 38f, 42f, 46f).forEach { y ->
            drawLine(
                color = Color(0xFFE8D5B8),
                start = Offset(22f * s, y * s),
                end = Offset(42f * s, y * s),
                strokeWidth = 1.2f * s,
                cap = StrokeCap.Round,
            )
        }
        // Rim
        drawRoundRect(
            color = Color(0xFFFF8A3D),
            topLeft = Offset(14f * s, 28f * s),
            size = Size(36f * s, 5f * s),
            cornerRadius = CornerRadius(2.5f * s, 2.5f * s),
        )
        // Handle
        val handle = Path().apply {
            moveTo(24f * s, 28f * s)
            quadraticBezierTo(32f * s, 20.5f * s, 40f * s, 28f * s)
        }
        drawPath(
            handle,
            color = Color(0xFFFF8A3D),
            style = Stroke(width = 3f * s, cap = StrokeCap.Round),
        )

        // Lid (pivots at rim center)
        rotate(lidAngle, pivot = Offset(32f * s, 28f * s)) {
            drawRoundRect(
                color = Color(0xFFF4A125),
                topLeft = Offset(13f * s, 24f * s),
                size = Size(38f * s, 5f * s),
                cornerRadius = CornerRadius(2.5f * s, 2.5f * s),
            )
        }

        // Burger
        if (burgerA > 0.02f) {
            translate(left = 0f, top = burgerY * s) {
                drawRoundRect(
                    color = Color(0xFFD4A056).copy(alpha = burgerA),
                    topLeft = Offset(19f * s, 27f * s),
                    size = Size(12f * s, 3.5f * s),
                    cornerRadius = CornerRadius(1.8f * s),
                )
                drawRoundRect(
                    color = Color(0xFF6D4C41).copy(alpha = burgerA),
                    topLeft = Offset(19f * s, 25.6f * s),
                    size = Size(12f * s, 2.4f * s),
                    cornerRadius = CornerRadius(1.2f * s),
                )
                drawRoundRect(
                    color = Color(0xFFFFCA28).copy(alpha = burgerA),
                    topLeft = Offset(18.4f * s, 24.1f * s),
                    size = Size(13.2f * s, 1.9f * s),
                    cornerRadius = CornerRadius(0.95f * s),
                )
                drawOval(
                    color = Color(0xFFE8B86D).copy(alpha = burgerA),
                    topLeft = Offset(18.4f * s, 19f * s),
                    size = Size(13.2f * s, 5.2f * s),
                )
            }
        }

        // Souvlaki skewer
        if (souvA > 0.02f) {
            translate(left = 0f, top = souvY * s) {
                drawLine(
                    color = Color(0xFFC99B6A).copy(alpha = souvA),
                    start = Offset(28.5f * s, 30f * s),
                    end = Offset(40.5f * s, 17.5f * s),
                    strokeWidth = 1.3f * s,
                    cap = StrokeCap.Round,
                )
                listOf(
                    Offset(31.86f * s, 26.5f * s) to Color(0xFFA85A29),
                    Offset(35f * s, 23.25f * s) to Color(0xFFB5733E),
                    Offset(38.1f * s, 20f * s) to Color(0xFFC07A44),
                ).forEach { (c, col) ->
                    drawRoundRect(
                        color = col.copy(alpha = souvA),
                        topLeft = Offset(c.x - 2.2f * s, c.y - 1.9f * s),
                        size = Size(4.4f * s, 3.8f * s),
                        cornerRadius = CornerRadius(1.3f * s),
                    )
                }
            }
        }

        // Crepe
        if (crepeA > 0.02f) {
            translate(left = 0f, top = crepeY * s) {
                rotate(-30f, pivot = Offset(42f * s, 22.75f * s)) {
                    drawRoundRect(
                        color = Color(0xFFE7C28B).copy(alpha = crepeA),
                        topLeft = Offset(36.5f * s, 18.5f * s),
                        size = Size(11f * s, 8.5f * s),
                        cornerRadius = CornerRadius(3f * s),
                    )
                    drawRoundRect(
                        color = Color(0xFFF0D6A4).copy(alpha = crepeA),
                        topLeft = Offset(38f * s, 21f * s),
                        size = Size(8f * s, 4.5f * s),
                        cornerRadius = CornerRadius(2f * s),
                    )
                }
            }
        }

        // Sparkles near peak open
        if (progress in 0.2f..0.75f) {
            val spark = ((progress - 0.2f) / 0.55f).coerceIn(0f, 1f)
            val sa = (kotlin.math.sin(spark * Math.PI).toFloat()).coerceIn(0f, 1f) * 0.85f
            drawCircle(Color(0xFFFFEB3B).copy(alpha = sa), radius = 1.2f * s, center = Offset(20f * s, 12f * s))
            drawCircle(Color(0xFFFFEB3B).copy(alpha = sa * 0.7f), radius = 1f * s, center = Offset(44f * s, 10f * s))
            drawCircle(Color.White.copy(alpha = sa * 0.5f), radius = 0.9f * s, center = Offset(32f * s, 7f * s))
        }
    }
}
