#!/usr/bin/env python3
"""Apply bundled phase diff + PromoCarousel file."""
from pathlib import Path
import base64
import subprocess
import sys

root = Path('.')
patch = root / 'scripts/fix_patches/phase_bundle.patch'
promo_b64 = root / 'scripts/fix_patches/phase_bundle_promo.b64'

if promo_b64.exists():
    out = root / 'native-customer/app/src/main/java/com/freshdelivery/nativecustomer/ui/PromoCarousel.kt'
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_bytes(base64.b64decode(promo_b64.read_text().strip()))
    print('wrote PromoCarousel.kt', out.stat().st_size)

if patch.exists():
    r = subprocess.run(
        ['patch', '-p1', '--forward', '--reject-file=-', '--batch'],
        input=patch.read_text(),
        text=True,
        capture_output=True,
    )
    print(r.stdout)
    print(r.stderr)
    print('patch exit', r.returncode)
    if r.returncode > 1:
        sys.exit(r.returncode)
else:
    print('no patch file')

print('phase_bundle_apply done')
