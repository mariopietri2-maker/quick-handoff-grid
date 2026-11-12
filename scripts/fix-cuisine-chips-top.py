#!/usr/bin/env python3
"""Move 'Τι θα φας σήμερα' cuisine chips above discovery rails so they are not missing."""
from pathlib import Path
import re

p = Path('native-customer/app/src/main/java/com/freshdelivery/nativecustomer/ui/CustomerShell.kt')
t = p.read_text()

cuisine_block = '''            item {
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

'''

# Remove existing cuisine block (wherever it is)
pattern = re.compile(
    r"\n            item \{\n                DiscoverSectionHeader\(title = \"Τι θα φας σήμερα;\"[\s\S]*?\n            \}\n\n",
    re.M,
)
t2, n = pattern.subn("\n", t, count=1)
if n:
    t = t2
    print('removed old cuisine block')
else:
    print('cuisine block pattern not found for remove')

# Insert right after discovery rails open + freeDelivery vals
anchor = '''        if (showDiscovery && stores.isNotEmpty()) {
            val freeDelivery = stores.filter { isFreeDeliveryStore(it) }
            val withOffers = stores.filter { !it.promo_badge.isNullOrBlank() }
            val nearFirst = if (hasLocation) {
                stores.sortedBy { storeDistanceKm(state.deliveryLat!!, state.deliveryLng!!, it) }
            } else stores

'''

if anchor in t:
    t = t.replace(anchor, anchor + cuisine_block, 1)
    print('inserted cuisine at top of discovery')
else:
    # try without isFreeDeliveryStore
    anchor2 = '        if (showDiscovery && stores.isNotEmpty()) {
'
    idx = t.find(anchor2)
    if idx >= 0:
        # find end of val nearFirst block
        insert_at = t.find('            if (withOffers', idx)
        if insert_at < 0:
            insert_at = t.find('            // Παράγγειλε ξανά', idx)
        if insert_at > 0:
            t = t[:insert_at] + cuisine_block + t[insert_at:]
            print('inserted cuisine alt position')
        else:
            print('insert position miss')
    else:
        print('discovery anchor miss')

p.write_text(t)
print('done')
