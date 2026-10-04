#!/usr/bin/env python3
from pathlib import Path
import re
base = Path('native-customer/app/src/main/java/com/freshdelivery/nativecustomer/ui')
for req in ('FreshCartBar.kt', 'StoreHeroImage.kt', 'PromoCarousel.kt'):
    if not (base / req).exists():
        print('missing', req)
        raise SystemExit(0)
shell_p = base / 'CustomerShell.kt'
shell = shell_p.read_text()

def strip_fun(src, name, next_markers):
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
    print('stripping', name, end-start)
    return src[:start] + '// %s extracted to %s.kt\n\n' % (name, name) + src[end:]

shell = strip_fun(shell, 'FreshCartBar', ['@Composable\nprivate fun StoreHeroImage', '@Composable\nprivate fun HomeTab'])
shell = strip_fun(shell, 'StoreHeroImage', ['@Composable\nprivate fun HomeTab'])
shell = strip_fun(shell, 'PromoCarousel', [])
shell_p.write_text(shell)
print('lines', shell.count(chr(10)))
for name in ['wire-advertising-admin.yml','wire-driver-offer-sounds.yml','wire-offer-and-banner.yml','wire-store-call-notify-ui.yml','wire-store-registry.yml','sed-wire-finish.yml','patch-customer-home.yml','patch-offer-customer-pin.yml']:
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
