#!/usr/bin/env python3
import base64, gzip
from pathlib import Path
b64 = Path("scripts/wave2_blob.b64").read_text().strip()
raw = gzip.decompress(base64.b64decode(b64))
shell, vm = raw.split(b"\n=====SPLIT=====\n", 1)
Path("native-customer/app/src/main/java/com/freshdelivery/nativecustomer/ui/CustomerShell.kt").write_bytes(shell)
Path("native-customer/app/src/main/java/com/freshdelivery/nativecustomer/ui/CustomerViewModel.kt").write_bytes(vm)
print("wrote", len(shell), len(vm))
