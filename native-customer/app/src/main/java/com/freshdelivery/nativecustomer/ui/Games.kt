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
import androidx.compose.material.icons.outlined.Gift
import androidx.compose.material.icons.outlined.LocalOffer
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
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
import com.freshdelivery.nativecustomer.data.WHEEL_SEGMENTS
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
            .padding(horizontal = 16.dp, vertical = 8.dp)
            .shadow(18.dp, RoundedCornerShape(26.dp))
            .clip(RoundedCornerShape(26.dp))
            .background(Brush.verticalGradient(listOf(Color(0xFF0E2B1D), Color(0xFF0A1F15))))
            .padding(14.dp),
    ) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Icon(Icons.Outlined.Gift, contentDescription = null, tint = FreshGold, modifier = Modifier.size(16.dp))
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
                    WHEEL_SEGMENTS.forEachIndexed { i, seg ->
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
                    WHEEL_SEGMENTS.forEachIndexed { i, seg ->
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
                        color = Color(0xFF0E2B1D),
                        fontWeight = FontWeight.ExtraBold,
                        fontSize = 12.sp,
                        textAlign = TextAlign.Center,
                    )
                }
            }
        }
    }
}

/** Emerald v2 — mystery deal cards (mirrors web `.deal-cards`). */
@Composable
fun MysteryCardsSection(
    state: CustomerUiState,
    onOpenCard: (Int) -> Unit,
) {
    Column(
        Modifier
            .fillMaxWidth()
            .padding(horizontal = 16.dp, vertical = 6.dp),
    ) {
        Row(
            Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Icon(Icons.Outlined.Gift, contentDescription = null, tint = FreshTeal, modifier = Modifier.size(16.dp))
                Spacer(Modifier.width(7.dp))
                Text(
                    "ΜΥΣΤΙΚΕΣ ΚΑΡΤΕΣ",
                    color = FreshInk,
                    fontWeight = FontWeight.Black,
                    fontSize = 13.sp,
                    letterSpacing = 1.4.sp,
                )
            }
            Text(
                "Άνοιξε μία · τα υπόλοιπα αποκαλύπτονται",
                color = FreshMuted,
                fontSize = 10.sp,
                fontWeight = FontWeight.Bold,
            )
        }
        Spacer(Modifier.height(8.dp))
        Row(
            Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.spacedBy(8.dp),
        ) {
            state.cards.forEachIndexed { i, card ->
                MysteryCard(
                    modifier = Modifier.weight(1f),
                    card = card,
                    index = i,
                    isClaimed = i == state.claimedCardIndex,
                    isOpen = i in state.openedCards,
                    canOpen = card.enabled && !state.cardClaimed,
                    onOpen = { onOpenCard(i) },
                )
            }
        }
    }
}

@Composable
private fun MysteryCard(
    modifier: Modifier = Modifier,
    card: MysteryCardDef,
    index: Int,
    isClaimed: Boolean,
    isOpen: Boolean,
    canOpen: Boolean,
    onOpen: () -> Unit,
) {
    var revealed by remember { mutableStateOf(false) }
    LaunchedEffect(isOpen) {
        if (isOpen) {
            if (!isClaimed) delay(200L + index * 120L)
            revealed = true
        } else {
            revealed = false
        }
    }
    val shown = isClaimed || revealed
    val rotation by animateFloatAsState(
        targetValue = if (shown) 180f else 0f,
        animationSpec = tween(550, easing = FastOutSlowInEasing),
        label = "cardFlip",
    )
    val shakeX = remember { Animatable(0f) }
    val scope = rememberCoroutineScope()
    Box(
        modifier
            .height(100.dp)
            .offset { IntOffset(shakeX.value.roundToInt(), 0) }
            .graphicsLayer {
                rotationY = rotation
                cameraDistance = 12f * density
            },
    ) {
        Box(
            Modifier
                .fillMaxSize()
                .graphicsLayer {
                    rotationY = 0f
                    alpha = if (rotation <= 90f) 1f else 0f
                }
                .background(
                    if (card.enabled) {
                        Brush.linearGradient(listOf(Color(0xFF0B8F5F), FreshTeal))
                    } else {
                        Brush.linearGradient(listOf(Color(0xFFCCD4D0), Color(0xFFA6B0AA)))
                    },
                )
                .shadow(10.dp, RoundedCornerShape(16.dp))
                .clip(RoundedCornerShape(16.dp)),
            contentAlignment = Alignment.Center,
        ) {
            Icon(
                Icons.Outlined.Gift,
                contentDescription = null,
                tint = Color.White,
                modifier = Modifier
                    .size(30.dp)
                    .alpha(if (card.enabled) 1f else 0.5f),
            )
            Text(
                card.tag,
                color = Color.White.copy(alpha = 0.85f),
                fontWeight = FontWeight.ExtraBold,
                fontSize = 10.sp,
                modifier = Modifier
                    .align(Alignment.TopStart)
                    .padding(start = 11.dp, top = 9.dp),
            )
            if (!card.enabled) {
                Text(
                    "ΑΝΕΝΕΡΓΗ",
                    color = Color.White.copy(alpha = 0.9f),
                    fontWeight = FontWeight.ExtraBold,
                    fontSize = 9.sp,
                    letterSpacing = 0.8.sp,
                    modifier = Modifier
                        .align(Alignment.BottomCenter)
                        .padding(bottom = 9.dp),
                )
            }
        }
        Box(
            Modifier
                .fillMaxSize()
                .graphicsLayer {
                    rotationY = 180f
                    alpha = if (rotation <= 90f) 0f else 1f
                }
                .background(Color.White)
                .border(
                    width = if (isClaimed) 1.5.dp else 1.dp,
                    color = if (isClaimed) FreshGreen else FreshDivider,
                    shape = RoundedCornerShape(16.dp),
                )
                .shadow(if (isClaimed) 10.dp else 0.dp, RoundedCornerShape(16.dp)),
            contentAlignment = Alignment.Center,
        ) {
            Text(
                card.prize,
                color = FreshGreenDark,
                fontWeight = FontWeight.ExtraBold,
                fontSize = 12.sp,
                textAlign = TextAlign.Center,
                lineHeight = 15.sp,
                modifier = Modifier.padding(6.dp),
            )
        }
        Box(
            Modifier
                .matchParentSize()
                .clip(RoundedCornerShape(16.dp))
                .clickable(
                    onClick = {
                        if (canOpen) onOpen()
                        else scope.launch {
                            listOf(-5f, 5f, -4f, 4f, 0f).forEach { shakeX.animateTo(it, tween(50)) }
                        }
                    },
                ),
        )
    }
}

