#!/usr/bin/env python3
from pathlib import Path
import re

p = Path("native-customer/app/src/main/java/com/freshdelivery/nativecustomer/ui/CustomerViewModel.kt")
t = p.read_text()

new_fn = r'''    /** User-facing edge-function errors — never dump headers/JWT. */
    private fun friendlyEdgeError(raw: String?): String {
        val s = raw?.trim().orEmpty()
        if (s.isEmpty()) return "Αποτυχία σύνδεσης με πληρωμές"
        if (s.contains("NOT_FOUND") || s.contains("was not found")) {
            return "Η υπηρεσία αποθήκευσης κάρτας δεν είναι ενεργή ακόμα."
        }
        if (s.contains("Unauthorized") || s.contains("401")) {
            return "Συνδέσου ξανά για να αποθηκεύσεις κάρτα."
        }
        if (s.length > 180 || s.contains("Authorization") || s.contains("Bearer")) {
            return "Αποτυχία αποθήκευσης κάρτας. Έλεγξε Stripe / edge functions."
        }
        return s.take(160)
    }
'''

pat = re.compile(
    r"    /\*\* User-facing edge-function errors.*?\n    private fun friendlyEdgeError\(raw: String\?\): String \{.*?\n    \}\n",
    re.S,
)
m = pat.search(t)
if not m:
    raise SystemExit("block not found")
p.write_text(t[: m.start()] + new_fn + t[m.end() :])
print("ok simplified friendlyEdgeError")
