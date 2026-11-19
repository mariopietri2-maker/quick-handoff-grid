#!/usr/bin/env python3
"""Add Terms + Privacy required checkboxes on customer signup (web AuthPage + native LoginScreen)."""
from pathlib import Path
import re

# ---------- WEB: AuthPage.tsx ----------
auth = Path('src/pages/AuthPage.tsx')
if auth.exists():
    t = auth.read_text()
    if 'acceptTerms' not in t:
        # state
        t = t.replace(
            "const [submitting, setSubmitting] = useState(false);",
            "const [submitting, setSubmitting] = useState(false);\n  const [acceptTerms, setAcceptTerms] = useState(false);\n  const [acceptPrivacy, setAcceptPrivacy] = useState(false);",
            1,
        )
        # block signup without checks
        marker = "const { error, session } = await signUp(emailNorm, password, fullName, driverIntent ? 'driver' : 'customer', phone.trim());"
        guard = """if (!acceptTerms || !acceptPrivacy) {
          toast.error('Πρέπει να αποδεχτείτε τους Όρους Χρήσης και την Πολιτική Απορρήτου.');
          setSubmitting(false);
          return;
        }
        """ + marker
        if marker in t:
            t = t.replace(marker, guard, 1)
        # UI before submit button in main login/signup form
        old_btn = "<Button type=\"submit\" className=\"w-full\" disabled={submitting}>{submitting ? <Loader2 className=\"h-4 w-4 animate-spin\" /> : isLogin ? 'Σύνδεση' : 'Εγγραφή'}</Button>"
        checks = '''{isSignup && (
                  <div className="space-y-3 rounded-lg border border-[hsl(220,20%,20%)] bg-[hsl(220,20%,12%)] p-3">
                    <label className="flex items-start gap-2 text-sm text-[hsl(220,14%,90%)] cursor-pointer">
                      <input
                        type="checkbox"
                        className="mt-1 h-4 w-4 rounded border-[hsl(220,20%,30%)]"
                        checked={acceptTerms}
                        onChange={(e) => setAcceptTerms(e.target.checked)}
                      />
                      <span>
                        Αποδέχομαι τους{' '}
                        <a href="/legal/terms" target="_blank" rel="noopener noreferrer" className="text-primary underline underline-offset-2">
                          Όρους Χρήσης
                        </a>
                      </span>
                    </label>
                    <label className="flex items-start gap-2 text-sm text-[hsl(220,14%,90%)] cursor-pointer">
                      <input
                        type="checkbox"
                        className="mt-1 h-4 w-4 rounded border-[hsl(220,20%,30%)]"
                        checked={acceptPrivacy}
                        onChange={(e) => setAcceptPrivacy(e.target.checked)}
                      />
                      <span>
                        Αποδέχομαι την{' '}
                        <a href="/legal/privacy" target="_blank" rel="noopener noreferrer" className="text-primary underline underline-offset-2">
                          Πολιτική Απορρήτου
                        </a>
                      </span>
                    </label>
                  </div>
                )}
                <Button type="submit" className="w-full" disabled={submitting || (isSignup && (!acceptTerms || !acceptPrivacy))}>{submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : isLogin ? 'Σύνδεση' : 'Εγγραφή'}</Button>'''
        if old_btn in t:
            t = t.replace(old_btn, checks, 1)
            print('web AuthPage patched')
        else:
            print('web button pattern miss')
        auth.write_text(t)
    else:
        print('web already has acceptTerms')

