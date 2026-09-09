#!/usr/bin/env python3
"""Simplify native customer store cards: less text, no delivery clutter."""
from pathlib import Path
import sys

path = Path("native-customer/app/src/main/java/com/freshdelivery/nativecustomer/ui/CustomerShell.kt")
if not path.exists():
    print("CustomerShell.kt missing", file=sys.stderr)
    sys.exit(1)
text = path.read_text()

def replace_between(src: str, start_marker: str, end_marker: str, new_middle: str) -> str:
    s = src.find(start_marker)
    if s < 0:
        raise SystemExit(f"start not found: {start_marker[:40]}")
    e = src.find(end_marker, s)
    if e < 0:
        raise SystemExit(f"end not found: {end_marker[:40]}")
    return src[:s] + new_middle + src[e:]

FRESH_STORE_CARD = r'''@Composable
private fun FreshStoreCard(
    store: StoreRow,
    onClick: () -> Unit,
    rating: StoreRating? = null,
    isFavorite: Boolean = false,
    deliveryLat: Double? = null,
    deliveryLng: Double? = null,
    onToggleFavorite: (() -> Unit)? = null,
) {
    val openNow = isStoreOpenNow(store)
    val active = store.is_active != false
    val badge = store.promo_badge?.trim().orEmpty()
    val avg = rating?.avg ?: 0.0
    val count = rating?.count ?: 0
    val eta = storeDeliveryEstimate(store, deliveryLat, deliveryLng)

    Column(
        Modifier
            .fillMaxWidth()
            .padding(horizontal = 16.dp, vertical = 7.dp)
            .shadow(5.dp, RoundedCornerShape(20.dp))
            .clip(RoundedCornerShape(20.dp))
            .background(Color.White)
            .clickable(onClick = onClick),
    ) {
        Box(Modifier.fillMaxWidth().height(148.dp)) {
            StoreHeroImage(
                store.cover_image_url?.takeIf { it.isNotBlank() } ?: store.image_url,
                height = 148,
            )
            Surface(
                color = if (!active || !openNow) Color.Black.copy(alpha = 0.72f) else FreshGreen,
                shape = RoundedCornerShape(9.dp),
                modifier = Modifier.align(Alignment.TopStart).padding(10.dp),
            ) {
                Text(
                    if (!active || !openNow) "Κλειστό" else "Ανοιχτό",
                    color = Color.White,
                    fontWeight = FontWeight.Bold,
                    style = MaterialTheme.typography.labelSmall,
                    modifier = Modifier.padding(horizontal = 9.dp, vertical = 4.dp),
                )
            }
            Surface(
                color = Color.White.copy(alpha = 0.92f),
                shape = CircleShape,
                modifier = Modifier
                    .align(Alignment.TopEnd)
                    .padding(10.dp)
                    .then(
                        if (onToggleFavorite != null) Modifier.clickable { onToggleFavorite.invoke() }
                        else Modifier,
                    ),
            ) {
                Icon(
                    if (isFavorite) Icons.Filled.Favorite else Icons.Outlined.FavoriteBorder,
                    contentDescription = null,
                    tint = if (isFavorite) FreshRose else FreshMuted,
                    modifier = Modifier.padding(7.dp).size(18.dp),
                )
            }
            if (badge.isNotEmpty()) {
                Surface(
                    color = Color(0xFFEA580C),
                    shape = RoundedCornerShape(9.dp),
                    modifier = Modifier.align(Alignment.BottomStart).padding(10.dp),
                ) {
                    Text(
                        badge,
                        color = Color.White,
                        fontWeight = FontWeight.Bold,
                        style = MaterialTheme.typography.labelSmall,
                        modifier = Modifier.padding(horizontal = 9.dp, vertical = 4.dp),
                        maxLines = 1,
                    )
                }
            }
        }
        Column(Modifier.padding(horizontal = 14.dp, vertical = 12.dp)) {
            Text(
                store.name ?: "Κατάστημα",
                style = MaterialTheme.typography.titleMedium,
                fontWeight = FontWeight.Bold,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
            )
            store.tagline?.takeIf { it.isNotBlank() }?.let { tagline ->
                Text(
                    tagline,
                    style = MaterialTheme.typography.bodySmall,
                    color = FreshMuted,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                    modifier = Modifier.padding(top = 2.dp),
                )
            }
            Spacer(Modifier.height(8.dp))
            Row(
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(10.dp),
            ) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Icon(Icons.Outlined.Star, contentDescription = null, tint = FreshAmber, modifier = Modifier.size(14.dp))
                    Spacer(Modifier.width(3.dp))
                    Text(
                        if (count > 0) "%.1f".format(avg) else "Νέο",
                        color = FreshInk,
                        fontWeight = FontWeight.Bold,
                        style = MaterialTheme.typography.labelMedium,
                    )
                }
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Icon(Icons.Outlined.Timer, contentDescription = null, tint = FreshMuted, modifier = Modifier.size(14.dp))
                    Spacer(Modifier.width(3.dp))
                    Text(eta, color = FreshMuted, fontWeight = FontWeight.SemiBold, style = MaterialTheme.typography.labelMedium)
                }
                val minOrd = store.min_order_amount ?: 0.0
                if (minOrd > 0) {
                    Text(
                        "ελάχ. €%.0f".format(minOrd),
                        color = FreshMuted,
                        fontWeight = FontWeight.Medium,
                        style = MaterialTheme.typography.labelMedium,
                    )
                }
            }
        }
    }
}

'''

