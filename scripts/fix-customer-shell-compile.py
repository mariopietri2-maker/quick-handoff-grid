#!/usr/bin/env python3
from pathlib import Path
p = Path("native-customer/app/src/main/java/com/freshdelivery/nativecustomer/ui/CustomerShell.kt")
t = p.read_text()
changed = False

old1 = "// FreshMenuRow extracted\n\n@Composable\n\n@Composable\nprivate fun PaymentMethodsScreen(\n"
new1 = "// FreshMenuRow extracted\n\n@Composable\nprivate fun PaymentMethodsScreen(\n"
if old1 in t:
    t = t.replace(old1, new1, 1)
    changed = True
    print("fixed double @Composable")
elif "@Composable\nprivate fun PaymentMethodsScreen" in t:
    print("PaymentMethodsScreen already single @Composable")
else:
    print("WARN PaymentMethodsScreen pattern")

old2 = "}\n\nprivate fun CartCheckoutScreen(\n    state: CustomerUiState,\n"
new2 = "}\n\n@Composable\nprivate fun CartCheckoutScreen(\n    state: CustomerUiState,\n"
if old2 in t:
    t = t.replace(old2, new2, 1)
    changed = True
    print("added @Composable to CartCheckoutScreen")
elif "@Composable\nprivate fun CartCheckoutScreen" in t:
    print("CartCheckoutScreen already @Composable")
else:
    print("WARN CartCheckoutScreen pattern")

old3 = """private fun ProfileTab(
    state: CustomerUiState,
    onSaveProfile: (String, String) -> Unit,
    onSignOut: () -> Unit,
    onOpenSupport: () -> Unit = {},
    onBackToHome: () -> Unit = {},
) {"""
new3 = """private fun ProfileTab(
    state: CustomerUiState,
    onSaveProfile: (String, String) -> Unit,
    onSignOut: () -> Unit,
    onOpenSupport: () -> Unit = {},
    onOpenPayments: () -> Unit = {},
    onBackToHome: () -> Unit = {},
) {"""
if old3 in t:
    t = t.replace(old3, new3, 1)
    changed = True
    print("added onOpenPayments to ProfileTab")
elif "onOpenPayments: () -> Unit = {}," in t[t.find("private fun ProfileTab"):t.find("private fun ProfileTab")+500]:
    print("ProfileTab already has onOpenPayments")
else:
    print("WARN ProfileTab signature")

old4 = "CustomerTab.Profile -> ProfileTab(state, onSaveProfile, onSignOut, onOpenSupport, onBackToHome = { onTab(CustomerTab.Home) })"
new4 = "CustomerTab.Profile -> ProfileTab(state, onSaveProfile, onSignOut, onOpenSupport, onOpenPayments = onOpenPayments, onBackToHome = { onTab(CustomerTab.Home) })"
if old4 in t:
    t = t.replace(old4, new4, 1)
    changed = True
    print("wired onOpenPayments at call site")
elif "onOpenPayments = onOpenPayments" in t:
    print("call site already wired")
else:
    print("WARN call site")

old5 = ".background(if (!canPlace) FreshChip else FreshGradient)"
new5 = ".then(if (canPlace) Modifier.background(FreshGradient) else Modifier.background(FreshChip))"
if old5 in t:
    t = t.replace(old5, new5, 1)
    changed = True
    print("fixed Color/Brush")

if changed:
    p.write_text(t)
    print("WROTE")
else:
    print("NO_CHANGE")
