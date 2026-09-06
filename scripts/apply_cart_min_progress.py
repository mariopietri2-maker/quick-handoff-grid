#!/usr/bin/env python3
from pathlib import Path
import re

p = Path('native-customer/app/src/main/java/com/freshdelivery/nativecustomer/ui/CustomerShell.kt')
t = p.read_text(encoding='utf-8')

old_bar = '''private fun FreshCartBar(count: Int, total: Double, onClick: () -> Unit) {
    Box(
        Modifier
            .fillMaxWidth()
            .padding(horizontal = 12.dp, vertical = 8.dp)
            .shadow(12.dp, RoundedCornerShape(20.dp))
            .clip(RoundedCornerShape(20.dp))
            .background(FreshGradient)
            .clickable(onClick = onClick),
    ) {
        Row(
            Modifier
                .fillMaxWidth()
                .padding(horizontal = 18.dp, vertical = 14.dp),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Box(
                    Modifier
                        .size(26.dp)
                        .clip(CircleShape)
                        .background(Color.White),
                    contentAlignment = Alignment.Center,
                ) {
                    Text(
                        "$count",
                        color = FreshGreen,
                        fontWeight = FontWeight.Bold,
                        fontSize = 13.sp,
                    )
                }
                Spacer(Modifier.width(12.dp))
                Text(
                    "Προβολή καλαθιού",
                    color = Color.White,
                    fontWeight = FontWeight.Bold,
                )
            }
            Text(
                "€" + "%.2f".format(total),
                color = Color.White,
                fontWeight = FontWeight.Bold,
            )
        }
    }
}'''

new_bar = '''private fun FreshCartBar(
    count: Int,
    total: Double,
    onClick: () -> Unit,
    minOrder: Double = 0.0,
) {
    val needMore = minOrder > 0 && total < minOrder
    val progress = if (minOrder > 0) (total / minOrder).toFloat().coerceIn(0f, 1f) else 1f
    Column(
        Modifier
            .fillMaxWidth()
            .padding(horizontal = 12.dp, vertical = 8.dp),
    ) {
        if (needMore) {
            Surface(
                color = Color.White,
                shape = RoundedCornerShape(14.dp),
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(bottom = 8.dp)
                    .shadow(4.dp, RoundedCornerShape(14.dp)),
            ) {
                Column(Modifier.padding(horizontal = 14.dp, vertical = 10.dp)) {
                    Text(
                        "Ακόμα €%.2f για ελάχιστη παραγγελία".format(minOrder - total),
                        color = FreshInk,
                        fontWeight = FontWeight.SemiBold,
                        style = MaterialTheme.typography.labelLarge,
                    )
                    Spacer(Modifier.height(6.dp))
                    Box(
                        Modifier
                            .fillMaxWidth()
                            .height(6.dp)
                            .clip(RoundedCornerShape(3.dp))
                            .background(FreshChip),
                    ) {
                        Box(
                            Modifier
                                .fillMaxWidth(progress)
                                .height(6.dp)
                                .clip(RoundedCornerShape(3.dp))
                                .background(FreshGreen),
                        )
                    }
                }
            }
        }
        Box(
            Modifier
                .fillMaxWidth()
                .shadow(12.dp, RoundedCornerShape(20.dp))
                .clip(RoundedCornerShape(20.dp))
                .background(FreshGradient)
                .clickable(onClick = onClick),
        ) {
            Row(
                Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 18.dp, vertical = 14.dp),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Box(
                        Modifier
                            .size(26.dp)
                            .clip(CircleShape)
                            .background(Color.White),
                        contentAlignment = Alignment.Center,
                    ) {
                        Text(
                            "$count",
                            color = FreshGreen,
                            fontWeight = FontWeight.Bold,
                            fontSize = 13.sp,
                        )
                    }
                    Spacer(Modifier.width(12.dp))
                    Text(
                        if (needMore) "Συνέχεια παραγγελίας" else "Προβολή καλαθιού",
                        color = Color.White,
                        fontWeight = FontWeight.Bold,
                    )
                }
                Text(
                    "€" + "%.2f".format(total),
                    color = Color.White,
                    fontWeight = FontWeight.Bold,
                )
            }
        }
    }
}'''

if 'minOrder: Double = 0.0' not in t and old_bar in t:
    t = t.replace(old_bar, new_bar)
    print('bar')

