@file:OptIn(androidx.compose.foundation.ExperimentalFoundationApi::class)
package com.freshdelivery.nativecustomer.ui

import androidx.compose.animation.core.LinearEasing
import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.tween
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.pager.HorizontalPager
import androidx.compose.foundation.pager.rememberPagerState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.input.nestedscroll.NestedScrollConnection
import androidx.compose.ui.input.nestedscroll.NestedScrollSource
import androidx.compose.ui.input.nestedscroll.nestedScroll
import androidx.compose.runtime.remember
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import kotlinx.coroutines.delay

@Composable
internal fun PromoCarousel(
    promos: List<com.freshdelivery.nativecustomer.data.PromoBanner>,
    onPromoClick: (com.freshdelivery.nativecustomer.data.PromoBanner) -> Unit = {},
) {
    if (promos.isEmpty()) return
    val pagerState = rememberPagerState(pageCount = { promos.size })
    LaunchedEffect(promos.size) {
        if (promos.size <= 1) return@LaunchedEffect
        while (true) {
            delay(4200)
            val next = (pagerState.currentPage + 1) % promos.size
            runCatching { pagerState.animateScrollToPage(next) }
        }
    }
    val infinite = rememberInfiniteTransition(label = "promoMotion")
    val sheen by infinite.animateFloat(
        initialValue = -1f,
        targetValue = 2f,
        animationSpec = infiniteRepeatable(
            animation = tween(2800, easing = LinearEasing),
            repeatMode = RepeatMode.Restart,
        ),
        label = "sheen",
    )
    Column(
        Modifier
            .fillMaxWidth()
            .padding(horizontal = 16.dp)
            .padding(top = 2.dp, bottom = 0.dp)
            .height(160.dp),
    ) {
        val passVertical = remember {
            object : NestedScrollConnection {
                override fun onPreScroll(available: Offset, source: NestedScrollSource): Offset {
                    return Offset(0f, 0f)
                }
            }
        }
        HorizontalPager(
            state = pagerState,
            modifier = Modifier
                .fillMaxWidth()
                .height(120.dp)
                .nestedScroll(passVertical)
                .clip(RoundedCornerShape(24.dp)),
            pageSpacing = 0.dp,
            userScrollEnabled = true,
        ) { page ->
            val promo = promos[page]
            val gradient = when (promo.gradient) {
                "dark" -> Brush.linearGradient(
                    listOf(Color(0xFF0F172A), Color(0xFF1E293B), Color(0xFF334155)),
                )
                else -> Brush.linearGradient(
                    listOf(Color(0xFFEA580C), Color(0xFFF97316), Color(0xFFC2410C)),
                )
            }
            Box(
                Modifier
                    .fillMaxSize()
                    .shadow(8.dp, RoundedCornerShape(24.dp))
                    .clip(RoundedCornerShape(24.dp))
                    .background(gradient)
                    .clickable { onPromoClick(promo) },
            ) {
                Box(
                    Modifier
                        .fillMaxSize()
                        .graphicsLayer {
                            translationX = sheen * 400f
                            alpha = 0.18f
                        }
                        .background(
                            Brush.horizontalGradient(
                                listOf(Color.Transparent, Color.White, Color.Transparent),
                            ),
                        ),
                )
                Row(
                    Modifier.fillMaxSize().padding(18.dp),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Box(
                        Modifier
                            .padding(end = 12.dp)
                            .clip(RoundedCornerShape(16.dp))
                            .background(Color.Black.copy(alpha = 0.35f))
                            .padding(12.dp),
                    ) {
                        Text("\uD83C\uDF81", style = MaterialTheme.typography.headlineMedium)
                    }
                    Column(Modifier.weight(1f)) {
                        if (promo.tag.isNotBlank()) {
                            Text(
                                promo.tag,
                                color = Color.White.copy(alpha = 0.9f),
                                fontWeight = FontWeight.Bold,
                                style = MaterialTheme.typography.labelMedium,
                            )
                        }
                        Text(
                            promo.title,
                            color = Color.White,
                            fontWeight = FontWeight.Bold,
                            style = MaterialTheme.typography.titleMedium,
                            maxLines = 2,
                        )
                        if (promo.subtitle.isNotBlank()) {
                            Text(
                                promo.subtitle,
                                color = Color.White.copy(alpha = 0.9f),
                                style = MaterialTheme.typography.bodySmall,
                                maxLines = 2,
                            )
                        }
                    }
                }
            }
        }
        if (promos.size > 1) {
            Spacer(Modifier.height(8.dp))
            Row(
                Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.Center,
            ) {
                repeat(promos.size) { i ->
                    Box(
                        Modifier
                            .padding(horizontal = 3.dp)
                            .height(6.dp)
                            .width(if (i == pagerState.currentPage) 16.dp else 6.dp)
                            .clip(RoundedCornerShape(99.dp))
                            .background(
                                if (i == pagerState.currentPage) Color(0xFFEA580C)
                                else Color(0xFFCBD5E1),
                            ),
                    )
                }
            }
        }
    }
}
