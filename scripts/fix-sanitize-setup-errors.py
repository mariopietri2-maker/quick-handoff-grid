#!/usr/bin/env python3
from pathlib import Path

p = Path("native-customer/app/src/main/java/com/freshdelivery/nativecustomer/ui/CustomerViewModel.kt")
t = p.read_text()

# Add helper if missing
if "fun friendlyEdgeError" not in t and "private fun friendlyEdgeError" not in t:
    # insert before startAddCard
    helper = '''
    /** User-facing edge-function errors — never dump headers/JWT. */
    private fun friendlyEdgeError(raw: String?): String {
        val s = raw?.trim().orEmpty()
        if (s.isEmpty()) return "Αποτυχία σύνδεσης με πληρωμές"
        if (s.contains("NOT_FOUND") || s.contains("was not found")) {
            return "Η υπηρεσία αποθήκευσης κάρτας δεν είναι ενεργή ακόμα (create-setup-intent)."
        }
        if (s.contains("Unauthorized") || s.contains("401")) {
            return "Συνδέσου ξανά για να αποθηκεύσεις κάρτα."
        }
        // Prefer JSON message field
        Regex("\"message\"\\s*:\\s*\"([^\"]+)\"").find(s)?.groupValues?.getOrNull(1)?.let {
            return it
        }
        Regex("\"error\"\\s*:\\s*\"([^\"]+)\"").find(s)?.groupValues?.getOrNull(1)?.let {
            return it
        }
        // Strip huge dumps
        if (s.length > 180 || s.contains("Authorization") || s.contains("Bearer")) {
            return "Αποτυχία αποθήκευσης κάρτας. Έλεγξε Stripe / edge functions."
        }
        return s
    }

'''
    t = t.replace("    fun startAddCard() {", helper + "    fun startAddCard() {", 1)

old_fail = '''                .onFailure { e ->
                    _state.value = _state.value.copy(busy = false, error = e.message ?: "Αποτυχία αποθήκευσης κάρτας")
                }
        }
    }

    fun openPayments() {'''

new_fail = '''                .onFailure { e ->
                    _state.value = _state.value.copy(
                        busy = false,
                        error = friendlyEdgeError(e.message),
                    )
                }
        }
    }

    fun openPayments() {'''

if old_fail in t:
    t = t.replace(old_fail, new_fail, 1)
    print("sanitized startAddCard errors")
else:
    # broader replace first onFailure after startAddCard
    print("WARN fail pattern")

p.write_text(t)
print("done")
