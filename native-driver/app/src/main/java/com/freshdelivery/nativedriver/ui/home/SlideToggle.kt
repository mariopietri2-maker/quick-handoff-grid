package com.freshdelivery.nativedriver.ui.home

import androidx.compose.animation.core.Animatable
import androidx.compose.animation.core.tween
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.gestures.detectDragGestures
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Power
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.layout.onSizeChanged
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.IntOffset
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import kotlin.math.roundToInt

/** Slide-to-go-on-duty / slide-to-go-off-duty control, mirrors the web SlideToggle. */
@Composable
fun SlideToggle(
    isOn: Boolean,
    enabled: Boolean,
    onToggle: (Boolean) -> Unit,
) {
    val scope = rememberCoroutineScope()
    val density = LocalDensity.current
    val thumb = remember { Animatable(0f) }
    var trackW by remember { mutableIntStateOf(0) }
    val thumbSizePx = with(density) { 52.dp.toPx() }
    val padPx = with(density) { 6.dp.toPx() }
    val maxX = (trackW - thumbSizePx - 2 * padPx).coerceAtLeast(0f)

    LaunchedEffect(isOn, trackW) {
        thumb.animateTo(if (isOn) maxX else 0f, animationSpec = tween(durationMillis = 400))
    }

    Box(
        Modifier
            .fillMaxWidth()
            .height(64.dp)
            .clip(RoundedCornerShape(32.dp))
            .background(if (isOn) Color(0xFF1DB954).copy(alpha = 0.16f) else Color(0xFFE8E8EC))
            .border(
                1.dp,
                if (isOn) Color(0xFF1DB954).copy(alpha = 0.35f) else Color(0xFFD4D4D8),
                RoundedCornerShape(32.dp),
            )
            .alpha(if (enabled) 1f else 0.5f)
            .onSizeChanged { trackW = it.width }
            .pointerInput(isOn, enabled) {
                if (!enabled) return@pointerInput
                detectDragGestures(
                    onDragStart = {
                        scope.launch { thumb.stop() }
                    },
                    onDrag = { change, dragAmount ->
                        change.consume()
                        val nx = (thumb.value + dragAmount.x).coerceIn(0f, maxX)
                        scope.launch { thumb.snapTo(nx) }
                    },
                    onDragEnd = {
                        val p = if (maxX > 0f) thumb.value / maxX else 0f
                        if (isOn) {
                            if (p < 0.15f) {
                                scope.launch { thumb.snapTo(0f) }
                                onToggle(false)
                            } else {
                                scope.launch { thumb.snapTo(maxX) }
                            }
                        } else {
                            if (p > 0.5f) {
                                scope.launch { thumb.snapTo(maxX) }
                                onToggle(true)
                            } else {
                                scope.launch { thumb.snapTo(0f) }
                            }
                        }
                    },
                    onDragCancel = {
                        scope.launch { thumb.snapTo(if (isOn) maxX else 0f) }
                    },
                )
            },
        contentAlignment = Alignment.Center,
    ) {
        val p = if (maxX > 0f) thumb.value / maxX else 0f
        Text(
            when {
                isOn && p < 0.85f -> if (p < 0.1f) "Σύρε ως το τέλος για εκτός υπηρεσίας" else "Σύρε αριστερά για εκτός υπηρεσίας"
                isOn -> "Σε υπηρεσία"
                p > 0.5f -> "Άσε για υπηρεσία"
                else -> "Σύρε για υπηρεσία"
            },
            color = if (isOn) Color(0xFF1DB954) else Color(0xFF6B7280),
            fontWeight = FontWeight.Bold,
            fontSize = 13.sp,
            textAlign = TextAlign.Center,
            modifier = Modifier.fillMaxWidth().padding(horizontal = 80.dp),
        )

        Box(
            Modifier
                .align(Alignment.CenterStart)
                .offset { IntOffset((padPx + thumb.value).roundToInt(), 0) }
                .size(52.dp)
                .shadow(10.dp, CircleShape)
                .clip(CircleShape)
                .background(if (isOn) Color(0xFF1DB954) else Color(0xFF1F2937)),
            contentAlignment = Alignment.Center,
        ) {
            Icon(Icons.Filled.Power, null, tint = Color.White, modifier = Modifier.size(22.dp))
        }
    }
}