STORE_MINI = r'''@Composable
private fun StoreMiniCard(
    store: StoreRow,
    onClick: () -> Unit,
    rating: StoreRating? = null,
    deliveryLat: Double? = null,
    deliveryLng: Double? = null,
) {
    val badge = store.promo_badge?.trim().orEmpty()
    Column(
        Modifier
            .width(156.dp)
            .shadow(3.dp, RoundedCornerShape(16.dp))
            .clip(RoundedCornerShape(16.dp))
            .background(Color.White)
            .clickable(onClick = onClick),
    ) {
        Box(Modifier.fillMaxWidth().height(88.dp)) {
            StoreHeroImage(
                store.cover_image_url?.takeIf { it.isNotBlank() } ?: store.image_url,
                height = 88,
            )
            Surface(
                color = Color.White.copy(alpha = 0.92f),
                shape = RoundedCornerShape(8.dp),
                modifier = Modifier.align(Alignment.BottomEnd).padding(6.dp),
            ) {
                Row(Modifier.padding(horizontal = 6.dp, vertical = 3.dp), verticalAlignment = Alignment.CenterVertically) {
                    Icon(Icons.Outlined.Star, contentDescription = null, tint = FreshAmber, modifier = Modifier.size(11.dp))
                    Spacer(Modifier.width(2.dp))
                    Text(
                        if ((rating?.count ?: 0) > 0) "%.1f".format(rating!!.avg) else "Νέο",
                        style = MaterialTheme.typography.labelSmall,
                        fontWeight = FontWeight.Bold,
                    )
                }
            }
            if (badge.isNotEmpty()) {
                Surface(
                    color = Color(0xFFEA580C),
                    shape = RoundedCornerShape(7.dp),
                    modifier = Modifier.align(Alignment.TopStart).padding(6.dp),
                ) {
                    Text(
                        badge,
                        color = Color.White,
                        fontWeight = FontWeight.Bold,
                        fontSize = 9.sp,
                        modifier = Modifier.padding(horizontal = 6.dp, vertical = 2.dp),
                        maxLines = 1,
                    )
                }
            }
        }
        Column(Modifier.padding(horizontal = 9.dp, vertical = 8.dp)) {
            Text(
                store.name ?: "Κατάστημα",
                fontWeight = FontWeight.Bold,
                fontSize = 13.sp,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
            )
            Text(
                storeDeliveryEstimate(store, deliveryLat, deliveryLng),
                color = FreshMuted,
                fontSize = 11.sp,
                maxLines = 1,
                modifier = Modifier.padding(top = 2.dp),
            )
        }
    }
}

'''

text = replace_between(
    text,
    "@Composable\nprivate fun FreshStoreCard(",
    "@Composable\nprivate fun DiscoverSectionHeader(",
    FRESH_STORE_CARD,
)
text = replace_between(
    text,
    "@Composable\nprivate fun StoreMiniCard(",
    "@Composable\nprivate fun MenuScreen(",
    STORE_MINI,
)
path.write_text(text)
print("applied clean store cards ->", path, "lines", len(text.splitlines()))
