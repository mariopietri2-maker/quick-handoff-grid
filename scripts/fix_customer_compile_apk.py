#!/usr/bin/env python3
"""Fix customer native compile so GitHub release gets a new APK."""
from pathlib import Path

# 1) StoreRow.min_order_amount
m = Path('native-customer/app/src/main/java/com/freshdelivery/nativecustomer/data/Models.kt')
mt = m.read_text(encoding='utf-8')
if 'min_order_amount' not in mt:
    mt = mt.replace(
        '    val delivery_free_min: Double? = null,\n',
        '    val delivery_free_min: Double? = null,\n'
        '    val min_order_amount: Double? = null,\n',
    )
    m.write_text(mt, encoding='utf-8')
    print('models min_order')
else:
    print('models ok')

# 2) Repository select columns
r = Path('native-customer/app/src/main/java/com/freshdelivery/nativecustomer/data/CustomerRepository.kt')
rt = r.read_text(encoding='utf-8')
if 'min_order_amount' not in rt:
    rt = rt.replace(
        '"covers_delivery_fee", "delivery_fee", "delivery_free_min",',
        '"covers_delivery_fee", "delivery_fee", "delivery_free_min", "min_order_amount",',
    )
    r.write_text(rt, encoding='utf-8')
    print('repo columns')
else:
    print('repo ok')

# 3) CustomerShell — imports + OptIn + safer PromoCarousel
shell = Path('native-customer/app/src/main/java/com/freshdelivery/nativecustomer/ui/CustomerShell.kt')
st = shell.read_text(encoding='utf-8')

# file-level OptIn for pager
if 'ExperimentalFoundationApi' not in st:
    st = st.replace(
        'package com.freshdelivery.nativecustomer.ui\n',
        'package com.freshdelivery.nativecustomer.ui\n\n'
        'import androidx.compose.foundation.ExperimentalFoundationApi\n',
    )
    # add OptIn annotation before first @Composable fun that uses pager — package level:
    if '@file:OptIn' not in st:
        st = st.replace(
            'package com.freshdelivery.nativecustomer.ui\n',
            '@file:OptIn(ExperimentalFoundationApi::class)\n'
            'package com.freshdelivery.nativecustomer.ui\n',
        )
    print('optin')

for imp in [
    'import androidx.compose.ui.graphics.graphicsLayer',
    'import androidx.compose.foundation.pager.HorizontalPager',
    'import androidx.compose.foundation.pager.rememberPagerState',
    'import kotlinx.coroutines.delay',
    'import androidx.compose.animation.core.LinearEasing',
    'import androidx.compose.animation.core.RepeatMode',
    'import androidx.compose.animation.core.animateFloat',
    'import androidx.compose.animation.core.infiniteRepeatable',
    'import androidx.compose.animation.core.rememberInfiniteTransition',
    'import androidx.compose.animation.core.tween',
    'import androidx.compose.animation.core.FastOutSlowInEasing',
    'import androidx.compose.ui.layout.ContentScale',
    'import coil.compose.AsyncImage',
]:
    if imp not in st:
        st = st.replace(
            'import androidx.compose.foundation.layout.Box',
            imp + '\nimport androidx.compose.foundation.layout.Box',
        )
        print('imp', imp.split()[-1])

# Fix PromoCarousel graphicsLayer size.width issue — replace broken sheen block if present
broken = 'translationX = sheen * size.width * 0.55f'
if broken in st:
    st = st.replace(
        broken,
        'translationX = sheen * 400f',
    )
    print('sheen fix')

# If PromoCarousel missing entirely, don't add now — errors reference it so it exists

shell.write_text(st, encoding='utf-8')
print('shell written')

# 4) Workflow: fail hard if customer APK missing
wf = Path('.github/workflows/build-native-apks.yml')
wt = wf.read_text(encoding='utf-8')
if 'continue-on-error: true' in wt:
    wt = wt.replace(
        '''      - name: Build customer debug APK + debug AAB
        id: customer
        continue-on-error: true
        working-directory: native-customer''',
        '''      - name: Build customer debug APK + debug AAB
        id: customer
        working-directory: native-customer''',
    )
    # require customer apk in stage
    wt = wt.replace(
        '''          if [ -f native-customer/app/build/outputs/apk/debug/app-debug.apk ]; then
            cp native-customer/app/build/outputs/apk/debug/app-debug.apk dist/fresh2go-customer-native-debug.apk
          fi''',
        '''          if [ ! -f native-customer/app/build/outputs/apk/debug/app-debug.apk ]; then
            echo "::error::customer APK missing — compile failed"
            exit 1
          fi
          cp native-customer/app/build/outputs/apk/debug/app-debug.apk dist/fresh2go-customer-native-debug.apk''',
    )
    wf.write_text(wt, encoding='utf-8')
    print('workflow fail-hard')
else:
    print('workflow ok')

print('done')
