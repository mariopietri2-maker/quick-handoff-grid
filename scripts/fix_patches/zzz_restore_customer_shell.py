#!/usr/bin/env python3
"""Restore CustomerShell if truncated; keep cart + modifier fixes from good parent."""
from pathlib import Path
import subprocess

path = Path("native-customer/app/src/main/java/com/freshdelivery/nativecustomer/ui/CustomerShell.kt")
size = path.stat().st_size if path.exists() else 0
print("current size", size)

def show(rev):
    try:
        return subprocess.check_output(
            ["git", "show", f"{rev}:native-customer/app/src/main/java/com/freshdelivery/nativecustomer/ui/CustomerShell.kt"],
            text=True,
            stderr=subprocess.DEVNULL,
        )
    except Exception:
        return None

# Prefer a full copy (>= 170k) with Scaffold + FreshCartBar
candidates = []
for rev in ("HEAD~1", "HEAD~2", "HEAD~3", "ec61add", "f71182a", "origin/main~1"):
    t = show(rev)
    if t and len(t) >= 170000 and "Scaffold(" in t and "fun FreshCartBar" in t:
        candidates.append((rev, t))
        print("candidate", rev, len(t))

if not candidates:
    print("no candidate")
else:
    # pick largest
    rev, t = max(candidates, key=lambda x: len(x[1]))
    if size < 170000 or "Scaffold(" not in path.read_text():
        path.write_text(t)
        print("restored from", rev, len(t))
    else:
        print("already ok")

# Ensure closeStore clears modifier picker
vm = Path("native-customer/app/src/main/java/com/freshdelivery/nativecustomer/ui/CustomerViewModel.kt")
if vm.exists():
    vt = vm.read_text()
    old = "fun closeStore() {\n        _state.value = _state.value.copy(selectedStore = null, menu = emptyList())"
    new = "fun closeStore() {\n        _state.value = _state.value.copy(selectedStore = null, menu = emptyList(), menuModifiers = emptyMap(), modifierPickerItem = null)"
    if old in vt:
        vm.write_text(vt.replace(old, new, 1))
        print("closeStore updated")
    elif "modifierPickerItem = null" in vt:
        print("closeStore already")
    else:
        print("closeStore pattern miss")
