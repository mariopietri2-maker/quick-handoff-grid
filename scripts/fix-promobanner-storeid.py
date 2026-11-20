#!/usr/bin/env python3
from pathlib import Path
import re

m = Path('native-customer/app/src/main/java/com/freshdelivery/nativecustomer/data/Models.kt')
t = m.read_text()
if 'val storeId: String? = null' not in t.split('data class PromoBanner')[1].split('data class')[0]:
    t2, n = re.subn(
        r'(data class PromoBanner\([\s\S]*?val imageUrl: String\? = null,)(\s*\))',
        r'\1\n    /** Optional store id/name from admin promo link. */\n    val storeId: String? = null,\2',
        t,
        count=1,
    )
    if n:
        m.write_text(t2)
        print('model storeId added')
    else:
        print('model pattern miss')
        raise SystemExit(1)
else:
    print('model already has storeId')

r = Path('native-customer/app/src/main/java/com/freshdelivery/nativecustomer/data/CustomerRepository.kt')
rt = r.read_text()
if 'storeId = o["store_id"]' not in rt and "storeId = o['store_id']" not in rt:
    old = 'imageUrl = o["image_url"]?.jsonPrimitive?.contentOrNull?.takeIf { it.isNotBlank() },'
    new = old + '\n                    storeId = (o["store_id"] ?: o["storeId"])?.jsonPrimitive?.contentOrNull?.takeIf { it.isNotBlank() },'
    idx = rt.find('PromoBanner(')
    if idx < 0:
        print('no PromoBanner construct')
        raise SystemExit(1)
    j = rt.find(old, idx)
    if j < 0:
        print('imageUrl line miss in PromoBanner')
        raise SystemExit(1)
    rt = rt[:j] + new + rt[j + len(old):]
    r.write_text(rt)
    print('repo storeId parse added')
else:
    print('repo already parses storeId')
print('PROMO_STOREID_OK')
