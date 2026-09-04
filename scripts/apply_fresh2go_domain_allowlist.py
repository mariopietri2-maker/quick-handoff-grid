#!/usr/bin/env python3
from pathlib import Path

EXTRA = [
    "'https://fresh2go.gr/*',",
    "'https://www.fresh2go.gr/*',",
]

def patch_cap(path: str) -> None:
    p = Path(path)
    t = p.read_text(encoding="utf-8")
    if "fresh2go.gr" in t:
        print("ok", path)
        return
    needle = "'https://freshdelivery.app/*',"
    if needle not in t:
        print("skip", path)
        return
    insert = needle + "\n      " + "\n      ".join(EXTRA)
    p.write_text(t.replace(needle, insert, 1), encoding="utf-8")
    print("patched", path)

def main() -> None:
    for f in [
        "capacitor.config.ts",
        "capacitor.store.config.ts",
        "capacitor.driver.config.ts",
    ]:
        patch_cap(f)
    p = Path("supabase/functions/request-password-reset/index.ts")
    t = p.read_text(encoding="utf-8")
    if "fresh2go.gr" not in t:
        t = t.replace(
            '"https://freshdelivery.app",',
            '"https://freshdelivery.app",\n  "https://fresh2go.gr",\n  "https://www.fresh2go.gr",',
            1,
        )
        p.write_text(t, encoding="utf-8")
        print("password-reset")
    doc = Path("docs/FRESH2GO_DOMAIN_SETUP.md")
    if not doc.exists():
        print("missing setup doc")

if __name__ == "__main__":
    main()
