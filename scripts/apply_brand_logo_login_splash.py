#!/usr/bin/env python3
"""Use Fresh2GO bag mark on LoginScreen (splash already has animated basket)."""
from pathlib import Path

login = Path('native-customer/app/src/main/java/com/freshdelivery/nativecustomer/ui/LoginScreen.kt')
t = login.read_text(encoding='utf-8')

# Orange brand gradient for login mark container
if 'LoginBrandGradient' not in t:
    t = t.replace(
        'private val LoginGradient = Brush.linearGradient(listOf(FreshGreen, FreshViolet))',
        'private val LoginGradient = Brush.linearGradient(listOf(Color(0xFFF4A125), Color(0xFFFF8A3D), Color(0xFFE94E8F)))\n'
        'private val LoginBrandGradient = LoginGradient',
    )

old_icon = '''        Box(
            Modifier
                .size(72.dp)
                .shadow(14.dp, CircleShape)
                .clip(CircleShape)
                .background(LoginGradient),
            contentAlignment = Alignment.Center,
        ) {
            Icon(
                Icons.Outlined.Storefront,
                contentDescription = null,
                tint = Color.White,
                modifier = Modifier.size(34.dp),
            )
        }'''

new_icon = '''        Box(
            Modifier
                .size(88.dp)
                .shadow(18.dp, RoundedCornerShape(22.dp))
                .clip(RoundedCornerShape(22.dp)),
            contentAlignment = Alignment.Center,
        ) {
            Fresh2GoBagMark(size = 88.dp)
        }'''

if 'Fresh2GoBagMark' not in t and old_icon in t:
    t = t.replace(old_icon, new_icon)
    print('login mark')
elif 'Fresh2GoBagMark' in t:
    print('login already')
else:
    print('WARN login block')

# Prefer orange login button accents slightly? keep FreshGreen for CTA is ok

login.write_text(t, encoding='utf-8')

# Splash: ensure app name always reads Fresh2GO under logo (already does)
splash = Path('native-customer/app/src/main/java/com/freshdelivery/nativecustomer/ui/SplashScreen.kt')
st = splash.read_text(encoding='utf-8')
if 'Fresh2GO bag / basket brand mark' not in st:
    st = st.replace(
        ' * Launch splash — website-style basket logo:',
        ' * Launch splash — Fresh2GO logo (animated basket brand mark):',
    )
    splash.write_text(st, encoding='utf-8')
    print('splash note')

print('done')
