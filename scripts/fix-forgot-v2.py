#!/usr/bin/env python3
from pathlib import Path

p = Path("src/pages/AuthPage.tsx")
t = p.read_text()

# Core bugfix: reset=1 must open forgot (request code), not otp
t = t.replace(
    "} else if (wantsReset) {\n        setMode('otp');",
    "} else if (wantsReset) {\n        setMode('forgot');",
    1,
)

if "const emailParam = params.get('email')" not in t:
    t = t.replace(
        "const hashRecovery = window.location.hash.includes('type=recovery');\n",
        "const hashRecovery = window.location.hash.includes('type=recovery');\n"
        "      const emailParam = params.get('email');\n"
        "      if (emailParam && emailParam.includes('@')) {\n"
        "        setEmail(emailParam.trim().toLowerCase());\n"
        "      }\n",
        1,
    )

t = t.replace(
    "Θα λάβετε κωδικό στην εφαρμογή (και email αν είναι διαθέσιμο)",
    "Θα λάβετε 6ψήφιο κωδικό στο email σας (Fresh2GO)",
)

p.write_text(t)
print("AuthPage:", "forgot-on-reset" if "wantsReset) {\n        setMode('forgot')" in t else "check")

login = Path("native-customer/app/src/main/java/com/freshdelivery/nativecustomer/ui/LoginScreen.kt")
if login.exists():
    lt = login.read_text()
    o = 'val uri = Uri.parse("https://freshdelivery.app/auth?reset=1")'
    n = (
        'val q = email.trim()\n'
        '                    val uri = Uri.parse(\n'
        '                        if (q.contains("@"))\n'
        '                            "https://freshdelivery.app/auth?reset=1&email=" + Uri.encode(q)\n'
        '                        else\n'
        '                            "https://freshdelivery.app/auth?reset=1"\n'
        '                    )'
    )
    if o in lt:
        login.write_text(lt.replace(o, n, 1))
        print("LoginScreen: ok")
    else:
        print("LoginScreen: skip")
