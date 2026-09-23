#!/usr/bin/env python3
from pathlib import Path
import re

p = Path("native-customer/app/build.gradle.kts")
t = p.read_text()
t = re.sub(r"versionCode\s*=\s*\d+", "versionCode = 7233002", t)
t = re.sub(r'versionName\s*=\s*"[^"]*"', 'versionName = "2.9.14-fresh2go"', t)
p.write_text(t)

apk = Path("src/lib/apk-downloads.ts")
a = apk.read_text()
a = re.sub(r"APK_NATIVE_CUSTOMER_VERSION = '[^']*'", "APK_NATIVE_CUSTOMER_VERSION = '2.9.14-fresh2go'", a)
apk.write_text(a)
print("bumped to 2.9.14-fresh2go / 7233002")
