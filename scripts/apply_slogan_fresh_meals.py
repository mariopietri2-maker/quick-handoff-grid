#!/usr/bin/env python3
"""Restore corrupted config and set slogan to Fresh Food. Fast Delivery."""
from pathlib import Path
import re
import subprocess

NEW = "Fresh Food. Fast Delivery."
OLD_VARIANTS = [
    "Fast · Fresh · Local",
    "Fast. Fresh. Local.",
    "Παράγγειλε από τα αγαπημένα σου",
    "Ιωάννινα · Live deliveries",
]

def restore_if_placeholder(path: str) -> None:
    p = Path(path)
    text = p.read_text(encoding="utf-8") if p.exists() else ""
    if text.strip() == "PLACEHOLDER" or len(text) < 50:
        # restore from parent of current HEAD
        raw = subprocess.check_output(
            ["git", "log", "--pretty=%H", "-n", "5", "--", path],
            text=True,
        ).strip().splitlines()
        for sha in raw:
            try:
                content = subprocess.check_output(
                    ["git", "show", f"{sha}:{path}"],
                    text=True,
                    stderr=subprocess.DEVNULL,
                )
            except subprocess.CalledProcessError:
                continue
            if content.strip() and content.strip() != "PLACEHOLDER" and len(content) > 50:
                p.write_text(content, encoding="utf-8")
                print(f"restored {path} from {sha[:8]}")
                return
        raise SystemExit(f"could not restore {path}")

def replace_in(path: str) -> None:
    p = Path(path)
    if not p.exists():
        print("skip missing", path)
        return
    t = p.read_text(encoding="utf-8")
    orig = t
    for old in OLD_VARIANTS:
        t = t.replace(old, NEW)
    if t != orig:
        p.write_text(t, encoding="utf-8")
        print("updated", path)
    else:
        print("unchanged", path)

def bump_gradle(path: str, code: int, name: str) -> None:
    p = Path(path)
    t = p.read_text(encoding="utf-8")
    t = re.sub(r"versionCode = \d+", f"versionCode = {code}", t, count=1)
    t = re.sub(r'versionName = "[^"]+"', f'versionName = "{name}"', t, count=1)
    p.write_text(t, encoding="utf-8")
    print(path, name)

def main() -> None:
    restore_if_placeholder("src/hooks/useCustomerAppConfig.ts")
    targets = [
        "src/hooks/useCustomerAppConfig.ts",
        "src/components/customer/AppSplash.tsx",
        "src/components/admin/CustomerAppCustomization.tsx",
        "native-customer/app/src/main/java/com/freshdelivery/nativecustomer/data/Models.kt",
        "native-customer/app/src/main/java/com/freshdelivery/nativecustomer/ui/SplashScreen.kt",
        "native-customer/app/src/main/java/com/freshdelivery/nativecustomer/ui/LoginScreen.kt",
        "native-driver/app/src/main/java/com/freshdelivery/nativedriver/ui/auth/LoginScreen.kt",
        "native-customer/preview.html",
        "native-customer-preview.html",
    ]
    for path in targets:
        replace_in(path)
    # Login-specific patterns already covered by OLD_VARIANTS
    # NOTE: version pins must always move FORWARD (see src/lib/apk-downloads.ts).
    # Never downgrade versionCode/versionName here — Android rejects downgrades
    # and the self-update checker compares exact versionName strings.
    bump_gradle("native-customer/app/build.gradle.kts", 266, "2.8.3-fresh2go")
    bump_gradle("native-driver/app/build.gradle.kts", 282, "2.6.28-fresh2go")
    apk = Path("src/lib/apk-downloads.ts")
    if apk.exists():
        t = apk.read_text(encoding="utf-8")
        t = t.replace("2.7.2-native", "2.7.3-native").replace("2.6.14-native", "2.6.15-native")
        # also force labels if already other (keep in sync with the pins above)
        t = re.sub(
            r"APK_NATIVE_DRIVER_VERSION = '[^']+'",
            "APK_NATIVE_DRIVER_VERSION = '2.6.28-fresh2go'",
            t,
        )
        t = re.sub(
            r"APK_NATIVE_CUSTOMER_VERSION = '[^']+'",
            "APK_NATIVE_CUSTOMER_VERSION = '2.8.3-fresh2go'",
            t,
        )
        apk.write_text(t, encoding="utf-8")
        print("apk-downloads labels")

if __name__ == "__main__":
    main()
