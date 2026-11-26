#!/usr/bin/env python3
from pathlib import Path

def fix_open():
    p = Path("native-customer/app/src/main/java/com/freshdelivery/nativecustomer/ui/StoreGeo.kt")
    t = p.read_text()
    if "force_closed" in t:
        print("open ok")
        return
    if 'status_override != "open"' in t:
        t = t.replace(
            'if (store.status_override != "open") return false\n    return withinSchedule(store)',
            'val ov = store.status_override?.trim()?.lowercase().orEmpty()\n'
            '    if (ov in setOf("closed", "force_closed")) return false\n'
            '    if (ov == "force_open") return true\n'
            '    return withinSchedule(store)',
        )
        p.write_text(t)
        print("open fixed")
    else:
        print("open miss")

def fix_geo():
    p = Path("native-customer/app/src/main/java/com/freshdelivery/nativecustomer/ui/CustomerViewModel.kt")
    t = p.read_text()
    if "nearby.ifEmpty" in t:
        print("geo ok")
        return
    old = (
        "    val visibleStores: List<StoreRow>\n"
        "        get() {\n"
        "            val base = if (searchQuery.isBlank()) stores else stores\n"
        "            val lat = deliveryLat\n"
        "            val lng = deliveryLng\n"
        "            if (lat == null || lng == null) return base\n"
        "            return base.filter { storeDistanceKm(lat, lng, it) <= 7.0 }\n"
        "        }"
    )
    new = (
        "    val visibleStores: List<StoreRow>\n"
        "        get() {\n"
        "            val base = stores\n"
        "            val lat = deliveryLat\n"
        "            val lng = deliveryLng\n"
        "            if (lat == null || lng == null) return base\n"
        "            val nearby = base.filter { storeDistanceKm(lat, lng, it) <= 15.0 }\n"
        "            return nearby.ifEmpty { base }\n"
        "        }"
    )
    if old in t:
        p.write_text(t.replace(old, new))
        print("geo fixed")
    else:
        print("geo miss")

def fix_all():
    p = Path("native-customer/app/src/main/java/com/freshdelivery/nativecustomer/ui/CustomerShell.kt")
    t = p.read_text()
    old = (
        "            HomeFilter.All -> base.filter { isStoreOpenNow(it) }.ifEmpty {\n"
        "                base.sortedBy { if (isStoreOpenNow(it)) 0 else 1 }\n"
        "            }"
    )
    new = "            HomeFilter.All -> base.sortedBy { if (isStoreOpenNow(it)) 0 else 1 }"
    if old in t:
        p.write_text(t.replace(old, new))
        print("all fixed")
    elif "HomeFilter.All -> base.sortedBy" in t:
        print("all ok")
    else:
        print("all miss")

def fix_promo():
    p = Path("native-customer/app/src/main/java/com/freshdelivery/nativecustomer/ui/PromoCarousel.kt")
    t = p.read_text()
    changed = False
    if "val img = promo.imageUrl" in t:
        t = t.replace("val img = promo.imageUrl\n                ", "")
        changed = True
    if "if (img.isNullOrBlank()) Row(" in t:
        t = t.replace("if (img.isNullOrBlank()) Row(", "Row(")
        changed = True
    if "if (!img.isNullOrBlank())" in t:
        t = t.replace("if (!img.isNullOrBlank())", "if (false)")
        changed = True
    if "AsyncImage(" in t:
        t = t.replace("AsyncImage(", "// AsyncImage(")
        changed = True
    if ".height(220.dp)" in t:
        t = t.replace(".height(220.dp)", ".height(160.dp)")
        changed = True
    if ".height(148.dp)" in t:
        t = t.replace(".height(148.dp)", ".height(120.dp)")
        changed = True
    if changed:
        p.write_text(t)
        print("promo fixed")
    else:
        print("promo ok")

if __name__ == "__main__":
    fix_open()
    fix_geo()
    fix_all()
    fix_promo()
    print("STORE_VISIBILITY_1_0_60_OK")
