#!/usr/bin/env python3
"""Make home store cards denser — less white space, one delivery chip."""
from pathlib import Path

p = Path('native-customer/app/src/main/java/com/freshdelivery/nativecustomer/ui/CustomerShell.kt')
t = p.read_text()

# Remove expanding spacer in chip row (causes odd empty look in some layouts)
if 'Spacer(Modifier.weight(1f))' in t:
    # only inside FreshStoreCard chip row — replace last few occurrences carefully
    # Safer: replace the specific trailing spacer before closing Row in min order block
    old = '''                if (minOrd > 0) {
                    Surface(color = FreshChip, shape = RoundedCornerShape(12.dp)) {
                        Text(
                            "ελάχ. €%.0f".format(minOrd),
                            color = FreshMuted,
                            fontWeight = FontWeight.Medium,
                            style = MaterialTheme.typography.labelMedium,
                            modifier = Modifier.padding(horizontal = 10.dp, vertical = 6.dp),
                        )
                    }
                }
                Spacer(Modifier.weight(1f))
            }
        }
    }
}'''
    new = '''                if (minOrd > 0) {
                    Surface(color = FreshChip, shape = RoundedCornerShape(8.dp)) {
                        Text(
                            "ελάχ. €%.0f".format(minOrd),
                            color = FreshInk,
                            fontWeight = FontWeight.SemiBold,
                            style = MaterialTheme.typography.labelSmall,
                            modifier = Modifier.padding(horizontal = 8.dp, vertical = 3.dp),
                        )
                    }
                }
            }
        }
    }
}'''
    if old in t:
        t = t.replace(old, new, 1)
        print('removed weight spacer + minOrd chip')
    else:
        t = t.replace('                Spacer(Modifier.weight(1f))\n', '', 1)
        print('removed one weight spacer')

# Tighter body padding under hero
t = t.replace(
    'Column(Modifier.padding(horizontal = 12.dp, vertical = 6.dp))',
    'Column(Modifier.padding(horizontal = 12.dp, vertical = 8.dp))',
    1,
)

# Hero already 92 — ensure not 148
t = t.replace(
    'Box(Modifier.fillMaxWidth().height(148.dp)',
    'Box(Modifier.fillMaxWidth().height(110.dp)',
)
t = t.replace('height = 148', 'height = 110')

# Don't show both fee "Παράδοση" AND "Παράδοση καταστήματος"
old_chips = '''                Surface(
                    color = if (freeDelivery) FreshGreenSoft else FreshChip,
                    shape = RoundedCornerShape(8.dp),
                ) {
                    Row(
                        Modifier.padding(horizontal = 8.dp, vertical = 3.dp),
                        verticalAlignment = Alignment.CenterVertically,
                    ) {
                        if (freeDelivery) {
                            Icon(Icons.Outlined.DirectionsBike, contentDescription = null, tint = FreshGreenDark, modifier = Modifier.size(14.dp))
                            Spacer(Modifier.width(4.dp))
                        }
                        Text(
                            feeLabel,
                            color = if (freeDelivery) FreshGreenDark else FreshMuted,
                            fontWeight = FontWeight.Bold,
                            style = MaterialTheme.typography.labelMedium,
                        )
                    }
                }
                Surface(
                    color = if (isPlatformFulfilment(store)) FreshGreenDark.copy(alpha = 0.12f) else FreshChip,
                    shape = RoundedCornerShape(8.dp),
                ) {
                    Text(
                        storeFulfilmentLabel(store),
                        color = if (isPlatformFulfilment(store)) FreshGreenDark else FreshMuted,
                        fontWeight = FontWeight.Bold,
                        style = MaterialTheme.typography.labelSmall,
                        modifier = Modifier.padding(horizontal = 8.dp, vertical = 3.dp),
                        maxLines = 1,
                    )
                }'''

new_chips = '''                // One delivery chip only (fee OR fulfilment — not both)
                Surface(
                    color = if (freeDelivery) FreshGreenSoft else FreshChip,
                    shape = RoundedCornerShape(8.dp),
                ) {
                    Row(
                        Modifier.padding(horizontal = 8.dp, vertical = 3.dp),
                        verticalAlignment = Alignment.CenterVertically,
                    ) {
                        if (freeDelivery) {
                            Icon(Icons.Outlined.DirectionsBike, contentDescription = null, tint = FreshGreenDark, modifier = Modifier.size(14.dp))
                            Spacer(Modifier.width(4.dp))
                        }
                        val deliveryChip = when {
                            freeDelivery -> "Δωρεάν παράδοση"
                            !isPlatformFulfilment(store) -> storeFulfilmentLabelShort(store)
                            else -> feeLabel
                        }
                        Text(
                            deliveryChip,
                            color = if (freeDelivery) FreshGreenDark else FreshInk,
                            fontWeight = FontWeight.Bold,
                            style = MaterialTheme.typography.labelSmall,
                            maxLines = 1,
                        )
                    }
                }'''

if old_chips in t:
    t = t.replace(old_chips, new_chips, 1)
    print('merged delivery chips')
else:
    print('delivery chips pattern miss')

p.write_text(t)
print('done')
