#!/usr/bin/env python3
from pathlib import Path

def fix_native():
    p = Path("native-customer/app/src/main/java/com/freshdelivery/nativecustomer/ui/CustomerViewModel.kt")
    t = p.read_text()
    old = '''        val dLat0 = s.deliveryLat
        val dLng0 = s.deliveryLng
        if (dLat0 != null && dLng0 != null && storeDistanceKm(dLat0, dLng0, store) > 7.0) {
            _state.value = s.copy(error = "\u0397 \u03b4\u03b9\u03b5\u03cd\u03b8\u03c5\u03bd\u03c3\u03b7 \u03b5\u03af\u03bd\u03b1\u03b9 \u03c0\u03ac\u03bd\u03c9 \u03b1\u03c0\u03cc 7 km \u03b1\u03c0\u03cc \u03c4\u03bf \u03ba\u03b1\u03c4\u03ac\u03c3\u03c4\u03b7\u03bc\u03b1")
            return
        }
'''
    # Prefer exact Greek string as in repo
    old2 = (
        "        val dLat0 = s.deliveryLat\n"
        "        val dLng0 = s.deliveryLng\n"
        "        if (dLat0 != null && dLng0 != null && storeDistanceKm(dLat0, dLng0, store) > 7.0) {\n"
        "            _state.value = s.copy(error = \"\u0397 \u03b4\u03b9\u03b5\u03cd\u03b8\u03c5\u03bd\u03c3\u03b7 \u03b5\u03af\u03bd\u03b1\u03b9 \u03c0\u03ac\u03bd\u03c9 \u03b1\u03c0\u03cc 7 km \u03b1\u03c0\u03cc \u03c4\u03bf \u03ba\u03b1\u03c4\u03ac\u03c3\u03c4\u03b7\u03bc\u03b1\")\n"
        "            return\n"
        "        }\n"
    )
    if "\u03c0\u03ac\u03bd\u03c9 \u03b1\u03c0\u03cc 7 km" in t or "\u03c0\u03ac\u03bd\u03c9 \u03b1\u03c0\u03cc 7 km" in t:
        pass
    marker = "storeDistanceKm(dLat0, dLng0, store) > 7.0"
    if marker in t:
        # remove the whole if block
        start = t.find("        val dLat0 = s.deliveryLat")
        end = t.find("        val minOrder = store.min_order_amount", start)
        if start >= 0 and end > start:
            t = t[:start] + "        // No hard km limit \u2014 Ioannina soft launch delivers city-wide.\n" + t[end:]
            p.write_text(t)
            print("native ok")
        else:
            print("native structure miss")
    else:
        print("native already")

def fix_web():
    p = Path("src/pages/CheckoutPage.tsx")
    if not p.exists():
        print("web skip")
        return
    t = p.read_text()
    if "meters > 7000" in t:
        import re
        t2 = re.sub(
            r"\s*if \(meters > 7000\) \{[\s\S]*?return;\s*\}",
            "\n          // No hard km limit \u2014 city-wide soft launch.",
            t,
            count=1,
        )
        p.write_text(t2)
        print("web ok")
    else:
        print("web already")

if __name__ == "__main__":
    fix_native()
    fix_web()
    print("NO_KM_LIMIT_OK")
