#!/usr/bin/env python3
from pathlib import Path

for path, pairs in [
    ('native-customer/app/src/main/java/com/freshdelivery/nativecustomer/ui/SplashScreen.kt',
     [('appName: String = "fresh2go"', 'appName: String = "Fresh2GO"')]),
    ('native-customer/app/src/main/java/com/freshdelivery/nativecustomer/data/Models.kt',
     [('val appName: String = "fresh2go"', 'val appName: String = "Fresh2GO"')]),
]:
    p = Path(path)
    t = p.read_text(encoding='utf-8')
    for a, b in pairs:
        if a in t:
            t = t.replace(a, b)
            print('ok', path, a)
    p.write_text(t, encoding='utf-8')
print('done')
