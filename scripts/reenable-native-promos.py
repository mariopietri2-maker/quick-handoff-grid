#!/usr/bin/env python3
from pathlib import Path
p = Path('native-customer/app/src/main/java/com/freshdelivery/nativecustomer/ui/CustomerShell.kt')
t = p.read_text()
# Re-enable promo carousel that was hard-disabled
old = '''        // Promo cards hidden for now.
        if (false && showDiscovery && enabledPromos.isNotEmpty()) {'''
new = '''        // Admin promo banners (customer_app_config.promos)
        if (showDiscovery && enabledPromos.isNotEmpty()) {'''
if old in t:
    t = t.replace(old, new, 1)
    print('promo re-enabled (comment style)')
else:
    t2 = t.replace(
        'if (false && showDiscovery && enabledPromos.isNotEmpty()) {',
        'if (showDiscovery && enabledPromos.isNotEmpty()) {',
        1,
    )
    if t2 != t:
        t = t2
        print('promo re-enabled (false&&)')
    else:
        print('pattern miss')
p.write_text(t)
print('done')
