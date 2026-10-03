#!/usr/bin/env python3
from pathlib import Path

p = Path("native-customer/app/src/main/java/com/freshdelivery/nativecustomer/ui/CustomerShell.kt")
t = p.read_text()
if "fun StoreHeroImage" in t:
    print("StoreHeroImage already present")
    raise SystemExit(0)

fn = '''
@Composable
private fun StoreHeroImage(url: String?, height: Int = 160) {
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

'''

marker = "\n@Composable\nprivate fun HomeTab("
if marker not in t:
    print("HomeTab marker miss")
    raise SystemExit(1)
t = t.replace(marker, fn + marker, 1)
p.write_text(t)
print("inserted StoreHeroImage", t.count("fun StoreHeroImage"))
