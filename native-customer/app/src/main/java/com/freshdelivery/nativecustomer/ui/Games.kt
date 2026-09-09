package com.freshdelivery.nativecustomer.ui

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.core.Animatable
import androidx.compose.animation.core.FastOutSlowInEasing
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.animateTo
import androidx.compose.animation.core.tween
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.outlined.ArrowBack
import androidx.compose.material.icons.outlined.CardGiftcard
import androidx.compose.material.icons.outlined.LocalOffer
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
import androidx.compose.material3.SnackbarHost
import androidx.compose.material3.SnackbarHostState
import androidx.compose.material3.Switch
import androidx.compose.material3.SwitchDefaults
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.rotate
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.text.AnnotatedString
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.drawText
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.rememberTextMeasurer
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.IntOffset
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.freshdelivery.nativecustomer.data.MysteryCardDef
import com.freshdelivery.nativecustomer.ui.theme.FreshBg
import com.freshdelivery.nativecustomer.ui.theme.FreshDivider
import com.freshdelivery.nativecustomer.ui.theme.FreshGold
import com.freshdelivery.nativecustomer.ui.theme.FreshGreen
import com.freshdelivery.nativecustomer.ui.theme.FreshGreenDark
import com.freshdelivery.nativecustomer.ui.theme.FreshGreenSoft
import com.freshdelivery.nativecustomer.ui.theme.FreshInk
import com.freshdelivery.nativecustomer.ui.theme.FreshMuted
import com.freshdelivery.nativecustomer.ui.theme.FreshRose
import com.freshdelivery.nativecustomer.ui.theme.FreshTeal
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import kotlin.math.cos
import kotlin.math.roundToInt
import kotlin.math.sin

