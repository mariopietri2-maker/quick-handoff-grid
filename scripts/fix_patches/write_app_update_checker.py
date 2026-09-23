#!/usr/bin/env python3
"""Write full AppUpdateChecker.kt (replaces truncated broken copy)."""
import base64
from pathlib import Path

# Full working customer AppUpdateChecker (from driver package, renamed).
B64 = (
    "cGFja2FnZSBjb20uZnJlc2hkZWxpdmVyeS5uYXRpdmVjdXN0b21lci51cGRhdGUKCmltcG9ydCBhbmRyb2lkLmFwcC5Eb3dubG9hZE1hbmFnZXIKaW1wb3J0IGFuZHJvaWQuY29udGVudC5Db250ZXh0CmltcG9ydCBhbmRyb2lkLmNvbnRlbnQuSW50ZW50CmltcG9ydCBhbmRyb2lkLmNvbnRlbnQucG0uUGFja2FnZU1hbmFnZXIKaW1wb3J0IGFuZHJvaWQubmV0LlVyaQppbXBvcnQgYW5kcm9pZC5vcy5CdWlsZAppbXBvcnQgYW5kcm9pZC5vcy5FbnZpcm9ubWVudAppbXBvcnQgYW5kcm9pZC5wcm92aWRlci5TZXR0aW5ncwppbXBvcnQgYW5kcm9pZHguY29yZS5jb250ZW50LkZpbGVQcm92aWRlcgppbXBvcnQgaW8ua3Rvci5jbGllbnQuSHR0cENsaWVudAppbXBvcnQgaW8ua3Rvci5jbGllbnQuZW5naW5lLmFuZHJvaWQuQW5kcm9pZAppbXBvcnQgaW8ua3Rvci5jbGllbnQucmVxdWVzdC5nZXQKaW1wb3J0IGlvLmt0b3IuY2xpZW50LnJlcXVlc3QucGFyYW1ldGVyCmltcG9ydCBpby5rdG9yLmNsaWVudC5zdGF0ZW1lbnQuYm9keUFzVGV4dAppbXBvcnQga290bGlu"
)

def main():
    # Prefer full multi-part B64 from this file if present; else fail clearly.
    path = Path("native-customer/app/src/main/java/com/freshdelivery/nativecustomer/update/AppUpdateChecker.kt")
    # Load full content from companion full file written next to this script
    full = Path("scripts/fix_patches/AppUpdateChecker.customer.kt")
    if full.exists():
        data = full.read_bytes()
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(data)
        print("wrote", path, len(data), "from AppUpdateChecker.customer.kt")
    else:
        print("MISSING scripts/fix_patches/AppUpdateChecker.customer.kt")
        raise SystemExit(1)
    sp = Path("native-customer/app/src/main/java/com/freshdelivery/nativecustomer/ui/SupportScreen.kt")
    if sp.exists():
        lines = sp.read_text().splitlines(True)
        seen, out = set(), []
        for line in lines:
            key = line.strip()
            if key in (
                "import androidx.compose.material3.Button",
                "import androidx.compose.material3.ButtonDefaults",
            ):
                if key in seen:
                    continue
                seen.add(key)
            out.append(line)
        sp.write_text("".join(out))
        print("SupportScreen imports ok")

if __name__ == "__main__":
    main()
