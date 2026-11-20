#!/usr/bin/env python3
from pathlib import Path
import re

VER = "1.0.46"
CODE = "7236600"

for rel in [
    "native-customer/app/build.gradle.kts",
    "native-driver/app/build.gradle.kts",
]:
    p = Path(rel)
    if not p.exists():
        print("miss", rel)
        continue
    t = p.read_text()
    t = re.sub(r"versionCode\s*=\s*\d+", f"versionCode = {CODE}", t)
    t = re.sub(r'versionName\s*=\s*"[^"]*"', f'versionName = "{VER}"', t)
    p.write_text(t)
    print("gradle", rel)

apk = Path("src/lib/apk-downloads.ts")
if apk.exists():
    t = apk.read_text()
    t = re.sub(r"APK_NATIVE_DRIVER_VERSION = '[^']+'", f"APK_NATIVE_DRIVER_VERSION = '{VER}'", t)
    t = re.sub(r"APK_NATIVE_CUSTOMER_VERSION = '[^']+'", f"APK_NATIVE_CUSTOMER_VERSION = '{VER}'", t)
    apk.write_text(t)
    print("apk-downloads synced")
print("SYNC_OK", VER, CODE)
