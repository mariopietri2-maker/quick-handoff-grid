#!/usr/bin/env python3
"""Show Παράδοση Fresh2GO on native customer store cards when fulfilment_mode is platform."""
from pathlib import Path

p = Path("native-customer/app/src/main/java/com/freshdelivery/nativecustomer/ui/CustomerShell.kt")
t = p.read_text()

if "storeFulfilmentLabel" not in t:
    old = '''private fun storeDeliveryFeeLabel(store: StoreRow): String {
    if (store.covers_delivery_fee == true) return "Δωρεάν delivery"
    val fee = store.delivery_fee
    return if (fee != null && fee > 0.0) {
        val s = if (fee % 1.0 == 0.0) fee.toInt().toString() else "%.1f".format(fee)
        "€$s delivery"
    } else {
        "Delivery"
    }
}'''
    new = old + '''

/** Who delivers this store — shown so customers know Fresh2GO vs store courier. */
private fun storeFulfilmentLabel(store: StoreRow): String {
    val mode = store.fulfilment_mode?.trim()?.lowercase().orEmpty()
    return if (mode == "store") "Παράδοση καταστήματος" else "Παράδοση Fresh2GO"
}

private fun isPlatformFulfilment(store: StoreRow): Boolean {
    val mode = store.fulfilment_mode?.trim()?.lowercase().orEmpty()
    return mode != "store"
}'''
    if old not in t:
        raise SystemExit("MISS fee helper")
    t = t.replace(old, new)
    print("helper")

old_mini = '''            Text(
                storeDeliveryEstimate(store, deliveryLat, deliveryLng),
                color = FreshMuted,
                fontSize = 11.sp,
                maxLines = 1,
                modifier = Modifier.padding(top = 2.dp),
            )
        }
    }
}

@Composable
private fun MenuScreen('''
new_mini = '''            Text(
                storeDeliveryEstimate(store, deliveryLat, deliveryLng),
                color = FreshMuted,
                fontSize = 11.sp,
                maxLines = 1,
                modifier = Modifier.padding(top = 2.dp),
            )
            Text(
                storeFulfilmentLabel(store),
                color = if (isPlatformFulfilment(store)) FreshTealDark else FreshMuted,
                fontSize = 10.sp,
                fontWeight = FontWeight.SemiBold,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
                modifier = Modifier.padding(top = 2.dp),
            )
        }
    }
}

@Composable
private fun MenuScreen('''
if "storeFulfilmentLabel(store)" not in t[t.find("private fun StoreMiniCard"):t.find("private fun StoreMiniCard")+2000]:
    if old_mini in t:
        t = t.replace(old_mini, new_mini)
        print("mini")
    else:
        print("mini miss")
else:
    print("mini already")

marker = '''                        Text(
                            feeLabel,
                            color = if (freeDelivery) FreshGreenDark else FreshMuted,
                            fontWeight = FontWeight.Bold,
                            style = MaterialTheme.typography.labelMedium,
                        )
                    }
                }
                if (dist != null) {'''
repl = '''                        Text(
                            feeLabel,
                            color = if (freeDelivery) FreshGreenDark else FreshMuted,
                            fontWeight = FontWeight.Bold,
                            style = MaterialTheme.typography.labelMedium,
                        )
                    }
                }
                Surface(
                    color = if (isPlatformFulfilment(store)) FreshTealDark.copy(alpha = 0.12f) else FreshChip,
                    shape = RoundedCornerShape(12.dp),
                ) {
                    Text(
                        storeFulfilmentLabel(store),
                        color = if (isPlatformFulfilment(store)) FreshTealDark else FreshMuted,
                        fontWeight = FontWeight.Bold,
                        style = MaterialTheme.typography.labelMedium,
                        modifier = Modifier.padding(horizontal = 10.dp, vertical = 6.dp),
                        maxLines = 1,
                    )
                }
                if (dist != null) {'''
if "FreshTealDark.copy(alpha = 0.12f)" in t:
    print("full already")
elif marker in t:
    t = t.replace(marker, repl, 1)
    print("full")
else:
    print("full miss")

old_hero = '''                        Spacer(Modifier.height(8.dp))
                        Surface(
                            color = Color.White.copy(alpha = 0.22f),
                            shape = RoundedCornerShape(10.dp),
                        ) {
                            Text(
                                "${state.menu.size} προϊόντα",
                                color = Color.White,
                                fontWeight = FontWeight.SemiBold,
                                style = MaterialTheme.typography.labelMedium,
                                modifier = Modifier.padding(horizontal = 10.dp, vertical = 5.dp),
                            )
                        }
                    }
                }
            }
            item {'''
new_hero = '''                        Spacer(Modifier.height(8.dp))
                        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                            store?.let { s ->
                                Surface(
                                    color = if (isPlatformFulfilment(s)) FreshTealDark else Color.White.copy(alpha = 0.22f),
                                    shape = RoundedCornerShape(10.dp),
                                ) {
                                    Text(
                                        storeFulfilmentLabel(s),
                                        color = Color.White,
                                        fontWeight = FontWeight.Bold,
                                        style = MaterialTheme.typography.labelMedium,
                                        modifier = Modifier.padding(horizontal = 10.dp, vertical = 5.dp),
                                    )
                                }
                            }
                            Surface(
                                color = Color.White.copy(alpha = 0.22f),
                                shape = RoundedCornerShape(10.dp),
                            ) {
                                Text(
                                    "${state.menu.size} προϊόντα",
                                    color = Color.White,
                                    fontWeight = FontWeight.SemiBold,
                                    style = MaterialTheme.typography.labelMedium,
                                    modifier = Modifier.padding(horizontal = 10.dp, vertical = 5.dp),
                                )
                            }
                        }
                    }
                }
            }
            item {'''
if "storeFulfilmentLabel(s)" in t:
    print("hero already")
elif old_hero in t:
    t = t.replace(old_hero, new_hero)
    print("hero")
else:
    print("hero miss")

p.write_text(t)
print("done", "Παράδοση Fresh2GO" in t)