/** Emerald v2 — admin game control panel (mirrors web `phoneAdmin`). */
@Composable
fun AdminPanel(
    state: CustomerUiState,
    onGameSelect: (String) -> Unit,
    onCardToggle: (Int, Boolean) -> Unit,
    onCardPrize: (Int, String) -> Unit,
    onClose: () -> Unit,
) {
    Column(
        Modifier
            .fillMaxSize()
            .background(FreshBg)
            .statusBarsPadding()
            .navigationBarsPadding(),
    ) {
        Row(
            Modifier
                .fillMaxWidth()
                .padding(horizontal = 8.dp, vertical = 6.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            IconButton(onClick = onClose) {
                Icon(Icons.AutoMirrored.Outlined.ArrowBack, contentDescription = "Back", tint = FreshInk)
            }
            Spacer(Modifier.width(4.dp))
            Column(Modifier.weight(1f)) {
                Text("Πίνακας διαχειριστή", style = MaterialTheme.typography.headlineSmall, fontWeight = FontWeight.Black)
                Text("Διαχείριση των μυστικών καρτών", color = FreshMuted, style = MaterialTheme.typography.bodySmall)
            }
        }
        Column(
            Modifier
                .weight(1f)
                .verticalScroll(rememberScrollState())
                .padding(bottom = 16.dp),
        ) {
            Row(
                Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 16.dp, vertical = 6.dp)
                    .clip(RoundedCornerShape(14.dp))
                    .background(FreshGreenSoft)
                    .padding(horizontal = 12.dp, vertical = 11.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Icon(Icons.Outlined.LocalOffer, contentDescription = null, tint = FreshGreenDark, modifier = Modifier.size(15.dp))
                Spacer(Modifier.width(7.dp))
                Text(
                    "Οι αλλαγές εφαρμόζονται αμέσως στις οθόνες πελατών",
                    color = FreshGreenDark,
                    fontSize = 11.sp,
                    fontWeight = FontWeight.Bold,
                )
            }
            Row(
                Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 16.dp, vertical = 8.dp),
                horizontalArrangement = Arrangement.spacedBy(8.dp),
            ) {
                AdminGameChip(
                    modifier = Modifier.weight(1f),
                    game = "wheel",
                    label = "ΡΟΔΑ\nΕΚΠΤΩΣΕΩΝ",
                    active = state.gameActive == "wheel",
                    onClick = { onGameSelect("wheel") },
                )
                AdminGameChip(
                    modifier = Modifier.weight(1f),
                    game = "cards",
                    label = "ΜΥΣΤΙΚΕΣ\nΚΑΡΤΕΣ",
                    active = state.gameActive == "cards",
                    onClick = { onGameSelect("cards") },
                )
            }
            state.cards.forEachIndexed { i, card ->
                AdminCardRow(
                    card = card,
                    index = i,
                    onToggle = { onCardToggle(i, it) },
                    onPrize = { onCardPrize(i, it) },
                )
            }
            Text(
                "Μόνο ένα παιχνίδι ενεργό κάθε φορά · ο πελάτης κερδίζει μία φορά (1 περιστροφή / 1 κάρτα). Επεξεργάσου το έπαθλο — αποθηκεύεται αυτόματα.",
                color = FreshMuted,
                fontSize = 10.sp,
                modifier = Modifier.padding(horizontal = 16.dp, vertical = 8.dp),
            )
        }
    }
}

