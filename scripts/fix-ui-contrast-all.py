#!/usr/bin/env python3
"""Customer + store UI contrast / readability pass."""
from pathlib import Path

# ========== CUSTOMER: home min-order as chip ==========
shell = Path('native-customer/app/src/main/java/com/freshdelivery/nativecustomer/ui/CustomerShell.kt')
t = shell.read_text()

old_min = '''            val minOrd = store.min_order_amount ?: 0.0
            if (minOrd > 0) {
                Text(
                    "Ελάχ. παραγγελία €" + "%.0f".format(minOrd),
                    style = MaterialTheme.typography.labelSmall,
                    color = FreshMuted,
                    modifier = Modifier.padding(top = 2.dp),
                )
            }'''

new_min = '''            val minOrd = store.min_order_amount ?: 0.0
            if (minOrd > 0) {
                Surface(
                    color = FreshChip,
                    shape = RoundedCornerShape(8.dp),
                    modifier = Modifier.padding(top = 6.dp),
                ) {
                    Text(
                        "Ελάχ. παραγγελία €" + "%.0f".format(minOrd),
                        style = MaterialTheme.typography.labelSmall,
                        color = FreshInk,
                        fontWeight = FontWeight.SemiBold,
                        modifier = Modifier.padding(horizontal = 8.dp, vertical = 4.dp),
                    )
                }
            }'''

if old_min in t:
    t = t.replace(old_min, new_min, 1)
    print('home min-order chip OK')
else:
    print('home min-order pattern missing')

# Closed store: less fade, stronger badge already exists
old_fade = '.then(if (!active || !openNow) Modifier.graphicsLayer { alpha = 0.72f } else Modifier)'
new_fade = '.then(if (!active || !openNow) Modifier.graphicsLayer { alpha = 0.88f } else Modifier)'
if old_fade in t:
    t = t.replace(old_fade, new_fade)
    print('closed card fade softened')

shell.write_text(t)

# ========== PROMO carousel: stronger scrim ==========
promo = Path('native-customer/app/src/main/java/com/freshdelivery/nativecustomer/ui/PromoCarousel.kt')
if promo.exists():
    pt = promo.read_text()
    pt2 = pt.replace(
        'Box(Modifier.fillMaxSize().background(Color.Black.copy(alpha = 0.4f)))',
        'Box(Modifier.fillMaxSize().background(Color.Black.copy(alpha = 0.58f)))',
    )
    pt2 = pt2.replace(
        '.background(Color.White.copy(alpha = 0.2f))',
        '.background(Color.Black.copy(alpha = 0.45f))',
    )
    pt2 = pt2.replace(
        '.background(Color.White.copy(alpha = 0.15f))',
        '.background(Color.Black.copy(alpha = 0.35f))',
    )
    if pt2 != pt:
        promo.write_text(pt2)
        print('promo carousel contrast OK')
    else:
        print('promo patterns already updated or missing')

# ========== Menu row empty image placeholder ==========
row = Path('native-customer/app/src/main/java/com/freshdelivery/nativecustomer/ui/FreshMenuRow.kt')
if row.exists():
    rt = row.read_text()
    # strengthen empty image box if present
    if 'Icons.Outlined.ShoppingBag' in rt or 'image_url' in rt:
        rt2 = rt.replace(
            'color = FreshGreen.copy(alpha = 0.12f)',
            'color = FreshGreenSoft',
        )
        # common empty thumb pattern
        rt2 = rt2.replace(
            '.background(FreshChip)',
            '.background(Color(0xFFEEEEEC))',
        )
        if rt2 != rt:
            row.write_text(rt2)
            print('menu row placeholder tweak')
        else:
            print('menu row no simple replace')

# ========== STORE PWA: order queue readability ==========
queue = Path('src/components/store/OrderQueue.tsx')
if queue.exists():
    qt = queue.read_text()
    # bump muted labels used on order cards if very light
    qt2 = qt.replace('text-muted-foreground text-[11px]', 'text-foreground/80 text-[12px] font-medium')
    qt2 = qt2.replace('text-muted-foreground text-xs', 'text-foreground/75 text-xs')
    # cash banner stronger
    qt2 = qt2.replace('bg-amber-50 text-amber-900', 'bg-amber-100 text-amber-950 font-semibold')
    if qt2 != qt:
        queue.write_text(qt2)
        print('store OrderQueue contrast OK')
    else:
        print('OrderQueue patterns skipped')

# Printer ticket already handled earlier; ensure largeType default stays true via comment no-op
print('DONE contrast pass')
