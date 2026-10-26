#!/usr/bin/env python3
"""Make Profile → Τρόποι πληρωμής open reliably and show errors on the screen."""
from pathlib import Path
import re

p = Path("native-customer/app/src/main/java/com/freshdelivery/nativecustomer/ui/CustomerShell.kt")
t = p.read_text()
changed = []

# 1) PaymentMethodsScreen: show error/info + always show cash note
old_body_start = '''        Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
            Text(
                "Αποθηκευμένες κάρτες",
                fontWeight = FontWeight.Bold,
                style = MaterialTheme.typography.titleMedium,
            )'''

new_body_start = '''        Column(
            Modifier
                .weight(1f)
                .verticalScroll(rememberScrollState())
                .padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(10.dp),
        ) {
            if (!state.error.isNullOrBlank()) {
                Text(state.error!!, color = Color(0xFFB91C1C), fontWeight = FontWeight.SemiBold)
            }
            if (!state.info.isNullOrBlank()) {
                Text(state.info!!, color = FreshGreenDark, fontWeight = FontWeight.Medium)
            }
            Text(
                "Μετρητά είναι πάντα διαθέσιμα στο checkout. Εδώ αποθηκεύεις κάρτα για πιο γρήγορη πληρωμή.",
                color = FreshMuted,
                style = MaterialTheme.typography.bodySmall,
            )
            Text(
                "Αποθηκευμένες κάρτες",
                fontWeight = FontWeight.Bold,
                style = MaterialTheme.typography.titleMedium,
            )'''

if old_body_start in t:
    t = t.replace(old_body_start, new_body_start, 1)
    changed.append("PaymentMethodsScreen body")
else:
    print("WARN PaymentMethodsScreen body")

# 2) Profile payments row: use explicit click + Role
old_row = '''        Row(
            Modifier
                .fillMaxWidth()
                .shadow(4.dp, RoundedCornerShape(22.dp))
                .clip(RoundedCornerShape(22.dp))
                .background(Color.White)
                .clickable(onClick = onOpenPayments)
                .padding(16.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Box(
                Modifier
                    .size(44.dp)
                    .background(FreshGreenSoft, RoundedCornerShape(14.dp)),
                contentAlignment = Alignment.Center,
            ) {
                Icon(Icons.Outlined.CreditCard, contentDescription = null, tint = FreshGreen, modifier = Modifier.size(22.dp))
            }'''

# Only replace if CreditCard is in that block - read actual icon
m = re.search(
    r'clickable\(onClick = onOpenPayments\)[\s\S]{0,400}?Τρόποι πληρωμής',
    t,
)
if m:
    # ensure clickable is first after background and use indication
    t2 = t.replace(
        ".clickable(onClick = onOpenPayments)",
        ".clickable(
                    enabled = true,
                    onClick = {
                        onOpenPayments()
                    },
                )",
        1,  # first is support? Careful - support is onOpenSupport
    )
    # Only replace the payments one - find unique context
    t = t.replace(
        '''                .background(Color.White)
                .clickable(onClick = onOpenPayments)
                .padding(16.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Box(
                Modifier
                    .size(44.dp)
                    .background(FreshGreenSoft, RoundedCornerShape(14.dp)),
                contentAlignment = Alignment.Center,
            ) {
                Icon(Icons.Outlined.CreditCard''',
        '''                .background(Color.White)
                .clickable(enabled = true, onClick = { onOpenPayments() })
                .padding(16.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Box(
                Modifier
                    .size(44.dp)
                    .background(FreshGreenSoft, RoundedCornerShape(14.dp)),
                contentAlignment = Alignment.Center,
            ) {
                Icon(Icons.Outlined.CreditCard''',
        1,
    )
    changed.append("payments row click")
else:
    # try generic: any clickable onOpenPayments
    if ".clickable(onClick = onOpenPayments)" in t:
        t = t.replace(
            ".clickable(onClick = onOpenPayments)",
            ".clickable(enabled = true, onClick = { onOpenPayments() })",
            1,
        )
        changed.append("payments click generic")
    else:
        print("WARN payments row")

p.write_text(t)

# 3) ViewModel openPayments — clear error and force true
p = Path("native-customer/app/src/main/java/com/freshdelivery/nativecustomer/ui/CustomerViewModel.kt")
t = p.read_text()
old = '''    fun openPayments() {
        _state.value = _state.value.copy(paymentsOpen = true)
        refreshSavedCards()
    }'''
new = '''    fun openPayments() {
        _state.value = _state.value.copy(
            paymentsOpen = true,
            error = null,
            supportOpen = false,
            showCart = false,
            adminOpen = false,
        )
        refreshSavedCards()
    }'''
if old in t:
    t = t.replace(old, new, 1)
    p.write_text(t)
    changed.append("openPayments")
else:
    print("WARN openPayments")

print("CHANGED:", ", ".join(changed) if changed else "none")
