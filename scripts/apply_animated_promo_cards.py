#!/usr/bin/env python3
"""Seed a few default promos + richer animated carousel cards."""
from pathlib import Path

# --- Default promos in Models.kt ---
m = Path('native-customer/app/src/main/java/com/freshdelivery/nativecustomer/data/Models.kt')
mt = m.read_text(encoding='utf-8')
old_empty = '    val promos: List<PromoBanner> = emptyList(),'
new_defaults = '''    val promos: List<PromoBanner> = listOf(
        PromoBanner(
            tag = "NEW",
            title = "Δωρεάν παράδοση",
            subtitle = "στην πρώτη σου παραγγελία",
            code = "WELCOME",
            gradient = "hero",
            enabled = true,
        ),
        PromoBanner(
            tag = "HOT",
            title = "Fresh Meals. Fast Delivery.",
            subtitle = "Ιωάννινα · σε 10–15′",
            code = "FRESH",
            gradient = "hero",
            enabled = true,
        ),
        PromoBanner(
            tag = "OFFER",
            title = "Προσφορές κάθε μέρα",
            subtitle = "δες τα καταστήματα με badge",
            code = "DEALS",
            gradient = "dark",
            enabled = true,
        ),
    ),'''
if old_empty in mt:
    mt = mt.replace(old_empty, new_defaults)
    m.write_text(mt, encoding='utf-8')
    print('default promos')
elif 'Δωρεάν παράδοση' in mt and 'val promos' in mt:
    print('defaults already')
else:
    print('WARN defaults')

# --- Richer PromoCarousel animation ---
shell = Path('native-customer/app/src/main/java/com/freshdelivery/nativecustomer/ui/CustomerShell.kt')
st = shell.read_text(encoding='utf-8')

if 'fun PromoCarousel' not in st:
    print('WARN no PromoCarousel yet — run apply_promo_carousel first')
else:
    # Replace entire PromoCarousel function with animated version
    start = st.find('@Composable\nprivate fun PromoCarousel')
    if start < 0:
        start = st.find('fun PromoCarousel')
    if start < 0:
        print('WARN cannot find PromoCarousel')
    else:
        # find next top-level @Composable or end
        next_fn = st.find('\n@Composable\n', start + 20)
        if next_fn < 0:
            next_fn = len(st)
        # also stop at \nfun [A-Z] at column 0 unlikely - use end of file if last
        animated = '''
@Composable
private fun PromoCarousel(promos: List<com.freshdelivery.nativecustomer.data.PromoBanner>) {
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
    val bob by infinite.animateFloat(
        initialValue = 0f,
        targetValue = 1f,
        animationSpec = infiniteRepeatable(
            animation = tween(1600, easing = FastOutSlowInEasing),
            repeatMode = RepeatMode.Reverse,
        ),
        label = "bob",
    )
    Column(Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 6.dp)) {
        HorizontalPager(
            state = pagerState,
            modifier = Modifier.fillMaxWidth().height(156.dp),
            pageSpacing = 12.dp,
        ) { page ->
            val promo = promos[page]
            val gradient = when (promo.gradient) {
                "dark" -> Brush.linearGradient(
                    listOf(Color(0xFF0F172A), Color(0xFF1E293B), Color(0xFF334155)),
                )
                else -> Brush.linearGradient(
                    listOf(Color(0xFFEA580C), Color(0xFFF97316), Color(0xFFFB7185)),
                )
            }
            Box(
                Modifier
                    .fillMaxSize()
                    .graphicsLayer {
                        val offset = (pagerState.currentPage - page) + pagerState.currentPageOffsetFraction
                        val scale = 1f - (kotlin.math.abs(offset) * 0.06f).coerceIn(0f, 0.12f)
                        scaleX = scale
                        scaleY = scale
                        alpha = 1f - (kotlin.math.abs(offset) * 0.25f).coerceIn(0f, 0.35f)
                    }
                    .shadow(14.dp, RoundedCornerShape(24.dp))
                    .clip(RoundedCornerShape(24.dp))
                    .background(gradient),
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
                // animated sheen
                Box(
                    Modifier
                        .fillMaxSize()
                        .graphicsLayer {
                            translationX = sheen * size.width * 0.55f
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
                                .size(48.dp)
                                .graphicsLayer { translationY = (bob - 0.5f) * 8f }
                                .clip(RoundedCornerShape(16.dp))
                                .background(Color.White.copy(alpha = 0.22f)),
                            contentAlignment = Alignment.Center,
                        ) {
                            Icon(
                                Icons.Outlined.LocalOffer,
                                contentDescription = null,
                                tint = Color.White,
                                modifier = Modifier.size(26.dp),
                            )
                        }
                        Spacer(Modifier.width(14.dp))
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
                Modifier.fillMaxWidth().padding(top = 10.dp),
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
'''
        st = st[:start] + animated + st[next_fn:]
        # imports for animation
        for imp in [
            'import androidx.compose.animation.core.FastOutSlowInEasing',
            'import androidx.compose.animation.core.LinearEasing',
            'import androidx.compose.animation.core.RepeatMode',
            'import androidx.compose.animation.core.animateFloat',
            'import androidx.compose.animation.core.infiniteRepeatable',
            'import androidx.compose.animation.core.rememberInfiniteTransition',
            'import androidx.compose.animation.core.tween',
            'import androidx.compose.ui.layout.ContentScale',
        ]:
            if imp not in st:
                st = st.replace('import androidx.compose.foundation.layout.Box', imp + '\nimport androidx.compose.foundation.layout.Box')
        shell.write_text(st, encoding='utf-8')
        print('animated carousel')

print('done')
