#!/usr/bin/env python3
from pathlib import Path

p = Path('native-customer/app/src/main/java/com/freshdelivery/nativecustomer/ui/CustomerShell.kt')
t = p.read_text(encoding='utf-8')

# Empty cart
old = '''        LazyColumn(
            Modifier
                .weight(1f)
                .padding(horizontal = 16.dp),
            verticalArrangement = Arrangement.spacedBy(10.dp),
        ) {
            item {
                Text("Τα αντικείμενά σου", fontWeight = FontWeight.Bold, style = MaterialTheme.typography.titleMedium, modifier = Modifier.padding(top = 8.dp))
            }
            items(state.cart, key = { it.menuItemId }) { line ->'''

new = '''        LazyColumn(
            Modifier
                .weight(1f)
                .padding(horizontal = 16.dp),
            verticalArrangement = Arrangement.spacedBy(10.dp),
        ) {
            if (state.cart.isEmpty()) {
                item {
                    Column(
                        Modifier
                            .fillMaxWidth()
                            .padding(vertical = 40.dp),
                        horizontalAlignment = Alignment.CenterHorizontally,
                    ) {
                        Box(
                            Modifier
                                .size(88.dp)
                                .clip(CircleShape)
                                .background(FreshGreenSoft),
                            contentAlignment = Alignment.Center,
                        ) {
                            Icon(
                                Icons.Outlined.ShoppingBag,
                                contentDescription = null,
                                tint = FreshGreenDark,
                                modifier = Modifier.size(40.dp),
                            )
                        }
                        Spacer(Modifier.height(16.dp))
                        Text(
                            "Το καλάθι είναι άδειο",
                            fontWeight = FontWeight.Bold,
                            style = MaterialTheme.typography.titleLarge,
                            color = FreshInk,
                        )
                        Spacer(Modifier.height(6.dp))
                        Text(
                            "Πρόσθεσε πιάτα από ένα κατάστημα για να συνεχίσεις.",
                            color = FreshMuted,
                            style = MaterialTheme.typography.bodyMedium,
                            textAlign = TextAlign.Center,
                            modifier = Modifier.padding(horizontal = 24.dp),
                        )
                        Spacer(Modifier.height(20.dp))
                        Button(
                            onClick = onBack,
                            colors = ButtonDefaults.buttonColors(containerColor = FreshGreen, contentColor = Color.White),
                            shape = RoundedCornerShape(16.dp),
                        ) {
                            Text("Δες καταστήματα", fontWeight = FontWeight.Bold)
                        }
                    }
                }
            } else {
            item {
                Text("Τα αντικείμενά σου", fontWeight = FontWeight.Bold, style = MaterialTheme.typography.titleMedium, modifier = Modifier.padding(top = 8.dp))
            }
            items(state.cart, key = { it.menuItemId }) { line ->'''

if 'Το καλάθι είναι άδειο' not in t and old in t:
    t = t.replace(old, new)
    print('empty')

# Close else at end of CartCheckoutScreen
marker = '''                    Spacer(Modifier.height(32.dp))
                }
            }
        }
    }
}

@Composable
private fun AddressPickerScreen('''

if '} // end else non-empty cart' not in t and marker in t and 'Το καλάθι είναι άδειο' in t:
    t = t.replace(marker, '''                    Spacer(Modifier.height(32.dp))
                }
            }
            } // end else non-empty cart
        }
    }
}

@Composable
private fun AddressPickerScreen(''')
    print('close else')

# Reorder section
if 'Παράγγειλε ξανά' not in t:
    reorder = '''
        val recentStores = remember(state.orders, state.stores) {
            val ids = state.orders.map { it.order.store_id }.distinct().take(8)
            ids.mapNotNull { id -> state.stores.find { it.id == id } }
        }
        if (recentStores.isNotEmpty()) {
            item {
                DiscoverSectionHeader(title = "Παράγγειλε ξανά", action = null, onAction = {})
            }
            item {
                Row(
                    Modifier
                        .horizontalScroll(rememberScrollState())
                        .padding(horizontal = 16.dp, vertical = 4.dp),
                    horizontalArrangement = Arrangement.spacedBy(10.dp),
                ) {
                    recentStores.forEach { store ->
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
'''
    if 'if (state.gameShow) {' in t:
        t = t.replace('        if (state.gameShow) {', reorder + '\n        if (state.gameShow) {', 1)
        print('reorder')

if 'textAlign = TextAlign.Center' in t and 'import androidx.compose.ui.text.style.TextAlign' not in t:
    t = t.replace(
        'import androidx.compose.ui.text.font.FontWeight',
        'import androidx.compose.ui.text.font.FontWeight\nimport androidx.compose.ui.text.style.TextAlign',
    )
    print('import')

p.write_text(t, encoding='utf-8')
print('done')
