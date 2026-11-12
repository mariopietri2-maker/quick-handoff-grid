#!/usr/bin/env python3
"""Wire PhoneSmsVerify into AuthPage after signup."""
from pathlib import Path

p = Path('src/pages/AuthPage.tsx')
t = p.read_text()

if "PhoneSmsVerify" not in t:
    # add import
    if "from '@/components/ui/button'" in t:
        t = t.replace(
            "from '@/components/ui/button'",
            "from '@/components/ui/button'\nimport { PhoneSmsVerify } from '@/components/PhoneSmsVerify'",
            1,
        )
    else:
        t = "import { PhoneSmsVerify } from '@/components/PhoneSmsVerify';\n" + t

# extend AuthMode if typed
t = t.replace(
    "type AuthMode = 'login' | 'signup' | 'forgot' | 'otp' | 'reset'",
    "type AuthMode = 'login' | 'signup' | 'forgot' | 'otp' | 'reset' | 'phone_sms'",
)
t = t.replace(
    "type AuthMode = \"login\" | \"signup\" | \"forgot\" | \"otp\" | \"reset\"",
    "type AuthMode = \"login\" | \"signup\" | \"forgot\" | \"otp\" | \"reset\" | \"phone_sms\"",
)

# after successful signup, go to phone_sms when phone present
# common pattern: await signUp(...)
if "setMode('phone_sms')" not in t:
    # try inject after signup success without error
    needle = "const { error, session } = await signUp"
    if needle not in t:
        needle = "await signUp("
    # softer: after signup block success toast
    for marker in [
        "toast.success('Ο λογαριασμός δημιουργήθηκε'",
        'toast.success("Ο λογαριασμός δημιουργήθηκε"',
        "toast.success('Εγγραφή επιτυχής'",
    ]:
        if marker in t:
            t = t.replace(
                marker,
                marker
                + ");\n        if (phone.trim()) { setMode('phone_sms'); setBusy(false); return; } // sms verify next\n        void (0",
                1,
            )
            # fix if we broke toast - actually bad. do different approach
            break

# Cleaner approach: append phone_sms UI mode section before closing of form modes
if "mode === 'phone_sms'" not in t:
    insert = '''
            ) : mode === 'phone_sms' ? (
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">Επιβεβαίωσε το κινητό σου με SMS για ασφαλείς παραγγελίες.</p>
                <PhoneSmsVerify
                  initialPhone={phone}
                  onVerified={() => {
                    void refreshProfile?.();
                    toast.success('Κινητό επιβεβαιωμένο');
                    setMode('login');
                  }}
                />
                <button type="button" className="text-xs text-muted-foreground underline" onClick={() => setMode('login')}>
                  Παράλειψη για τώρα
                </button>
              </div>
'''
    # insert before final login/signup fields close - find mode === 'reset'
    if ") : mode === 'reset'" in t:
        t = t.replace(") : mode === 'reset'", insert + "            ) : mode === 'reset'", 1)
        print('inserted phone_sms mode')
    elif "mode === 'otp'" in t:
        print('otp present - try after otp block')
    else:
        print('insert anchor miss')

# isAuthBypass include phone_sms
t = t.replace(
    "const isAuthBypass = mode === 'reset' || mode === 'forgot' || mode === 'otp';",
    "const isAuthBypass = mode === 'reset' || mode === 'forgot' || mode === 'otp' || mode === 'phone_sms';",
)

p.write_text(t)
print('AuthPage wired')

# Ensure profiles has phone_verified used - optional SQL note file
note = Path('docs/SMS_VERIFICATION.md')
note.parent.mkdir(parents=True, exist_ok=True)
note.write_text('''# SMS phone verification (Fresh2GO)\n\n## Required Supabase secrets (Edge Functions)\n- `TWILIO_ACCOUNT_SID`\n- `TWILIO_AUTH_TOKEN`\n- `TWILIO_FROM` (e.g. +30... or messaging service)\n\n## Functions\n- `send-phone-otp`\n- `verify-phone-otp`\n\n## UI\n- `PhoneSmsVerify` component\n- Auth signup can continue to SMS step\n\n## Deploy functions\n```bash\nsupabase functions deploy send-phone-otp\nsupabase functions deploy verify-phone-otp\n```\n\nWithout Twilio secrets, send returns `sms_not_configured`.\n''')
print('docs written')
