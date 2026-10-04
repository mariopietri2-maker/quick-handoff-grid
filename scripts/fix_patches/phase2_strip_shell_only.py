#!/usr/bin/env python3
"""Phase 2: strip extracted composables from CustomerShell; write missing files."""
from pathlib import Path
import re

base = Path('native-customer/app/src/main/java/com/freshdelivery/nativecustomer/ui')
shell_p = base / 'CustomerShell.kt'
shell = shell_p.read_text()

PROMO_HEADER = '''package com.freshdelivery.nativecustomer.ui

import androidx.compose.animation.core.LinearEasing
import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.tween
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.pager.HorizontalPager
import androidx.compose.foundation.pager.rememberPagerState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import coil.compose.AsyncImage
import kotlinx.coroutines.delay

'''

def strip_fun(src, name, next_markers, write_path=None, header=''):
    token = '@Composable\nprivate fun %s(' % name
    start = src.find(token)
    if start < 0:
        print(name, 'already extracted')
        return src
    end = len(src)
    for m in next_markers:
        i = src.find(m, start + 10)
        if i > start:
            end = min(end, i)
    body = src[start:end].replace('private fun %s' % name, 'internal fun %s' % name, 1)
    if write_path and not Path(write_path).exists():
        Path(write_path).write_text(header + body)
        print('wrote', write_path)
    print('stripping', name, end - start)
    return src[:start] + '// %s extracted to %s.kt\n\n' % (name, name) + src[end:]

shell = strip_fun(shell, 'FreshCartBar', ['@Composable\nprivate fun StoreHeroImage', '@Composable\nprivate fun HomeTab'])
shell = strip_fun(shell, 'StoreHeroImage', ['@Composable\nprivate fun HomeTab'])
shell = strip_fun(
    shell,
    'PromoCarousel',
    [],
    write_path=str(base / 'PromoCarousel.kt'),
    header=PROMO_HEADER,
)
shell_p.write_text(shell)
print('CustomerShell lines', shell.count('\n'))

for name in [
    'wire-advertising-admin.yml',
    'wire-driver-offer-sounds.yml',
    'wire-offer-and-banner.yml',
    'wire-store-call-notify-ui.yml',
    'wire-store-registry.yml',
    'sed-wire-finish.yml',
    'patch-customer-home.yml',
    'patch-offer-customer-pin.yml',
]:
    fp = Path('.github/workflows') / name
    if not fp.exists():
        continue
    wt = fp.read_text()
    if 'if: false # phase2-disabled' in wt:
        print('already', name)
        continue
    wt2 = re.sub(r'(jobs:\s*\n\s+\w+:\s*\n)', r'\1    if: false # phase2-disabled\n', wt, count=1)
    if wt2 == wt:
        wt2 = '# phase2-disabled\n' + wt
    fp.write_text(wt2)
    print('disabled', name)
print('phase2 strip done')
