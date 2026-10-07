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
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import coil.compose.AsyncImage
import kotlinx.coroutines.delay

@Composable
internal fun PromoCarousel(
    promos: List<com.freshdelivery.nativecustomer.data.PromoBanner>,
    onPromoClick: () -> Unit = {},
) {
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
            .height(168.dp),
    ) {
        HorizontalPager(
            state = pagerState,
            modifier = Modifier
                .fillMaxWidth()
                .height(148.dp)
                .clip(RoundedCornerShape(24.dp)),
            pageSpacing = 0.dp,
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
                    .clickable { onPromoClick() },
            ) {
                val img = promo.imageUrl
                if (!img.isNullOrBlank()) {
                    AsyncImage(
                        model = img,
                        contentDescription = null,
                        contentScale = ContentScale.Crop,
                        modifier = Modifier.fillMaxSize(),
                    )
                    Box(Modifier.fillMaxSize().background(Color.Black.copy(alpha = 0.4f)))
                }
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
                    if (img.isNullOrBlank()) {
                        Box(
                            Modifier
                                .padding(end = 12.dp)
                                .clip(RoundedCornerShape(16.dp))
                                .background(Color.White.copy(alpha = 0.15f))
                                .padding(12.dp),
                        ) {
                            Text("🎁", style = MaterialTheme.typography.headlineMedium)
                        }
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
                        )
                        if (promo.subtitle.isNotBlank()) {
                            Text(
                                promo.subtitle,
                                color = Color.White.copy(alpha = 0.92f),
                                style = MaterialTheme.typography.bodySmall,
                            )
                        }
                        if (promo.code.isNotBlank()) {
                            Spacer(Modifier.height(8.dp))
                            Box(
                                Modifier
                                    .clip(RoundedCornerShape(8.dp))
                                    .background(Color.White.copy(alpha = 0.2f))
                                    .padding(horizontal = 10.dp, vertical = 4.dp),
                            ) {
                                Text(
                                    promo.code,
                                    color = Color.White,
                                    fontWeight = FontWeight.ExtraBold,
                                    style = MaterialTheme.typography.labelLarge,
                                )
                            }
                        }
                    }
                }
            }
        }
        if (promos.size > 1) {
            Row(
                Modifier.fillMaxWidth().padding(top = 6.dp),
                horizontalArrangement = Arrangement.Center,
            ) {
                repeat(promos.size) { i ->
                    val on = pagerState.currentPage == i
                    Box(
                        Modifier
                            .padding(horizontal = 3.dp)
                            .height(6.dp)
                            .width(if (on) 18.dp else 6.dp)
                            .clip(RoundedCornerShape(99.dp))
                            .background(
                                if (on) Color(0xFFEA580C) else Color.Gray.copy(alpha = 0.35f),
                            ),
                    )
                }
            }
        }
    }
}