# ---------- NATIVE: LoginScreen.kt ----------
login = Path('native-customer/app/src/main/java/com/freshdelivery/nativecustomer/ui/LoginScreen.kt')
if login.exists():
    lt = login.read_text()
    if 'acceptTerms' not in lt:
        # imports
        if 'androidx.compose.foundation.clickable' not in lt:
            lt = lt.replace(
                'import androidx.compose.foundation.layout.',
                'import androidx.compose.foundation.clickable\nimport androidx.compose.foundation.layout.',
                1,
            )
        if 'android.content.Intent' not in lt:
            # add after package / first imports block
            lt = lt.replace(
                'import android',
                'import android.content.Intent\nimport android.net.Uri\nimport android',
                1,
            )
        if 'import android.content.Intent' not in lt:
            # try another insertion point
            first_import = lt.find('import ')
            if first_import >= 0:
                lt = lt[:first_import] + 'import android.content.Intent\nimport android.net.Uri\n' + lt[first_import:]
        if 'LocalContext' not in lt:
            lt = lt.replace(
                'import androidx.compose.ui.platform.',
                'import androidx.compose.ui.platform.LocalContext\nimport androidx.compose.ui.platform.',
                1,
            )
            if 'LocalContext' not in lt:
                lt = lt.replace(
                    'import androidx.compose.ui.Modifier',
                    'import androidx.compose.ui.Modifier\nimport androidx.compose.ui.platform.LocalContext',
                    1,
                )

        # state vars near rememberMe
        if 'var rememberMe by remember' in lt:
            lt = lt.replace(
                'var rememberMe by remember',
                'var acceptTerms by remember { mutableStateOf(false) }\n    var acceptPrivacy by remember { mutableStateOf(false) }\n    var rememberMe by remember',
                1,
            )
        else:
            # insert after first mutableStateOf for email
            lt = re.sub(
                r'(var email by remember[^
]+
)',
                r'\1    var acceptTerms by remember { mutableStateOf(false) }\n    var acceptPrivacy by remember { mutableStateOf(false) }\n',
                lt,
                count=1,
            )

        # context
        if 'val context = LocalContext.current' not in lt:
            # inside composable after params
            lt = re.sub(
                r'(fun LoginScreen\([^)]*\) \{)',
                r'\1\n    val context = LocalContext.current',
                lt,
                count=1,
            )

        # UI block before main Button - after remember me row / error
        insert_ui = '''
        if (signupMode) {
            Spacer(Modifier.height(12.dp))
            Row(verticalAlignment = Alignment.CenterVertically, modifier = Modifier.fillMaxWidth()) {
                Checkbox(
                    checked = acceptTerms,
                    onCheckedChange = { acceptTerms = it },
                    colors = CheckboxDefaults.colors(checkedColor = FreshGreen, checkmarkColor = Color.White),
                )
                Text(
                    text = "Αποδέχομαι τους ",
                    color = FreshInk,
                    style = MaterialTheme.typography.bodySmall,
                )
                Text(
                    text = "Όρους Χρήσης",
                    color = FreshGreenDark,
                    style = MaterialTheme.typography.bodySmall,
                    fontWeight = FontWeight.SemiBold,
                    modifier = Modifier.clickable {
                        context.startActivity(Intent(Intent.ACTION_VIEW, Uri.parse("https://fresh2go.gr/legal/terms")))
                    },
                )
            }
            Row(verticalAlignment = Alignment.CenterVertically, modifier = Modifier.fillMaxWidth()) {
                Checkbox(
                    checked = acceptPrivacy,
                    onCheckedChange = { acceptPrivacy = it },
                    colors = CheckboxDefaults.colors(checkedColor = FreshGreen, checkmarkColor = Color.White),
                )
                Text(
                    text = "Αποδέχομαι την ",
                    color = FreshInk,
                    style = MaterialTheme.typography.bodySmall,
                )
                Text(
                    text = "Πολιτική Απορρήτου",
                    color = FreshGreenDark,
                    style = MaterialTheme.typography.bodySmall,
                    fontWeight = FontWeight.SemiBold,
                    modifier = Modifier.clickable {
                        context.startActivity(Intent(Intent.ACTION_VIEW, Uri.parse("https://fresh2go.gr/legal/privacy")))
                    },
                )
            }
        }
'''
        # insert before // Google Sign-In disabled
        if '// Google Sign-In disabled' in lt and 'acceptTerms' in lt:
            # state was added; still need UI
            pass
        if 'Αποδέχομαι τους' not in lt:
            if '// Google Sign-In disabled' in lt:
                lt = lt.replace('// Google Sign-In disabled', insert_ui + '\n        // Google Sign-In disabled', 1)
            else:
                lt = lt.replace(
                    'Button(\n            onClick = {',
                    insert_ui + '\n        Button(\n            onClick = {',
                    1,
                )

        # enabled condition
        old_en = 'enabled = !busy && email.isNotBlank() && password.length >= 6 &&\n                (!signupMode || (fullName.isNotBlank() && phone.filter { it.isDigit() }.length >= 10)),'
        new_en = 'enabled = !busy && email.isNotBlank() && password.length >= 6 &&\n                (!signupMode || (fullName.isNotBlank() && phone.filter { it.isDigit() }.length >= 10 && acceptTerms && acceptPrivacy)),'
        if old_en in lt:
            lt = lt.replace(old_en, new_en, 1)
        else:
            lt = re.sub(
                r'enabled = !busy && email\.isNotBlank\(\) && password\.length >= 6 &&\s*\(!signupMode \|\| \(fullName\.isNotBlank\(\) && phone\.filter \{ it\.isDigit\(\) \}\.length >= 10\)\),',
                'enabled = !busy && email.isNotBlank() && password.length >= 6 && (!signupMode || (fullName.isNotBlank() && phone.filter { it.isDigit() }.length >= 10 && acceptTerms && acceptPrivacy)),',
                lt,
                count=1,
            )

        # also guard onClick
        lt = lt.replace(
            '''if (signupMode) {
                    if (fullName.trim().length < 2) return@Button
                    val digits = phone.filter { it.isDigit() }
                    if (digits.length < 10) return@Button
                    onSignUp(email, password, fullName.trim(), phone.trim())''',
            '''if (signupMode) {
                    if (fullName.trim().length < 2) return@Button
                    val digits = phone.filter { it.isDigit() }
                    if (digits.length < 10) return@Button
                    if (!acceptTerms || !acceptPrivacy) return@Button
                    onSignUp(email, password, fullName.trim(), phone.trim())''',
            1,
        )

        login.write_text(lt)
        print('native LoginScreen patched')
    else:
        print('native already has acceptTerms')

print('SIGNUP_TERMS_OK')
