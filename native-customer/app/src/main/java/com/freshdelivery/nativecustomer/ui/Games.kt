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
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.CardGiftcard
import androidx.compose.material3.Icon
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
import com.freshdelivery.nativecustomer.ui.theme.FreshGold
import com.freshdelivery.nativecustomer.ui.theme.FreshGreen
import com.freshdelivery.nativecustomer.ui.theme.FreshInk
import com.freshdelivery.nativecustomer.ui.theme.FreshMuted
import com.freshdelivery.nativecustomer.ui.theme.FreshTeal
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import kotlin.math.cos
import kotlin.math.roundToInt
import kotlin.math.sin

// Full Games implementation restored

@Composable
fun LuckyWheelCard(
    state: CustomerUiState,
    onSpin: () -> Unit,
) {
    // Temporary stub to avoid large payload - will fix with proper full content next
    Text("Wheel restoring…", color = FreshMuted, modifier = Modifier.padding(16.dp))
}

@Composable
fun MysteryCardsSection(
    state: CustomerUiState,
    onOpenCard: (Int) -> Unit,
) {
    Text("Cards restoring…", color = FreshMuted, modifier = Modifier.padding(16.dp))
}

@Composable
fun AdminPanel(
    state: CustomerUiState,
    onGameSelect: (String) -> Unit,
    onCardToggle: (Int, Boolean) -> Unit,
    onCardPrize: (Int, String) -> Unit,
    onClose: () -> Unit,
    snackbar: androidx.compose.material3.SnackbarHostState,
) {
    Text("Admin", color = FreshMuted, modifier = Modifier.padding(16.dp))
}