for old_c, new_c in [
    ('''                    FreshCartBar(
                        count = state.cartCount,
                        total = state.cartSubtotal,
                        onClick = { onToggleCart(true) },
                    )''',
     '''                    FreshCartBar(
                        count = state.cartCount,
                        total = state.cartSubtotal,
                        minOrder = (state.stores.find { it.id == state.cartStoreId } ?: state.selectedStore)?.min_order_amount ?: 0.0,
                        onClick = { onToggleCart(true) },
                    )'''),
    ('''                FreshCartBar(
                    count = state.cartCount,
                    total = state.cartSubtotal,
                    onClick = onOpenCart,
                )''',
     '''                FreshCartBar(
                    count = state.cartCount,
                    total = state.cartSubtotal,
                    minOrder = (state.stores.find { it.id == state.cartStoreId } ?: state.selectedStore)?.min_order_amount ?: 0.0,
                    onClick = onOpenCart,
                )'''),
]:
    if old_c in t:
        t = t.replace(old_c, new_c)
        print('call')

old_btn = '''                    if (!state.error.isNullOrBlank()) {
                        Text(state.error!!, color = MaterialTheme.colorScheme.error)
                    }
                    Spacer(Modifier.height(16.dp))
                    Box(
                        Modifier
                            .fillMaxWidth()
                            .height(58.dp)
                            .shadow(12.dp, RoundedCornerShape(29.dp))
                            .clip(RoundedCornerShape(29.dp))
                            .background(if (state.busy || state.cart.isEmpty() || address.isBlank()) FreshChipGradient else FreshGradient)
                            .clickable(
                                enabled = !state.busy && state.cart.isNotEmpty() && address.isNotBlank(),
                                onClick = onPlaceOrder,
                            ),'''

new_btn = '''                    if (!state.error.isNullOrBlank()) {
                        Text(state.error!!, color = MaterialTheme.colorScheme.error)
                    }
                    val cartMin = (state.stores.find { it.id == state.cartStoreId } ?: state.selectedStore)?.min_order_amount ?: 0.0
                    if (cartMin > 0 && state.cartSubtotal < cartMin) {
                        Spacer(Modifier.height(12.dp))
                        Surface(
                            color = FreshGreenSoft,
                            shape = RoundedCornerShape(14.dp),
                            modifier = Modifier.fillMaxWidth(),
                        ) {
                            Column(Modifier.padding(14.dp)) {
                                Text(
                                    "Ελάχιστη παραγγελία €%.2f — ακόμα €%.2f".format(cartMin, cartMin - state.cartSubtotal),
                                    color = FreshGreenDark,
                                    fontWeight = FontWeight.SemiBold,
                                    style = MaterialTheme.typography.bodyMedium,
                                )
                                Spacer(Modifier.height(8.dp))
                                Box(
                                    Modifier
                                        .fillMaxWidth()
                                        .height(8.dp)
                                        .clip(RoundedCornerShape(4.dp))
                                        .background(Color.White.copy(alpha = 0.7f)),
                                ) {
                                    Box(
                                        Modifier
                                            .fillMaxWidth((state.cartSubtotal / cartMin).toFloat().coerceIn(0f, 1f))
                                            .height(8.dp)
                                            .clip(RoundedCornerShape(4.dp))
                                            .background(FreshGreen),
                                    )
                                }
                            }
                        }
                    }
                    Spacer(Modifier.height(16.dp))
                    val canPlace = !state.busy && state.cart.isNotEmpty() && address.isNotBlank() &&
                        (cartMin <= 0 || state.cartSubtotal >= cartMin)
                    Box(
                        Modifier
                            .fillMaxWidth()
                            .height(58.dp)
                            .shadow(12.dp, RoundedCornerShape(29.dp))
                            .clip(RoundedCornerShape(29.dp))
                            .background(if (!canPlace) FreshChipGradient else FreshGradient)
                            .clickable(
                                enabled = canPlace,
                                onClick = onPlaceOrder,
                            ),'''

if 'cartMin > 0 && state.cartSubtotal < cartMin' not in t and old_btn in t:
    t = t.replace(old_btn, new_btn)
    t = t.replace(
        '''                            Text(
                                "Τοποθέτηση παραγγελίας · €" + "%.2f".format(state.grandTotal),
                                fontWeight = FontWeight.Bold,
                                color = if (state.cart.isEmpty() || address.isBlank()) FreshMuted else Color.White,
                            )''',
        '''                            Text(
                                if (cartMin > 0 && state.cartSubtotal < cartMin) {
                                    "Πρόσθεσε προϊόντα · ακόμα €" + "%.2f".format(cartMin - state.cartSubtotal)
                                } else {
                                    "Τοποθέτηση παραγγελίας · €" + "%.2f".format(state.grandTotal)
                                },
                                fontWeight = FontWeight.Bold,
                                color = if (!canPlace) FreshMuted else Color.White,
                            )''',
    )
    print('checkout')

if 'stickyHeader(key = "cat-chips")' not in t:
    t = t.replace(
        'item(key = "cat-chips") {',
        'stickyHeader(key = "cat-chips") {',
        1,
    )
    print('sticky')

p.write_text(t, encoding='utf-8')
print('done')
