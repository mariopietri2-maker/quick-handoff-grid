from pathlib import Path
p = Path("native-customer/app/src/main/java/com/freshdelivery/nativecustomer/ui/CustomerShell.kt")
t = p.read_text()
if "placeLabel = when" in t:
    print("already polished")
    raise SystemExit(0)

old = """                    Spacer(Modifier.height(16.dp))
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
                            ),
                        contentAlignment = Alignment.Center,
                    ) {
                        if (state.busy) {
                            CircularProgressIndicator(color = Color.White, modifier = Modifier.size(24.dp))
                        } else {
                            Text(
                                if (cartMin > 0 && state.cartSubtotal < cartMin) {
                                    "Πρόσθεσε προϊόντα · ακόμα €" + "%.2f".format(cartMin - state.cartSubtotal)
                                } else {
                                    "Τοποθέτηση παραγγελίας · €" + "%.2f".format(state.grandTotal)
                                },
                                fontWeight = FontWeight.Bold,
                                color = if (!canPlace) FreshMuted else Color.White,
                            )
                        }
                    }"""

new = """                    Spacer(Modifier.height(16.dp))
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
                            .background(if (!canPlace) FreshChip else FreshGradient)
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
                    }"""

if old not in t:
    raise SystemExit("place order block missing")
t = t.replace(old, new, 1)

old_empty = """        if (state.orders.isEmpty()) {
            item {
                Column(
                    Modifier
                        .fillMaxWidth()
                        .padding(32.dp),
                    horizontalAlignment = Alignment.CenterHorizontally,
                ) {
                    Icon(Icons.Outlined.Receipt, contentDescription = null, tint = FreshMuted, modifier = Modifier.size(44.dp))
                    Spacer(Modifier.height(10.dp))
                    Text("Δεν υπάρχουν παραγγελίες ακόμα.", color = FreshMuted, style = MaterialTheme.typography.bodyMedium)
                    Spacer(Modifier.height(6.dp))
                    Text("Παράγγειλε από ένα κατάστημα για να εμφανιστούν εδώ.", color = FreshMuted, style = MaterialTheme.typography.bodySmall)
                }
            }
        }"""

new_empty = """        if (state.orders.isEmpty()) {
            item {
                Column(
                    Modifier
                        .fillMaxWidth()
                        .padding(horizontal = 28.dp, vertical = 48.dp),
                    horizontalAlignment = Alignment.CenterHorizontally,
                ) {
                    Box(
                        Modifier
                            .size(72.dp)
                            .clip(RoundedCornerShape(24.dp))
                            .background(FreshGreenSoft),
                        contentAlignment = Alignment.Center,
                    ) {
                        Icon(Icons.Outlined.Receipt, contentDescription = null, tint = FreshGreen, modifier = Modifier.size(36.dp))
                    }
                    Spacer(Modifier.height(16.dp))
                    Text(
                        "Καμία παραγγελία ακόμα",
                        fontWeight = FontWeight.Bold,
                        style = MaterialTheme.typography.titleMedium,
                        color = FreshInk,
                    )
                    Spacer(Modifier.height(8.dp))
                    Text(
                        "Διάλεξε κατάστημα από την Αρχική και η παραγγελία σου θα εμφανιστεί εδώ με live tracking.",
                        color = FreshMuted,
                        style = MaterialTheme.typography.bodyMedium,
                        modifier = Modifier.padding(horizontal = 8.dp),
                    )
                    Spacer(Modifier.height(20.dp))
                    Surface(
                        onClick = onBackToHome,
                        color = FreshGreen,
                        shape = RoundedCornerShape(16.dp),
                    ) {
                        Text(
                            "Δες καταστήματα",
                            color = Color.White,
                            fontWeight = FontWeight.Bold,
                            modifier = Modifier.padding(horizontal = 22.dp, vertical = 12.dp),
                        )
                    }
                }
            }
        }"""

if old_empty in t:
    t = t.replace(old_empty, new_empty, 1)

t = t.replace(
    """.padding(horizontal = 16.dp, vertical = 7.dp)
            .shadow(6.dp, RoundedCornerShape(22.dp))
            .clip(RoundedCornerShape(22.dp))
            .background(Color.White)
            .clickable(onClick = onClick),
    ) {
        Box(Modifier.fillMaxWidth().height(160.dp)) {""",
    """.padding(horizontal = 16.dp, vertical = 6.dp)
            .shadow(3.dp, RoundedCornerShape(20.dp))
            .clip(RoundedCornerShape(20.dp))
            .background(Color.White)
            .clickable(onClick = onClick),
    ) {
        Box(Modifier.fillMaxWidth().height(148.dp)) {""",
    1,
)
t = t.replace(
    """            StoreHeroImage(
                store.cover_image_url?.takeIf { it.isNotBlank() } ?: store.image_url,
                height = 160,
            )""",
    """            StoreHeroImage(
                store.cover_image_url?.takeIf { it.isNotBlank() } ?: store.image_url,
                height = 148,
            )""",
    1,
)

p.write_text(t)
print("polish applied")
