#!/usr/bin/env python3
import base64, zlib
from pathlib import Path

AUTH_Z64 = open('scripts/restore-auth/auth.z64').read().strip()
LOGIN_Z64 = open('scripts/restore-auth/login.z64').read().strip()

auth = zlib.decompress(base64.b64decode(AUTH_Z64))
login = zlib.decompress(base64.b64decode(LOGIN_Z64))
Path('src/pages/AuthPage.tsx').write_bytes(auth)
p = Path('native-customer/app/src/main/java/com/freshdelivery/nativecustomer/ui/LoginScreen.kt')
p.parent.mkdir(parents=True, exist_ok=True)
p.write_bytes(login)
print('sizes', len(auth), len(login))
assert b'acceptTerms' in auth and b'export default function AuthPage' in auth
assert b'acceptTerms' in login
print('RESTORE_OK')
