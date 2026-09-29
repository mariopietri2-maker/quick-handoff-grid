#!/usr/bin/env python3
"""Sticky place-order button + nav bar padding on cart checkout."""
from pathlib import Path

p = Path('native-customer/app/src/main/java/com/freshdelivery/nativecustomer/ui/CustomerShell.kt')
t = p.read_text()
if 'Sticky place-order bar' in t:
    print('already')
else:
    if 'import androidx.compose.foundation.layout.navigationBarsPadding' not in t:
        t = t.replace(
            'import androidx.compose.foundation.layout.statusBarsPadding',
            'import androidx.compose.foundation.layout.navigationBarsPadding\nimport androidx.compose.foundation.layout.statusBarsPadding',
        )
    idx = t.find('private fun CartCheckoutScreen')
    old_col = '''    Column(
        Modifier
            .fillMaxSize()
            .background(FreshBg)
            .statusBarsPadding(),
    ) {
        SnackbarHost(snackbar)'''
    new_col = '''    Column(
        Modifier
            .fillMaxSize()
            .background(FreshBg)
            .statusBarsPadding()
            .navigationBarsPadding(),
    ) {
        SnackbarHost(snackbar)'''
    idx2 = t.find(old_col, idx)
    if idx2 > 0:
        t = t[:idx2] + new_col + t[idx2+len(old_col):]
        print('nav pad')
    old = '''                    Spacer(Modifier.height(16.dp))
                    val pinned = state.deliveryLat != null && state.deliveryLng != null
                    val minOk = cartMin <= 0 || state.cartSubtotal >= cartMin
                    val canPlace = !state.busy &&
                        state.cart.isNotEmpty() &&
                        address.isNotBlank() &&
                        pinned &&
                        minOk
                    val placeLabel = when {
                        state.cart.isEmpty() -> "Το καλάθι είναι άδειο"
                        address.isBlank() -> "Πρόσθεσε διεύθυνση παράδοσης"
                        !pinned -> "Επίλεξε σημείο στον χάρτη / εύρεση"
                        !minOk -> "Ακόμα €" + "%.2f".format(cartMin - state.cartSubtotal) + " για ελάχιστη"
                        else -> "Τοποθέτηση παραγγελίας · €" + "%.2f".format(state.grandTotal)
                    }
                    if (!canPlace && !state.busy) {
                        Text(
                            placeLabel,
                            color = FreshMuted,
                            style = MaterialTheme.typography.bodySmall,
                            modifier = Modifier.padding(bottom = 8.dp),
                        )
                    }
                    Box(
                        Modifier
                            .fillMaxWidth()
                            .height(56.dp)
                            .shadow(if (canPlace) 10.dp else 2.dp, RoundedCornerShape(28.dp))
                            .clip(RoundedCornerShape(28.dp))
                            .then(if (canPlace) Modifier.background(FreshGradient) else Modifier.background(FreshChip))
                            .clickable(
                                enabled = canPlace,
                                onClick = onPlaceOrder,
                            ),
                        contentAlignment = Alignment.Center,
                    ) {
                        if (state.busy) {
                            CircularProgressIndicator(color = Color.White, modifier = Modifier.size(24.dp))
                        } else {
                            Text(
                                if (canPlace) placeLabel else "Συμπλήρωσε τα στοιχεία πάνω",
                                fontWeight = FontWeight.Bold,
                                color = if (!canPlace) FreshMuted else Color.White,
                            )
                        }
                    }
                    Spacer(Modifier.height(32.dp))
                }
            }
            } // end else non-empty cart
        }
    }
}'''
    new = '''                    Spacer(Modifier.height(8.dp))
                }
            }
            } // end else non-empty cart
        }

        // Sticky place-order bar — sits above system nav (gesture / 3-button)
        if (state.cart.isNotEmpty()) {
            val cartMinSticky = (state.stores.find { it.id == state.cartStoreId } ?: state.selectedStore)?.min_order_amount ?: 0.0
            val pinned = state.deliveryLat != null && state.deliveryLng != null
            val minOk = cartMinSticky <= 0 || state.cartSubtotal >= cartMinSticky
            val canPlace = !state.busy &&
                state.cart.isNotEmpty() &&
                address.isNotBlank() &&
                pinned &&
                minOk
            val placeLabel = when {
                state.cart.isEmpty() -> "Το καλάθι είναι άδειο"
                address.isBlank() -> "Πρόσθεσε διεύθυνση παράδοσης"
                !pinned -> "Επίλεξε σημείο στον χάρτη / εύρεση"
                !minOk -> "Ακόμα €" + "%.2f".format(cartMinSticky - state.cartSubtotal) + " για ελάχιστη"
                else -> "Τοποθέτηση παραγγελίας · €" + "%.2f".format(state.grandTotal)
            }
            Column(
                Modifier
                    .fillMaxWidth()
                    .background(FreshSurface)
                    .padding(horizontal = 16.dp, vertical = 10.dp),
            ) {
                if (!canPlace && !state.busy) {
                    Text(
                        placeLabel,
                        color = FreshMuted,
                        style = MaterialTheme.typography.bodySmall,
                        modifier = Modifier.padding(bottom = 8.dp),
                    )
                }
                Box(
                    Modifier
                        .fillMaxWidth()
                        .height(56.dp)
                        .shadow(if (canPlace) 10.dp else 2.dp, RoundedCornerShape(28.dp))
                        .clip(RoundedCornerShape(28.dp))
                        .then(if (canPlace) Modifier.background(FreshGradient) else Modifier.background(FreshChip))
                        .clickable(
                            enabled = canPlace,
                            onClick = onPlaceOrder,
                        ),
                    contentAlignment = Alignment.Center,
                ) {
                    if (state.busy) {
                        CircularProgressIndicator(color = Color.White, modifier = Modifier.size(24.dp))
                    } else {
                        Text(
                            if (canPlace) placeLabel else "Συμπλήρωσε τα στοιχεία πάνω",
                            fontWeight = FontWeight.Bold,
                            color = if (!canPlace) FreshMuted else Color.White,
                        )
                    }
                }
            }
        }
    }
}'''
    if old in t:
        t = t.replace(old, new)
        print('sticky applied')
    else:
        print('miss')
    p.write_text(t)

gp = Path('native-customer/app/build.gradle.kts')
g = gp.read_text()
g = g.replace('versionName = "2.9.19-fresh2go"', 'versionName = "2.9.20-fresh2go"')
g = g.replace('versionName = "2.9.18-fresh2go"', 'versionName = "2.9.20-fresh2go"')
g = g.replace('versionCode = 7233051', 'versionCode = 7233052')
g = g.replace('versionCode = 7233050', 'versionCode = 7233052')
gp.write_text(g)
print('version')
