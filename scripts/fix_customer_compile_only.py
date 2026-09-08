#!/usr/bin/env python3
"""Compile fixes only (no workflow files — GH App cannot push workflows)."""
from pathlib import Path

m = Path('native-customer/app/src/main/java/com/freshdelivery/nativecustomer/data/Models.kt')
mt = m.read_text(encoding='utf-8')
if 'min_order_amount' not in mt:
    mt = mt.replace(
        '    val delivery_free_min: Double? = null,\n',
        '    val delivery_free_min: Double? = null,\n    val min_order_amount: Double? = null,\n',
    )
    m.write_text(mt, encoding='utf-8')
    print('models')
else:
    print('models ok')

r = Path('native-customer/app/src/main/java/com/freshdelivery/nativecustomer/data/CustomerRepository.kt')
rt = r.read_text(encoding='utf-8')
if 'min_order_amount' not in rt:
    for a, b in [
        ('"covers_delivery_fee", "delivery_fee", "delivery_free_min",',
         '"covers_delivery_fee", "delivery_fee", "delivery_free_min", "min_order_amount",'),
        ('covers_delivery_fee,delivery_fee,delivery_free_min,',
         'covers_delivery_fee,delivery_fee,delivery_free_min,min_order_amount,'),
    ]:
        if a in rt:
            rt = rt.replace(a, b)
            print('repo')
            break
    r.write_text(rt, encoding='utf-8')
else:
    print('repo ok')

shell = Path('native-customer/app/src/main/java/com/freshdelivery/nativecustomer/ui/CustomerShell.kt')
st = shell.read_text(encoding='utf-8')
changed = False
if '@file:OptIn' not in st and 'ExperimentalFoundationApi' not in st:
    st = '@file:OptIn(androidx.compose.foundation.ExperimentalFoundationApi::class)\n' + st
    changed = True
elif '@file:OptIn' not in st and 'ExperimentalFoundationApi' in st:
    st = st.replace(
        'package com.freshdelivery.nativecustomer.ui\n',
        '@file:OptIn(ExperimentalFoundationApi::class)\npackage com.freshdelivery.nativecustomer.ui\n',
    )
    changed = True

if 'import androidx.compose.ui.graphics.graphicsLayer' not in st:
    st = st.replace(
        'import androidx.compose.ui.graphics.Color',
        'import androidx.compose.ui.graphics.Color\nimport androidx.compose.ui.graphics.graphicsLayer',
    )
    changed = True

if 'translationX = sheen * size.width' in st:
    st = st.replace('translationX = sheen * size.width * 0.55f', 'translationX = sheen * 400f')
    changed = True

if changed:
    shell.write_text(st, encoding='utf-8')
    print('shell')
else:
    print('shell ok')
print('done')
