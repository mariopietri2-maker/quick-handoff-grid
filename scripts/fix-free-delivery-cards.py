#!/usr/bin/env python3
from pathlib import Path

geo = Path('native-customer/app/src/main/java/com/freshdelivery/nativecustomer/ui/StoreGeo.kt')
gt = geo.read_text()

if 'fun isFreeDeliveryStore' not in gt:
    insert = '''
/** True when customer pays €0 delivery for this store. */
internal fun isFreeDeliveryStore(store: StoreRow): Boolean {
    if (store.covers_delivery_fee == true) return true
    val fee = store.delivery_fee
    return fee != null && fee <= 0.0
}

'''
    # after storeDeliveryFeeLabel function start - insert before storeDeliveryFeeLabel
    needle = 'internal fun storeDeliveryFeeLabel(store: StoreRow): String {'
    if needle in gt:
        gt = gt.replace(needle, insert + needle, 1)
        # fix body of fee label
        gt = gt.replace(
            '''internal fun storeDeliveryFeeLabel(store: StoreRow): String {
    if (store.covers_delivery_fee == true) return "Δωρεάν παράδοση"
''',
            '''internal fun storeDeliveryFeeLabel(store: StoreRow): String {
    if (isFreeDeliveryStore(store)) return "Δωρεάν"
''',
            1,
        )
        geo.write_text(gt)
        print('StoreGeo free helper OK')
    else:
        print('storeDeliveryFeeLabel miss')
else:
    print('isFreeDeliveryStore already')

shell = Path('native-customer/app/src/main/java/com/freshdelivery/nativecustomer/ui/CustomerShell.kt')
st = shell.read_text()

# Filter free rail with helper
st = st.replace(
    'val freeDelivery = stores.filter { it.covers_delivery_fee == true }',
    'val freeDelivery = stores.filter { isFreeDeliveryStore(it) }',
)

# StoreMiniCard subtitle: show Δωρεάν clearly
old = '''            Text(
                storeDeliveryEstimate(store, deliveryLat, deliveryLng) + " · " + storeDeliveryFeeLabel(store),
                color = FreshMuted,
                fontSize = 11.sp,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
                modifier = Modifier.padding(top = 2.dp),
            )
            Text(
                storeFulfilmentLabelShort(store),
                color = if (isPlatformFulfilment(store)) FreshGreenDark else FreshMuted,
                fontSize = 10.sp,
                fontWeight = FontWeight.SemiBold,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
                modifier = Modifier.padding(top = 2.dp),
            )'''

new = '''            val free = isFreeDeliveryStore(store)
            Text(
                storeDeliveryEstimate(store, deliveryLat, deliveryLng) +
                    " · " +
                    if (free) "Δωρεάν παράδοση" else storeDeliveryFeeLabel(store),
                color = if (free) FreshGreenDark else FreshMuted,
                fontSize = 11.sp,
                fontWeight = if (free) FontWeight.Bold else FontWeight.Normal,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
                modifier = Modifier.padding(top = 2.dp),
            )
            if (!free) {
                Text(
                    storeFulfilmentLabelShort(store),
                    color = if (isPlatformFulfilment(store)) FreshGreenDark else FreshMuted,
                    fontSize = 10.sp,
                    fontWeight = FontWeight.SemiBold,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                    modifier = Modifier.padding(top = 2.dp),
                )
            } else {
                Text(
                    storeFulfilmentLabelShort(store),
                    color = FreshMuted,
                    fontSize = 10.sp,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                    modifier = Modifier.padding(top = 1.dp),
                )
            }'''

if old in st:
    st = st.replace(old, new, 1)
    print('StoreMiniCard OK')
else:
    print('StoreMiniCard pattern miss')

# Section title stay Greek
st = st.replace('title = "Δωρεάν delivery"', 'title = "Δωρεάν παράδοση"')

shell.write_text(st)
print('done')
