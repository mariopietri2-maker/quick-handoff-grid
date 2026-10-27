#!/usr/bin/env python3
from pathlib import Path
p = Path("native-customer/app/src/main/java/com/freshdelivery/nativecustomer/ui/CustomerViewModel.kt")
t = p.read_text()
old = '''    /** User-facing edge-function errors — never dump headers/JWT. */
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
        Regex(""message"\s*:\s*"([^"]+)"").find(s)?.groupValues?.getOrNull(1)?.let {
            return it
        }
        Regex(""error"\s*:\s*"([^"]+)"").find(s)?.groupValues?.getOrNull(1)?.let {
            return it
        }
        // Strip huge dumps
        if (s.length > 180 || s.contains("Authorization") || s.contains("Bearer")) {
            return "Αποτυχία αποθήκευσης κάρτας. Έλεγξε Stripe / edge functions."
        }
        return s
    }'''

# Match whatever broken form is on disk more loosely
import re
pat = re.compile(
    r"    /\*\* User-facing edge-function errors[\s\S]*?private fun friendlyEdgeError\(raw: String\?\): String \{[\s\S]*?\n    \}\n",
    re.M,
)
new = '''    /** User-facing edge-function errors — never dump headers/JWT. */
    private fun friendlyEdgeError(raw: String?): String {
        val s = raw?.trim().orEmpty()
        if (s.isEmpty()) return "Αποτυχία σύνδεσης με πληρωμές"
        if (s.contains("NOT_FOUND") || s.contains("was not found")) {
            return "Η υπηρεσία αποθήκευσης κάρτας δεν είναι ενεργή ακόμα."
        }
        if (s.contains("Unauthorized") || s.contains("401")) {
            return "Συνδέσου ξανά για να αποθηκεύσεις κάρτα."
        }
        // Prefer short JSON message= without fragile Regex string escaping
        val msgKey = s.indexOf("\"message\"")
        if (msgKey >= 0) {
            val after = s.substring(msgKey + 9)
            val q1 = after.indexOf('\"')
            if (q1 >= 0) {
                val q2 = after.indexOf('\"', q1 + 1)
                if (q2 > q1) {
                    val extracted = after.substring(q1 + 1, q2)
                    if (extracted.isNotBlank() && extracted.length < 160) return extracted
                }
            }
        }
        if (s.length > 180 || s.contains("Authorization") || s.contains("Bearer")) {
            return "Αποτυχία αποθήκευσης κάρτας. Έλεγξε Stripe / edge functions."
        }
        return s.take(160)
    }
'''
m = pat.search(t)
if not m:
    raise SystemExit('friendlyEdgeError block not found')
p.write_text(t[:m.start()] + new + t[m.end():])
print('fixed friendlyEdgeError')
