#!/usr/bin/env python3
from pathlib import Path

p = Path('native-customer/app/src/main/java/com/freshdelivery/nativecustomer/ui/CustomerShell.kt')
t = p.read_text(encoding='utf-8')

old_disc = '''        // Competitor-style horizontal discovery (food-only; retail hidden by flag).
        if (stores.isNotEmpty()) {
            item {
                DiscoverSectionHeader(title = "Φαγητό με δωρεάν delivery", action = "Δες τα όλα ›") {
                    filter = HomeFilter.All; onSearch("")
                }
            }
            item {
                Row(
                    Modifier
                        .horizontalScroll(rememberScrollState())
                        .padding(horizontal = 16.dp, vertical = 4.dp),
                    horizontalArrangement = Arrangement.spacedBy(10.dp),
                ) {
                    stores.take(8).forEach { store ->
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
            item {
                DiscoverSectionHeader(title = "Δημοφιλείς κουζίνες", action = null, onAction = {})
            }
            item {
                Row(
                    Modifier
                        .horizontalScroll(rememberScrollState())
                        .padding(horizontal = 16.dp, vertical = 4.dp),
                    horizontalArrangement = Arrangement.spacedBy(14.dp),
                ) {
                    listOf(
                        "Σουβλάκια" to "🥙", "Pizza" to "🍕",
                        "Κρέπες" to "🥞", "Burgers" to "🍔",
                    ).forEach { (label, emoji) ->
                        Column(
                            horizontalAlignment = Alignment.CenterHorizontally,
                            modifier = Modifier.clickable { onSearch(label) },
                        ) {
                            Box(
                                Modifier
                                    .size(52.dp)
                                    .clip(CircleShape)
                                    .background(Color.White)
                                    .border(0.5.dp, FreshDivider, CircleShape),
                                contentAlignment = Alignment.Center,
                            ) { Text(emoji, fontSize = 24.sp) }
                            Spacer(Modifier.height(4.dp))
                            Text(label, style = MaterialTheme.typography.labelMedium, color = FreshInk)
                        }
                    }
                }
            }
        }'''

new_disc = '''        // Fresh2GO discovery rails (efood density, own style)
        if (stores.isNotEmpty()) {
            val freeDelivery = stores.filter { it.covers_delivery_fee == true }.ifEmpty {
                stores.filter { (it.delivery_fee ?: 0.0) <= 0.0 }
            }
            val withOffers = stores.filter { !it.promo_badge.isNullOrBlank() }
            val nearFirst = if (hasLocation) {
                stores.sortedBy { storeDistanceKm(state.deliveryLat!!, state.deliveryLng!!, it) }
            } else stores

            if (withOffers.isNotEmpty()) {
                item {
                    DiscoverSectionHeader(title = "Προσφορές τώρα", action = "Όλες ›") {
                        filter = HomeFilter.Deals; onSearch("")
                    }
                }
                item {
                    Row(
                        Modifier
                            .horizontalScroll(rememberScrollState())
                            .padding(horizontal = 16.dp, vertical = 4.dp),
                        horizontalArrangement = Arrangement.spacedBy(10.dp),
                    ) {
                        withOffers.take(10).forEach { store ->
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

            if (freeDelivery.isNotEmpty()) {
                item {
                    DiscoverSectionHeader(title = "Δωρεάν delivery", action = "Δες τα όλα ›") {
                        filter = HomeFilter.Deals; onSearch("")
                    }
                }
                item {
                    Row(
                        Modifier
                            .horizontalScroll(rememberScrollState())
                            .padding(horizontal = 16.dp, vertical = 4.dp),
                        horizontalArrangement = Arrangement.spacedBy(10.dp),
                    ) {
                        freeDelivery.take(10).forEach { store ->
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

            item {
                DiscoverSectionHeader(title = "Κοντά σου", action = null, onAction = {})
            }
            item {
                Row(
                    Modifier
                        .horizontalScroll(rememberScrollState())
                        .padding(horizontal = 16.dp, vertical = 4.dp),
                    horizontalArrangement = Arrangement.spacedBy(10.dp),
                ) {
                    nearFirst.take(8).forEach { store ->
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

            item {
                DiscoverSectionHeader(title = "Τι θα φας σήμερα;", action = null, onAction = {})
            }
            item {
                val cuisineHints = listOf(
                    "Σουβλάκι" to "🥙",
                    "Πίτσα" to "🍕",
                    "Burger" to "🍔",
                    "Κρέπα" to "🥞",
                    "Καφές" to "☕",
                    "Γλυκό" to "🍰",
                    "Σαλάτα" to "🥗",
                    "Ζυμαρικά" to "🍝",
                )
                Row(
                    Modifier
                        .horizontalScroll(rememberScrollState())
                        .padding(horizontal = 16.dp, vertical = 4.dp),
                    horizontalArrangement = Arrangement.spacedBy(14.dp),
                ) {
                    cuisineHints.forEach { (label, emoji) ->
                        Column(
                            horizontalAlignment = Alignment.CenterHorizontally,
                            modifier = Modifier.clickable { onSearch(label) },
                        ) {
                            Box(
                                Modifier
                                    .size(56.dp)
                                    .shadow(3.dp, CircleShape)
                                    .clip(CircleShape)
                                    .background(Color.White),
                                contentAlignment = Alignment.Center,
                            ) { Text(emoji, fontSize = 26.sp) }
                            Spacer(Modifier.height(4.dp))
                            Text(label, style = MaterialTheme.typography.labelMedium, color = FreshInk, fontWeight = FontWeight.SemiBold)
                        }
                    }
                }
            }
        }'''

