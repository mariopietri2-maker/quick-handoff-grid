#!/usr/bin/env python3
from pathlib import Path
import re
p = Path("native-customer/app/src/main/java/com/freshdelivery/nativecustomer/ui/LoginScreen.kt")
if not p.exists():
    print("no native"); raise SystemExit(0)
lt = p.read_text()
if "acceptTerms" in lt and "fresh2go.gr/legal/terms" in lt:
    print("native already"); raise SystemExit(0)
if "import android.content.Intent" not in lt:
    i = lt.find("import ")
    lt = lt[:i] + "import android.content.Intent\nimport android.net.Uri\n" + lt[i:]
if "LocalContext" not in lt:
    lt = lt.replace("import androidx.compose.ui.Modifier", "import androidx.compose.ui.Modifier\nimport androidx.compose.ui.platform.LocalContext", 1)
if "import androidx.compose.foundation.clickable" not in lt:
    lt = lt.replace("import androidx.compose.foundation.", "import androidx.compose.foundation.clickable\nimport androidx.compose.foundation.", 1)
if "import androidx.compose.material3.Checkbox" not in lt:
    lt = lt.replace("import androidx.compose.material3.Button\n", "import androidx.compose.material3.Button\nimport androidx.compose.material3.Checkbox\nimport androidx.compose.material3.CheckboxDefaults\n", 1)
if "var acceptTerms" not in lt:
    if "var rememberMe by remember" in lt:
        lt = lt.replace("var rememberMe by remember", "var acceptTerms by remember { mutableStateOf(false) }\n    var acceptPrivacy by remember { mutableStateOf(false) }\n    var rememberMe by remember", 1)
if "val context = LocalContext.current" not in lt:
    lt = re.sub(r"(fun LoginScreen\([\s\S]*?\) \{)\n", r"\1\n    val context = LocalContext.current\n", lt, count=1)
ui = '''
        if (signupMode) {
            Spacer(Modifier.height(12.dp))
            Row(verticalAlignment = Alignment.CenterVertically, modifier = Modifier.fillMaxWidth()) {
                Checkbox(checked = acceptTerms, onCheckedChange = { acceptTerms = it }, colors = CheckboxDefaults.colors(checkedColor = FreshGreen, checkmarkColor = Color.White))
                Text(text = "Αποδέχομαι τους ", color = FreshInk, style = MaterialTheme.typography.bodySmall)
                Text(text = "Όρους Χρήσης", color = FreshGreenDark, style = MaterialTheme.typography.bodySmall, fontWeight = FontWeight.SemiBold, modifier = Modifier.clickable { context.startActivity(Intent(Intent.ACTION_VIEW, Uri.parse("https://fresh2go.gr/legal/terms"))) })
            }
            Row(verticalAlignment = Alignment.CenterVertically, modifier = Modifier.fillMaxWidth()) {
                Checkbox(checked = acceptPrivacy, onCheckedChange = { acceptPrivacy = it }, colors = CheckboxDefaults.colors(checkedColor = FreshGreen, checkmarkColor = Color.White))
                Text(text = "Αποδέχομαι την ", color = FreshInk, style = MaterialTheme.typography.bodySmall)
                Text(text = "Πολιτική Απορρήτου", color = FreshGreenDark, style = MaterialTheme.typography.bodySmall, fontWeight = FontWeight.SemiBold, modifier = Modifier.clickable { context.startActivity(Intent(Intent.ACTION_VIEW, Uri.parse("https://fresh2go.gr/legal/privacy"))) })
            }
        }
'''
if "fresh2go.gr/legal/terms" not in lt:
    if "// Google Sign-In disabled" in lt:
        lt = lt.replace("// Google Sign-In disabled", ui + "\n        // Google Sign-In disabled", 1)
    else:
        lt = lt.replace("Button(\n            onClick = {", ui + "\n        Button(\n            onClick = {", 1)
if "acceptTerms && acceptPrivacy" not in lt:
    lt = lt.replace("phone.filter { it.isDigit() }.length >= 10)", "phone.filter { it.isDigit() }.length >= 10 && acceptTerms && acceptPrivacy)", 1)
if "if (!acceptTerms || !acceptPrivacy) return@Button" not in lt:
    lt = lt.replace(
        "if (digits.length < 10) return@Button\n                    onSignUp",
        "if (digits.length < 10) return@Button\n                    if (!acceptTerms || !acceptPrivacy) return@Button\n                    onSignUp",
        1,
    )
p.write_text(lt)
print("native ok", "acceptTerms" in lt)