@Composable
private fun AdminGameChip(
    modifier: Modifier = Modifier,
    game: String,
    label: String,
    active: Boolean,
    onClick: () -> Unit,
) {
    Box(
        modifier
            .clip(RoundedCornerShape(16.dp))
            .background(
                if (active) Brush.horizontalGradient(listOf(Color(0xFF0B8F5F), FreshTeal))
                else Color.White,
            )
            .border(
                width = if (active) 0.dp else 1.5.dp,
                color = FreshDivider,
                shape = RoundedCornerShape(16.dp),
            )
            .clickable(onClick = onClick)
            .padding(vertical = 12.dp),
        contentAlignment = Alignment.Center,
    ) {
        Text(
            label,
            color = if (active) Color.White else FreshMuted,
            fontWeight = FontWeight.ExtraBold,
            fontSize = 12.sp,
            textAlign = TextAlign.Center,
            lineHeight = 14.sp,
        )
    }
}

@Composable
private fun AdminCardRow(
    card: MysteryCardDef,
    index: Int,
    onToggle: (Boolean) -> Unit,
    onPrize: (String) -> Unit,
) {
    val dotBrush = when (card.tag) {
        "A" -> Brush.linearGradient(listOf(Color(0xFF0B8F5F), Color(0xFF14B8A6)))
        "B" -> Brush.linearGradient(listOf(Color(0xFF8B5CF6), Color(0xFF6366F1)))
        "C" -> Brush.linearGradient(listOf(Color(0xFFF59E0B), Color(0xFFF97316)))
        else -> Brush.linearGradient(listOf(Color(0xFF0B8F5F), Color(0xFF14B8A6)))
    }
    Column(
        Modifier
            .fillMaxWidth()
            .padding(horizontal = 16.dp, vertical = 4.dp)
            .shadow(4.dp, RoundedCornerShape(20.dp))
            .clip(RoundedCornerShape(20.dp))
            .background(Color.White)
            .padding(14.dp),
    ) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Box(
                Modifier
                    .size(36.dp)
                    .clip(RoundedCornerShape(12.dp))
                    .background(dotBrush),
                contentAlignment = Alignment.Center,
            ) {
                Text(card.tag, color = Color.White, fontWeight = FontWeight.Black, fontSize = 13.sp)
            }
            Spacer(Modifier.width(10.dp))
            Column(Modifier.weight(1f)) {
                Text(card.name, fontWeight = FontWeight.ExtraBold, fontSize = 14.sp)
                Text(
                    if (card.enabled) "Ενεργή" else "Απενεργοποιημένη",
                    color = if (card.enabled) FreshGreenDark else FreshRose,
                    fontSize = 11.sp,
                    fontWeight = FontWeight.Bold,
                )
            }
            Switch(
                checked = card.enabled,
                onCheckedChange = onToggle,
                colors = SwitchDefaults.colors(
                    checkedTrackColor = FreshGreen,
                    checkedThumbColor = Color.White,
                ),
            )
        }
        Spacer(Modifier.height(10.dp))
        Row(verticalAlignment = Alignment.CenterVertically) {
            Text("Έπαθλο:", color = FreshMuted, fontSize = 12.sp, fontWeight = FontWeight.Bold)
            Spacer(Modifier.width(8.dp))
            OutlinedTextField(
                value = card.prize,
                onValueChange = onPrize,
                singleLine = true,
                modifier = Modifier
                    .weight(1f)
                    .height(40.dp),
                shape = RoundedCornerShape(12.dp),
                textStyle = MaterialTheme.typography.bodyMedium.copy(
                    fontWeight = FontWeight.Bold,
                    color = FreshInk,
                ),
                colors = OutlinedTextFieldDefaults.colors(
                    focusedBorderColor = FreshGreen,
                    unfocusedBorderColor = FreshDivider,
                    focusedContainerColor = Color.White,
                    unfocusedContainerColor = Color.White,
                ),
            )
        }
    }
}

private fun formatDealTime(seconds: Int): String {
    val m = seconds / 60
    val s = seconds % 60
    return String.format("%02d:%02d", m, s)
}
