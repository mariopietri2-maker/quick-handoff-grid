#!/usr/bin/env python3
from pathlib import Path

p = Path('native-customer/app/src/main/java/com/freshdelivery/nativecustomer/ui/CustomerShell.kt')
t = p.read_text(encoding='utf-8')
changed = False

old_filter = '    var filter by remember { mutableStateOf(HomeFilter.All) }'
new_filter = '''    var filter by remember {
        mutableStateOf(
            if (state.deliveryLat != null && state.deliveryLng != null) HomeFilter.Near else HomeFilter.All,
        )
    }'''
if old_filter in t:
    t = t.replace(old_filter, new_filter, 1)
    changed = True
    print('default near')

if 'HomeFilter.Deals' not in t:
    t = t.replace(
        'private enum class HomeFilter { All, Open, Near, Fav }',
        'private enum class HomeFilter { All, Open, Near, Fav, Deals }',
    )
    t = t.replace(
        '''        when (filter) {
            HomeFilter.All -> base
            HomeFilter.Open -> open
            HomeFilter.Near -> near
            HomeFilter.Fav -> base.filter { state.favoriteStoreIds.contains(it.id) }
        }''',
        '''        when (filter) {
            HomeFilter.All -> base
            HomeFilter.Open -> open
            HomeFilter.Near -> near
            HomeFilter.Fav -> base.filter { state.favoriteStoreIds.contains(it.id) }
            HomeFilter.Deals -> base.filter { !it.promo_badge.isNullOrBlank() || it.covers_delivery_fee == true }
        }''',
    )
    t = t.replace(
        '''                FreshFilterChip("Όλα", selected = filter == HomeFilter.All) { filter = HomeFilter.All }
                FreshFilterChip("Ανοιχτά", selected = filter == HomeFilter.Open) { filter = HomeFilter.Open }
                FreshFilterChip("Κοντά μου", selected = filter == HomeFilter.Near) { filter = HomeFilter.Near }
                FreshFilterChip("Αγαπημένα", selected = filter == HomeFilter.Fav) { filter = HomeFilter.Fav }''',
        '''                FreshFilterChip("Όλα", selected = filter == HomeFilter.All) { filter = HomeFilter.All }
                FreshFilterChip("Ανοιχτά", selected = filter == HomeFilter.Open) { filter = HomeFilter.Open }
                FreshFilterChip("Κοντά μου", selected = filter == HomeFilter.Near) { filter = HomeFilter.Near }
                FreshFilterChip("Προσφορές", selected = filter == HomeFilter.Deals) { filter = HomeFilter.Deals }
                FreshFilterChip("Αγαπημένα", selected = filter == HomeFilter.Fav) { filter = HomeFilter.Fav }''',
    )
    t = t.replace(
        '''                val heading = when (filter) {
                    HomeFilter.All -> if (browseMode) "Όλα τα καταστήματα" else "Κοντά σου"
                    HomeFilter.Open -> "Ανοιχτά τώρα"
                    HomeFilter.Near -> "Κοντά μου"
                    HomeFilter.Fav -> "Αγαπημένα"
                }''',
        '''                val heading = when (filter) {
                    HomeFilter.All -> if (browseMode) "Όλα τα καταστήματα" else "Για σένα"
                    HomeFilter.Open -> "Ανοιχτά τώρα"
                    HomeFilter.Near -> "Κοντά σου"
                    HomeFilter.Deals -> "Προσφορές & δωρεάν delivery"
                    HomeFilter.Fav -> "Αγαπημένα"
                }''',
    )
    changed = True
    print('deals')

if 'private fun storeDeliveryFeeLabel' not in t:
    helper = '''
private fun storeDeliveryFeeLabel(store: StoreRow): String {
    if (store.covers_delivery_fee == true) return "Δωρεάν delivery"
    val fee = store.delivery_fee
    return if (fee != null && fee > 0.0) {
        val s = if (fee % 1.0 == 0.0) fee.toInt().toString() else "%.1f".format(fee)
        "€$s delivery"
    } else {
        "Delivery"
    }
}

private fun storeDistanceLabel(store: StoreRow, deliveryLat: Double?, deliveryLng: Double?): String? {
    if (deliveryLat == null || deliveryLng == null) return null
    val km = storeDistanceKm(deliveryLat, deliveryLng, store)
    if (km == Double.MAX_VALUE) return null
    return if (km < 1.0) "${(km * 1000).toInt()} m" else "%.1f km".format(km)
}

'''
    t = t.replace('private fun storeDeliveryEstimate', helper + 'private fun storeDeliveryEstimate')
    changed = True
    print('helpers')

