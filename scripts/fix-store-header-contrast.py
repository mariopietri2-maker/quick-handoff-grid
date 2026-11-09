#!/usr/bin/env python3
from pathlib import Path

p = Path('native-customer/app/src/main/java/com/freshdelivery/nativecustomer/ui/CustomerShell.kt')
t = p.read_text()

old = '''                    Column(
                        Modifier
                            .align(Alignment.BottomStart)
                            .padding(16.dp),
                    ) {
                        Text(
                            store?.name ?: "Μενού",
                            style = MaterialTheme.typography.headlineMedium,
                            color = Color.White,
                        )
                        store?.address?.let {
                            Text(it, color = Color.White.copy(alpha = 0.85f), style = MaterialTheme.typography.bodyMedium)
                        }
                        val minO = store?.min_order_amount ?: 0.0
                        if (minO > 0) {
                            Text(
                                "Ελάχ. παραγγελία €%.0f".format(minO),
                                color = Color.White.copy(alpha = 0.9f),
                                style = MaterialTheme.typography.labelLarge,
                                fontWeight = FontWeight.SemiBold,
                            )
                        }
                        Spacer(Modifier.height(8.dp))
                        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                            store?.let { s ->
                                Surface(
                                    color = if (isPlatformFulfilment(s)) FreshGreenDark else Color.White.copy(alpha = 0.22f),
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
                    }'''

new = '''                    Column(
                        Modifier
                            .align(Alignment.BottomStart)
                            .padding(16.dp),
                    ) {
                        Text(
                            store?.name ?: "Μενού",
                            style = MaterialTheme.typography.headlineMedium,
                            color = Color.White,
                            fontWeight = FontWeight.Bold,
                        )
                        store?.address?.let {
                            Text(it, color = Color.White.copy(alpha = 0.95f), style = MaterialTheme.typography.bodyMedium, fontWeight = FontWeight.Medium)
                        }
                        Spacer(Modifier.height(10.dp))
                        Row(
                            horizontalArrangement = Arrangement.spacedBy(8.dp),
                            modifier = Modifier.fillMaxWidth(),
                        ) {
                            val minO = store?.min_order_amount ?: 0.0
                            if (minO > 0) {
                                Surface(
                                    color = Color.Black.copy(alpha = 0.72f),
                                    shape = RoundedCornerShape(10.dp),
                                ) {
                                    Text(
                                        "Ελάχ. παραγγελία €%.0f".format(minO),
                                        color = Color.White,
                                        fontWeight = FontWeight.Bold,
                                        style = MaterialTheme.typography.labelMedium,
                                        modifier = Modifier.padding(horizontal = 10.dp, vertical = 6.dp),
                                    )
                                }
                            }
                            store?.let { s ->
                                Surface(
                                    color = if (isPlatformFulfilment(s)) FreshGreenDark else Color.Black.copy(alpha = 0.72f),
                                    shape = RoundedCornerShape(10.dp),
                                ) {
                                    Text(
                                        storeFulfilmentLabel(s),
                                        color = Color.White,
                                        fontWeight = FontWeight.Bold,
                                        style = MaterialTheme.typography.labelMedium,
                                        modifier = Modifier.padding(horizontal = 10.dp, vertical = 6.dp),
                                    )
                                }
                            }
                            Surface(
                                color = Color.Black.copy(alpha = 0.72f),
                                shape = RoundedCornerShape(10.dp),
                            ) {
                                Text(
                                    "${state.menu.size} προϊόντα",
                                    color = Color.White,
                                    fontWeight = FontWeight.Bold,
                                    style = MaterialTheme.typography.labelMedium,
                                    modifier = Modifier.padding(horizontal = 10.dp, vertical = 6.dp),
                                )
                            }
                        }
                    }'''

if old not in t:
    raise SystemExit('header block not found')
t = t.replace(old, new, 1)

# stronger hero scrim so white text always readable
old_grad = '''                            .background(
                                Brush.verticalGradient(
                                    listOf(
                                        Color.Transparent,
                                        Color.Black.copy(alpha = 0.55f),
                                    ),
                                    startY = 120f,
                                ),
                            ),'''
new_grad = '''                            .background(
                                Brush.verticalGradient(
                                    listOf(
                                        Color.Black.copy(alpha = 0.15f),
                                        Color.Black.copy(alpha = 0.72f),
                                    ),
                                    startY = 40f,
                                ),
                            ),'''
if old_grad in t:
    t = t.replace(old_grad, new_grad, 1)
    print('gradient strengthened')
else:
    print('gradient pattern missing — chips still fixed')

p.write_text(t)
print('store header contrast OK')
