#!/usr/bin/env python3
"""Fix auth reset=1 to open forgot (request code) not empty otp screen."""
from pathlib import Path

# --- AuthPage.tsx ---
p = Path("src/pages/AuthPage.tsx")
t = p.read_text()

old = """      const wantsReset = params.get('reset') === '1' || params.get('type') === 'recovery';
      const hashRecovery = window.location.hash.includes('type=recovery');
      if (hashRecovery || params.get('type') === 'recovery') {
        setMode('reset');
      } else if (wantsReset) {
        setMode('otp');
      }"""

new = """      const wantsReset = params.get('reset') === '1' || params.get('type') === 'recovery';
      const hashRecovery = window.location.hash.includes('type=recovery');
      const emailParam = params.get('email');
      if (emailParam && emailParam.includes('@')) {
        setEmail(emailParam.trim().toLowerCase());
      }
      // recovery link from email → set new password
      if (hashRecovery || params.get('type') === 'recovery') {
        setMode('reset');
      } else if (wantsReset) {
        // App "forgot password" → request 6-digit code first (not empty OTP form)
        setMode('forgot');
      }"""

if old not in t:
    raise SystemExit('AuthPage reset block not found')
t = t.replace(old, new, 1)

# Add resend on OTP form if missing
if "Ξαναποστολή κωδικού" not in t and "mode === 'otp'" in t:
    needle = """                <Button type=\"submit\" className=\"w-full\" disabled={submitting}>{submitting ? <Loader2 className=\"h-4 w-4 animate-spin\" /> : 'Αλλαγή κωδικού'}</Button>
                <button type=\"button\" className=\"w-full text-sm text-[hsl(220,10%,55%)]\" onClick={() => setMode('login')}>Πίσω στη σύνδεση</button>"""
    insert = """                <Button type=\"submit\" className=\"w-full\" disabled={submitting}>{submitting ? <Loader2 className=\"h-4 w-4 animate-spin\" /> : 'Αλλαγή κωδικού'}</Button>
                <button
                  type=\"button\"
                  className=\"w-full text-sm text-primary font-semibold\"
                  disabled={submitting || !email.trim()}
                  onClick={(ev) => { void handleForgot(ev as unknown as React.FormEvent); }}
                >
                  Ξαναποστολή κωδικού
                </button>
                <button type=\"button\" className=\"w-full text-sm text-[hsl(220,10%,55%)]\" onClick={() => setMode('forgot')}>Αλλαγή email</button>
                <button type=\"button\" className=\"w-full text-sm text-[hsl(220,10%,55%)]\" onClick={() => setMode('login')}>Πίσω στη σύνδεση</button>"""
    if needle in t:
        t = t.replace(needle, insert, 1)
        print('otp resend added')
    else:
        print('otp resend needle missing')

# Clearer subtitle
t = t.replace(
    "Θα λάβετε κωδικό στην εφαρμογή (και email αν είναι διαθέσιμο)",
    "Θα λάβετε 6ψήφιο κωδικό στο email σας (Fresh2GO)",
)

p.write_text(t)
print('AuthPage updated')

# --- LoginScreen.kt: pass email in reset URL ---
login = Path("native-customer/app/src/main/java/com/freshdelivery/nativecustomer/ui/LoginScreen.kt")
if login.exists():
    lt = login.read_text()
    old_uri = 'val uri = Uri.parse("https://freshdelivery.app/auth?reset=1")'
    new_uri = '''val q = email.trim()
                    val uri = Uri.parse(
                        if (q.contains("@"))
                            "https://freshdelivery.app/auth?reset=1&email=" + Uri.encode(q)
                        else
                            "https://freshdelivery.app/auth?reset=1"
                    )'''
    if old_uri in lt:
        lt = lt.replace(old_uri, new_uri, 1)
        login.write_text(lt)
        print('LoginScreen URL fixed')
    else:
        print('LoginScreen uri not found')
else:
    print('LoginScreen missing')
