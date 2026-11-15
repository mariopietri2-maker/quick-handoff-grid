#!/usr/bin/env python3
from pathlib import Path
p = Path('src/pages/AuthPage.tsx')
if not p.exists():
    print('no AuthPage'); raise SystemExit(0)
t = p.read_text()
t = t.replace("/* Twilio removed */ // setMode('phone_sms');", "setMode('phone_sms');")
t = t.replace('/* Twilio removed */ // setMode("phone_sms");', 'setMode("phone_sms");')
p.write_text(t)
print('phone_sms re-enabled')
