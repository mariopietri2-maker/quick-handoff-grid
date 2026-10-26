#!/usr/bin/env python3
"""Fix known compile/lint issues then bump versions for native APK rebuild."""
from pathlib import Path
import re

changed = []

# 1) Broken GOOGLE_WEB_CLIENT_ID buildConfigField in customer gradle
p = Path("native-customer/app/build.gradle.kts")
t = p.read_text()
# Remove any malformed GOOGLE_WEB_CLIENT_ID block(s)
t2 = re.sub(
    r"\n\s*// Web client ID for Google Sign-In[\s\S]*?buildConfigField\([\s\S]*?GOOGLE_WEB_CLIENT_ID[\s\S]*?\)\n",
    "\n",
    t,
    count=1,
)
if t2 == t:
    # try broader: any buildConfigField containing GOOGLE_WEB_CLIENT_ID spanning lines
    t2 = re.sub(
        r"\s*buildConfigField\([\"']String[\"'],\s*[\"']GOOGLE_WEB_CLIENT_ID[\"'][\s\S]*?\)\s*\n",
        "\n",
        t,
    )
# Insert clean field after versionName
if "GOOGLE_WEB_CLIENT_ID" not in t2:
    t2 = re.sub(
        r'(versionName\s*=\s*"[^"]+")',
        r'''\1

        // Google Sign-In web client ID (optional; empty disables Google button flow)
        val googleWebClientId = (project.findProperty("GOOGLE_WEB_CLIENT_ID") as String?)
            ?: System.getenv("GOOGLE_WEB_CLIENT_ID")
            ?: ""
        buildConfigField("String", "GOOGLE_WEB_CLIENT_ID", "\"$googleWebClientId\"")''',
        t2,
        count=1,
    )
    changed.append("fix GOOGLE_WEB_CLIENT_ID")
elif t2 != t:
    # re-add clean after strip
    t2 = re.sub(
        r'(versionName\s*=\s*"[^"]+")',
        r'''\1

        val googleWebClientId = (project.findProperty("GOOGLE_WEB_CLIENT_ID") as String?)
            ?: System.getenv("GOOGLE_WEB_CLIENT_ID")
            ?: ""
        buildConfigField("String", "GOOGLE_WEB_CLIENT_ID", "\"$googleWebClientId\"")''',
        t2,
        count=1,
    )
    changed.append("repair GOOGLE_WEB_CLIENT_ID")
p.write_text(t2)

# 2) Cart snackbar — no info on routine add
p = Path("native-customer/app/src/main/java/com/freshdelivery/nativecustomer/ui/CustomerViewModel.kt")
t = p.read_text()
old = '''            info = if (switched) {
                "Νέο καλάθι · ${s.selectedStore?.name ?: "κατάστημα"} (το προηγούμενο καθαρίστηκε)"
            } else {
                "Προστέθηκε στο καλάθι"
            },
        )
        tickHaptic()
        scheduleBannerClear()'''
new = '''            info = if (switched) {
                "Νέο καλάθι · ${s.selectedStore?.name ?: "κατάστημα"} (το προηγούμενο καθαρίστηκε)"
            } else {
                null
            },
        )
        tickHaptic()
        if (switched) scheduleBannerClear(1500)'''
if old in t:
    t = t.replace(old, new, 1)
    changed.append("cart snackbar")
# scheduleBannerClear with ms param
if "fun scheduleBannerClear(ms: Long" not in t:
    t = t.replace(
        "fun scheduleBannerClear() {\n        viewModelScope.launch {\n            delay(4500)",
        "fun scheduleBannerClear(ms: Long = 4500) {\n        viewModelScope.launch {\n            delay(ms)",
        1,
    )
    changed.append("scheduleBannerClear ms")
p.write_text(t)

# 3) CartCheckoutScreen must be @Composable
p = Path("native-customer/app/src/main/java/com/freshdelivery/nativecustomer/ui/CustomerShell.kt")
t = p.read_text()
if re.search(r"\nprivate fun CartCheckoutScreen\(", t) and not re.search(r"@Composable\nprivate fun CartCheckoutScreen\(", t):
    t = t.replace("\nprivate fun CartCheckoutScreen(", "\n@Composable\nprivate fun CartCheckoutScreen(", 1)
    changed.append("CartCheckoutScreen @Composable")
# drop double @Composable before PaymentMethodsScreen
t = t.replace("@Composable\n\n@Composable\nprivate fun PaymentMethodsScreen(", "@Composable\nprivate fun PaymentMethodsScreen(", 1)
# ProfileTab onOpenPayments
if "private fun ProfileTab(" in t and "onOpenPayments: () -> Unit = {}," not in t[t.find("private fun ProfileTab"):t.find("private fun ProfileTab")+500]:
    t = t.replace(
        """private fun ProfileTab(
    state: CustomerUiState,
    onSaveProfile: (String, String) -> Unit,
    onSignOut: () -> Unit,
    onOpenSupport: () -> Unit = {},
    onBackToHome: () -> Unit = {},
) {""",
        """private fun ProfileTab(
    state: CustomerUiState,
    onSaveProfile: (String, String) -> Unit,
    onSignOut: () -> Unit,
    onOpenSupport: () -> Unit = {},
    onOpenPayments: () -> Unit = {},
    onBackToHome: () -> Unit = {},
) {""",
        1,
    )
    t = t.replace(
        "CustomerTab.Profile -> ProfileTab(state, onSaveProfile, onSignOut, onOpenSupport, onBackToHome = { onTab(CustomerTab.Home) })",
        "CustomerTab.Profile -> ProfileTab(state, onSaveProfile, onSignOut, onOpenSupport, onOpenPayments = onOpenPayments, onBackToHome = { onTab(CustomerTab.Home) })",
        1,
    )
    changed.append("ProfileTab onOpenPayments")
p.write_text(t)

# 4) viva prefer-const
p = Path("supabase/functions/create-viva-checkout/index.ts")
if p.exists():
    t = p.read_text()
    t2 = t.replace("let sourceCode: string | null =", "const sourceCode: string | null =")
    if t2 != t:
        p.write_text(t2)
        changed.append("viva prefer-const")

# 5) Bump version codes/names (customer + driver) and apk-downloads parity
for app, name in [("native-customer", "1.0.10"), ("native-driver", "1.0.2")]:
    gp = Path(f"{app}/app/build.gradle.kts")
    gt = gp.read_text()
    gt2 = re.sub(r"versionCode\s*=\s*\d+", lambda m: f"versionCode = {int(re.search(r'\d+', m.group(0)).group()) + 1}", gt, count=1)
    gt2 = re.sub(r'versionName\s*=\s*"[^"]+"', f'versionName = "{name}"', gt2, count=1)
    gp.write_text(gt2)
    changed.append(f"{app} -> {name}")

apk = Path("src/lib/apk-downloads.ts")
at = apk.read_text()
at = re.sub(r"APK_NATIVE_CUSTOMER_VERSION = '[^']+'", "APK_NATIVE_CUSTOMER_VERSION = '1.0.10'", at)
at = re.sub(r"APK_NATIVE_DRIVER_VERSION = '[^']+'", "APK_NATIVE_DRIVER_VERSION = '1.0.2'", at)
apk.write_text(at)
changed.append("apk-downloads versions")

print("CHANGED:", ", ".join(changed))
