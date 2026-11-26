#!/usr/bin/env python3
"""Apply remaining efood-level polish for customer native 1.0.61."""
from pathlib import Path

def fix_geo():
    p = Path("native-customer/app/src/main/java/com/freshdelivery/nativecustomer/ui/StoreGeo.kt")
    t = p.read_text()
    if "Soon" not in t and "enum class HomeFilter" in t:
        t = t.replace(
            "internal enum class HomeFilter { All, Open, Near, Fav, Deals }",
            "internal enum class HomeFilter { All, Open, Near, Fav, Deals, Soon }",
        )
    if "fun isOpeningSoon" not in t:
        block = '''
/** True if store is closed now but opens within [withinMin] minutes (Europe/Athens). */
internal fun isOpeningSoon(store: StoreRow, withinMin: Int = 60): Boolean {
    if (isStoreOpenNow(store)) return false
    if (store.is_active == false) return false
    if (store.status_override?.trim()?.lowercase() in setOf("closed", "force_closed")) return false
    val hours = store.opening_hours ?: return false
    val now = LocalDateTime.now(ZoneId.of("Europe/Athens"))
    val key = when (now.dayOfWeek) {
        DayOfWeek.MONDAY -> "mon"
        DayOfWeek.TUESDAY -> "tue"
        DayOfWeek.WEDNESDAY -> "wed"
        DayOfWeek.THURSDAY -> "thu"
        DayOfWeek.FRIDAY -> "fri"
        DayOfWeek.SATURDAY -> "sat"
        DayOfWeek.SUNDAY -> "sun"
    }
    val obj = hours.jsonObject[key]?.jsonObject ?: return false
    val enabled = obj["enabled"]?.jsonPrimitive?.booleanOrNull ?: true
    if (!enabled) return false
    val open = obj["open"]?.jsonPrimitive?.contentOrNull ?: return false
    val parts = open.trim().split(":")
    if (parts.size != 2) return false
    val openMin = (parts[0].toIntOrNull() ?: return false) * 60 + (parts[1].toIntOrNull() ?: 0)
    val nowMin = now.hour * 60 + now.minute
    val delta = openMin - nowMin
    return delta in 1..withinMin
}

'''
        t = t.replace("internal fun nextOpenHint", block + "internal fun nextOpenHint")
    if "force_closed" not in t and 'status_override != "open"' in t:
        t = t.replace(
            'if (store.status_override != "open") return false\n    return withinSchedule(store)',
            'val ov = store.status_override?.trim()?.lowercase().orEmpty()\n'
            '    if (ov in setOf("closed", "force_closed")) return false\n'
            '    if (ov == "force_open") return true\n'
            '    return withinSchedule(store)',
        )
    p.write_text(t)
    print("geo ok")

