package com.freshdelivery.nativecustomer.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.Store
import androidx.compose.material3.Icon
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import coil.compose.AsyncImage
import coil.request.ImageRequest
import com.freshdelivery.nativecustomer.ui.theme.FreshGreen

@Composable
internal fun StoreHeroImage(url: String?, height: Int = 160) {
    Box(
        Modifier
            .fillMaxWidth()
            .height(height.dp)
            .background(
                Brush.linearGradient(listOf(Color(0xFFFFE3C7), Color(0xFFFFC895))),
            ),
        contentAlignment = Alignment.Center,
    ) {
        if (url.isNullOrBlank()) {
            Box(
                Modifier
                    .size(64.dp)
                    .clip(CircleShape)
                    .background(Color.White.copy(alpha = 0.75f)),
                contentAlignment = Alignment.Center,
            ) {
                Icon(
                    Icons.Outlined.Store,
                    contentDescription = null,
                    tint = FreshGreen,
                    modifier = Modifier.size(32.dp),
                )
            }
        } else {
            val ctx = LocalContext.current
            AsyncImage(
                model = ImageRequest.Builder(ctx)
                    .data(url)
                    .size(960, 540)
                    .crossfade(160)
                    .memoryCacheKey(url)
                    .build(),
                contentDescription = null,
                contentScale = ContentScale.Crop,
                modifier = Modifier.fillMaxSize(),
            )
        }
        Box(
            Modifier
                .fillMaxSize()
                .background(
                    Brush.verticalGradient(
                        0f to Color.Black.copy(alpha = 0.28f),
                        0.32f to Color.Transparent,
                        0.62f to Color.Transparent,
                        1f to Color.Black.copy(alpha = 0.34f),
                    ),
                ),
        )
    }
}
