#!/usr/bin/env python3
"""Native home: remove double status-bar gap; hide Προσφορές τώρα when only 1 store."""
from pathlib import Path

p = Path('native-customer/app/src/main/java/com/freshdelivery/nativecustomer/ui/CustomerShell.kt')
t = p.read_text()
changed = []

if 'contentWindowInsets = WindowInsets(0, 0, 0, 0)' not in t:
    old = """    Scaffold(\n        containerColor = FreshBg,\n        snackbarHost = { SnackbarHost(snackbar) },\n        bottomBar = {"""
    new = """    Scaffold(\n        containerColor = FreshBg,\n        contentWindowInsets = WindowInsets(0, 0, 0, 0),\n        snackbarHost = { SnackbarHost(snackbar) },\n        bottomBar = {"""
    if old in t:
        t = t.replace(old, new, 1)
        changed.append('scaffold')
    else:
        changed.append('scaffold-miss')

if 'import androidx.compose.foundation.layout.WindowInsets' not in t:
    t = t.replace(
        'import androidx.compose.foundation.layout.statusBarsPadding',
        'import androidx.compose.foundation.layout.WindowInsets\nimport androidx.compose.foundation.layout.statusBarsPadding',
    )
    changed.append('import')

old_pad = """.statusBarsPadding()\n                    .padding(horizontal = 16.dp)\n                    .padding(top = 8.dp, bottom = 4.dp),"""
new_pad = """.statusBarsPadding()\n                    .padding(horizontal = 16.dp)\n                    .padding(top = 2.dp, bottom = 4.dp),"""
if old_pad in t:
    t = t.replace(old_pad, new_pad, 1)
    changed.append('pad')

idx = t.find('val withOffers = stores.filter')
if idx >= 0:
    j = t.find('if (withOffers.isNotEmpty()) {', idx)
    if j > 0:
        t = t[:j] + 'if (withOffers.size >= 2) {' + t[j + len('if (withOffers.isNotEmpty()) {'):]
        changed.append('offers')
elif 'withOffers.size >= 2' in t:
    changed.append('offers-ok')

p.write_text(t)
print(changed)