def fix_shell():
    p = Path("native-customer/app/src/main/java/com/freshdelivery/nativecustomer/ui/CustomerShell.kt")
    t = p.read_text()
    if "HomeFilter.Soon ->" not in t:
        t = t.replace(
            "HomeFilter.Deals -> base.filter {",
            "HomeFilter.Soon -> base.filter { isOpeningSoon(it) }\n            HomeFilter.Deals -> base.filter {",
        )
    if "Ανοίγουν σύντομα" not in t:
        t = t.replace(
            'FreshFilterChip("Αγαπημένα", selected = filter == HomeFilter.Fav) { applyFilter(HomeFilter.Fav) }',
            'FreshFilterChip("Αγαπημένα", selected = filter == HomeFilter.Fav) { applyFilter(HomeFilter.Fav) }\n'
            '                FreshFilterChip("Ανοίγουν σύντομα", selected = filter == HomeFilter.Soon) { applyFilter(HomeFilter.Soon) }',
        )
    if 'HomeFilter.Soon -> "Ανοίγουν σύντομα"' not in t:
        t = t.replace(
            """                val heading = when (filter) {
                    HomeFilter.All -> if (browseMode) "Όλα τα καταστήματα" else "Για σένα"
                    HomeFilter.Open -> "Ανοιχτά τώρα"
                    HomeFilter.Near -> "Κοντά σου"
                    HomeFilter.Deals -> "Προσφορές & δωρεάν delivery"
                    HomeFilter.Fav -> "Αγαπημένα"
                }""",
            """                val heading = when (filter) {
                    HomeFilter.All -> if (browseMode) "Όλα τα καταστήματα" else "Για σένα"
                    HomeFilter.Open -> "Ανοιχτά τώρα"
                    HomeFilter.Near -> "Κοντά σου"
                    HomeFilter.Deals -> "Προσφορές & δωρεάν delivery"
                    HomeFilter.Fav -> "Αγαπημένα"
                    HomeFilter.Soon -> "Ανοίγουν σύντομα"
                }""",
        )
    if "1 \u00b7 Στοιχεία" not in t and "1 · Στοιχεία" not in t:
        old = '''            item {
                Column(Modifier.fillMaxWidth()) {
                    Text("Πληρωμή", fontWeight = FontWeight.Bold, style = MaterialTheme.typography.titleMedium)
                    Spacer(Modifier.height(8.dp))
                    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        Button(
                            onClick = { onSetPayment("cash"); onSetTip(0.0); tipText = "0" },'''
        new = '''            item {
                Column(Modifier.fillMaxWidth()) {
                    Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        listOf("1 \u00b7 Στοιχεία", "2 \u00b7 Πληρωμή", "3 \u00b7 Επιβεβαίωση").forEachIndexed { i, label ->
                            val active = when {
                                state.paymentMethod == "card" && i >= 1 -> true
                                else -> i <= 1
                            }
                            Surface(
                                color = if (active) FreshGreenSoft else FreshChip,
                                shape = RoundedCornerShape(999.dp),
                            ) {
                                Text(
                                    label,
                                    modifier = Modifier.padding(horizontal = 10.dp, vertical = 4.dp),
                                    style = MaterialTheme.typography.labelSmall,
                                    fontWeight = if (active) FontWeight.Bold else FontWeight.Normal,
                                    color = if (active) FreshGreenDark else FreshMuted,
                                )
                            }
                        }
                    }
                    Spacer(Modifier.height(10.dp))
                    Text("Πληρωμή", fontWeight = FontWeight.Bold, style = MaterialTheme.typography.titleMedium)
                    Spacer(Modifier.height(8.dp))
                    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        Button(
                            onClick = { onSetPayment("cash"); onSetTip(0.0); tipText = "0" },'''
        if old in t:
            t = t.replace(old, new, 1)
            print("checkout steps")
        else:
            print("checkout steps miss")
    old_all = """            HomeFilter.All -> base.filter { isStoreOpenNow(it) }.ifEmpty {
                base.sortedBy { if (isStoreOpenNow(it)) 0 else 1 }
            }"""
    if old_all in t:
        t = t.replace(old_all, "            HomeFilter.All -> base.sortedBy { if (isStoreOpenNow(it)) 0 else 1 }")
    p.write_text(t)
    print("shell ok")

