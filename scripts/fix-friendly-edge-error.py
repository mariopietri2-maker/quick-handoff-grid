#!/usr/bin/env python3
"""Replace entire friendlyEdgeError with a compile-safe version."""
from pathlib import Path
import re

p = Path("native-customer/app/src/main/java/com/freshdelivery/nativecustomer/ui/CustomerViewModel.kt")
t = p.read_text()

# Kill any existing friendlyEdgeError function body
pat = re.compile(
    r"[ \t]*/\*\* User-facing edge-function errors[\s\S]*?"
    r"private fun friendlyEdgeError\(raw: String\?\): String \{[\s\S]*?\n    \}\n",
)
new = (
    "    /** User-facing edge-function errors — never dump headers/JWT. */\n"
    "    private fun friendlyEdgeError(raw: String?): String {\n"
    "        val s = raw?.trim().orEmpty()\n"
    "        if (s.isEmpty()) return \"Αποτυχία σύνδεσης με πληρωμές\"\n"
    "        if (s.contains(\"NOT_FOUND\") || s.contains(\"was not found\")) {\n"
    "            return \"Η υπηρεσία αποθήκευσης κάρτας δεν είναι ενεργή ακόμα.\"\n"
    "        }\n"
    "        if (s.contains(\"Unauthorized\") || s.contains(\"401\")) {\n"
    "            return \"Συνδέσου ξανά για να αποθηκεύσεις κάρτα.\"\n"
    "        }\n"
    "        if (s.length > 180 || s.contains(\"Authorization\") || s.contains(\"Bearer\")) {\n"
    "            return \"Αποτυχία αποθήκευσης κάρτας. Έλεγξε Stripe / edge functions.\"\n"
    "        }\n"
    "        return s.take(160)\n"
    "    }\n"
)
m = pat.search(t)
if not m:
    # fallback: replace the broken indexOf line only
    if 'indexOf(""message"")' in t or 'indexOf(""message"")' in t:
        pass
    # try literal broken form from raw github
    broken_forms = [
        'val msgKey = s.indexOf(""message"")',
        'val msgKey = s.indexOf("\"message\"")',
    ]
    found = False
    for b in broken_forms:
        if b in t:
            # delete from msgKey block through return extracted
            t2 = re.sub(
                r"        // Prefer short JSON[\s\S]*?return s\.take\(160\)\n",
                "        return s.take(160)\n",
                t,
                count=1,
            )
            if t2 == t:
                t2 = re.sub(
                    r"        val msgKey = s\.indexOf\([\s\S]*?return s\.take\(160\)\n",
                    "        return s.take(160)\n",
                    t,
                    count=1,
                )
            p.write_text(t2)
            print("fallback strip msgKey")
            found = True
            break
    if not found:
        raise SystemExit("friendlyEdgeError not found")
else:
    p.write_text(t[: m.start()] + new + t[m.end() :])
    print("replaced full function")

# Verify no empty string concat that breaks Kotlin
final = p.read_text()
if 'indexOf(""' in final or 'Regex(""' in final:
    # last resort nuclear: line-filter
    lines = final.splitlines(keepends=True)
    out = []
    skip = False
    depth = 0
    for line in lines:
        if "private fun friendlyEdgeError" in line:
            skip = True
            depth = 0
            out.append(
                "    private fun friendlyEdgeError(raw: String?): String {\n"
                "        val s = raw?.trim().orEmpty()\n"
                "        if (s.isEmpty()) return \"Αποτυχία σύνδεσης με πληρωμές\"\n"
                "        if (s.length > 180 || s.contains(\"Bearer\") || s.contains(\"Authorization\")) {\n"
                "            return \"Αποτυχία αποθήκευσης κάρτας\"\n"
                "        }\n"
                "        if (s.contains(\"NOT_FOUND\")) return \"Υπηρεσία κάρτας μη διαθέσιμη\"\n"
                "        return s.take(160)\n"
                "    }\n"
            )
            continue
        if skip:
            depth += line.count("{") - line.count("}")
            if depth <= 0 and "}" in line:
                skip = False
            continue
        out.append(line)
    p.write_text("".join(out))
    print("nuclear rewrite")
print("done")
