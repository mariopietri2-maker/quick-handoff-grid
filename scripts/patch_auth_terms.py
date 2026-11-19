#!/usr/bin/env python3
from pathlib import Path
t = Path("src/pages/AuthPage.tsx").read_text()
if "acceptTerms" in t:
    print("already")
    raise SystemExit(0)
t = t.replace(
    "const [submitting, setSubmitting] = useState(false);",
    "const [submitting, setSubmitting] = useState(false);\n  const [acceptTerms, setAcceptTerms] = useState(false);\n  const [acceptPrivacy, setAcceptPrivacy] = useState(false);",
    1,
)
marker = "const { error, session } = await signUp(emailNorm, password, fullName, driverIntent ? 'driver' : 'customer', phone.trim());"
if marker in t:
    t = t.replace(
        marker,
        "if (!acceptTerms || !acceptPrivacy) {\n"
        "          toast.error('Accept Terms of Use and Privacy Policy');\n"
        "          setSubmitting(false);\n"
        "          return;\n"
        "        }\n        " + marker,
        1,
    )
old = "<Button type=\"submit\" className=\"w-full\" disabled={submitting}>{submitting ? <Loader2 className=\"h-4 w-4 animate-spin\" /> : isLogin ? 'Σύνδεση' : 'Εγγραφή'}</Button>"
new = """{isSignup && (
                  <div className=\"space-y-3 rounded-lg border border-[hsl(220,20%,20%)] bg-[hsl(220,20%,12%)] p-3\">
                    <label className=\"flex items-start gap-2 text-sm text-[hsl(220,14%,90%)] cursor-pointer\">
                      <input type=\"checkbox\" className=\"mt-1 h-4 w-4 rounded border-[hsl(220,20%,30%)]\" checked={acceptTerms} onChange={(e) => setAcceptTerms(e.target.checked)} />
                      <span>Αποδέχομαι τους{' '}<a href=\"/legal/terms\" target=\"_blank\" rel=\"noopener noreferrer\" className=\"text-primary underline underline-offset-2\">Όρους Χρήσης</a></span>
                    </label>
                    <label className=\"flex items-start gap-2 text-sm text-[hsl(220,14%,90%)] cursor-pointer\">
                      <input type=\"checkbox\" className=\"mt-1 h-4 w-4 rounded border-[hsl(220,20%,30%)]\" checked={acceptPrivacy} onChange={(e) => setAcceptPrivacy(e.target.checked)} />
                      <span>Αποδέχομαι την{' '}<a href=\"/legal/privacy\" target=\"_blank\" rel=\"noopener noreferrer\" className=\"text-primary underline underline-offset-2\">Πολιτική Απορρήτου</a></span>
                    </label>
                  </div>
                )}
                <Button type=\"submit\" className=\"w-full\" disabled={submitting || (isSignup && (!acceptTerms || !acceptPrivacy))}>{submitting ? <Loader2 className=\"h-4 w-4 animate-spin\" /> : isLogin ? 'Σύνδεση' : 'Εγγραφή'}</Button>"""
if old not in t:
    raise SystemExit("button pattern missing")
t = t.replace(old, new, 1)
Path("src/pages/AuthPage.tsx").write_text(t)
print("AuthPage patched ok", t.count("acceptTerms"))
