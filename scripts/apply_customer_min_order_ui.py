#!/usr/bin/env python3
from pathlib import Path
shell = Path('native-customer/app/src/main/java/com/freshdelivery/nativecustomer/ui/CustomerShell.kt')
st = shell.read_text(encoding='utf-8')

# Mini card meta with min order
if 'Ελάχ. €' not in st or 'min_order_amount ?: 0.0' not in st:
    if 'Ελάχ. 5€' in st:
        st = st.replace(
            'storeDeliveryEstimate(store, deliveryLat, deliveryLng) + " • Ελάχ. 5€"',
            'buildString {\n                append(storeDeliveryEstimate(store, deliveryLat, deliveryLng))\n                storeDistanceLabel(store, deliveryLat, deliveryLng)?.let { append(" • "); append(it) }\n                val minO = store.min_order_amount ?: 0.0\n                if (minO > 0) append(" • Ελάχ. €%.0f".format(minO))\n            }',
        )
        print('mini from fake')
    elif 'storeDistanceLabel(store, deliveryLat, deliveryLng)?.let { append(" • "); append(it) }' in st and 'minO = store.min_order_amount' not in st:
        st = st.replace(
            'storeDistanceLabel(store, deliveryLat, deliveryLng)?.let { append(" • "); append(it) }',
            'storeDistanceLabel(store, deliveryLat, deliveryLng)?.let { append(" • "); append(it) }\n                    val minO = store.min_order_amount ?: 0.0\n                    if (minO > 0) append(" • Ελάχ. €%.0f".format(minO))',
            1,
        )
        print('mini dist')

fee_block_end = '''                Surface(
                    color = if (store.covers_delivery_fee == true) FreshGreenSoft else FreshChip,
                    shape = RoundedCornerShape(12.dp),
                ) {
                    Text(
                        storeDeliveryFeeLabel(store),
                        color = if (store.covers_delivery_fee == true) FreshGreenDark else FreshMuted,
                        fontWeight = FontWeight.Bold,
                        style = MaterialTheme.typography.labelMedium,
                        modifier = Modifier.padding(horizontal = 10.dp, vertical = 6.dp),
                    )
                }
                val platformDelivers'''
fee_with_min = '''                Surface(
                    color = if (store.covers_delivery_fee == true) FreshGreenSoft else FreshChip,
                    shape = RoundedCornerShape(12.dp),
                ) {
                    Text(
                        storeDeliveryFeeLabel(store),
                        color = if (store.covers_delivery_fee == true) FreshGreenDark else FreshMuted,
                        fontWeight = FontWeight.Bold,
                        style = MaterialTheme.typography.labelMedium,
                        modifier = Modifier.padding(horizontal = 10.dp, vertical = 6.dp),
                    )
                }
                val minOrd = store.min_order_amount ?: 0.0
                if (minOrd > 0) {
                    Surface(
                        color = FreshChip,
                        shape = RoundedCornerShape(12.dp),
                    ) {
                        Text(
                            "Ελάχ. €%.0f".format(minOrd),
                            color = FreshMuted,
                            fontWeight = FontWeight.Bold,
                            style = MaterialTheme.typography.labelMedium,
                            modifier = Modifier.padding(horizontal = 10.dp, vertical = 6.dp),
                        )
                    }
                }
                val platformDelivers'''
if 'val minOrd = store.min_order_amount' not in st and fee_block_end in st:
    st = st.replace(fee_block_end, fee_with_min, 1)
    print('card chip')

shell.write_text(st, encoding='utf-8')
print('done')
