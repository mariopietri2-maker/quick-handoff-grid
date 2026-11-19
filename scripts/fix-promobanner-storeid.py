#!/usr/bin/env python3
from pathlib import Path
import re

m = Path('native-customer/app/src/main/java/com/freshdelivery/nativecustomer/data/Models.kt')
t = m.read_text()
old = '''data class PromoBanner(
    val tag: String = "NEW",
    val title: String = "",
    val subtitle: String = "",
    val code: String = "",
    val gradient: String = "hero",
    val enabled: Boolean = true,
    val imageUrl: String? = null,
)'''
new = '''data class PromoBanner(
    val tag: String = "NEW",
    val title: String = "",
    val subtitle: String = "",
    val code: String = "",
    val gradient: String = "hero",
    val enabled: Boolean = true,
    val imageUrl: String? = null,
    /** Optional store id or name from admin promo link. */
    val storeId: String? = null,
)'''
if 'val storeId' not in t.split('data class PromoBanner')[1].split('data class')[0]:
    if old in t:
        m.write_text(t.replace(old, new, 1))
        print('model ok')
    else:
        # looser
        t2 = re.sub(
            r'(data class PromoBanner\([\s\S]*?val imageUrl: String\? = null,)(\s*\))',
            r'\1\n    val storeId: String? = null,\2',
            t,
            count=1,
        )
        if t2 != t:
            m.write_text(t2)
            print('model regex ok')
        else:
            print('model miss')
else:
    print('model already')

r = Path('native-customer/app/src/main/java/com/freshdelivery/nativecustomer/data/CustomerRepository.kt')
rt = r.read_text()
if 'storeId = o["store_id"]' not in rt:
    old_c = 'imageUrl = o["image_url"]?.jsonPrimitive?.contentOrNull?.takeIf { it.isNotBlank() },'
    new_c = old_c + '\n                    storeId = o["store_id"]?.jsonPrimitive?.contentOrNull?.takeIf { it.isNotBlank() },'
    if old_c in rt:
        # only first PromoBanner construction - replace within promo mapping carefully
        # replace only occurrences that are inside PromoBanner(...)
        idx = rt.find('PromoBanner(')
        if idx >= 0:
            # find imageUrl after that
            j = rt.find(old_c, idx)
            if j >= 0 and 'storeId = o["store_id"]' not in rt[idx:j+200]:
                rt = rt[:j] + new_c + rt[j+len(old_c):]
                r.write_text(rt)
                print('repo ok')
            else:
                print('repo skip')
        else:
            print('repo no PromoBanner')
    else:
        print('repo pattern miss')
else:
    print('repo already')
print('done')
