#!/usr/bin/env python3
from pathlib import Path
import re

def main() -> None:
    r = Path("native-customer/app/src/main/java/com/freshdelivery/nativecustomer/data/CustomerRepository.kt")
    rt = r.read_text(encoding="utf-8")
    if 'suspend fun fetchStores' in rt and '"fulfilment_mode"' not in rt[rt.find("suspend fun fetchStores"):rt.find("suspend fun fetchStores")+500]:
        rt2 = re.sub(
            r'(suspend fun fetchStores\(\)[\s\S]*?"holiday_dates",)\n(\s*\)\) \{)',
            r'\1\n                "fulfilment_mode",\n\2 {',
            rt,
            count=1,
        )
        # simpler replace
        old = '"holiday_dates",\n            )) {\n                filter { eq("is_active", true) }'
        new = '"holiday_dates",\n                "fulfilment_mode",\n            )) {\n                filter { eq("is_active", true) }'
        if old in rt:
            rt = rt.replace(old, new, 1)
            print("fetchStores fulfilment_mode")
        elif rt2 != rt:
            rt = rt2
            print("fetchStores regex")
        else:
            print("fetchStores skip")
    else:
        print("fetchStores ok")
    r.write_text(rt, encoding="utf-8")

    m = Path("native-customer/app/src/main/java/com/freshdelivery/nativecustomer/data/Models.kt")
    mt = m.read_text(encoding="utf-8")
    if "fulfilment_mode" not in mt:
        mt = mt.replace(
            "    val holiday_dates: List<String>? = null,\n)",
            "    val holiday_dates: List<String>? = null,\n    val fulfilment_mode: String? = \"platform\",\n)",
            1,
        )
        m.write_text(mt, encoding="utf-8")
        print("models")
    else:
        print("models ok")

    s = Path("native-customer/app/src/main/java/com/freshdelivery/nativecustomer/ui/CustomerShell.kt")
    st = s.read_text(encoding="utf-8")
    if "Delivered by Fresh" in st:
        print("shell already")
        return
    old_pill = '''                FreshMetaPill {
                    Icon(Icons.Outlined.DirectionsBike, contentDescription = null, tint = FreshMuted, modifier = Modifier.size(14.dp))
                    Spacer(Modifier.width(4.dp))
                    Text("Παράδοση", color = FreshInk, fontWeight = FontWeight.SemiBold)
                }'''
    new_pill = '''                val platformDelivers = (store.fulfilment_mode ?: "platform") != "store"
                if (platformDelivers) {
                    FreshMetaPill {
                        Icon(Icons.Outlined.DirectionsBike, contentDescription = null, tint = FreshGreen, modifier = Modifier.size(14.dp))
                        Spacer(Modifier.width(4.dp))
                        Text(
                            "Delivered by Fresh",
                            color = FreshGreenDark,
                            fontWeight = FontWeight.Bold,
                            style = MaterialTheme.typography.labelMedium,
                        )
                    }
                } else {
                    FreshMetaPill {
                        Icon(Icons.Outlined.DirectionsBike, contentDescription = null, tint = FreshMuted, modifier = Modifier.size(14.dp))
                        Spacer(Modifier.width(4.dp))
                        Text("Παράδοση καταστήματος", color = FreshInk, fontWeight = FontWeight.SemiBold)
                    }
                }'''
    if old_pill not in st:
        raise SystemExit("pill not found")
    s.write_text(st.replace(old_pill, new_pill, 1), encoding="utf-8")
    print("shell Delivered by Fresh")

if __name__ == "__main__":
    main()
