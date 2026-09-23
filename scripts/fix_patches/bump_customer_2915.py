#!/usr/bin/env python3
import re
from pathlib import Path

def main():
    g = Path('native-customer/app/build.gradle.kts')
    t = g.read_text()
    # bump versionCode by 1 from current, set name
    m = re.search(r'versionCode\s*=\s*(\d+)', t)
    code = int(m.group(1)) + 1 if m else 7233003
    t = re.sub(r'versionCode\s*=\s*\d+', f'versionCode = {code}', t, count=1)
    t = re.sub(r'versionName\s*=\s*"[^"]+"', 'versionName = "2.9.15-fresh2go"', t, count=1)
    g.write_text(t)
    print(f'customer versionCode={code} name=2.9.15-fresh2go')

    p = Path('src/lib/apk-downloads.ts')
    t = p.read_text()
    t = t.replace(
        "export const APK_NATIVE_CUSTOMER_VERSION = '2.9.14-fresh2go';",
        "export const APK_NATIVE_CUSTOMER_VERSION = '2.9.15-fresh2go';",
    )
    p.write_text(t)
    print('apk-downloads updated')

if __name__ == '__main__':
    main()
