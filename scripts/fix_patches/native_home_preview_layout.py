#!/usr/bin/env python3
"""Apply HTML-preview home layout to customer native HomeTab."""
from pathlib import Path
import re

p = Path('native-customer/app/src/main/java/com/freshdelivery/nativecustomer/ui/CustomerShell.kt')
t = p.read_text()

if 'import androidx.compose.foundation.BorderStroke' not in t:
    t = t.replace(
        'import androidx.compose.foundation.background',
        'import androidx.compose.foundation.BorderStroke\nimport androidx.compose.foundation.background',
        1,
    )

t = t.replace('if (withOffers.size >= 2) {', 'if (withOffers.isNotEmpty()) {', 1)

marker = '''                        withOffers.take(10).forEach { store ->
                            StoreMiniCard(
                                store = store,
                                rating = state.storeRatings[store.id],
                                deliveryLat = state.deliveryLat,
                                deliveryLng = state.deliveryLng,
                                onClick = { onOpenStore(store) },
                            )
                        }
                    }
                }
            }

            if (freeDelivery.isNotEmpty()) {'''

insert = '''                        withOffers.take(10).forEach { store ->
                            StoreMiniCard(
                                store = store,
                                rating = state.storeRatings[store.id],
                                deliveryLat = state.deliveryLat,
                                deliveryLng = state.deliveryLng,
                                onClick = { onOpenStore(store) },
                            )
                        }
                    }
                }
            }

            // Παράγγειλε ξανά — last unique stores from order history
            val recentOrders = state.orders
                .distinctBy { it.order.store_id }
                .take(4)
            if (recentOrders.isNotEmpty()) {
                item {
                    DiscoverSectionHeader(title = "Παράγγειλε ξανά", action = "Ιστορικό ›") {
                        onTab(com.freshdelivery.nativecustomer.data.CustomerTab.Orders)
                    }
                }
                item {
                    Row(
                        Modifier
                            .horizontalScroll(rememberScrollState())
                            .padding(horizontal = 16.dp, vertical = 4.dp),
                        horizontalArrangement = Arrangement.spacedBy(10.dp),
                    ) {
                        recentOrders.forEach { ou ->
                            val store = state.stores.firstOrNull { it.id == ou.order.store_id }
                            Surface(
                                onClick = {
                                    if (store != null) onOpenStore(store)
                                    else onTab(com.freshdelivery.nativecustomer.data.CustomerTab.Orders)
                                },
                                color = Color.White,
                                shape = RoundedCornerShape(14.dp),
                                border = BorderStroke(1.dp, FreshDivider),
                                modifier = Modifier.width(168.dp),
                            ) {
                                Row(
                                    Modifier.padding(10.dp),
                                    verticalAlignment = Alignment.CenterVertically,
                                ) {
                                    Box(
                                        Modifier
                                            .size(40.dp)
                                            .clip(RoundedCornerShape(10.dp))
                                            .background(FreshGreenSoft),
                                        contentAlignment = Alignment.Center,
                                    ) {
                                        Text("🍽️", fontSize = 18.sp)
                                    }
                                    Spacer(Modifier.width(8.dp))
                                    Column(Modifier.weight(1f)) {
                                        Text(
                                            ou.storeName ?: store?.name ?: "Κατάστημα",
                                            fontWeight = FontWeight.Bold,
                                            fontSize = 12.sp,
                                            maxLines = 1,
                                            overflow = TextOverflow.Ellipsis,
                                        )
                                        Text(
                                            "€%.2f".format(ou.order.total_amount ?: 0.0),
                                            color = FreshMuted,
                                            fontSize = 11.sp,
                                            maxLines = 1,
                                        )
                                    }
                                }
                            }
                        }
                    }
                }
            }

            if (freeDelivery.isNotEmpty()) {'''

if 'Παράγγειλε ξανά' not in t and marker in t:
    t = t.replace(marker, insert, 1)
    print('order-again')
elif 'Παράγγειλε ξανά' in t:
    print('order-again already')
else:
    print('order-again miss')

t2, n = re.subn(
    r'\n            item \{\n                DiscoverSectionHeader\(\n                    title = "Νέες γεύσεις — ζωντανά",[\s\S]*?AnimatedDemoStoreCard\([\s\S]*?\n            \}\n',
    '\n',
    t,
    count=1,
)
if n:
    t = t2
    print('demo removed')
else:
    print('demo skip')

old_cart = '''        Box(
            Modifier
                .fillMaxWidth()
                .shadow(12.dp, RoundedCornerShape(20.dp))
                .clip(RoundedCornerShape(20.dp))
                .background(FreshGradient)
                .clickable(onClick = onClick),
        ) {'''
new_cart = '''        Box(
            Modifier
                .fillMaxWidth()
                .shadow(12.dp, RoundedCornerShape(16.dp))
                .clip(RoundedCornerShape(16.dp))
                .background(FreshInk)
                .clickable(onClick = onClick),
        ) {'''
if old_cart in t:
    t = t.replace(old_cart, new_cart, 1)
    print('cart')
else:
    print('cart skip')

p.write_text(t)

gp = Path('native-customer/app/build.gradle.kts')
g = gp.read_text()
g = g.replace('versionName = "2.9.18-fresh2go"', 'versionName = "2.9.19-fresh2go"')
g = g.replace('versionName = "2.9.15-fresh2go"', 'versionName = "2.9.19-fresh2go"')
g = g.replace('versionCode = 7233050', 'versionCode = 7233051')
g = g.replace('versionCode = 7233049', 'versionCode = 7233051')
gp.write_text(g)
print('version bumped')
