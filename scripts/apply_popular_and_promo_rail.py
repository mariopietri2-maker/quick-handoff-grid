#!/usr/bin/env python3
from pathlib import Path

p = Path('native-customer/app/src/main/java/com/freshdelivery/nativecustomer/ui/CustomerShell.kt')
t = p.read_text(encoding='utf-8')

old_promo = '''        state.appConfig.promos.firstOrNull()?.let { promo ->
            item {
                Box(
                    Modifier
                        .fillMaxWidth()
                        .padding(horizontal = 16.dp, vertical = 6.dp)
                        .shadow(10.dp, RoundedCornerShape(24.dp))
                        .clip(RoundedCornerShape(24.dp))
                        .background(FreshGradient),
                ) {
                    Row(Modifier.padding(18.dp), verticalAlignment = Alignment.CenterVertically) {
                        Box(
                            Modifier
                                .size(44.dp)
                                .clip(RoundedCornerShape(14.dp))
                                .background(Color.White.copy(alpha = 0.22f)),
                            contentAlignment = Alignment.Center,
                        ) {
                            Icon(Icons.Outlined.LocalOffer, contentDescription = null, tint = Color.White)
                        }
                        Spacer(Modifier.width(12.dp))
                        Column(Modifier.weight(1f)) {
                            Text(
                                promo.tag,
                                color = Color.White.copy(alpha = 0.85f),
                                fontWeight = FontWeight.Bold,
                                style = MaterialTheme.typography.labelMedium,
                            )
                            Text(
                                promo.title,
                                color = Color.White,
                                fontWeight = FontWeight.Bold,
                                style = MaterialTheme.typography.titleMedium,
                            )
                            Text(
                                promo.subtitle,
                                color = Color.White.copy(alpha = 0.8f),
                                style = MaterialTheme.typography.bodySmall,
                            )
                        }
                        if (promo.code.isNotBlank()) {
                            Surface(
                                color = Color.White,
                                shape = RoundedCornerShape(10.dp),
                            ) {
                                Text(
                                    promo.code,
                                    color = FreshGreenDark,
                                    fontWeight = FontWeight.Bold,
                                    modifier = Modifier.padding(horizontal = 10.dp, vertical = 6.dp),
                                )
                            }
                        }
                    }
                }
            }
        }'''

new_promo = '''        val activePromos = state.appConfig.promos.filter { it.enabled && it.title.isNotBlank() }
        if (activePromos.isNotEmpty()) {
            item {
                Row(
                    Modifier
                        .horizontalScroll(rememberScrollState())
                        .padding(horizontal = 16.dp, vertical = 6.dp),
                    horizontalArrangement = Arrangement.spacedBy(12.dp),
                ) {
                    activePromos.forEach { promo ->
                        Box(
                            Modifier
                                .width(if (activePromos.size == 1) 320.dp else 280.dp)
                                .shadow(10.dp, RoundedCornerShape(24.dp))
                                .clip(RoundedCornerShape(24.dp))
                                .background(FreshGradient),
                        ) {
                            Row(Modifier.padding(18.dp), verticalAlignment = Alignment.CenterVertically) {
                                Box(
                                    Modifier
                                        .size(44.dp)
                                        .clip(RoundedCornerShape(14.dp))
                                        .background(Color.White.copy(alpha = 0.22f)),
                                    contentAlignment = Alignment.Center,
                                ) {
                                    Icon(Icons.Outlined.LocalOffer, contentDescription = null, tint = Color.White)
                                }
                                Spacer(Modifier.width(12.dp))
                                Column(Modifier.weight(1f)) {
                                    Text(
                                        promo.tag.ifBlank { "ΠΡΟΣΦΟΡΑ" },
                                        color = Color.White.copy(alpha = 0.85f),
                                        fontWeight = FontWeight.Bold,
                                        style = MaterialTheme.typography.labelMedium,
                                    )
                                    Text(
                                        promo.title,
                                        color = Color.White,
                                        fontWeight = FontWeight.Bold,
                                        style = MaterialTheme.typography.titleMedium,
                                        maxLines = 2,
                                        overflow = TextOverflow.Ellipsis,
                                    )
                                    if (promo.subtitle.isNotBlank()) {
                                        Text(
                                            promo.subtitle,
                                            color = Color.White.copy(alpha = 0.8f),
                                            style = MaterialTheme.typography.bodySmall,
                                            maxLines = 2,
                                            overflow = TextOverflow.Ellipsis,
                                        )
                                    }
                                }
                                if (promo.code.isNotBlank()) {
                                    Surface(
                                        color = Color.White,
                                        shape = RoundedCornerShape(10.dp),
                                    ) {
                                        Text(
                                            promo.code,
                                            color = FreshGreenDark,
                                            fontWeight = FontWeight.Bold,
                                            modifier = Modifier.padding(horizontal = 10.dp, vertical = 6.dp),
                                        )
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }'''

