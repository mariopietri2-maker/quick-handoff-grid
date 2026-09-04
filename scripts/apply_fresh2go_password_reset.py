#!/usr/bin/env python3
from pathlib import Path
p = Path("supabase/functions/request-password-reset/index.ts")
t = p.read_text(encoding="utf-8")
if "fresh2go.gr" in t:
    print("already")
else:
    t = t.replace(
        '"https://freshdelivery.app",',
        '"https://freshdelivery.app",\n  "https://fresh2go.gr",\n  "https://www.fresh2go.gr",',
        1,
    )
    p.write_text(t, encoding="utf-8")
    print("patched")
