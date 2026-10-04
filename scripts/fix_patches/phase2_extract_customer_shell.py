#!/usr/bin/env python3
"""Phase 2: extract cart/hero/promo from CustomerShell + disable one-shot workflows."""
from pathlib import Path
import base64
import re

base = Path("native-customer/app/src/main/java/com/freshdelivery/nativecustomer/ui")
blob_dir = Path("scripts/fix_patches")

def write_blob(name: str) -> None:
    b64_path = blob_dir / f"_blob_{name}.b64"
    if not b64_path.exists():
        print("missing blob", name)
        return
    data = base64.b64decode(b64_path.read_text().strip())
    base.joinpath(name).write_bytes(data)
    print("wrote", name, len(data))

for n in ("FreshCartBar.kt", "StoreHeroImage.kt", "PromoCarousel.kt"):
    write_blob(n)

shell_p = base / "CustomerShell.kt"
shell = shell_p.read_text()

def strip_fun(src: str, name: str, next_markers: list) -> str:
    token = f"@Composable\nprivate fun {name}("
    start = src.find(token)
    if start < 0:
        print(name, "already extracted or missing")
        return src
    end = len(src)
    for m in next_markers:
        i = src.find(m, start + 10)
        if i > start:
            end = min(end, i)
    print(f"stripping {name} bytes={end-start}")
    return src[:start] + f"// {name} extracted to {name}.kt\n\n" + src[end:]

shell = strip_fun(shell, "FreshCartBar", ["@Composable\nprivate fun StoreHeroImage", "@Composable\nprivate fun HomeTab"])
shell = strip_fun(shell, "StoreHeroImage", ["@Composable\nprivate fun HomeTab"])
shell = strip_fun(shell, "PromoCarousel", [])
shell_p.write_text(shell)
print("CustomerShell lines", shell.count("\n"))

for name in [
    "wire-advertising-admin.yml",
    "wire-driver-offer-sounds.yml",
    "wire-offer-and-banner.yml",
    "wire-store-call-notify-ui.yml",
    "wire-store-registry.yml",
    "sed-wire-finish.yml",
    "patch-customer-home.yml",
    "patch-offer-customer-pin.yml",
]:
    fp = Path(".github/workflows") / name
    if not fp.exists():
        continue
    wt = fp.read_text()
    if "if: false # phase2-disabled" in wt:
        print("already disabled", name)
        continue
    wt2 = re.sub(r"(jobs:\s*\n\s+\w+:\s*\n)", r"\1    if: false # phase2-disabled\n", wt, count=1)
    if wt2 == wt:
        wt2 = "# phase2-disabled\n" + wt
    fp.write_text(wt2)
    print("disabled", name)

Path(".github/workflows_archived").mkdir(exist_ok=True)
Path(".github/workflows_archived/README.md").write_text(
    "# Archived workflows (Phase 2)\nOne-shot wire/sed/patch workflows disabled via if: false.\n"
)
print("phase2 extract done")
