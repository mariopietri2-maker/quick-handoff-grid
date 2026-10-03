#!/usr/bin/env python3
"""Restore customer build.gradle.kts + apk-downloads if wiped empty; else bump to 2.9.22."""
from pathlib import Path
import re
import subprocess

GRADLE = Path("native-customer/app/build.gradle.kts")
APK = Path("src/lib/apk-downloads.ts")

def from_git(path):
    for rev in ("HEAD~1", "HEAD~2", "HEAD~5", "HEAD~10", "origin/main"):
        try:
            out = subprocess.check_output(["git", "show", f"{rev}:{path}"], text=True, stderr=subprocess.DEVNULL)
            if len(out) > 200:
                return out
        except Exception:
            pass
    return None

if not GRADLE.exists() or GRADLE.stat().st_size < 200:
    out = from_git("native-customer/app/build.gradle.kts")
    if out:
        out = re.sub(r"versionCode = \d+", "versionCode = 7233066", out, count=1)
        out = re.sub(r'versionName = "[^"]+"', 'versionName = "2.9.22-fresh2go"', out, count=1)
        GRADLE.write_text(out)
        print("restored gradle from git", len(out))
    else:
        print("FATAL: cannot restore gradle")
else:
    t = GRADLE.read_text()
    t = re.sub(r"versionCode = \d+", "versionCode = 7233066", t, count=1)
    t = re.sub(r'versionName = "[^"]+"', 'versionName = "2.9.22-fresh2go"', t, count=1)
    GRADLE.write_text(t)
    print("bumped gradle", GRADLE.stat().st_size)

if not APK.exists() or APK.stat().st_size < 100:
    out = from_git("src/lib/apk-downloads.ts")
    if out:
        out = re.sub(r"APK_NATIVE_CUSTOMER_VERSION = '[^']+'", "APK_NATIVE_CUSTOMER_VERSION = '2.9.22-fresh2go'", out)
        APK.write_text(out)
        print("restored apk-downloads from git", len(out))
    else:
        print("FATAL: cannot restore apk-downloads")
else:
    t = APK.read_text()
    t = re.sub(r"APK_NATIVE_CUSTOMER_VERSION = '[^']+'", "APK_NATIVE_CUSTOMER_VERSION = '2.9.22-fresh2go'", t)
    APK.write_text(t)
    print("bumped apk-downloads", APK.stat().st_size)
