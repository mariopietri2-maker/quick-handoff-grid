#!/usr/bin/env python3
from pathlib import Path
import re

p = Path("native-customer/app/src/main/java/com/freshdelivery/nativecustomer/ui/CustomerViewModel.kt")
t = p.read_text()

# Replace friendlyEdgeError with network-aware version
new_fn = '''    /** User-facing edge/Stripe errors — never dump headers/JWT/raw IOException. */
    private fun friendlyEdgeError(raw: String?): String {
        val s = raw?.trim().orEmpty()
        if (s.isEmpty()) return "Αποτυχία σύνδεσης με πληρωμές"
        val lower = s.lowercase()
        if (lower.contains("unable to resolve host") ||
            lower.contains("no address associated") ||
            lower.contains("unknownhost") ||
            lower.contains("failed to connect") ||
            lower.contains("network is unreachable") ||
            lower.contains("software caused connection abort") ||
            lower.contains("timeout") && lower.contains("stripe")
        ) {
            return "Δεν υπάρχει σύνδεση στο Stripe. Έλεγξε Wi‑Fi/δεδομένα (ή VPN/ad-block) και δοκίμασε ξανά."
        }
        if (s.contains("NOT_FOUND") || s.contains("was not found")) {
            return "Η υπηρεσία κάρτας δεν είναι ενεργή ακόμα."
        }
        if (s.contains("Unauthorized") || s.contains("401")) {
            return "Συνδέσου ξανά για να αποθηκεύσεις κάρτα."
        }
        if (s.length > 180 || s.contains("Authorization") || s.contains("Bearer") || s.contains("IOException")) {
            return "Αποτυχία πληρωμής/κάρτας. Έλεγξε σύνδεση και Stripe."
        }
        return s.take(160)
    }
'''

pat = re.compile(
    r"    /\*\* User-facing edge[\s\S]*?private fun friendlyEdgeError\(raw: String\?\): String \{[\s\S]*?\n    \}\n",
)
m = pat.search(t)
if not m:
    raise SystemExit('friendlyEdgeError not found')
t = t[: m.start()] + new_fn + t[m.end() :]

# onPaymentSheetResult: map network errors
old_fail = '''        } else if (!message.isNullOrBlank()) {
            val friendly = when {
                message.contains("cancel", ignoreCase = true) ||
                    message.contains("ακυρ", ignoreCase = true) ->
                    "Η πληρωμή ακυρώθηκε. Μπορείς να δοκιμάσεις ξανά."
                else -> message
            }
            _state.value = _state.value.copy(error = friendly)
        }'''

new_fail = '''        } else if (!message.isNullOrBlank()) {
            val friendly = when {
                message.contains("cancel", ignoreCase = true) ||
                    message.contains("ακυρ", ignoreCase = true) ->
                    "Η πληρωμή ακυρώθηκε. Μπορείς να δοκιμάσεις ξανά."
                message.contains("Unable to resolve host", ignoreCase = true) ||
                    message.contains("No address associated", ignoreCase = true) ||
                    message.contains("UnknownHost", ignoreCase = true) ||
                    message.contains("IOException", ignoreCase = true) ->
                    "Δεν υπάρχει σύνδεση στο Stripe. Έλεγξε Wi‑Fi/δεδομένα και δοκίμασε ξανά."
                else -> friendlyEdgeError(message)
            }
            _state.value = _state.value.copy(error = friendly)
        }'''

if old_fail in t:
    t = t.replace(old_fail, new_fail, 1)
    print('onPaymentSheetResult updated')
else:
    print('WARN onPaymentSheetResult pattern')

# Clarifying info after card place
if 'Στέλνουμε την παραγγελία στο κατάστημα' in t:
    t = t.replace(
        'Στέλνουμε την παραγγελία στο κατάστημα…',
        'Πληρωμή OK — η παραγγελία πάει στο κατάστημα μόνο μετά την επιβεβαίωση Stripe…',
        1,
    )

p.write_text(t)
print('ok')
