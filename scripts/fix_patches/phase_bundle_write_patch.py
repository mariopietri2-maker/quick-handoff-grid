#!/usr/bin/env python3
from pathlib import Path
import base64
a = Path("scripts/fix_patches/phase_bundle_patch_a.b64").read_text().strip()
b = Path("scripts/fix_patches/phase_bundle_patch_b.b64").read_text().strip()
Path("scripts/fix_patches/phase_bundle.patch").write_bytes(base64.b64decode(a + b))
print("patch written", Path("scripts/fix_patches/phase_bundle.patch").stat().st_size)
