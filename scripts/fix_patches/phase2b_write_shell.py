#!/usr/bin/env python3
from pathlib import Path
import base64
parts = sorted(Path('scripts/fix_patches').glob('_shell_part_*.b64'), key=lambda p: int(p.stem.split('_')[-1]))
if not parts:
    print('no shell parts')
    raise SystemExit(0)
data = base64.b64decode(''.join(p.read_text().strip() for p in parts))
out = Path('native-customer/app/src/main/java/com/freshdelivery/nativecustomer/ui/CustomerShell.kt')
out.write_bytes(data)
print('wrote CustomerShell', len(data), 'from', len(parts), 'parts')
promo = Path('scripts/fix_patches/_promo.b64')
if promo.exists():
    Path('native-customer/app/src/main/java/com/freshdelivery/nativecustomer/ui/PromoCarousel.kt').write_bytes(base64.b64decode(promo.read_text().strip()))
    print('wrote PromoCarousel')