if 'Προσφορές τώρα' not in t and old_disc in t:
    t = t.replace(old_disc, new_disc)
    print('discovery')
elif 'Προσφορές τώρα' in t:
    print('discovery already')
else:
    print('WARN discovery')

if 'Ελάχ. 5€' in t:
    t = t.replace(
        'storeDeliveryEstimate(store, deliveryLat, deliveryLng) + " • Ελάχ. 5€"',
        'buildString {\n                append(storeDeliveryEstimate(store, deliveryLat, deliveryLng))\n                storeDistanceLabel(store, deliveryLat, deliveryLng)?.let { append(" • "); append(it) }\n            }',
    )
    print('minicard')

old_menu = '''            } else {
                items(state.menu, key = { it.id }) { item ->
                    FreshMenuRow(item = item, onAdd = { onAdd(item) })
                    Spacer(Modifier.height(6.dp))
                }
                item { Spacer(Modifier.height(100.dp)) }
            }'''
new_menu = '''            } else {
                val menuGroups = state.menu
                    .groupBy { it.category?.trim()?.takeIf { c -> c.isNotEmpty() } ?: "Μενού" }
                    .toList()
                    .sortedBy { (cat, _) -> if (cat == "Μενού") "zzz" else cat }
                menuGroups.forEach { (category, itemsInCat) ->
                    item(key = "cat-$category") {
                        Text(
                            category,
                            style = MaterialTheme.typography.titleMedium,
                            fontWeight = FontWeight.Bold,
                            color = FreshInk,
                            modifier = Modifier.padding(horizontal = 16.dp, vertical = 10.dp),
                        )
                    }
                    items(itemsInCat, key = { it.id }) { item ->
                        FreshMenuRow(item = item, onAdd = { onAdd(item) })
                        Spacer(Modifier.height(6.dp))
                    }
                }
                item { Spacer(Modifier.height(100.dp)) }
            }'''
if 'menuGroups' not in t and old_menu in t:
    t = t.replace(old_menu, new_menu)
    print('menu')
elif 'menuGroups' in t:
    print('menu already')
else:
    print('WARN menu')

p.write_text(t, encoding='utf-8')
print('done')
