#!/usr/bin/env python3
from pathlib import Path
login = Path('native-driver/app/src/main/java/com/freshdelivery/nativedriver/ui/auth/LoginScreen.kt')
lt = login.read_text(encoding='utf-8')
repls = [
    ('''                Brush.verticalGradient(
                    listOf(Color(0xFF0B0E0C), Color(0xFF0E1A14), Color(0xFF0B0E0C)),
                ),''',
     '''                Brush.verticalGradient(
                    listOf(Color(0xFF0C0A09), Color(0xFF1C120C), Color(0xFF0C0A09)),
                ),'''),
    ('text = "fresh2go Driver"', 'text = "Fresh2GO Driver"'),
    ('text = "Η Ήπειρος στο σπίτι σου, γρήγορα."', 'text = "Fresh Meals. Fast Delivery."'),
    ('Uri.parse("https://freshdelivery.app/support")', 'Uri.parse("https://fresh2go.gr/support")'),
    ('disabledContainerColor = Color(0xFF2A322C),',
     'disabledContainerColor = Color(0xFF292524),'),
    ('disabledContentColor = Color(0xFF67716B),',
     'disabledContentColor = Color(0xFF78716C),'),
]
for a, b in repls:
    if a in lt:
        lt = lt.replace(a, b)
        print('ok', a[:36])
    else:
        print('skip', a[:36])
login.write_text(lt, encoding='utf-8')
print('done')
