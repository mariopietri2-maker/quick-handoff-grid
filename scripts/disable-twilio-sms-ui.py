#!/usr/bin/env python3
from pathlib import Path

# Hide phone_sms mode entry after signup and PhoneSmsVerify in AuthPage
p = Path('src/pages/AuthPage.tsx')
if p.exists():
    t = p.read_text()
    t = t.replace("setMode('phone_sms');", "/* Twilio removed */ // setMode('phone_sms');")
    t = t.replace('setMode("phone_sms");', '/* Twilio removed */ // setMode("phone_sms");')
    # Don't show phone_sms UI block as reachable from signup
    p.write_text(t)
    print('AuthPage phone_sms disabled')
else:
    print('AuthPage miss')

note = Path('docs/SMS_VERIFICATION.md')
if note.exists():
    note.write_text(
        '# SMS verification\n\nTwilio was removed from this project.\n'
        'Phone OTP edge functions may still exist but secrets are not configured.\n'
        'Re-enable only after adding a new SMS provider.\n'
    )
    print('docs updated')
print('done')