if 'storeDistanceLabel(store, deliveryLat' not in t:
    old_meta = '''                Surface(
                    color = FreshGreenSoft,
                    shape = RoundedCornerShape(12.dp),
                ) {
                    Row(
                        Modifier.padding(horizontal = 10.dp, vertical = 6.dp),
                        verticalAlignment = Alignment.CenterVertically,
                    ) {
                        Icon(Icons.Outlined.Timer, contentDescription = null, tint = FreshGreenDark, modifier = Modifier.size(14.dp))
                        Spacer(Modifier.width(4.dp))
                        Text(
                            storeDeliveryEstimate(store, deliveryLat, deliveryLng),
                            color = FreshGreenDark,
                            fontWeight = FontWeight.Bold,
                            style = MaterialTheme.typography.labelMedium,
                        )
                    }
                }
                val platformDelivers'''
    new_meta = '''                Surface(
                    color = FreshGreenSoft,
                    shape = RoundedCornerShape(12.dp),
                ) {
                    Row(
                        Modifier.padding(horizontal = 10.dp, vertical = 6.dp),
                        verticalAlignment = Alignment.CenterVertically,
                    ) {
                        Icon(Icons.Outlined.Timer, contentDescription = null, tint = FreshGreenDark, modifier = Modifier.size(14.dp))
                        Spacer(Modifier.width(4.dp))
                        Text(
                            storeDeliveryEstimate(store, deliveryLat, deliveryLng),
                            color = FreshGreenDark,
                            fontWeight = FontWeight.Bold,
                            style = MaterialTheme.typography.labelMedium,
                        )
                    }
                }
                storeDistanceLabel(store, deliveryLat, deliveryLng)?.let { dist ->
                    Surface(
                        color = FreshChip,
                        shape = RoundedCornerShape(12.dp),
                    ) {
                        Text(
                            dist,
                            color = FreshMuted,
                            fontWeight = FontWeight.SemiBold,
                            style = MaterialTheme.typography.labelMedium,
                            modifier = Modifier.padding(horizontal = 10.dp, vertical = 6.dp),
                        )
                    }
                }
                Surface(
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
    if old_meta in t:
        t = t.replace(old_meta, new_meta, 1)
        changed = True
        print('meta')

anchor = '''            Surface(
                color = Color.White.copy(alpha = 0.92f),
                shape = RoundedCornerShape(10.dp),
                modifier = Modifier
                    .align(Alignment.BottomEnd)
                    .padding(10.dp),
            ) {
                Row(
                    Modifier.padding(horizontal = 10.dp, vertical = 5.dp),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Icon(Icons.Outlined.Star, contentDescription = null, tint = FreshAmber, modifier = Modifier.size(13.dp))'''
promo_block = '''            val badge = store.promo_badge?.trim().orEmpty()
            if (badge.isNotEmpty()) {
                Surface(
                    color = FreshGreen,
                    shape = RoundedCornerShape(10.dp),
                    modifier = Modifier
                        .align(Alignment.BottomStart)
                        .padding(10.dp),
                ) {
                    Text(
                        badge,
                        color = Color.White,
                        fontWeight = FontWeight.Bold,
                        style = MaterialTheme.typography.labelMedium,
                        modifier = Modifier.padding(horizontal = 10.dp, vertical = 5.dp),
                        maxLines = 1,
                    )
                }
            }
'''
if 'val badge = store.promo_badge' not in t and anchor in t:
    t = t.replace(anchor, promo_block + anchor, 1)
    changed = True
    print('promo')

if 'Πίτσα, σουβλάκι, καφές' not in t:
    t = t.replace(
        'placeholder = { Text("Αναζήτηση καταστημάτων", color = FreshMuted) }',
        'placeholder = { Text("Πίτσα, σουβλάκι, καφές…", color = FreshMuted) }',
        1,
    )
    changed = True
    print('search')

if changed:
    p.write_text(t, encoding='utf-8')
    print('written')
else:
    print('no changes')