if 'activePromos' not in t and old_promo in t:
    t = t.replace(old_promo, new_promo)
    print('promo')

popular_block = '''                val popular = remember(state.menu) {
                    state.menu
                        .filter { it.is_available != false }
                        .sortedWith(
                            compareByDescending<MenuItemRow> { !it.image_url.isNullOrBlank() }
                                .thenBy { it.price },
                        )
                        .take(6)
                }
                if (popular.size >= 3) {
                    item(key = "popular-header") {
                        Text(
                            "Δημοφιλή",
                            style = MaterialTheme.typography.titleMedium,
                            fontWeight = FontWeight.Bold,
                            color = FreshInk,
                            modifier = Modifier.padding(horizontal = 16.dp, vertical = 10.dp),
                        )
                    }
                    item(key = "popular-row") {
                        Row(
                            Modifier
                                .horizontalScroll(rememberScrollState())
                                .padding(horizontal = 16.dp, vertical = 4.dp),
                            horizontalArrangement = Arrangement.spacedBy(12.dp),
                        ) {
                            popular.forEach { item ->
                                Column(
                                    Modifier
                                        .width(140.dp)
                                        .shadow(4.dp, RoundedCornerShape(18.dp))
                                        .clip(RoundedCornerShape(18.dp))
                                        .background(Color.White)
                                        .clickable {
                                            if (item.is_available != false) onAdd(item)
                                        }
                                        .padding(10.dp),
                                ) {
                                    Box(
                                        Modifier
                                            .fillMaxWidth()
                                            .height(90.dp)
                                            .clip(RoundedCornerShape(14.dp))
                                            .background(FreshChip),
                                        contentAlignment = Alignment.Center,
                                    ) {
                                        if (!item.image_url.isNullOrBlank()) {
                                            AsyncImage(
                                                model = item.image_url,
                                                contentDescription = null,
                                                contentScale = ContentScale.Crop,
                                                modifier = Modifier.fillMaxSize(),
                                            )
                                        } else {
                                            Icon(Icons.Outlined.Restaurant, null, tint = FreshMuted)
                                        }
                                    }
                                    Spacer(Modifier.height(8.dp))
                                    Text(
                                        item.name,
                                        fontWeight = FontWeight.Bold,
                                        style = MaterialTheme.typography.labelLarge,
                                        maxLines = 2,
                                        overflow = TextOverflow.Ellipsis,
                                        color = FreshInk,
                                    )
                                    Text(
                                        "€" + "%.2f".format(item.price),
                                        fontWeight = FontWeight.Bold,
                                        color = FreshGreenDark,
                                        style = MaterialTheme.typography.labelMedium,
                                    )
                                }
                            }
                        }
                    }
                }
'''

if 'popular-header' not in t:
    for needle in [
        '''            } else {
                if (menuGroups.size > 1) {
                    stickyHeader(key = "cat-chips") {''',
        '''            } else {
                if (menuGroups.size > 1) {
                    item(key = "cat-chips") {''',
    ]:
        if needle in t:
            t = t.replace(needle, '''            } else {
''' + popular_block + needle.split('} else {')[0].replace('            } else {
','') + needle[len('            } else {\n'):] if False else None)
            # simpler
            head, rest = needle.split('{', 1)
            # just do direct
            break
    if 'stickyHeader(key = "cat-chips")' in t and 'popular-header' not in t:
        t = t.replace(
            '''            } else {
                if (menuGroups.size > 1) {
                    stickyHeader(key = "cat-chips") {''',
            '''            } else {
''' + popular_block + '''                if (menuGroups.size > 1) {
                    stickyHeader(key = "cat-chips") {''',
        )
        print('popular sticky')
    elif 'item(key = "cat-chips")' in t and 'popular-header' not in t:
        t = t.replace(
            '''            } else {
                if (menuGroups.size > 1) {
                    item(key = "cat-chips") {''',
            '''            } else {
''' + popular_block + '''                if (menuGroups.size > 1) {
                    item(key = "cat-chips") {''',
        )
        print('popular item')
else:
    print('popular already')

p.write_text(t, encoding='utf-8')
print('done')
