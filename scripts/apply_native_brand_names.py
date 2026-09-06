#!/usr/bin/env python3
from pathlib import Path

d = Path('native-driver/app/src/main/java/com/freshdelivery/nativedriver/ui/auth/LoginScreen.kt')
if d.exists():
    dt = d.read_text(encoding='utf-8')
    dt = dt.replace('text = "fresh2go Driver"', 'text = "Fresh2GO Driver"')
    dt = dt.replace('text = "Η Ήπειρος στο σπίτι σου, γρήγορα."', 'text = "Fresh Meals. Fast Delivery."')
    dt = dt.replace('contentDescription = "fresh2go"', 'contentDescription = "Fresh2GO"')
    dt = dt.replace('Uri.parse("https://freshdelivery.app/support")', 'Uri.parse("https://fresh2go.gr/support")')
    d.write_text(dt, encoding='utf-8')
    print('driver login')

c = Path('native-customer/app/src/main/java/com/freshdelivery/nativecustomer/ui/LoginScreen.kt')
if c.exists():
    ct = c.read_text(encoding='utf-8')
    ct = ct.replace('"fresh2go"', '"Fresh2GO"')
    ct = ct.replace('Η Ήπειρος στο σπίτι σου, γρήγορα.', 'Fresh Meals. Fast Delivery.')
    c.write_text(ct, encoding='utf-8')
    print('customer login')

shell = Path('native-driver/app/src/main/java/com/freshdelivery/nativedriver/ui/DriverShell.kt')
if shell.exists():
    st = shell.read_text(encoding='utf-8')
    st = st.replace('Text("fresh2go"', 'Text("Fresh2GO"')
    shell.write_text(st, encoding='utf-8')
    print('shell')

Path('native-driver/app/src/main/res/values/strings.xml').write_text(
    '''<?xml version="1.0" encoding="utf-8"?>\n<resources>\n    <string name="app_name">Fresh2GO Driver</string>\n</resources>\n''',
    encoding='utf-8',
)
print('done')