def fix_vm():
    p = Path("native-customer/app/src/main/java/com/freshdelivery/nativecustomer/ui/CustomerViewModel.kt")
    t = p.read_text()
    if "stores_disk_cache" not in t:
        old = """                    val fetched = repo.fetchStores()
                    allStoresCache = fetched
                    storesCacheAtMs = now
                    fetched"""
        new = """                    val fetched = repo.fetchStores()
                    allStoresCache = fetched
                    storesCacheAtMs = now
                    runCatching {
                        getApplication<Application>().getSharedPreferences("fresh_customer", Context.MODE_PRIVATE)
                            .edit()
                            .putString("stores_disk_cache", kotlinx.serialization.json.Json.encodeToString(
                                kotlinx.serialization.builtins.ListSerializer(com.freshdelivery.nativecustomer.data.StoreRow.serializer()),
                                fetched,
                            ))
                            .putLong("stores_disk_cache_at", now)
                            .apply()
                    }
                    fetched"""
        if old in t:
            t = t.replace(old, new)
        old2 = """    fun refreshStores(force: Boolean = false) {
        viewModelScope.launch {
            runCatching {
                val now = System.currentTimeMillis()
                val cached = allStoresCache
                val list = if (!force && cached.isNotEmpty() && now - storesCacheAtMs < 5 * 60 * 1000L) {
                    cached
                } else {"""
        new2 = """    fun refreshStores(force: Boolean = false) {
        viewModelScope.launch {
            runCatching {
                val now = System.currentTimeMillis()
                if (allStoresCache.isEmpty()) {
                    runCatching {
                        val prefs = getApplication<Application>().getSharedPreferences("fresh_customer", Context.MODE_PRIVATE)
                        val raw = prefs.getString("stores_disk_cache", null)
                        if (!raw.isNullOrBlank()) {
                            val disk = kotlinx.serialization.json.Json { ignoreUnknownKeys = true }
                                .decodeFromString(kotlinx.serialization.builtins.ListSerializer(com.freshdelivery.nativecustomer.data.StoreRow.serializer()), raw)
                            if (disk.isNotEmpty()) {
                                allStoresCache = disk
                                storesCacheAtMs = prefs.getLong("stores_disk_cache_at", 0L)
                                val q0 = _state.value.searchQuery.trim()
                                _state.value = _state.value.copy(stores = if (q0.isBlank()) disk else filterStoresLocal(disk, q0))
                            }
                        }
                    }
                }
                val cached = allStoresCache
                val list = if (!force && cached.isNotEmpty() && now - storesCacheAtMs < 5 * 60 * 1000L) {
                    cached
                } else {"""
        if old2 in t:
            t = t.replace(old2, new2)
    if "nearby.ifEmpty" not in t:
        oldg = """    val visibleStores: List<StoreRow>
        get() {
            val base = if (searchQuery.isBlank()) stores else stores
            val lat = deliveryLat
            val lng = deliveryLng
            if (lat == null || lng == null) return base
            return base.filter { storeDistanceKm(lat, lng, it) <= 7.0 }
        }"""
        newg = """    val visibleStores: List<StoreRow>
        get() {
            val base = stores
            val lat = deliveryLat
            val lng = deliveryLng
            if (lat == null || lng == null) return base
            val nearby = base.filter { storeDistanceKm(lat, lng, it) <= 15.0 }
            return nearby.ifEmpty { base }
        }"""
        if oldg in t:
            t = t.replace(oldg, newg)
    p.write_text(t)
    print("vm ok")

def fix_promo():
    p = Path("native-customer/app/src/main/java/com/freshdelivery/nativecustomer/ui/PromoCarousel.kt")
    if not p.exists():
        return
    t = p.read_text()
    if "model = img" in t:
        start = t.find("if (false)")
        if start < 0:
            start = t.find("AsyncImage(")
        end = t.find("Box(", start + 1) if start >= 0 else -1
        if start >= 0 and end > start:
            t = t[:start] + t[end:]
    if "val img = promo.imageUrl" in t:
        t = t.replace("val img = promo.imageUrl\n                ", "")
    if "if (img.isNullOrBlank()) Row(" in t:
        t = t.replace("if (img.isNullOrBlank()) Row(", "Row(")
    if "import coil.compose.AsyncImage\n" in t and "AsyncImage(" not in t:
        t = t.replace("import coil.compose.AsyncImage\n", "")
    p.write_text(t)
    print("promo ok")

if __name__ == "__main__":
    fix_geo()
    fix_shell()
    fix_vm()
    fix_promo()
    print("EFOOD_10_OK")
