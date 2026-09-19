#!/usr/bin/env python3
import base64
from pathlib import Path
parts = sorted(Path("scripts/fix_patches").glob("auc_b64_*.txt"))
b64 = "".join(p.read_text().strip() for p in parts)
path = Path("native-customer/app/src/main/java/com/freshdelivery/nativecustomer/update/AppUpdateChecker.kt")
path.write_bytes(base64.b64decode(b64))
print("wrote", path, path.stat().st_size)
