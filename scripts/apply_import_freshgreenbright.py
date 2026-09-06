#!/usr/bin/env python3
from pathlib import Path
p = Path('native-driver/app/src/main/java/com/freshdelivery/nativedriver/ui/auth/LoginScreen.kt')
t = p.read_text(encoding='utf-8')
if 'import com.freshdelivery.nativedriver.ui.theme.FreshGreenBright' in t:
    print('already')
elif 'import com.freshdelivery.nativedriver.ui.theme.FreshGreen' in t:
    t = t.replace(
        'import com.freshdelivery.nativedriver.ui.theme.FreshGreen',
        'import com.freshdelivery.nativedriver.ui.theme.FreshGreen\nimport com.freshdelivery.nativedriver.ui.theme.FreshGreenBright',
    )
    p.write_text(t, encoding='utf-8')
    print('imported')
else:
    # fallback: inline color
    t = t.replace('FreshGreenBright', 'Color(0xFFFB923C)')
    p.write_text(t, encoding='utf-8')
    print('inlined')