/** Emerald v2 — dark lucky discount wheel card (mirrors web `.wheel-card`). */
@Composable
fun LuckyWheelCard(
    state: CustomerUiState,
    onSpin: () -> Unit,
) {
    val rotation = remember { Animatable(0f) }
    val textMeasurer = rememberTextMeasurer()
    val target = state.wheelPendingTarget
    LaunchedEffect(target, state.spinning) {
        if (state.spinning && target != null) {
            val final = (360 - target * 60) % 360
            val cur = rotation.value
            val delta = ((final - cur % 360f) + 360f) % 360f
            rotation.animateTo(
                targetValue = cur + 360f * 5f + delta,
                animationSpec = tween(4_200, easing = FastOutSlowInEasing),
            )
        }
    }
    val wheelLocked = state.spinLocked
    Column(
        Modifier
            .fillMaxWidth()
            .padding(horizontal = 16.dp, vertical = 4.dp)
            .shadow(14.dp, RoundedCornerShape(24.dp))
            .clip(RoundedCornerShape(24.dp))
            .background(Brush.verticalGradient(listOf(Color(0xFF33170C), Color(0xFF1A0B05))))
            .padding(14.dp),
    ) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Icon(Icons.Outlined.CardGiftcard, contentDescription = null, tint = FreshGold, modifier = Modifier.size(16.dp))
                Spacer(Modifier.width(7.dp))
                Text(
                    "ΡΟΔΑ ΕΚΠΤΩΣΕΩΝ",
                    color = Color.White,
                    fontWeight = FontWeight.Black,
                    fontSize = 13.sp,
                    letterSpacing = 1.4.sp,
                )
            }
            Spacer(Modifier.weight(1f))
            Text(
                "λήγει σε ${formatDealTime(state.dealSeconds)}",
                color = FreshGold,
                fontWeight = FontWeight.ExtraBold,
                fontSize = 11.sp,
                modifier = Modifier
                    .clip(RoundedCornerShape(999.dp))
                    .background(Color(0xFFF7B955).copy(alpha = 0.14f))
                    .border(1.dp, Color(0xFFF7B955).copy(alpha = 0.35f), RoundedCornerShape(999.dp))
                    .padding(horizontal = 10.dp, vertical = 5.dp),
            )
        }
        Spacer(Modifier.height(4.dp))
        Text(
            "Μία δωρεάν περιστροφή την ημέρα · ισχύει αμέσως στο καλάθι",
            color = Color.White.copy(alpha = 0.6f),
            fontSize = 11.sp,
        )
        Spacer(Modifier.height(12.dp))
        Box(
            Modifier
                .size(200.dp)
                .align(Alignment.CenterHorizontally),
            contentAlignment = Alignment.Center,
        ) {
            Box(
                Modifier
                    .fillMaxSize()
                    .rotate(rotation.value)
                    .shadow(18.dp, CircleShape)
                    .clip(CircleShape)
                    .border(6.dp, Color.White.copy(alpha = 0.10f), CircleShape)
                    .border(10.dp, Color.White.copy(alpha = 0.05f), CircleShape),
            ) {
                Canvas(Modifier.fillMaxSize()) {
                    val center = this.center
                    val radius = size.minDimension / 2f
                    val labelRadius = radius * 0.58f
                    val segments = state.wheelSegments.ifEmpty { com.freshdelivery.nativecustomer.data.WHEEL_SEGMENTS }
                    segments.forEachIndexed { i, seg ->
                        val centerAngle = i * 60f - 90f
                        drawArc(
                            color = Color(seg.color),
                            startAngle = centerAngle - 30f,
                            sweepAngle = 60f,
                            useCenter = true,
                            topLeft = Offset(center.x - radius, center.y - radius),
                            size = Size(radius * 2f, radius * 2f),
                        )
                        val lineAngle = Math.toRadians((centerAngle - 30f).toDouble())
                        drawLine(
                            color = Color.White.copy(alpha = 0.18f),
                            start = center,
                            end = Offset(
                                center.x + cos(lineAngle).toFloat() * radius,
                                center.y + sin(lineAngle).toFloat() * radius,
                            ),
                            strokeWidth = 2f,
                        )
                    }
                    segments.forEachIndexed { i, seg ->
                        val midAngle = Math.toRadians((i * 60f - 90f).toDouble())
                        val x = center.x + cos(midAngle).toFloat() * labelRadius
                        val y = center.y + sin(midAngle).toFloat() * labelRadius
                        val layout = textMeasurer.measure(
                            AnnotatedString("${seg.label}\n${seg.sub}"),
                            style = TextStyle(
                                color = Color.White,
                                fontSize = 11.sp,
                                fontWeight = FontWeight.Black,
                                textAlign = TextAlign.Center,
                                lineHeight = 12.sp,
                            ),
                        )
                        drawText(
                            textLayoutResult = layout,
                            topLeft = Offset(x - layout.size.width / 2f, y - layout.size.height / 2f),
                        )
                    }
                }
            }
            Box(
                Modifier
                    .size(86.dp)
                    .shadow(10.dp, CircleShape)
                    .clip(CircleShape)
                    .background(
                        if (wheelLocked) {
                            Brush.linearGradient(listOf(Color(0xFF52635B), Color(0xFF3A4A42)))
                        } else {
                            Brush.linearGradient(listOf(Color(0xFF0B8F5F), FreshGreen))
                        },
                    )
                    .clickable(enabled = !state.spinning && !wheelLocked, onClick = onSpin),
                contentAlignment = Alignment.Center,
            ) {
                Column(horizontalAlignment = Alignment.CenterHorizontally) {
                    Text(
                        if (wheelLocked) "ΟΛΟΚΛΗΡΩΘΗΚΕ" else "ΓΥΡΙΣΕ",
                        color = Color.White,
                        fontWeight = FontWeight.Black,
                        fontSize = 10.sp,
                        textAlign = TextAlign.Center,
                    )
                    Text(
                        if (wheelLocked) "1 φορά / κύκλο" else "δωρεάν",
                        color = Color.White.copy(alpha = 0.8f),
                        fontSize = 8.sp,
                        fontWeight = FontWeight.SemiBold,
                    )
                }
            }
            Canvas(
                Modifier
                    .align(Alignment.TopCenter)
                    .offset(y = (-6).dp)
                    .size(22.dp, 24.dp),
            ) {
                val w = size.width
                val h = size.height
                val path = Path().apply {
                    moveTo(w / 2f, h)
                    lineTo(0f, 0f)
                    lineTo(w, 0f)
                    close()
                }
                drawPath(path, Color.White)
                drawCircle(Color.White, radius = 4.dp.toPx(), center = Offset(w / 2f, 3f))
            }
        }
        Spacer(Modifier.height(12.dp))
        Row(
            Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.Center,
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Text("Κωδικός: ", color = Color.White.copy(alpha = 0.65f), fontSize = 11.sp)
            Text(
                state.wheelResult?.code ?: "—",
                color = Color.White,
                fontWeight = FontWeight.Bold,
                fontSize = 12.sp,
                letterSpacing = 1.4.sp,
                modifier = Modifier
                    .clip(RoundedCornerShape(10.dp))
                    .background(Color.White.copy(alpha = 0.12f))
                    .border(1.dp, Color.White.copy(alpha = 0.4f), RoundedCornerShape(10.dp))
                    .padding(horizontal = 12.dp, vertical = 6.dp),
            )
        }
        AnimatedVisibility(visible = state.wheelResult != null) {
            state.wheelResult?.let { res ->
                Box(
                    Modifier
                        .fillMaxWidth()
                        .padding(top = 12.dp)
                        .clip(RoundedCornerShape(14.dp))
                        .background(
                            Brush.horizontalGradient(
                                listOf(Color(0xFFF7B955).copy(alpha = 0.95f), Color(0xFFFB923C).copy(alpha = 0.95f)),
                            ),
                        )
                        .padding(12.dp),
                    contentAlignment = Alignment.Center,
                ) {
                    Text(
                        res.label,
                        color = Color(0xFF431407),
                        fontWeight = FontWeight.ExtraBold,
                        fontSize = 12.sp,
                        textAlign = TextAlign.Center,
                    )
                }
            }
        }
    }
}
