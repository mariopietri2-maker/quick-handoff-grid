#!/usr/bin/env python3
"""Require full name + valid Greek mobile on signup (web AuthPage + native LoginScreen)."""
from pathlib import Path
import re

# --- Web AuthPage: stricter phone validation ---
p = Path('src/pages/AuthPage.tsx')
if p.exists():
    t = p.read_text()
    old = '''        if (!fullName.trim()) {
          toast.error('Παρακαλώ εισάγετε το όνομά σας');
          return;
        }
        if (!phone.trim()) {
          toast.error('Παρακαλώ εισάγετε το τηλέφωνό σας');
          return;
        }'''
    new = '''        if (!fullName.trim() || fullName.trim().length < 2) {
          toast.error('Το όνομα είναι υποχρεωτικό (τουλάχιστον 2 χαρακτήρες)');
          return;
        }
        {
          const digits = phone.replace(/\\D/g, '');
          const okPhone = /^(30)?69\\d{8}$/.test(digits) || /^69\\d{8}$/.test(digits);
          if (!phone.trim() || !okPhone) {
            toast.error('Το κινητό είναι υποχρεωτικό (π.χ. 69xxxxxxxx)');
            return;
          }
        }'''
    # fix double escapes for actual file content
    new = '''        if (!fullName.trim() || fullName.trim().length < 2) {
          toast.error('Το όνομα είναι υποχρεωτικό (τουλάχιστον 2 χαρακτήρες)');
          return;
        }
        {
          const digits = phone.replace(/\\D/g, '');
          const okPhone = /^(30)?69\\d{8}$/.test(digits) || /^69\\d{8}$/.test(digits);
          if (!phone.trim() || !okPhone) {
            toast.error('Το κινητό είναι υποχρεωτικό (π.χ. 69xxxxxxxx)');
            return;
          }
        }'''
    # Write with correct single backslashes for JS regex
    new = (
        "        if (!fullName.trim() || fullName.trim().length < 2) {\n"
        "          toast.error('Το όνομα είναι υποχρεωτικό (τουλάχιστον 2 χαρακτήρες)');\n"
        "          return;\n"
        "        }\n"
        "        {\n"
        "          const digits = phone.replace(/\\D/g, '');\n"
        "          const okPhone = /^(30)?69\\d{8}$/.test(digits) || /^69\\d{8}$/.test(digits);\n"
        "          if (!phone.trim() || !okPhone) {\n"
        "            toast.error('Το κινητό είναι υποχρεωτικό (π.χ. 69xxxxxxxx)');\n"
        "            return;\n"
        "          }\n"
        "        }"
    )
    if old in t:
        t = t.replace(old, new, 1)
        print('AuthPage validation')
    else:
        print('AuthPage block miss')
    # Ensure phone input required on signup form
    t = t.replace(
        'placeholder="69xxxxxxxx" className="bg-[hsl(220,20%,14%)] border-[hsl(220,20%,20%)] text-[hsl(220,14%,96%)]" required />',
        'placeholder="69xxxxxxxx" className="bg-[hsl(220,20%,14%)] border-[hsl(220,20%,20%)] text-[hsl(220,14%,96%)]" required minLength={10} />',
    )
    p.write_text(t)

# --- Native LoginScreen: require phone on button enabled + click guard ---
ls = Path('native-customer/app/src/main/java/com/freshdelivery/nativecustomer/ui/LoginScreen.kt')
if ls.exists():
    lt = ls.read_text()
    lt = lt.replace(
        'enabled = !busy && email.isNotBlank() && password.length >= 6 &&\n                (!signupMode || fullName.isNotBlank()),',
        'enabled = !busy && email.isNotBlank() && password.length >= 6 &&\n                (!signupMode || (fullName.isNotBlank() && phone.filter { it.isDigit() }.length >= 10)),',
    )
    old_click = '''            onClick = {
                prefs.rememberMe = rememberMe
                if (rememberMe) {
                    prefs.savedEmail = email.trim()
                    prefs.savedPassword = password
                } else {
                    prefs.savedEmail = ""
                    prefs.savedPassword = ""
                }
                if (signupMode) onSignUp(email, password, fullName, phone)
                else onLogin(email, password)
            },'''
    new_click = '''            onClick = {
                prefs.rememberMe = rememberMe
                if (rememberMe) {
                    prefs.savedEmail = email.trim()
                    prefs.savedPassword = password
                } else {
                    prefs.savedEmail = ""
                    prefs.savedPassword = ""
                }
                if (signupMode) {
                    if (fullName.trim().length < 2) return@Button
                    val digits = phone.filter { it.isDigit() }
                    if (digits.length < 10) return@Button
                    onSignUp(email, password, fullName.trim(), phone.trim())
                } else onLogin(email, password)
            },'''
    if old_click in lt:
        lt = lt.replace(old_click, new_click, 1)
        print('LoginScreen click+enabled')
    else:
        print('LoginScreen click miss')
    # labels
    lt = lt.replace('label = { Text("Ονοματεπώνυμο") },', 'label = { Text("Ονοματεπώνυμο *") },')
    lt = lt.replace('label = { Text("Τηλέφωνο") },', 'label = { Text("Κινητό *") },')
    ls.write_text(lt)

# --- ViewModel: hard reject ---
vm = Path('native-customer/app/src/main/java/com/freshdelivery/nativecustomer/ui/CustomerViewModel.kt')
if vm.exists():
    vt = vm.read_text()
    if 'fullName.trim().length < 2' not in vt:
        vt = vt.replace(
            'repo.signUp(emailNorm, pass, fullName.trim(), phone.trim())',
            '''run {
                    if (fullName.trim().length < 2) error("NAME_REQUIRED")
                    if (phone.filter { it.isDigit() }.length < 10) error("PHONE_REQUIRED")
                    repo.signUp(emailNorm, pass, fullName.trim(), phone.trim())
                }''',
        )
        vt = vt.replace(
            '"invalid" in raw && "email" in raw ->\n                            "Μη έγκυρο email."',
            '"invalid" in raw && "email" in raw ->\n                            "Μη έγκυρο email."\n'
            '                        "name_required" in raw ->\n                            "Το όνομα είναι υποχρεωτικό."\n'
            '                        "phone_required" in raw ->\n                            "Το κινητό είναι υποχρεωτικό (10 ψηφία)."',
        )
        vm.write_text(vt)
        print('ViewModel guards')
    else:
        print('ViewModel already')

print('REQUIRE_NAME_PHONE_OK')
