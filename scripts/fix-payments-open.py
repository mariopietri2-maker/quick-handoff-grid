#!/usr/bin/env python3
from pathlib import Path

changed = []

# ViewModel
p = Path("native-customer/app/src/main/java/com/freshdelivery/nativecustomer/ui/CustomerViewModel.kt")
t = p.read_text()
old = """    fun openPayments() {
        _state.value = _state.value.copy(paymentsOpen = true)
        refreshSavedCards()
    }"""
new = """    fun openPayments() {
        _state.value = _state.value.copy(
            paymentsOpen = true,
            error = null,
            supportOpen = false,
            showCart = false,
            adminOpen = false,
        )
        refreshSavedCards()
    }"""
if old in t:
    p.write_text(t.replace(old, new, 1))
    changed.append("openPayments")
else:
    print("WARN openPayments pattern missing")

# Shell - payments row click
p = Path("native-customer/app/src/main/java/com/freshdelivery/nativecustomer/ui/CustomerShell.kt")
t = p.read_text()
if ".clickable(onClick = onOpenPayments)" in t:
    t = t.replace(
        ".clickable(onClick = onOpenPayments)",
        ".clickable(enabled = true, onClick = { onOpenPayments() })",
        1,
    )
    changed.append("row click")

# PaymentMethodsScreen - insert error/info after Column padding start
needle = """        Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
            Text(
                "Αποθηκευμένες κάρτες",
                fontWeight = FontWeight.Bold,
                style = MaterialTheme.typography.titleMedium,
            )"""
insert = """        Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
            if (!state.error.isNullOrBlank()) {
                Text(state.error!!, color = Color(0xFFB91C1C), fontWeight = FontWeight.SemiBold)
            }
            if (!state.info.isNullOrBlank()) {
                Text(state.info!!, color = FreshGreenDark, fontWeight = FontWeight.Medium)
            }
            Text(
                "Μετρητά στο checkout. Εδώ αποθηκεύεις κάρτα για πιο γρήγορη πληρωμή.",
                color = FreshMuted,
                style = MaterialTheme.typography.bodySmall,
            )
            Text(
                "Αποθηκευμένες κάρτες",
                fontWeight = FontWeight.Bold,
                style = MaterialTheme.typography.titleMedium,
            )"""
if needle in t:
    t = t.replace(needle, insert, 1)
    changed.append("PaymentMethodsScreen")
else:
    print("WARN PaymentMethodsScreen needle")

p.write_text(t)
print("CHANGED:", ", ".join(changed) if changed else "none")
if not changed:
    raise SystemExit(1)
