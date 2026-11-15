#!/usr/bin/env python3
"""Pizza Pan promo opens store; other promos do nothing."""
from pathlib import Path
import re

# --- PromoCarousel: pass promo to click ---
pc = Path('native-customer/app/src/main/java/com/freshdelivery/nativecustomer/ui/PromoCarousel.kt')
if pc.exists():
    t = pc.read_text()
    t = t.replace(
        'onPromoClick: () -> Unit = {},',
        'onPromoClick: (com.freshdelivery.nativecustomer.data.PromoBanner) -> Unit = {},',
    )
    t = t.replace(
        '.clickable { onPromoClick() },',
        '.clickable { onPromoClick(promo) },',
    )
    # also common variant
    t = t.replace(
        'onPromoClick: () -> Unit',
        'onPromoClick: (com.freshdelivery.nativecustomer.data.PromoBanner) -> Unit',
    )
    pc.write_text(t)
    print('PromoCarousel ok')

# --- CustomerShell: smart click ---
shell = Path('native-customer/app/src/main/java/com/freshdelivery/nativecustomer/ui/CustomerShell.kt')
if shell.exists():
    st = shell.read_text()
    old = 'PromoCarousel(promos = enabledPromos, onPromoClick = { applyFilter(HomeFilter.Deals); onSearch("") })'
    new = '''PromoCarousel(
                    promos = enabledPromos,
                    onPromoClick = { promo ->
                        // Only open a real store when promo maps to one (e.g. Pizza Pan).
                        // Generic brand promos (HOT/FRESH/etc.) land nowhere.
                        val needle = listOf(promo.title, promo.code, promo.tag)
                            .joinToString(" ")
                            .lowercase()
                        val store = state.stores.firstOrNull { s ->
                            val n = s.name.lowercase()
                            ("pizza pan" in needle || "pizzapan" in needle || promo.code.equals("PIZZAPAN", true))
                                && ("pizza pan" in n || "pizzapan" in n.replace(" ", ""))
                        } ?: state.stores.firstOrNull { s ->
                            val n = s.name.lowercase()
                            promo.title.isNotBlank() && n.contains(promo.title.lowercase().take(8))
                        }
                        if (store != null) onOpenStore(store)
                    },
                )'''
    if old in st:
        st = st.replace(old, new, 1)
        print('CustomerShell click')
    else:
        # try partial
        if 'onPromoClick = { applyFilter(HomeFilter.Deals)' in st:
            st = re.sub(
                r'PromoCarousel\(promos = enabledPromos, onPromoClick = \{[^}]+\}\)',
                new.replace('\n', ' '),
                st,
                count=1,
            )
            print('CustomerShell regex')
        else:
            print('CustomerShell miss')
    shell.write_text(st)

print('PROMO_CLICK_OK')
